import { log } from "@/browser/log.browser";
import { reconcile } from "@/browser/reconcile.browser";

/**
 * Used to select a frame within the document, which is either the document's body element
 * or the id of a `hy-frame` element, in which case the frame id is expected to be unique.
 */
export type FrameSelector = string;

/**
 * Simulates a full page navigation to a route by first pushing a new entry onto the browser's
 * history stack with the route's URL and then loads the route to update the selected frame.
 *
 * Note that we make the history change first to simulate the native browser behavior. In case of an
 * error or a long loading time, the URL is already updated, so a browser reload will then reload the
 * new  URL instead of the old one.
 *
 * If the server's response to the route is a redirect, the redirect is followed automatically. In
 * that case, the previously pushed history entry is replaced with the new URL after the redirected
 * response is fetched. This is different from the normal browser behavior, where the history stack
 * is updated before requested the redirected URL. Due to security considerations, this behavior
 * cannot be reimplemented with JavaScript.
 *
 * @param frameSelector Selects the frame that should be updated.
 * @param routeUrl The URL of the route that should be loaded and navigated to.
 */
export async function navigateToRoute(
    frameSelector: FrameSelector,
    routeUrl: string,
): Promise<void> {
    return withHistoryUpdate(frameSelector, routeUrl, (frame, signal) =>
        fetchRoute(frame, routeUrl, signal),
    );
}

/**
 * Simulates a full page navigation while also executing the given action. The selected frame is
 * updated with the action's response HTML. Before the action is invoked, the given route URL is
 * pushed onto the browser's history stack. The server must serve a route at this URL, otherwise
 * the browser's reload behavior is broken because such a reload always issues a GET request for a
 * route instead of a POST request to an action.
 *
 * Note that we make the history change first to simulate the browser behavior. In case of an error
 * or a long loading time, the URL is already updated, so a browser reload will then reload the new
 * URL instead of the old one. In that case, however, it is unclear whether the action has already
 * been carried out, will be carried out eventually, or whether it never reached the server in the
 * first place. This behavior is somewhat different from the native browser behavior, which would
 * re-issue the POST request again in such a situation, typically after warning the user that she
 * is about to send the data again. So also in that case, the user does not know whether the action
 * is carried out twice.
 *
 * If the server's response to the route is a redirect, the redirect is followed automatically. In
 * that case, the previously pushed history entry is replaced with the new URL after the redirected
 * response is fetched. This is different from the normal browser behavior, where the history stack
 * is updated before requested the redirected URL. Due to security considerations, this behavior
 * cannot be reimplemented with JavaScript.
 *
 * @param frameSelector Selects the frame that should be updated.
 * @param actionUrl The URL of the action that should be executed.
 * @param actionParams The action's URL encoded params.
 * @param routeUrlForHistory The route URL that should be pushed onto the browser's history stack.
 */
export function navigateToAction(
    frameSelector: FrameSelector,
    actionUrl: string,
    actionParams: string,
    routeUrlForHistory: string,
): Promise<void> {
    return withHistoryUpdate(frameSelector, routeUrlForHistory, (frame, signal) =>
        fetchAction(frame, actionUrl, actionParams, signal),
    );
}

/**
 * Updates a frame using the given fetch callback, taking care of the necessary history updates.
 */
async function withHistoryUpdate(
    frameSelector: FrameSelector,
    historyUrl: string,
    fetch: (frame: Element, signal: AbortSignal) => Promise<Response>,
): Promise<void> {
    // Update the history immediately to simulate the native browser behavior.
    const thisNavigationId = ++navigationId;
    history.pushState({ [navigationIdKey]: thisNavigationId }, "", historyUrl);

    let response: Response = undefined!;
    await updateFrame(frameSelector, async (frame, signal) => {
        response = await fetch(frame, signal);
        return extractFrameFromResponse(frame, response);
    });

    // For redirected responses, replace the previously pushed history entry to mimic the native
    // browser behavior as best as we can (but see also the remarks for `navigateToAction`). To
    // prevent a race condition where multiple concurrent navigations to routes or actions overlap,
    // we only replace the history entry if the previously pushed one is still topmost.
    if (response.redirected && history.state[navigationIdKey] === thisNavigationId) {
        history.replaceState(null, "", response.url);
    }
}

/**
 * Loads the HTML for the given `routeUrl` and updates the selected frame accordingly.
 * @param frameSelector Selects the frame that should be updated.
 * @param routeUrl The URL of the route that should be loaded.
 */
export function loadRoute(frameSelector: FrameSelector, routeUrl: string): Promise<void> {
    return updateFrame(frameSelector, async (frame, signal) =>
        extractFrameFromResponse(frame, await fetchRoute(frame, routeUrl, signal)),
    );
}

/**
 * Executes the given action and updates the selected frame based on the returned HTML.
 * @param frameSelector Selects the frame that should be updated.
 * @param actionUrl The URL of the action that should be executed.
 * @param actionParams The action's URL encoded params.
 */
export async function executeAction(
    frameSelector: FrameSelector,
    actionUrl: string,
    actionParams: string,
): Promise<void> {
    return updateFrame(frameSelector, async (frame, signal) =>
        extractFrameFromResponse(frame, await fetchAction(frame, actionUrl, actionParams, signal)),
    );
}

/**
 * Updates the contents of the selected frame with the element returned by the given callback.
 * Ensures that only one update can be in-flight concurrently for the frame. If a new update is issued
 * before a previous one finished, the previous one is immediately aborted so that it can't have any
 * effect on the frame anymore and the new update is started immediately. After a successful update,
 * all pending updates for any of the frame's transitive child frames are aborted.
 * @param frameSelector Selects the frame that should be updated.
 * @param getFrameElement A callback that returns the HTML element the frame should be updated with.
 *                        The callback should use the given `AbortSignal` to abort the update as soon
 *                        as possible once a newer update is started.
 */
export async function updateFrame(
    frameSelector: FrameSelector,
    getFrameElement: (frame: Element, abortSignal: AbortSignal) => Promise<Element>,
): Promise<void> {
    const frame = document.querySelector(frameSelector);
    if (!frame) {
        // Obviously, we'll always find the `body` element of a document, so this can only happen for
        // incorrect/unknown ids.
        throw new Error(`Frame '${frameSelector}' not found.`);
    }

    await abortPreviousUpdate(frame);

    // Collect the frame's direct and indirect frame children transitively from the DOM. We have to
    // do this before the update, as the current children, for which we later cancel all pending
    // updates, might no longer be part of the DOM afterwards. We must cancel child frame updates
    // because the current frame might have new frame children with the same child frame ids as
    // before, but the updates for the old child frames should not affect the new child frames.
    const childFrames = [...document.querySelectorAll("hy-frame")].filter(
        (frame) => frame !== frame && frame.contains(frame),
    );

    // Start the new update and store it and a new abort controller as a pending update of the frame,
    // so that the next update can cancel this update, if necessary.
    const abortController = new AbortController();
    const newFramePromise = getFrameElement(frame, abortController.signal);
    pendingUpdates.set(frame, [abortController, newFramePromise]);

    // Once the update is completed, reconcile the changes from the new frame and abort all child
    // frame updates and wait for their completion.
    reconcile(frame, await newFramePromise);
    await Promise.all(childFrames.map(abortPreviousUpdate));
}

/**
 * Used to parse the HTML returned from the server. Since we use the document's body as an implicit
 * top-level frame, we can't rely on the DOM's `DocumentFragment` API, as that removes the `head` and
 * `body` elements during parsing, which would unnecessarily complicate things for us. On the other
 * hand, the `DOMParser` always introduces a `html`, `head`, and `body` even for partial responses,
 * which we can silently ignore.
 */
const parseHTML = (() => {
    const parser = new DOMParser();
    return async (response: Response) => {
        const contentType = response.headers.get("content-type") ?? "<unknown>";
        if (!contentType.startsWith("text/html")) {
            throw new Error(`Expected content-type 'text/html' instead of '${contentType}'.`);
        }

        return parser.parseFromString(await response.text(), "text/html");
    };
})();

/**
 * Maps an element representing a frame to the abort controller of the last frame update. Using
 * a weak map ensures that there are no memory leaks when the element is eventually removed
 * from the UI and could thus be garbage collected.
 */
const pendingUpdates = new WeakMap<Element, [AbortController, Promise<Element>]>();

/**
 * Aborts any previous update, if there is one, that might or might not still be in progress and wait
 * for its completion. Any errors of the previous update are silently discarded.
 */
async function abortPreviousUpdate(frame: Element) {
    const [previousSignal, previousPromise] = pendingUpdates.get(frame) ?? [];
    previousSignal?.abort();

    try {
        await previousPromise;
    } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") {
            // This is an expected error, e.g., when a fetch request is aborted.
        } else {
            // We do not propagate all other errors, as the previous update was only canceled
            // and we're about to update the frame anyway. Otherwise, we might get into a situation
            // where we can never update a frame again.
            log.warn(`An error occurred in an aborted frame update: ${e}`);
        }
    }
}

/**
 * Fetches a route URL with offline handling.
 */
function fetchRoute(frame: Element, routeUrl: string, signal: AbortSignal) {
    return fetchFrame(frame, routeUrl, {
        signal,
        headers: { "x-hytts": "true" },
    });
}

/**
 * Fetches an action URL with offline handling.
 */
function fetchAction(frame: Element, actionUrl: string, actionParams: string, signal: AbortSignal) {
    return fetchFrame(frame, actionUrl, {
        method: "post",
        body: actionParams,
        signal,
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            // see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#use-of-custom-request-headers
            "x-hytts": "true",
        },
    });
}

/**
 * Wraps the `fetch` function, raising the `hy:offline` event on the frame if the browser seems to
 * be unable to reach the server (no internet connection, server is down, ...).
 */
async function fetchFrame(frame: Element, url: string, fetchOptions: RequestInit) {
    try {
        return await fetch(url, fetchOptions);
    } catch (e: unknown) {
        if (e instanceof TypeError) {
            // This indicates a generic network error, where the server is unreachable for some
            // reason (the server might be down, there might be no internet connection, ...).
            // In this case, we report the error on the frame as a bubbling event; typically,
            // there is a top-level error handler for the offline scenario.
            frame.dispatchEvent(new Event("hy:offline", { bubbles: true }));
        }

        // Rethrow the error to abort the frame update. In the offline case, the typical reaction
        // is to continue displaying the previous contents and show some sort of "offline" overlay.
        throw e;
    }
}

/**
 * Extracts the new frame contents from the server's HTML response. If the frame cannot be found in the
 * response, raises the `hy:missing-frame` event. If the server response's status code indicates that
 * an error occurred, the default behavior is to replace the frame's content with the server response.
 * This situation typically happens for errors raised by the app context or the router, and the default
 * behavior scopes these errors to the frame being updated. An event handler of the `hy:frame-missing`
 * event can call `preventDefault()` on the event instance to disable this default behavior. When
 * the default is disabled, or the server response has a success status code, the frame's contents
 * remain unchanged and an error is raised to cancel the frame update.
 */
async function extractFrameFromResponse(frame: Element, response: Response): Promise<Element> {
    const document = await parseHTML(response);
    const selector = frame instanceof HTMLBodyElement ? "body" : `#${frame.id}`;
    const newFrameElement = document.querySelector(selector);

    if (!newFrameElement) {
        const updateFrameForErrorResponses = frame.dispatchEvent(
            new CustomEvent("hy:frame-missing", {
                bubbles: true,
                cancelable: true,
                detail: { response, newFrameElement },
            }),
        );

        if (updateFrameForErrorResponses && response.status >= 300) {
            // The default behavior is to show the entire server response within the frame.
            // For reconciliation to work correctly later on, we have to clone the current
            // frame's node first and copy the new documents body's children over.
            const newFrame = frame.cloneNode() as HTMLElement;
            newFrame.replaceChildren(...document.body.children);
            return newFrame;
        } else {
            throw new Error(`Frame '${selector}' not found in the server's response.`);
        }
    }

    return newFrameElement;
}

let navigationId = 0;
const navigationIdKey = "hyNavigationId";

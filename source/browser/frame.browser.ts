import { log } from "$/log.browser";
import { reconcile } from "$/reconcile.browser";

/**
 * Used to select a frame within the document, which is either the document's body element or the id
 * of a `hy-frame` element, in which case the frame id is expected to be unique.
 */
export type FrameSelector = string;

/**
 * Updates the contents of the selected frame with the element returned by the given callback.
 * Ensures that only one update can be in-flight concurrently for the frame. If a new update is
 * issued before a previous one finished, the previous one is immediately aborted so that it can't
 * have any effect on the frame anymore and the new update is started immediately. After a
 * successful update, all pending updates for any of the frame's transitive child frames are
 * aborted.
 *
 * @param frameSelector Selects the frame that should be updated.
 * @param getFrameElement A callback that returns the HTML element the frame should be updated with.
 *   The callback should use the given `AbortSignal` to abort the update as soon as possible once a
 *   newer update is started.
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
        (childFrame) => childFrame !== frame && frame.contains(childFrame),
    );

    // Start the new update and store it and a new abort controller as a pending update of the frame,
    // so that the next update can cancel this update, if necessary.
    const abortController = new AbortController();
    const newFramePromise = getFrameElement(frame, abortController.signal);
    pendingUpdates.set(frame, [abortController, newFramePromise]);

    // Once the update is completed, reconcile the changes from the new frame and abort all child
    // frame updates and wait for their completion.
    abortController.signal.throwIfAborted();
    reconcile(frame, await newFramePromise);
    await Promise.all(childFrames.map(abortPreviousUpdate));
}

/**
 * Maps an element representing a frame to the abort controller of the last frame update. Using a
 * weak map ensures that there are no memory leaks when the element is eventually removed from the
 * UI and could thus be garbage collected.
 */
const pendingUpdates = new WeakMap<Element, [AbortController, Promise<Element>]>();

/**
 * Aborts any previous update, if there is one, that might or might not still be in progress and
 * wait for its completion. Any errors of the previous update are silently discarded.
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
 * Wraps the `fetch` function, raising the `hy:offline` event on the frame if the browser seems to
 * be unable to reach the server (no internet connection, server is down, ...). Returns the server's
 * response as well as the parsed HTML element representing the frame.
 */
export async function fetchFrame(frame: Element, url: string, fetchOptions: RequestInit) {
    try {
        const response = await fetch(url, fetchOptions);
        return {
            response,
            frameElement: await extractFrameFromResponse(frame, response, fetchOptions.signal),
        };
    } catch (e: unknown) {
        if (e instanceof TypeError) {
            // This indicates a generic network error, where the server is unreachable for some
            // reason (the server might be down, there might be no internet connection, ...).
            // In this case, we report the error on the frame as a bubbling event; typically,
            // there is a top-level error handler for the offline scenario.
            frame.dispatchEvent(new CustomEvent("hy:offline", { bubbles: true, cancelable: true }));
        }

        // Rethrow the error to abort the frame update. In the offline case, the typical reaction
        // is to continue displaying the previous contents and show some sort of "offline" overlay.
        throw e;
    }
}

/**
 * Extracts the new frame contents from the server's HTML response. If the frame cannot be found in
 * the response, raises the `hy:missing-frame` event. If the server response's status code indicates
 * that an error occurred, the default behavior is to replace the frame's content with the server
 * response. This situation typically happens for errors raised by the app context or the router,
 * and the default behavior scopes these errors to the frame being updated. An event handler of the
 * `hy:frame-missing` event can call `preventDefault()` on the event instance to disable this
 * default behavior. When the default is disabled, or the server response has a success status code,
 * the frame's contents remain unchanged and an error is raised to cancel the frame update.
 */
async function extractFrameFromResponse(
    frame: Element,
    response: Response,
    signal: AbortSignal | null | undefined,
): Promise<Element> {
    const document = await parseHTML(response);

    signal?.throwIfAborted();

    const selector = frame instanceof HTMLBodyElement ? "body" : `#${frame.id}`;
    const newFrameElement = document.querySelector(selector);

    if (!newFrameElement) {
        const updateFrameForErrorResponses = frame.dispatchEvent(
            new CustomEvent("hy:frame-missing", {
                bubbles: true,
                cancelable: true,
                detail: { response, document },
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

/**
 * Used to parse the HTML returned from the server. Since we use the document's body as an implicit
 * top-level frame, we can't rely on the DOM's `DocumentFragment` API, as that removes the `head`
 * and `body` elements during parsing, which would unnecessarily complicate things for us. On the
 * other hand, the `DOMParser` always introduces a `html`, `head`, and `body` even for partial
 * responses, which we can silently ignore.
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

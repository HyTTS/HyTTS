import { log } from "$/log.browser";
import { reconcile } from "$/reconcile.browser";

/** The well-known id of the root frame, right below the document's body. */
export const rootFrameId = "root";

/**
 * Used to select a `hy-frame` element within the document. It is assumed that there always is a
 * root frame directly below the document's body.
 */
export type FrameId = string;

/**
 * Updates the contents of the frame with the element returned by the given callback. Ensures that
 * only one update can be in-flight concurrently for the frame. If a new update is issued before a
 * previous one finished, the previous one is immediately aborted so that it can't have any effect
 * on the frame anymore and the new update is started immediately. After a successful update, all
 * pending updates for any of the frame's transitive child frames are aborted.
 *
 * @param frameId The id of the frame that should be updated.
 * @param getFrameElement A callback that returns the HTML element the frame should be updated with.
 *   If `undefined` is returned, the frame's content remains unmodified. The callback should use the
 *   given `AbortSignal` to abort the update as soon as possible once a newer update is started.
 */
export function updateFrame(
    frameId: FrameId,
    getFrameElement: (frame: Element, abortSignal: AbortSignal) => Promise<Element | undefined>,
): Promise<void> {
    const frame = document.getElementById(frameId);
    if (!frame || frame.tagName.toLowerCase() !== "hy-frame") {
        throw new Error(`Frame '${frameId}' not found.`);
    }

    // Start the new update and store it and a new abort controller as a pending update of the frame,
    // so that the next update can cancel this update, if necessary.
    const abortController = new AbortController();
    const updateFramePromise = (async () => {
        // Await the abortion of all previous updates of this frame so that there is only a single
        // frame update in-flight at a given time.
        await abortPreviousUpdate(frame);

        // Collect the frame's direct and indirect frame children transitively from the DOM. We have to
        // do this before the update, as the current children, for which we later cancel all pending
        // updates, might no longer be part of the DOM afterwards. We must cancel child frame updates
        // because the current frame might have new frame children with the same child frame ids as
        // before, but the updates for the old child frames should not affect the new child frames.
        const childFrames = [...document.querySelectorAll("hy-frame")].filter(
            (childFrame) => childFrame !== frame && frame.contains(childFrame),
        );

        const newFrame = await getFrameElement(frame, abortController.signal);

        // Once the new frame content is available, reconcile the changes from the new frame and abort
        // all child frame updates so that we reach a steady state again.
        if (newFrame) {
            abortController.signal.throwIfAborted();

            reconcile(frame, newFrame);
            await Promise.all(childFrames.map(abortPreviousUpdate));
        }
    })();

    pendingUpdates.set(frame, [abortController, updateFramePromise]);
    return updateFramePromise;
}

/**
 * Maps an element representing a frame to the abort controller of the last frame update. Using a
 * weak map ensures that there are no memory leaks when the frame element is eventually removed from
 * the DOM and can thus be garbage collected.
 */
const pendingUpdates = new WeakMap<Element, [AbortController, Promise<void>]>();

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
 * Wraps the `fetch` function, raising the `hy:fetch-error` event on the frame if the browser seems
 * to be unable to reach the server (no internet connection, server is down, ...).
 */
export async function fetchFrame(frame: Element, url: string, fetchOptions: RequestInit) {
    try {
        return await fetch(url, {
            ...fetchOptions,
            headers: {
                ...fetchOptions.headers,
                // see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#use-of-custom-request-headers
                "x-hy": "true",
                "x-hy-frame-id": frame.getAttribute("id") ?? "error: unknown frame id",
                ...(!fetchOptions.method || fetchOptions.method === "GET"
                    ? {}
                    : { "content-type": "application/x-www-form-urlencoded" }),
            },
        });
    } catch (error: unknown) {
        if (isNetworkError(error)) {
            // We report an `hy:fetch-error` error on the frame as a bubbling event; typically, there is
            // a top-level error handler for the offline scenario.
            frame.dispatchEvent(
                new CustomEvent("hy:fetch-error", {
                    bubbles: true,
                    cancelable: true,
                    detail: { error },
                }),
            );
        }

        // Rethrow the error to abort the frame update.
        throw error;
    }
}

/**
 * Checks whether the error indicates that a `fetch` request failed due to a generic network error,
 * where the server is unreachable for some reason (the server might be down, there might be no
 * internet connection, ...).
 *
 * It is a major design flaw of the `fetch` API that it is not possible to distinguish between
 * malformed parameters and network errors: In both cases, a `TypeError` is thrown. We here assume
 * that all `TypeError`s are actually network errors, which s safe to do, because everyone fixes all
 * bugs before new code reaches production ;)
 *
 * See also https://developer.mozilla.org/en-US/docs/Web/API/fetch#exceptions
 */
function isNetworkError(e: unknown): e is TypeError {
    return e instanceof TypeError;
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
export async function extractFrameFromResponse(
    frame: Element,
    response: Response,
    signal: AbortSignal | null | undefined,
): Promise<Element> {
    try {
        const document = await parseHTML(response);

        signal?.throwIfAborted();

        const frameId = frame.getAttribute("id") ?? "";
        const newFrameElement = document.getElementById(frameId);

        if (!newFrameElement || newFrameElement.tagName.toLowerCase() !== "hy-frame") {
            const updateFrameForErrorResponses = frame.dispatchEvent(
                new CustomEvent("hy:frame-missing", {
                    bubbles: true,
                    cancelable: true,
                    detail: { response, document },
                }),
            );

            const message = `Frame '${frameId}' not found in the server's response.`;
            if (updateFrameForErrorResponses && response.status >= 300) {
                log.warn(message);

                // The default behavior is to show the entire server response within the frame.
                // For reconciliation to work correctly later on, we have to clone the current
                // frame's node first and copy the new documents body's children over. That way,
                // the frame remains in the DOM and reconciliation replaces all of its contents
                // with the server response.
                const newFrame = frame.cloneNode() as HTMLElement;
                newFrame.replaceChildren(...document.body.children);
                return newFrame;
            } else {
                throw new Error(message);
            }
        }

        return newFrameElement;
    } catch (error: unknown) {
        // We report an `hy:fetch-error` error on the frame as a bubbling event; typically, there is
        // a top-level error handler for all fetch-related problems.
        frame.dispatchEvent(
            new CustomEvent("hy:fetch-error", {
                bubbles: true,
                cancelable: true,
                detail: { error },
            }),
        );

        // Rethrow the error to abort the frame update.
        throw error;
    }
}

/** Parses the HTML returned from the server. */
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

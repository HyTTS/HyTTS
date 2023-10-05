import { createFormRequestBody } from "$/form.browser";
import {
    extractFrameFromResponse,
    fetchFrame,
    type FrameId,
    rootFrameId,
    updateFrame,
} from "$/frame.browser";
import type { HttpMethod } from "@/http/http-context";

export type NavigationOptions = {
    /** The URL that should be navigated to. */
    readonly href: string;
    /** The HTTP method that should be used for the request to the server. */
    readonly httpMethod: HttpMethod;
    /** The URL-encoded body parameters that should be sent with the (non-`GET`) request. */
    readonly bodyParams?: string;
    /**
     * The URL that should be pushed onto the history stack if `updateHistory` is `true`. Defaults
     * to the `href` prop if `historyHref` is `undefined`.
     */
    readonly historyHref?: string;
    /**
     * If `true`, updates the browser's history stack. Defaults to `true` for requests targeting the
     * root frame.
     */
    readonly updateHistory?: boolean;
    /** Selects the frame that should be updated. */
    readonly frameId: FrameId;
};

/**
 * Simulates a full page navigation to a URL by, optionally, first pushing a new entry onto the
 * browser's history stack and then requests the server-rendered HTML to update the selected frame.
 *
 * When navigating to a non-`GET` route and a history entry is pushed onto the stack, the server
 * must serve a `GET` route at this URL, otherwise the browser's reload behavior is broken because
 * such a reload always issues a GET request as opposed to using the original HTTP method.
 *
 * Note that we make the history change first to simulate the native browser behavior. In case of an
 * error or a long loading time, the URL is already updated, so a browser reload will then reload
 * the new URL instead of the old one.
 *
 * When a navigation is aborted, e.g., due to a browser reload, for which the server potentially
 * carries out side effects (which typically happens for POST requests), it is unclear whether the
 * side effects have already been carried out, will be carried out eventually, or whether the
 * request never reached the server in the first place. In this case, the HyTTS behavior for browser
 * reloads is somewhat different from the native browser behavior, which would re-issue the POST
 * request again, typically after warning the user that she is about to send the data again. With
 * HyTTS, by contrast, a GET request to the URL pushed onto the history stack is executed instead.
 * Neither the browser's behavior nor HyTTS's behavior is ideal in that case, as the user has no
 * idea whether or not her "aborted" actions have already been carried out.
 *
 * If the server's response is a redirect, the redirect is followed automatically. In that case, the
 * previously pushed history entry is replaced with the new URL _after_ the redirected response is
 * fetched. This is different from the normal browser behavior, where the history stack is updated
 * _before_ requesting the redirected URL. Due to security considerations, this behavior cannot be
 * reimplemented with JavaScript.
 */
export async function navigateTo({
    href,
    httpMethod,
    bodyParams,
    updateHistory,
    historyHref,
    frameId,
}: NavigationOptions): Promise<void> {
    // Only update the history if so configured. If nothing is specified, update the history by default
    // for the root frame, but not for all other frames.
    updateHistory ??= frameId === rootFrameId;

    // Update the history immediately to simulate the native browser behavior.
    const thisNavigationId = ++navigationId;
    if (updateHistory) {
        history.pushState({ [navigationIdKey]: thisNavigationId }, "", historyHref ?? href);
    }

    let response: Response = undefined!;
    await updateFrame(frameId, async (frame, signal) => {
        response = await fetchFrame(frame, href, {
            method: httpMethod,
            body: httpMethod === "GET" ? undefined : bodyParams,
            signal,
        });

        return await extractFrameFromResponse(frame, response, signal);
    });

    // For redirected responses, replace the previously pushed history entry to mimic the native
    // browser behavior as best as we can. To prevent a race condition where multiple concurrent
    // navigation operations overlap, we only replace the history entry if the previously pushed
    // one is still topmost.
    if (
        updateHistory &&
        response.redirected &&
        history.state[navigationIdKey] === thisNavigationId
    ) {
        history.replaceState(null, "", response.url);
    }
}

/** Specifies a set of attributes that control the behavior of `interceptClicks`. */
export type DomNavigationOptions = {
    /**
     * The id of the frame that should be updated with the HTML returned by the server. Specified on
     * the target element with the `data-hy-frame` attribute.
     */
    readonly hyFrame?: FrameId;
    /**
     * The URL of the route that should be navigated to. This is required for buttons and optional
     * for anchors, whose `href` attribute takes precedence. Specified on the target element with
     * the `data-hy-url` attribute.
     */
    readonly hyUrl?: string;
    /**
     * Indicates the HTTP method that is used to execute the request. Specified on the target
     * element with the `data-hy-method` attribute.
     */
    readonly hyMethod?: HttpMethod;
    /**
     * For GET requests, indicates whether a new entry for the route's URL should be pushed onto the
     * browser's history stack. Defaults to `true` for requests targeting the root frame. For
     * non-GET requests, contains the URL that should be pushed onto the browser's history stack.
     * Specified on the target element with the `data-hy-update-history` attribute.
     */
    readonly hyUpdateHistory?: string;
    /**
     * The URL-encoded request body. Specified on the target element with the `data-hy-body`
     * attribute.
     */
    readonly hyBody?: string;
    /**
     * If the button triggers a non-GET request and belongs to a form, the form's data is sent along
     * with the request.
     */
    readonly hyForm?: string;
};

/**
 * Intercepts all click events, checking whether the target or one of its parents is an anchor or an
 * "anchor-like" button that should be handled by HyTTS. If so, triggers the appropriate frame
 * update. The exact behavior must be specified using `data-*` attributes as described by the
 * `DomNavigationOptions` of the target's `dataset` property.
 */
export function interceptClicks() {
    document.addEventListener("click", (e: MouseEvent) => {
        if (e.defaultPrevented) {
            return;
        }

        const target =
            (e.target as Element).closest("a") ?? (e.target as Element).closest("button");
        const options = target?.dataset as DomNavigationOptions | undefined;

        if (!target || !options?.hyMethod) {
            return;
        }

        e.preventDefault();

        const method = options.hyMethod;
        const href =
            (target instanceof HTMLAnchorElement ? target.href : undefined) ?? options.hyUrl;

        if (!href) {
            throw new Error("Unknown navigation URL.");
        }

        if (!options.hyFrame) {
            throw new Error("Unknown target frame.");
        }

        switch (method) {
            case "GET":
                void navigateTo({
                    frameId: options.hyFrame,
                    href,
                    httpMethod: "GET",
                    updateHistory:
                        // We have to explicitly pass through the `undefined` so that the root frame
                        // logic kicks in.
                        options.hyUpdateHistory === undefined
                            ? undefined
                            : !!options.hyUpdateHistory,
                });
                break;
            case "POST": {
                let bodyParams = options.hyBody;
                if (options.hyForm) {
                    const form = document.getElementById(options.hyForm);
                    if (!form || !(form instanceof HTMLFormElement)) {
                        throw new Error(`Unable to find form '${options.hyForm}'.`);
                    }

                    bodyParams = createFormRequestBody(form, bodyParams);
                }

                void navigateTo({
                    frameId: options.hyFrame,
                    href,
                    httpMethod: "POST",
                    bodyParams,
                    updateHistory: !!options.hyUpdateHistory,
                    historyHref: options.hyUpdateHistory,
                });
                break;
            }
            case undefined:
                break;
            default: {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const switchGuard: never = method;
                throw new Error(`Unknown or unsupported HTTP request method '${method}'.`);
            }
        }
    });
}

/**
 * Intercepts history changes, reloading the root frame to make backward/forward navigation work as
 * expected. If a frame within the route was updated to a different state than what the server
 * originally rendered, this state might not be restored correctly because the server might render
 * the original UI again. This is expected behavior, however. If such a state change should be
 * persisted across history navigation operations, the frame update should push a new entry onto the
 * history stack and the server should be able to serve a full document at a route with this new
 * state. That way, a browser reload will also work correctly in addition to the history
 * navigation.
 */
export function interceptHistoryChanges() {
    window.addEventListener(
        "popstate",
        () => void navigateTo({ frameId: rootFrameId, href: location.href, httpMethod: "GET" }),
    );
}

let navigationId = 0;
const navigationIdKey = "hyNavigationId";

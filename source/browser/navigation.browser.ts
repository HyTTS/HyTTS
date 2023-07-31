import {
    executeAction,
    loadRoute,
    navigateToAction,
    navigateToRoute,
} from "@/browser/frame.browser";
import type { FrameSelector } from "@/browser/frame.browser";

/**
 * Specifies a set of attributes that control the behavior of `interceptClicks` for both routes and actions.
 */
type NavigationOptions = {
    /**
     * The selector of the frame that should be updated with the HTML returned by the server. This should
     * either be `"body"` or `"#some-id"` for a `hy-frame` with id `"some-id"`. If no target is given,
     * implicitly uses the nearest ancestor `hy-frame` element or, if none exists, the document's body.
     * Specified on the target element with the `data-hy-frame` attribute.
     */
    readonly hyFrame?: FrameSelector;

    /**
     * The URL of the route or action to navigate to. This is required for buttons and optional for
     * anchors, whose `href` attribute takes precedence. Specified on the target element with the
     * `data-hy-url` attribute.
     */
    readonly hyUrl?: string;
} & (RouteOptions | ActionOptions);

/**
 * Specifies a set of attributes that control the behavior of `interceptClicks` for routes.
 */
type RouteOptions = {
    /**
     * Indicates if an anchor or button element should be handled by HyTTS or if the native browser
     * behavior should be used. Specified on the target element with the `data-hy-navigate` attribute.
     */
    readonly hyNavigate?: "route";

    /**
     * Indicates whether a new entry for the route's URL should be pushed onto the browser's history stack.
     * Specified on the target element with the `data-hy-update-history` attribute.
     */
    readonly hyUpdateHistory?: boolean;
};

/**
 * Specifies a set of attributes that control the behavior of `interceptClicks` for actions.
 */
type ActionOptions = {
    /**
     * Indicates if an anchor or button element should be handled by HyTTS or if the native browser
     * behavior should be used. Specified on the target element with the `data-hy-navigate` attribute.
     */
    readonly hyNavigate?: "action";

    /**
     * The URL-encoded action params. Specified on the target element with the `data-hy-action-params`
     * attribute.
     */
    readonly hyActionParams?: string;

    /**
     * The route URL that should be pushed onto the browser's history stack. Specified on the target element
     * with the `data-hy-history-url` attribute.
     */
    readonly hyHistoryUrl?: string;
};

/**
 * Intercepts all click events, checking whether the target or one of its parents is an anchor or an
 * "anchor-like" button that should be handled by HyTTS. If so, triggers the appropriate frame update.
 * The exact behavior must be specified using `data-*` attributes as described by the `NavigationOptions`
 * of the target's `dataset` property.
 */
export function interceptClicks() {
    window.onclick = async (e: MouseEvent) => {
        const target =
            (e.target as Element).closest("a") ?? (e.target as Element).closest("button");
        const options = target?.dataset as NavigationOptions | undefined;

        if (!target || !options || !options.hyNavigate) {
            return;
        }

        e.preventDefault();

        const navigationKind = options.hyNavigate;
        const href =
            (target instanceof HTMLAnchorElement ? target.href : undefined) ?? options.hyUrl;

        if (!href || !options.hyFrame) {
            throw new Error("Unknown navigation URL or target frame.");
        }

        switch (navigationKind) {
            case "route":
                // Only update the history if so configured. If nothing is specified, update the history by default
                // for the document body, but not for all other frames.
                await (options.hyUpdateHistory ?? options.hyFrame === "body"
                    ? navigateToRoute
                    : loadRoute)(options.hyFrame, href);
                break;
            case "action":
                if (options.hyHistoryUrl) {
                    await navigateToAction(
                        options.hyFrame,
                        href,
                        options.hyActionParams ?? "",
                        options.hyHistoryUrl,
                    );
                } else {
                    await executeAction(options.hyFrame, href, options.hyActionParams ?? "");
                }
                break;
            case undefined:
                break;
            default: {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const switchGuard: never = navigationKind;
                throw new Error(`Unknown 'data-hy-navigate' value '${navigationKind}'.`);
            }
        }
    };
}

/**
 * Intercepts history changes, reloading the body frame to make backward/forward navigation work
 * as expected. If a frame within the route was updated to a different state than what the server
 * originally rendered, this state might not be restored correctly because the server might render
 * the original UI again. This is expected behavior, however. If such a state change should be
 * persisted across history navigations, the frame update should push a new entry onto the history
 * stack and the server should be able to serve a full document at a route with this new state.
 * That way, a browser reload will also work correctly in addition to the history navigation.
 */
export function interceptHistoryChanges() {
    window.onpopstate = () => loadRoute("body", location.href);
}

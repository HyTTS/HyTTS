import { type FrameMetadata, useFrameMetadata } from "@/dom/frame";
import type { HttpMethod } from "@/http/http-context";
import type { JSX } from "@/jsx/jsx-runtime";
import { type Href, isHref } from "@/routing/href";

type NavigationProps<Method extends HttpMethod> = {
    /** The HTTP request that is executed and whose response the UI is subsequently updated with. */
    readonly href: Href<Method>;

    /** The frame to update. If none is given, updates the nearest ancestor frame. */
    readonly target?: FrameMetadata;

    /**
     * Indicates whether the browser history should be updated. For GET requests, defaults to `true`
     * if the body frame is updated, either explicitly through the `target` prop or implicitly by
     * checking for the nearest ancestor frame. Non-GET requests can provide an alternative GET
     * request here that is executed when, e.g., the page is reloaded (e.g., via F5) or the browser
     * is restarted and the tab is auto-reopened.
     */
    readonly updateHistory?: Method extends "GET" ? boolean : Href<"GET">;
};

export type AProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target"> &
    NavigationProps<"GET"> & {
        /**
         * If `true`, ignores `target` and `updateHistory` and does a full page navigation instead
         * of a frame update.
         */
        readonly reloadDocument?: boolean;
    };

/**
 * Renders an anchor tag that executes the given HTTP GET request and renders the response. Unless
 * configured otherwise, uses frame updates instead of full page navigations.
 */
export function A({ target, updateHistory, reloadDocument, href, ...props }: AProps) {
    return reloadDocument ? (
        <a {...props} href={href.url} />
    ) : (
        <a
            {...props}
            data-hy-method="GET"
            data-hy-frame={(target ?? useFrameMetadata()).frameId}
            data-hy-update-history={updateHistory}
            href={href.url}
        />
    );
}

export type ButtonProps<Method extends HttpMethod> = Omit<
    JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    "type"
> &
    NavigationProps<Method>;

/** Renders a button tag that executes the given HTTP request and renders the response. */
export function Button<Method extends HttpMethod>({
    href,
    target,
    updateHistory,
    ...props
}: ButtonProps<Method>) {
    return (
        <button
            {...props}
            type="button"
            data-hy-method={href.method}
            data-hy-frame={(target ?? useFrameMetadata()).frameId}
            data-hy-update-history={isHref(updateHistory) ? updateHistory.url : updateHistory}
            data-hy-url={href.url}
            data-hy-body={href.body}
        />
    );
}

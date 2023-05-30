import { FrameMetadata, useFrameMetadata } from "@/dom/frame";
import { JSX } from "@/jsx/jsx-runtime";
import { ActionUrl, RouteUrl } from "@/routing/urls";

export type RouteLinkProps = {
    /**
     * The route that should be navigated to.
     */
    readonly route: RouteUrl;

    /**
     * The frame to update. If none is given, updates the nearest ancestor frame.
     */
    readonly target?: FrameMetadata;

    /**
     * Indicates whether the browser history should be updated. Defaults to `true` if the body frame
     * is updated, either explicitly through the `target` prop or implicitly by checking for the nearest
     * ancestor frame. In all other cases, defaults to `false`.
     */
    readonly updateHistory?: boolean;

    /**
     * If `true`, ignores `target` and `updateHistory` and does a full page navigation instead of a
     * frame update.
     */
    readonly reloadDocument?: boolean;
};

/**
 * Renders an anchor tag that uses frame updates instead of full page navigations to navigate to a route,
 * unless configured otherwise.
 */
export function RouteLink({
    target,
    updateHistory,
    reloadDocument,
    route,
    ...props
}: Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target"> & RouteLinkProps) {
    return reloadDocument ? (
        <a {...props} href={route.url} />
    ) : (
        <a
            {...props}
            data-hy-navigate="route"
            data-hy-frame={target?.frameSelector ?? useFrameMetadata().frameSelector}
            data-hy-update-history={updateHistory}
            href={route.url}
        />
    );
}

/**
 * Renders an button tag that uses frame updates to navigate to a route.
 */
export function RouteButton({
    route,
    target,
    updateHistory,
    ...props
}: Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "type"> &
    Omit<RouteLinkProps, "reloadDocument">) {
    return (
        <button
            {...props}
            type="button"
            data-hy-navigate="route"
            data-hy-frame={target?.frameSelector ?? useFrameMetadata().frameSelector}
            data-hy-update-history={updateHistory}
            data-hy-url={route.url}
        />
    );
}

export type ActionLinkProps = {
    /**
     * The action that should be executed.
     */
    readonly action: ActionUrl;

    /**
     * The frame to update. If none is given, updates the nearest ancestor frame.
     */
    readonly target?: FrameMetadata;

    /**
     * The route URL that should be pushed onto the browser's history stack.
     */
    readonly historyUrl?: RouteUrl;
};

/**
 * Renders an anchor tag that uses frame updates to execute an action.
 */
export function ActionLink({
    action,
    target,
    historyUrl,
    ...props
}: Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & ActionLinkProps) {
    return (
        <a
            {...props}
            data-hy-navigate="action"
            data-hy-frame={target?.frameSelector ?? useFrameMetadata().frameSelector}
            data-hy-history-url={historyUrl?.url}
            data-hy-url={action.url}
            data-hy-action-params={action.actionParams}
        />
    );
}

/**
 * Renders an button tag that uses frame updates to execute an action.
 */
export function ActionButton({
    action,
    target,
    historyUrl,
    ...props
}: Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & ActionLinkProps) {
    return (
        <button
            {...props}
            type="button"
            data-hy-navigate="action"
            data-hy-frame={target?.frameSelector ?? useFrameMetadata().frameSelector}
            data-hy-history-url={historyUrl?.url}
            data-hy-url={action.url}
            data-hy-action-params={action.actionParams}
        />
    );
}

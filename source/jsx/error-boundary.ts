import { toJsxExpression } from "@/jsx/jsx-types";
import { renderChildren } from "@/jsx/render-children";
import type { JsxComponent, JsxElement, PropsWithChildren } from "@/jsx/jsx-types";

export type ErrorViewProps = {
    /** The error that occurred and that should be shown. */
    readonly error: unknown;
};

export type ErrorBoundaryProps = PropsWithChildren<{
    /** The component that is rendered if an error was thrown while rendering of the children. */
    readonly ErrorView: JsxComponent<ErrorViewProps>;
}>;

/**
 * Tries to render its `children`. If an error is thrown during children rendering, the `ErrorView`
 * component is rendered instead.
 */
export function ErrorBoundary(props: ErrorBoundaryProps): JsxElement {
    return toJsxExpression(async () => {
        try {
            return await renderChildren(props.children, "", "");
        } catch (error: unknown) {
            return (await props.ErrorView({ error }))?.() ?? "";
        }
    });
}

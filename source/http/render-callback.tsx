import { ErrorBoundary, ErrorViewProps } from "@/jsx/error-boundary";
import { renderToString } from "@/jsx/jsx-runtime";
import { Response } from "express";
import type { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";
import { RouteFilters } from "@/routing/route-filters";
import { HttpContextProvider, useHttpStatusCode } from "./http-context";
import { CspNonceProvider } from "@/jsx/csp-nonce";
import { UniqueNameProvider } from "@/jsx/unique-name";
import { randomBytes } from "node:crypto";

export type RenderCallback = ReturnType<typeof createRenderCallback>;

export type RenderOptions = {
    /**
     * The HTML document consisting of the `html`, `head`, and `body` tags that constitutes the HTML document
     * returned by the HTTP response.
     */
    readonly document: JsxComponent<PropsWithChildren>;

    /**
     * The app context that is loaded for an HTTP request immediately after the HTTP context is available.
     * It is typically used to inject contexts for databases, tenancy, etc. into the JSX component tree so
     * that all route/action handlers as well as route filters have access to thoses contexts. The app context
     * component itself usually does not render anything and just defers to its children, which typically is
     * the HTML document.
     */
    readonly appContext: JsxComponent<PropsWithChildren>;

    /**
     * The error view that is rendered when a non-fatal error occurs during JSX rendering. The error view
     * has access to the same contexts and hooks as the `Document` like the database or tenant theme styling
     * depending on your application infrastructure.
     */
    readonly errorView: JsxComponent<ErrorViewProps>;

    /**
     * The error view that is returned when a fatal error occurs, i.e., when there are errors both during
     * normal JSX rendering and while rendering the non-fatal `ErrorView`. This function must return a plain
     * HTML string that is immediately sent to the browser.
     * Ensure that this callback never throws an error, or that there is an Express middleware later on that
     * handles such errors.
     */
    readonly fatalErrorView: (error: unknown) => string | Promise<string>;
};

export function createRenderCallback({
    document: Document,
    appContext: AppContext,
    errorView: ErrorView,
    fatalErrorView,
}: RenderOptions) {
    return async (
        Handler: JsxComponent,
        res: Response,
        filters: RouteFilters,
        embedInDocument: boolean,
    ) => {
        try {
            if (!embedInDocument && res.req.headers["x-hytts"] !== "true") {
                throw new Error(
                    "Received a request to a handler not embedded in the document that was not issued by HyTTS. " +
                        "This typically indicates that the user initiated a frame updated before the HyTTS browser " +
                        "bundle was initialized.",
                );
            }

            sendResponse(
                await render(() => (
                    <ErrorBoundary ErrorView={InternalServerError}>
                        <Handler />
                    </ErrorBoundary>
                )),
            );
        } catch (e: unknown) {
            // There was some error outside the top-level error boundary. So let's try to render a
            // JSX-based error page, if possible. Otherwise, fall back to a possibly uglier, simpler,
            // string-based error view that hopefully still works.
            try {
                sendResponse(await render(() => <InternalServerError error={e} />));
            } catch (e: unknown) {
                // Default to a status code of 500 internal server error. The error view can override this.
                res.status(500);
                sendResponse(await fatalErrorView(e));
            }
        }

        function InternalServerError(props: ErrorViewProps) {
            // Default to a status code of 500 internal server error. The error view can override this
            // to a more specific error if it wants to.
            useHttpStatusCode(500);
            return <ErrorView {...props} />;
        }

        function render(Component: JsxComponent<{}>) {
            return renderToString(
                <HttpContextProvider value={res}>
                    <CspNonceProvider value={randomBytes(32).toString("base64")}>
                        <UniqueNameProvider prefix="root">
                            <AppContext>
                                <ApplyFilters filters={filters}>
                                    {embedInDocument ? (
                                        <Document>
                                            <Component />
                                        </Document>
                                    ) : (
                                        <Component />
                                    )}
                                </ApplyFilters>
                            </AppContext>
                        </UniqueNameProvider>
                    </CspNonceProvider>
                </HttpContextProvider>,
            );
        }

        function sendResponse(html: string) {
            // We might not be able to send the response, for instance when the browser was
            // redirected during JSX rendering.
            if (!res.headersSent) {
                res.send(html);
            }
        }
    };
}

type ApplyFiltersProps = PropsWithChildren<{
    readonly filters: RouteFilters;
}>;

function ApplyFilters(props: ApplyFiltersProps) {
    if (Array.isArray(props.filters) && props.filters.length === 0) {
        return <>{props.children}</>;
    } else {
        const Filter = Array.isArray(props.filters) ? props.filters[0]! : props.filters;
        return (
            <Filter>
                <ApplyFilters filters={Array.isArray(props.filters) ? props.filters.slice(1) : []}>
                    {props.children}
                </ApplyFilters>
            </Filter>
        );
    }
}

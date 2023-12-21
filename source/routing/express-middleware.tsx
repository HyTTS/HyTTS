import type { Request, RequestHandler } from "express";
import { HttpResponse } from "@/http/http-context";
import { toHttpStatusCode } from "@/http/http-error";
import type { ErrorBoundary } from "@/jsx/error-boundary";
import { renderToString } from "@/jsx/jsx-runtime";
import type { JsxElement } from "@/jsx/jsx-types";
import type { Router } from "@/routing/router";

/**
 * Creates an Express middleware for rendering JSX-based routes. This must be the last middleware in
 * your Express pipeline as it returns a "404 - not found" status code for all unknown routes.
 *
 * @param element The JSX element that handles all incoming requests. The contained component tree
 *   should provide:
 *
 *   - A top-level {@link ErrorBoundary} that catches all errors during JSX rendering.
 *   - A {@link Router} component somewhere within the component tree.
 *   - A component that injects all relevant contexts to access other services, the database, etc.
 *
 * @param onFatalError Generates the error HTML that is returned to the browser when a fatal error
 *   occurs, i.e., when there are errors both during normal JSX rendering and while rendering the
 *   top-most {@link ErrorBoundary}. This function must return a plain HTML string that is
 *   immediately sent to the browser. Ensure that this callback never throws an error, or that there
 *   is an Express middleware later on that handles such errors. If no callback is provided, a
 *   generic error message not containing any details is shown.
 * @returns A middleware for Express that can be used with `express.use`.
 */
export function createExpressMiddleware(
    element: JsxElement,
    onFatalError?: (error: unknown) => string | Promise<string>,
): RequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return async (req, res) => {
        try {
            send(
                await renderToString(
                    <HttpResponse
                        value={{
                            method: req.method,
                            requestPath: req.path.split("/"),
                            searchParams: getSearchParams(req),
                            requestBody: getRequestBody(req),
                            redirect: (url) => res.redirect(url),
                            getHeader: (header) => req.get(header),
                            setHeader: (header, value) => res.setHeader(header, value),
                            setStatusCode: (code) => res.status(code),
                        }}
                    >
                        {element}
                    </HttpResponse>,
                ),
            );
        } catch (e: unknown) {
            res.status(toHttpStatusCode(e));
            send(onFatalError ? await onFatalError(e) : "An error occurred.");
        }

        // We might not be able to send the response, for instance when the browser was
        // redirected during JSX rendering.
        function send(html: string) {
            if (!res.headersSent) {
                res.send(html);
            } else {
                res.end();
            }
        }
    };
}

/**
 * Ensures that the request's search params are a string and returns it. The string is expected to
 * be URL encoded, but that is not checked here.
 */
function getSearchParams(req: Request): string {
    const query: any = req.query;

    if (query && typeof query !== "string") {
        throw new Error(
            "Expected URL query string to be unparsed. Make sure you've disabled query string parsing in " +
                'Express like so: `app.set("query parser", (queryString: string) => queryString)`',
        );
    }

    return query ?? "";
}

/**
 * For form-urlencoded requests, ensures that the request body is a string and returns it. The
 * string is expected to be URL encoded, but that is not checked here.
 */
function getRequestBody(req: Request): string {
    if (req.is("application/x-www-form-urlencoded")) {
        if (req.body && typeof req.body !== "string") {
            throw new Error(
                "Expected request body to be a string. Make sure you've enabled body string handling in " +
                    'Express like so: `app.use(express.text({ type: "application/x-www-form-urlencoded" }))`',
            );
        } else {
            return req.body;
        }
    }

    return "";
}

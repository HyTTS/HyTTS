import type { Request, Response } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { createContext, useContext } from "@/jsx/context";
import type { JsxElement, PropsWithChildren } from "@/jsx/jsx-types";
import type { RouteUrl } from "@/routing/urls";
import { parseUrlSearchParams } from "@/serialization/url-params";

const httpContext = createContext<Response>({ name: "http context" });

export type HttpContextProps = PropsWithChildren<{ readonly response: Response }>;

/**
 * Provides access to the HTTP context, i.e., the HTTP response object, to all of its children.
 */
export const HttpContextProvider = httpContext.Provider;

/**
 * Sends an HTTP header of the given `name` and with the given `value` as part of the response. This
 * function can be called multiple times to add additional HTTP response headers. If the function
 * is called again for the same header name, the last call wins. So components deeper in the tree
 * can overwrite headers set by their ancestors. It is a race condition if sibling components within
 * the tree set different status codes, so the behavior in that case is undefined.
 */
export function useResponseHeader(name: string, value: string | number | readonly string[]) {
    useContext(httpContext).setHeader(name, value);
}

/**
 * Sets the HTTP status code the given value. The last call to this function wins. So components
 * deeper in the tree can overwrite the status code set by their ancestors. It is a race condition
 * if sibling components within the tree set different status codes, so the behavior in that case
 * is undefined.
 */
export function useHttpStatusCode(code: number) {
    useContext(httpContext).status(code);
}

/**
 * Returns the current request's search params, parsed with the given `schema`.
 */
export function useUrlSearchParams<
    Output extends Record<string, unknown>,
    Def extends ZodTypeDef,
    Input,
>(schema: ZodType<Output, Def, Input>): Output {
    return parseUrlSearchParams(schema, getSearchParams(useContext(httpContext).req))!;
}

/**
 * Sets the route URL the browser should be redirected to using a 302 HTTP status code. Immediately
 * sends the response so ensure that nothing else gets rendered. You cannot redirect more than once in
 * the same HTTP response.
 */
export function useRedirect(redirectTo: RouteUrl) {
    // SECURITY: Do not allow redirects outside of our app, when someone fakes the `RouteUrl`, see:
    // https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
    if (!isRelativeUrl(redirectTo.url)) {
        throw new Error("Redirecting to absolute URLs is unsupported for security reasons.");
    }

    useContext(httpContext).redirect(redirectTo.url);
}

/**
 * Sets an absolute URL, typically to some other webpage or app, the browser should be redirected to using
 * a 302 HTTP status code. Immediately sends the response so ensure that nothing else gets rendered. You
 * cannot redirect more than once in the same HTTP response.
 *
 * SECURITY: Redirecting to absolute URLs can be dangerous from a security perspective. Ensure that you
 * redirect to an expected URL and that you understand the OWASP security cheat sheet for redirects:
 * https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */
export function useAbsoluteRedirect(url: string) {
    useContext(httpContext).redirect(url);
}

export type RedirectProps = {
    readonly to: RouteUrl;
};

/**
 * Sets the URL the browser should be redirected to using a 302 HTTP status code, internally using
 * `useRedirect`. See the remarks there regarding the precise behavior.
 */
export function Redirect(props: RedirectProps): JsxElement {
    useRedirect(props.to);
    return null;
}

export type AbsoluteRedirectProps = {
    readonly to: string;
};

/**
 * Sets an absolute URL, typically to some other webpage or app, the browser should be redirected to using
 * a 302 HTTP status code, internally using `useAbsoluteRedirect`. See the remarks there regarding the precise
 * behavior.
 *
 * SECURITY: Redirecting to absolute URLs can be dangerous from a security perspective. Ensure that you
 * redirect to an expected URL and that you understand the OWASP security cheat sheet for redirects:
 * https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */
export function AbsoluteRedirect(props: AbsoluteRedirectProps): JsxElement {
    useAbsoluteRedirect(props.to);
    return null;
}

/**
 * Ensures that the request's search params are a string and returns it. The string is typically expected
 * to be URL encoded, but that is not checked here.
 */
export function getSearchParams(req: Request): string {
    // The type is wrong here because we're actually not using qs
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (req.query && typeof req.query !== "string") {
        throw new Error(
            "Expected URL query string to be unparsed. Make sure you've disabled query string parsing in " +
                'Express like so: `app.set("query parser", (queryString: string) => queryString)`',
        );
    }

    return req.query;
}

/**
 * Ensures that the request body is a string and returns it. The string is typically expected to be
 * URL encoded, but that is not checked here.
 */
export function getRequestBody(req: Request): string {
    if (req.body && typeof req.body !== "string") {
        throw new Error(
            "Expected request body to be a string. Make sure you've enabled body string handling in " +
                'Express like so: `app.use(express.text({ type: "application/x-www-form-urlencoded" }))`',
        );
    }

    return req.body;
}

/**
 * Checks whether the given URL is relative or absolute.
 */
function isRelativeUrl(url: string) {
    const origin = "https://example.com";
    return new URL(url, origin).origin === origin;
}

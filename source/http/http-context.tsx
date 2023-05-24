import { createContext, useContext } from "@/jsx/context";
import { JsxElement, PropsWithChildren } from "@/jsx/jsx-types";
import { RouteUrl } from "@/routing/urls";
import { parseUrlSearchParams } from "@/serialization/url-params";
import { Response } from "express";
import { ZodType, ZodTypeDef } from "zod";

const httpContext = createContext<Response>({
    name: "http context",
});

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
    Input
>(schema: ZodType<Output, Def, Input>): Output {
    return parseUrlSearchParams(schema, useContext(httpContext).req.query as any)!;
}

/**
 * Sets the URL the browser should be redirected to using a 302 HTTP status code. Immediately sends
 * the response so ensure that nothing else gets rendered. You cannot call `useRedirect` more than
 * once in the same HTTP response.
 */
export function useRedirect(redirectTo: RouteUrl) {
    useContext(httpContext).redirect(redirectTo.url);
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

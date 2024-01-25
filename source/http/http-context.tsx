import { randomBytes } from "node:crypto";
import type { ZodType, ZodTypeDef } from "zod";
import { HttpError } from "@/http/http-error";
import { type ContextProviderProps, createContext, useContext } from "@/jsx/context";
import { CspNonceProvider } from "@/jsx/csp-nonce";
import type { JsxElement, PropsWithChildren } from "@/jsx/jsx-types";
import type { HrefOptions } from "@/routing/href-3";
import type { GetRoutes, RoutesConfig, RoutesInfo } from "@/routing/router-3";
import { parseUrlSearchParams } from "@/serialization/url-params";

/** The list of HTTP verbs supported by HyTTS. */
export const httpMethods = ["GET", "POST"] as const;

/** The list of HTTP verbs supported by HyTTS. */
export type HttpMethod = (typeof httpMethods)[number];

type HttpContext = {
    readonly method: HttpMethod;
    readonly requestPath: string[];
    readonly searchParams: string;
    readonly requestBody: string;
    readonly redirect: (url: string) => void;
    readonly getHeader: (header: string) => string | undefined;
    readonly setHeader: (header: string, value: string) => void;
    readonly setStatusCode: (code: number) => void;
};

const httpContext = createContext<HttpContext>({ name: "http context" });

/** Provides access to the entire HTTP context. */
export function useHttpContext() {
    return useContext(httpContext);
}

/**
 * Starts rendering an HTTP response, providing access to the HTTP context, i.e., the HTTP response
 * object, to all of its children.
 */
export function HttpResponse(
    props: ContextProviderProps<Omit<HttpContext, "method"> & { readonly method: string }>,
) {
    const method = props.value.method as HttpMethod;
    if (!httpMethods.includes(method)) {
        throw new HttpError("MethodNotSupported");
    }

    return (
        <httpContext.Provider
            value={{
                ...props.value,
                method,
                requestPath: props.value.requestPath.filter((segment) => segment !== ""),
            }}
        >
            <CspNonceProvider value={randomBytes(32).toString("base64")}>
                {props.children}
            </CspNonceProvider>
        </httpContext.Provider>
    );
}

export type HttpHeaderProps = PropsWithChildren<{
    readonly name: string;
    readonly value: string;
}>;

/**
 * Sends an HTTP header of the given `name` and with the given `value` as part of the response. If
 * the same HTTP header is set by multiple component instances, the last one wins. So components
 * deeper in the tree can overwrite headers set by their ancestors. It is a race condition if
 * sibling components within the tree set different values for the same header, so the behavior in
 * that case is undefined.
 */
export function HttpHeader({ name, value, children }: HttpHeaderProps): JsxElement {
    useHttpContext().setHeader(name, value);
    return <>{children}</>;
}

export type HttpStatusCodeProps = PropsWithChildren<{
    readonly code: number;
}>;

/**
 * Sets the HTTP status code the given value. If the request renders multiple component instances,
 * the last one wins. So components deeper in the tree can overwrite the status code set by their
 * ancestors. It is a race condition if sibling components within the tree set different status
 * codes, so the behavior in that case is undefined.
 */
export function HttpStatusCode({ code, children }: HttpStatusCodeProps): JsxElement {
    useHttpContext().setStatusCode(code);
    return <>{children}</>;
}

export type RedirectProps<
    Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
    Path extends keyof Info & `GET ${string}` = any,
> = PropsWithChildren<HrefOptions<Routes, Info, Path>>;

/**
 * Sets the URL the browser should be redirected to using a 302 HTTP status code. All rendered JSX
 * components are discarded. You cannot redirect more than once in the same HTTP response.
 */
export function Redirect<
    Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
    Path extends keyof Info & `GET ${string}` = any,
>({ href, children }: RedirectProps<Routes, Info, Path>): JsxElement {
    // SECURITY: Do not allow redirects outside of our app, when someone fakes the given href, see:
    // https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
    if (!isRelativeUrl(href.url)) {
        throw new Error("Redirecting to absolute URLs is unsupported for security reasons.");
    }

    useHttpContext().redirect(href.url);
    return <>{children}</>;
}

export type AbsoluteRedirectProps = PropsWithChildren<{
    readonly href: string;
}>;

/**
 * Sets an absolute URL, typically to some other webpage or app, the browser should be redirected to
 * using a 302 HTTP status code. All rendered JSX components are discarded. You cannot redirect more
 * than once in the same HTTP response.
 *
 * SECURITY: Redirecting to absolute URLs can be dangerous from a security perspective. Ensure that
 * you redirect to an expected URL and that you understand the OWASP security cheat sheet for
 * redirects:
 * https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */
export function AbsoluteRedirect({ href, children }: AbsoluteRedirectProps): JsxElement {
    if (isRelativeUrl(href)) {
        throw new Error("Expected an absolute URL, but got a relative URL.");
    }

    useHttpContext().redirect(href);
    return <>{children}</>;
}

/**
 * Checks the current HTTP request's `x-hy` header to determine if the request originates from a
 * browser navigation, e.g., on the first request to the application, or from HyTTS, for instance
 * during a frame navigation or a form submission.
 */
export function useRequester() {
    return useContext(httpContext).getHeader("x-hy") ? "HyTTS" : "browser";
}

/**
 * Checks the current HTTP request's 'x-hy-frame-id' header to determine the id of the frame that is
 * updated with the response HTML.
 */
export function useRequestedFrameId() {
    return useContext(httpContext).getHeader("x-hy-frame-id");
}

/** Returns the current request's search params, parsed with the given `schema`. */
export function useUrlSearchParams<
    Output extends Record<string, unknown>,
    Def extends ZodTypeDef,
    Input,
>(schema: ZodType<Output, Def, Input>): Output {
    return parseUrlSearchParams(schema, useHttpContext().searchParams)!;
}

/** Retrieves the value of the current request's HTTP header called `name`. */
export function useRequestHeader(name: string) {
    return useHttpContext().getHeader(name);
}

function isRelativeUrl(url: string) {
    const origin = "https://example.com";
    return new URL(url, origin).origin === origin;
}

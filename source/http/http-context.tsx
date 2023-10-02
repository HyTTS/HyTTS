import { randomBytes } from "node:crypto";
import type { ZodType, ZodTypeDef } from "zod";
import { HttpError, toHttpStatusCode } from "@/http/http-error";
import { type ContextProviderProps, createContext, useContext } from "@/jsx/context";
import { CspNonceProvider } from "@/jsx/csp-nonce";
import { ErrorBoundary, type ErrorViewProps } from "@/jsx/error-boundary";
import type { JsxElement } from "@/jsx/jsx-types";
import { UniqueNameProvider } from "@/jsx/unique-name";
import { log } from "@/log";
import type { Href } from "@/routing/href";
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
            <ErrorBoundary ErrorView={InternalServerError}>
                <CspNonceProvider value={randomBytes(32).toString("base64")}>
                    <UniqueNameProvider prefix="root">{props.children}</UniqueNameProvider>
                </CspNonceProvider>
            </ErrorBoundary>
        </httpContext.Provider>
    );

    function InternalServerError({ error }: ErrorViewProps) {
        useHttpStatusCode(toHttpStatusCode(error));
        log.error(`${error}`);

        return (
            <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <title>Error</title>
                </head>
                <body>
                    <h1>Error</h1>
                    <p>
                        An error occurred while rendering the JSX. Add a top-level{" "}
                        <code>ErrorBoundary</code> above your <code>Router</code> in your JSX
                        component hierarchy to catch all errors that occur during rendering.
                    </p>

                    <p>
                        Make sure that your top-level <code>ErrorBoundary</code> never throws an
                        error when it is rendered. Otherwise, HyTTS will fall back to a static, more
                        generic error message that might not be as helpful to your users.
                    </p>
                </body>
            </html>
        );
    }
}

/**
 * Sends an HTTP header of the given `name` and with the given `value` as part of the response. This
 * function can be called multiple times to add additional HTTP response headers. If the function is
 * called again for the same header name, the last call wins. So components deeper in the tree can
 * overwrite headers set by their ancestors. It is a race condition if sibling components within the
 * tree set different status codes, so the behavior in that case is undefined.
 */
export function useResponseHeader(name: string, value: string) {
    useHttpContext().setHeader(name, value);
}

/**
 * Sets the HTTP status code the given value. The last call to this function wins. So components
 * deeper in the tree can overwrite the status code set by their ancestors. It is a race condition
 * if sibling components within the tree set different status codes, so the behavior in that case is
 * undefined.
 */
export function useHttpStatusCode(code: number) {
    useHttpContext().setStatusCode(code);
}

/** Returns the current request's search params, parsed with the given `schema`. */
export function useUrlSearchParams<
    Output extends Record<string, unknown>,
    Def extends ZodTypeDef,
    Input,
>(schema: ZodType<Output, Def, Input>): Output {
    return parseUrlSearchParams(schema, useHttpContext().searchParams)!;
}

/**
 * Sets the route URL the browser should be redirected to using a 302 HTTP status code. Immediately
 * sends the response so ensure that nothing else gets rendered. You cannot redirect more than once
 * in the same HTTP response.
 */
export function useRedirect(redirectTo: Href<"GET">) {
    // SECURITY: Do not allow redirects outside of our app, when someone fakes the `RouteUrl`, see:
    // https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
    if (!isRelativeUrl(redirectTo.url)) {
        throw new Error("Redirecting to absolute URLs is unsupported for security reasons.");
    }

    useHttpContext().redirect(redirectTo.url);
}

/**
 * Sets an absolute URL, typically to some other webpage or app, the browser should be redirected to
 * using a 302 HTTP status code. Immediately sends the response so ensure that nothing else gets
 * rendered. You cannot redirect more than once in the same HTTP response.
 *
 * SECURITY: Redirecting to absolute URLs can be dangerous from a security perspective. Ensure that
 * you redirect to an expected URL and that you understand the OWASP security cheat sheet for
 * redirects:
 * https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */
export function useAbsoluteRedirect(url: string) {
    useHttpContext().redirect(url);
}

export type RedirectProps = {
    readonly href: Href<"GET">;
};

/**
 * Sets the URL the browser should be redirected to using a 302 HTTP status code, internally using
 * `useRedirect`. See the remarks there regarding the precise behavior.
 */
export function Redirect(props: RedirectProps): JsxElement {
    useRedirect(props.href);
    return null;
}

export type AbsoluteRedirectProps = {
    readonly href: string;
};

/**
 * Sets an absolute URL, typically to some other webpage or app, the browser should be redirected to
 * using a 302 HTTP status code, internally using `useAbsoluteRedirect`. See the remarks there
 * regarding the precise behavior.
 *
 * SECURITY: Redirecting to absolute URLs can be dangerous from a security perspective. Ensure that
 * you redirect to an expected URL and that you understand the OWASP security cheat sheet for
 * redirects:
 * https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
 */
export function AbsoluteRedirect(props: AbsoluteRedirectProps): JsxElement {
    useAbsoluteRedirect(props.href);
    return null;
}

/** Checks whether the given URL is relative or absolute. */
function isRelativeUrl(url: string) {
    const origin = "https://example.com";
    return new URL(url, origin).origin === origin;
}

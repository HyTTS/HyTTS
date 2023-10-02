import type { ErrorBoundary } from "@/jsx/error-boundary";

/**
 * Represents typical HTTP error codes supported by HyTTS that can be used to specify the failure
 * reason when throwing an {@link HttpError}.
 */
export type ErrorCode =
    | "BadRequest"
    | "InternalServerError"
    | "NotImplemented"
    | "Unauthorized"
    | "Forbidden"
    | "NotFound"
    | "MethodNotSupported"
    | "Timeout"
    | "Conflict"
    | "PreconditionFailed"
    | "PayloadTooLarge"
    | "UnprocessableContent"
    | "TooManyRequests"
    | "ClientClosedRequest";

const errorCodeToHttpStatusCode: Record<ErrorCode, number> = {
    BadRequest: 400,
    InternalServerError: 500,
    NotImplemented: 501,
    Unauthorized: 401,
    Forbidden: 403,
    NotFound: 404,
    MethodNotSupported: 405,
    Timeout: 408,
    Conflict: 409,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UnprocessableContent: 422,
    TooManyRequests: 429,
    ClientClosedRequest: 499,
};

/** Maps an {@link ErrorCode} to the equivalent HTTP status code. */
export function toHttpStatusCode(e: unknown) {
    return e instanceof HttpError ? errorCodeToHttpStatusCode[e.errorCode] : 500;
}

/**
 * Throw this error type when rendering a route to allow HyTTS to send a semantically valid HTTP
 * response to the browser.
 */
export class HttpError extends Error {
    /**
     * Creates a new error, describing what went wrong.
     *
     * @param errorCode The error code describing what went wrong. It is used to deduce the HTTP
     *   status code that is sent to the browser.
     * @param additionalInfo Additional information about the error. This value is not used by
     *   HyTTS, but you can use it, for instance, to send additional information to the browser in
     *   an {@link ErrorBoundary}. Please ensure that you never leak sensitive information to the
     *   client, e.g., only render the additional info when the Node environment is 'dev'.
     */
    public constructor(
        public errorCode: ErrorCode,
        public additionalInfo?: unknown,
    ) {
        super(errorCode);
    }
}

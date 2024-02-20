import { createContext, useContext } from "@/jsx/context";

export const CspNonceContext = createContext<string>({ name: "csp nonce provider" });

/** Gets the current request's CSP nonce that allows JavaScript execution. */
export function useCspNonce() {
    return useContext(CspNonceContext);
}

/**
 * If you use a CSP nonce that forbids inline scripts (as you should for security reasons), you must
 * make the nonce available to HyTTS so that it can work correctly. To do that, place this component
 * into your document's head. Making the nonce available to HyTTS is OK because JS is generally
 * allowed to access it, see https://github.com/w3c/webappsec-csp/issues/458
 */
export function CspNonce() {
    return <meta name="hy-csp-nonce" content={useCspNonce()} />;
}

import { createContext, useContext } from "@/jsx/context";
import type { PropsWithChildren } from "@/jsx/jsx-types";

const nonceContext = createContext<string>({ name: "csp nonce provider" });

/** Gets the current request's CSP nonce that allows JavaScript execution. */
export function useCspNonce() {
    return useContext(nonceContext);
}

export type CspNonceProviderProps = PropsWithChildren<{ readonly nonce: string }>;

export const CspNonceProvider = nonceContext.Provider;

import { useContext, createContext } from "@/jsx/context";
import type { PropsWithChildren } from "@/jsx/jsx-types";

const uniqueNameContext = createContext<{ readonly prefix: string; index: number }>({
    name: "unique name provider",
});

export type UniqueNameProviderProps = PropsWithChildren<{ readonly prefix: string }>;

/** Provides the `useUniqueName` hook with unique sequential numbers for its `prefix`. */
export function UniqueNameProvider(props: UniqueNameProviderProps) {
    return uniqueNameContext.Provider({
        value: { prefix: props.prefix, index: 0 },
        children: props.children,
    });
}

/**
 * Generates a globally unique name that can be used for HTML element ids or JavaScript identifiers. The generated
 * id is *not* guaranteed to be stable when rerendering the same view.
 */
export function useUniqueName() {
    const context = useContext(uniqueNameContext);
    return `${context.prefix}_${context.index++}`;
}

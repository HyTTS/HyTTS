import { createContext, useContext, useContextOrDefault } from "@/jsx/context";
import type { PropsWithChildren } from "@/jsx/jsx-types";

const uniqueNameContext = createContext<{ readonly namespace: string; index: number }>({
    name: "unique name provider",
});

export type UniqueNameProviderProps = PropsWithChildren<{ readonly namespace: string }>;

/**
 * Provides a generator for request-wide unique names that can be retrieved with the
 * {@link useUniqueName} hook. The namespace cannot contain the '$' character.
 */
export function UniqueNameProvider(props: UniqueNameProviderProps) {
    if (props.namespace.includes("$")) {
        throw new Error("You cannot use '$' as part of a namespace.");
    }

    const context = useContextOrDefault(uniqueNameContext, false);
    const namespace = context ? `${useUniqueName()}$${props.namespace}` : `$${props.namespace}`;

    return uniqueNameContext.Provider({
        value: { namespace, index: 0 },
        children: props.children,
    });
}

/**
 * Generates a request-wide unique name that can be used for HTML element ids or JavaScript
 * identifiers. The name is generated from a namespace prefix (typically, something defined by the
 * containing frame) and a monotonically increasing number. Use the {@link UniqueNameProvider} to
 * introduce a new nested namespace of unique names.
 *
 * Note that:
 *
 * - The generated id is _not_ guaranteed to be stable when rerendering the same view.
 * - The generated id is _only_ guaranteed to be unique within a single request, but not across
 *   multiple requests.
 */
export function useUniqueName() {
    const context = useContext(uniqueNameContext);
    return `${context.namespace}$${context.index++}`;
}

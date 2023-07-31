import { AsyncLocalStorage } from "node:async_hooks";
import { toJsxExpression } from "@/jsx/jsx-types";
import { renderChildren } from "@/jsx/render-children";
import type { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";

const contextStorage = new AsyncLocalStorage<Record<symbol, unknown>>();
const contextIdSymbol = Symbol();

export type ContextProviderProps<T> = PropsWithChildren<{
    /** The value that the context provides to all of its children. */
    readonly value: T;
}>;

/**
 * A context handles some state scoped to the children of its `Provider` component.
 * A provided context can be overwritten in lower parts of the component tree.
 */
export type Context<T> = {
    readonly [contextIdSymbol]: symbol;
    /** Provides the given `value` to all of its children. */
    readonly Provider: JsxComponent<ContextProviderProps<T>>;
    /** Configures the behavior of a context. */
    readonly options: ContextOptions<T> | undefined;
};

/** Configures the behavior of a context. */
export type ContextOptions<T> = {
    /**
     * The default value that is returned by a call to `useContext` for the current context if no context has
     * been set by any ancestor component.
     */
    readonly default?: { value: T };
    /** The context's name, useful for debugging purposes. */
    readonly name?: string;
};

/**
 * Creates a new `Context<T>` instance. The resulting context is typically stored in a module-scoped variable.
 */
export function createContext<T>(options?: ContextOptions<T>): Context<T> {
    const id = Symbol();
    return {
        [contextIdSymbol]: id,
        options,
        Provider: (props) =>
            toJsxExpression(() => {
                const context = { ...contextStorage.getStore(), [id]: props.value };
                return contextStorage.run(context, () => renderChildren(props.children));
            }),
    };
}

/**
 * Gets the given `context`'s value provided for the calling component with regards to its location
 * in the component tree. If no value is provided, an error is thrown.
 */
export function useContext<T>(context: Context<T>): T {
    const store = contextStorage.getStore() ?? {};
    const id = context[contextIdSymbol];

    if (!(id in store)) {
        if (context.options?.default) {
            return context.options.default.value;
        } else {
            throw new Error(
                `No context named '${
                    context.options?.name ?? "[unnamed context]"
                }' has been set by any ancestor component and the context does not have a default value.`,
            );
        }
    }

    return store[id] as T;
}

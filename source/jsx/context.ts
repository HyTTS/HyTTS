import { AsyncLocalStorage } from "node:async_hooks";
import { type JsxComponent, type PropsWithChildren, toJsxExpression } from "@/jsx/jsx-types";
import { renderChildren } from "@/jsx/render-children";

const contextStorage = new AsyncLocalStorage<Record<symbol, unknown>>();
const contextIdSymbol = Symbol();

export type ContextProps<T> = PropsWithChildren<{
    /** The value that the context provides to all of its children. */
    readonly value: T;
}>;

/**
 * A context handles some state scoped to its children. Such a scoped state provided by a context
 * can be overwritten in lower parts of the component tree by providing the context again with a
 * different value.
 */
export type Context<T> = JsxComponent<ContextProps<T>> & {
    readonly [contextIdSymbol]: symbol;
    /** Configures the behavior of a context. */
    readonly options: ContextOptions<T> | undefined;
};

/** Configures the behavior of a context. */
export type ContextOptions<T> = {
    /**
     * The default value that is returned by a call to `useContext` for the current context if no
     * context has been set by any ancestor component.
     */
    readonly default?: { value: T };
    /** The context's name, useful for debugging purposes. */
    readonly name?: string;
};

/**
 * Creates a new `Context<T>` instance. The resulting context is typically stored in a module-scoped
 * variable.
 */
export function createContext<T>(options?: ContextOptions<T>): Context<T> {
    const id = Symbol();
    return Object.assign(
        (props: ContextProps<T>) =>
            toJsxExpression(() => {
                const context = { ...contextStorage.getStore(), [id]: props.value };
                return contextStorage.run(context, () => renderChildren(props.children));
            }),
        { [contextIdSymbol]: id, options },
    );
}

/**
 * Gets the given `context`'s value provided for the calling component with regards to its location
 * in the component tree. If no context value is provided by some ancestor component and the context
 * defines no default value, an error is thrown.
 */
export function useContext<T>(context: Context<T>): T {
    const value = useContextOrDefault(context, noContextValueSymbol);

    if (value === noContextValueSymbol) {
        throw new Error(
            `No context named '${
                context.options?.name ?? "[unnamed context]"
            }' has been set by any ancestor component and the context provides no default value.`,
        );
    } else {
        return value;
    }
}

const noContextValueSymbol = Symbol();

/**
 * Gets the given `context`'s value provided for the calling component with regards to its location
 * in the component tree. If no context value is provided by some ancestor component and the context
 * defines no default value, the `fallbackValue` is returned.
 */
export function useContextOrDefault<T, U>(context: Context<T>, fallbackValue: U): T | U {
    const store = contextStorage.getStore() ?? {};
    const id = context[contextIdSymbol];

    if (!(id in store)) {
        if (context.options?.default) {
            return context.options.default.value;
        } else {
            return fallbackValue;
        }
    }

    return store[id] as T;
}

/**
 * Represents the path of a property within an object. E.g., `a.0.b` references the property `b` at
 * the first element of the array stored in property `a` of the object, in accordance with lodash's
 * semantics.
 */
export type PropertyPath = string;

/**
 * Selects a property from the given object as either a string or a lambda function, e.g.,
 * `"a.b.c.0"` or, equivalently, `s => s.a.b.c[0]`.
 */
export type PropertySelector<TObject extends Record<string, unknown>, TValue> =
    | PropertyPath
    | ((obj: TObject) => TValue);

/**
 * Uses a proxy object to simulate and collect a navigation through an object by the given
 * `selector`. The returned path is formatted as expected by lodash.
 */
export function collectPath<T extends Record<string, unknown>>(
    selector: PropertySelector<T, unknown>,
): PropertyPath {
    if (typeof selector === "string") {
        return selector;
    }

    const path: string[] = [];
    const handler: ProxyHandler<{}> = {
        get(target, prop) {
            if (typeof prop === "symbol") {
                throw new Error("Expected a string, not a symbol.");
            }

            path.push(prop);
            return new Proxy(target, handler);
        },
    };

    const collector = new Proxy(
        { pathStarted: false },
        {
            get(target, prop, receiver) {
                if (target.pathStarted) {
                    throw new Error("A selector can only navigate a single path.");
                }
                target.pathStarted = true;
                return handler.get!(target, prop, receiver);
            },
        },
    ) as unknown as T;

    selector(collector);

    if (path.length === 0) {
        throw new Error(
            "Expected a navigation through the object, e.g. `(state) => state.a.b[0].c`.",
        );
    }

    return path.join(".");
}

import { isBrowserFunc, useRegisterBrowserEventHandler } from "@/jsx/browser-script";
import { renderChildren } from "@/jsx/render-children";
import { escapeString } from "@/jsx/escape-string";
import { useUniqueName } from "@/jsx/unique-name";
import {
    JsxComponent,
    JsxElement,
    JsxExpression,
    PropsWithChildren,
    toJsxExpression,
} from "@/jsx/jsx-types";

// This export is required so that type checking works for JSX expressions without polluting the global namespace,
// thus making it possible to use multiple JSX implementations in the same code base.
export type { JSX } from "@/jsx/jsx-types";

/** Renders a JSX element into a string. */
export async function renderToString(element: JsxElement) {
    return (await (await element)?.()) ?? "";
}

/**
 * Represents a component that can be used to group multiple `JsxElement`s into a single one.
 * The fragment itself is never rendered, only its children are. The `Fragment` function itself
 * is never invoked; it's just used by `jsxs` below to check if any HTML should be rendered for
 * the current element.
 */
export function Fragment() {}

/**
 * Creates a render function that serializes the given intrinsic element or function component into an HTML string.
 * This function is invoked automatically by the compiler when it encounters a JSX expression like `<div/>`.
 */
export function jsxs<TProps extends Record<string, unknown> = {}>(
    element: string | JsxComponent<TProps>,
    allProps: PropsWithChildren<TProps>
): JsxExpression {
    const { children, ...props } = allProps;

    if (element === Fragment) {
        // A fragment has no DOM representation, so it just renders its children.
        return toJsxExpression(() => renderChildren(children));
    }

    if (typeof element === "string") {
        // HTML void elements are only allowed to have an opening tag and cannot have children.
        return voidElements.has(element)
            ? toJsxExpression(() => `<${element}${renderProps(props)}>`)
            : toJsxExpression(() =>
                  renderChildren(children, `<${element}${renderProps(props)}>`, `</${element}>`)
              );
    }

    if (typeof element === "function") {
        return toJsxExpression(() => {
            const jsxElement = element(allProps);

            if (jsxElement === null) return "";
            if (typeof jsxElement === "function") return jsxElement();

            return (async () => {
                const contentOrPromise = (await jsxElement)?.();
                return !contentOrPromise
                    ? ""
                    : typeof contentOrPromise === "string"
                    ? contentOrPromise
                    : await contentOrPromise;
            })();
        });
    }

    throw new Error("Unexpected JSX element type.");
}

// Required by the JSX transformation; this function is called when an JSX element only has a single child, and
// the `children` prop is therefore not an array. The `jsxs` above implementation can handle both array and non-array
// `children` props. Some optimization attempts for the non-array case have so far nor yielded any measurable
// performance benefits, hence the two functions are currently the same.
export const jsx = jsxs;

function renderProps(props: Record<string, unknown>) {
    let propsString = "";
    let hasEventProps = false;
    const propEntries = Object.entries(props);

    for (const [name, value] of propEntries) {
        if (value === null || value === undefined) {
            continue;
        }

        if (name.startsWith(browserEventPrefix)) {
            hasEventProps = true;
            continue;
        }

        if (typeof value === "boolean" || typeof value === "number")
            propsString += ` ${name}="${value}"`;
        else if (typeof value === "string")
            propsString += ` ${name}="${escapeString(value, true)}"`;
        else {
            throw new Error(`Unsupported value for prop '${name}'.`);
        }
    }

    if (hasEventProps) {
        // If the element has an event handler, we need to ensure that it has an id that we can use to
        // attach the event handler; if it doesn't have an id, we thus have to generate a unique one.
        let id = props.id as string | undefined;
        if (!id) {
            id = useUniqueName();
            propsString += ` id="${id}"`;
        }

        for (const [name, handler] of propEntries) {
            if (handler === null || handler === undefined) {
                continue;
            }

            if (name.startsWith(browserEventPrefix)) {
                if (isBrowserFunc(handler)) {
                    useRegisterBrowserEventHandler(
                        id,
                        name.slice(browserEventPrefixLength),
                        handler
                    );
                } else {
                    throw new Error(`Expected a browser function for event handler '${name}'.`);
                }
            }
        }
    }

    return propsString;
}

/**
 * The set of HTML "void elements" that can never have content. They must be rendered without a
 * closing tag; see https://www.w3.org/TR/2011/WD-html-markup-20110113/syntax.html#void-element
 */
const voidElements = new Set<string>([
    "area",
    "base",
    "basefont",
    "bgsound",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "image",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "menuitem",
    "meta",
    "nextid",
    "param",
    "source",
    "track",
    "wbr",
]);

const browserEventPrefix = "browser:";
const browserEventPrefixLength = browserEventPrefix.length;

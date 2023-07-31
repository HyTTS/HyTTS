import { escapeString } from "@/jsx/escape-string";
import type { JsxExpression } from "@/jsx/jsx-types";
import { isJsxExpression } from "@/jsx/jsx-types";

export function renderChildren(
    children: unknown,
    startTag = "",
    endTag = "",
): string | Promise<string> {
    const renderedChildren: (string | null | Promise<string | null>)[] = [];
    collectChildrenAndStartRendering(children);

    for (let i = 0; i < renderedChildren.length; ++i) {
        const child = renderedChildren[i]!;
        if (typeof child !== "string") {
            // Slow path: We have to await all async children (that are already executing asynchronously).
            return (async () => {
                try {
                    renderedChildren[i] = await child;
                    for (let j = i + 1; j < renderedChildren.length; ++j) {
                        const child = renderedChildren[j]!;
                        if (typeof child !== "string") {
                            renderedChildren[j] = await child;
                        }
                    }
                    return `${startTag}${renderedChildren.join("")}${endTag}`;
                } catch (e: unknown) {
                    // If any of the promises throws an error, we have to ensure that we await all
                    // others as well before rethrowing the exception, as otherwise the Node process
                    // is terminated due to unhandled promise rejections.
                    await Promise.all(renderedChildren);
                    throw e;
                }
            })();
        }
    }

    // Fast path: We can simply join everything together, as all children are synchronous.
    return `${startTag}${renderedChildren.join("")}${endTag}`;

    function collectChildrenAndStartRendering(children: unknown) {
        if (Array.isArray(children)) {
            // Arrays can be arbitrarily nested...
            for (const child of children) {
                collectChildrenAndStartRendering(child);
            }
        } else {
            // Since we don't await the promise potentially returned by `renderChild` here, all children
            // render concurrently.
            renderedChildren.push(renderChild(children));
        }
    }

    function renderChild(child: unknown): ReturnType<JsxExpression> {
        if (child === null || child === undefined) {
            return "";
        }

        switch (typeof child) {
            case "boolean":
                return "";
            case "number":
                return child.toString();
            case "string":
                return escapeString(child, false);
            case "function":
                if (isJsxExpression(child)) {
                    return child();
                } else {
                    throw new Error("Functions are unsupported as JSX children.");
                }
            default:
                throw new Error("Unsupported JSX child.");
        }
    }
}

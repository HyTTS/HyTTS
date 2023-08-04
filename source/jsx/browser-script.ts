import { createContext, useContext } from "@/jsx/context";
import { useCspNonce } from "@/jsx/csp-nonce";
import {
    type EventArgs,
    type EventHandler,
    type PropsWithChildren,
    toJsxExpression,
} from "@/jsx/jsx-types";
import { renderChildren } from "@/jsx/render-children";

const browserScriptSymbol = Symbol();
const browserFuncSymbol = Symbol();

/**
 * Browser scripts can only capture variables of the given type. In particular, they cannot capture
 * objects or arrays for security reasons; it would be to easy to inadvertently capture some secret
 * value which should never be exposed to the browser. If you really need to pass an object to a
 * browser script, JSON-serialize it.
 */
export type CapturedVariable = undefined | null | boolean | number | string | BrowserFunc<any>;

/**
 * Represents a script, i.e., a sequence of JavaScript statements, that can be serialized to and executed
 * by the browser. A browser script can never capture any surrounding server variables implicitly. All
 * server variables must be passed explicitly for security reasons.
 */
export type BrowserScript = {
    readonly [browserScriptSymbol]: null;
    readonly hasContext: boolean;
    readonly serializeScript: SerializeScript;
};

/**
 * Represents a function that can be serialized to and executed by the browser. A browser function
 * can never capture any surrounding server variables implicitly. All server variables must be passed
 * explicitly for security reasons.
 */
export type BrowserFunc<T extends (...args: any[]) => any> = {
    readonly [browserFuncSymbol]: T | null;
    readonly serializeScript: SerializeScript;
};

/**
 * Renders all browser scripts and functions registered by its children.
 */
export function BrowserScriptRenderer(props: PropsWithChildren) {
    // Contains the browser scripts or functions that have been registered while the renderer's
    // children are rendered. We have to generate the appropriate browser code for these scripts
    // after all children's output.
    const registeredScripts = new Set<BrowserScript | BrowserFunc<any>>();

    return scriptContext.Provider({
        value: (script) => registeredScripts.add(script),
        children: toJsxExpression(
            async () =>
                (await renderChildren(props.children)) +
                (registeredScripts.size > 0
                    ? `<script nonce="${useCspNonce()}" type="text/javascript">${generateCode()}</script>`
                    : ""),
        ),
    });

    function generateCode() {
        // The individual statements that we are going to render, i.e., variable declarations and
        // assignments, IIFEs, etc.
        const statements: string[] = [];

        // Generates names for JavaScript variables that are unique within this script renderer.
        const generateName = (() => {
            let index = 0;
            return () => `_${index++}`;
        })();

        // We deduplicate functions based on the string representation of their code. This avoids
        // writing the same function again and again just because it has a different closure. This
        // could happen, for example, if the same function is registered in a loop with the loop
        // index being part of the captured variables.
        const renderFunction = (() => {
            // This map tracks which unique name is used to refer to a given function, regardless
            // of its closure. We don't deduplicate closures, as they are expected to be mostly
            // different each time they are instantiated.
            const functions = new Map</* code: */ string, /* variableName: */ string>();

            return (script: BrowserFunc<any>) => {
                const serializedScript = script.serializeScript(renderFunction);
                let functionName = functions.get(serializedScript.script);

                if (!functionName) {
                    functionName = generateName();
                    functions.set(serializedScript.script, functionName);
                    statements.push(`const ${functionName}=${serializedScript.script};`);
                }

                return `(${functionName})(${serializedScript.context})`;
            };
        })();

        // We cannot deduplicate scripts, as they typically have observable side effects.
        function renderScript(script: BrowserScript) {
            const serializedScript = script.serializeScript(renderFunction);
            if (!script.hasContext) {
                if (serializedScript.context) {
                    throw new Error("Encountered unexpected closure context.");
                }
                statements.push(serializedScript.script + ";");
            } else {
                statements.push(`(${serializedScript.script})(${serializedScript.context});`);
            }
        }

        // Renders all registered scripts, which in turn transitively render their dependencies.
        registeredScripts.forEach((script) => {
            if (isBrowserFunc(script)) renderFunction(script);
            else if (isBrowserScript(script)) renderScript(script);
            else throw new Error("Unknown script type.");
        });

        // We use an IIFE for all of this renderer's code so that we can be sure that all generated
        // names are unique within the context of this renderer and don't leak to the global scope.
        return `(()=>{${statements.join("").replaceAll("</script", "<\\/script")}})()`;
    }
}

export function createBrowserScript<TContext extends CapturedVariable[]>(
    script: (...ctx: ToBrowserContext<TContext>) => void,
    ...context: TContext
): BrowserScript {
    return {
        [browserScriptSymbol]: null,
        hasContext: true,
        serializeScript: serializeScript(script, context),
    };
}

export function createBrowserFunc<
    T extends (...args: any[]) => any,
    TContext extends CapturedVariable[],
>(script: (...ctx: ToBrowserContext<TContext>) => T, ...context: TContext): BrowserFunc<T> {
    return {
        [browserFuncSymbol]: null,
        serializeScript: serializeScript(script, context),
    };
}

export function createEventHandler<
    TElement extends EventTarget,
    TEvent extends Event,
    TContext extends CapturedVariable[],
>(
    handler: (...ctx: ToBrowserContext<TContext>) => (e: EventArgs<TElement, TEvent>) => void,
    ...context: TContext
): EventHandler<TElement, TEvent> {
    return createBrowserFunc(handler, ...context);
}

/**
 * Registers the given browser script so that the appropriate browser-side JavaScript code gets emitted.
 * The emitted code also includes all transitively referenced browser functions.
 */
export function useRegisterBrowserScript(script: BrowserScript) {
    useContext(scriptContext)(script);
}

/**
 * Registers the given event handler to be invoked when the event of the given event name is fired
 * on the element with the given id. This function is typically only used by infrastructure code;
 * prefer to use the JSX `browser:*` event handlers in most cases, i.e.:
 *
 *      <div browser:onclick={createEventHandler(...)} />
 */
export function useRegisterBrowserEventHandler(
    id: string,
    eventName: string,
    handler: BrowserFunc<(e: EventArgs) => void>,
) {
    useContext(scriptContext)({
        [browserScriptSymbol]: null,
        hasContext: false,
        serializeScript: (registerFunction) => ({
            script: `document.getElementById("${id}").${eventName}=${registerFunction(handler)}`,
            context: "",
        }),
    });
}

/**
 * Checks if the given value is a browser script.
 */
export function isBrowserScript(value: unknown): value is BrowserScript {
    return value !== null && typeof value === "object" && browserScriptSymbol in value;
}

/**
 * Checks if the given value is a browser function.
 */
export function isBrowserFunc(value: unknown): value is BrowserFunc<any> {
    return value !== null && typeof value === "object" && browserFuncSymbol in value;
}

function serializeScript<TContext extends CapturedVariable[]>(
    script: () => any,
    context: TContext,
): SerializeScript {
    return (registerFunction: (func: BrowserFunc<any>) => string) => ({
        script: script.toString(),
        context: context
            .map((value) => {
                if (value === undefined) return "undefined";
                if (value === null) return "null";
                if (typeof value === "boolean") return value ? "true" : "false";
                if (typeof value === "number") return value.toString();
                if (typeof value === "string") return `"${value}"`;
                if (isBrowserFunc(value)) return registerFunction(value);
                throw new Error("Unsupported type of closure variable.");
            })
            .join(","),
    });
}

type ToBrowserContext<T extends CapturedVariable[]> = {
    [K in keyof T]: T[K] extends BrowserFunc<infer S> ? S : T[K];
} & { length: T["length"] };

type SerializedScript = {
    readonly script: string;
    readonly context: string;
};

type SerializeScript = (registerFunction: (func: BrowserFunc<any>) => string) => SerializedScript;

const scriptContext = createContext<(script: BrowserScript | BrowserFunc<any>) => void>({
    name: "browser script renderer",
});

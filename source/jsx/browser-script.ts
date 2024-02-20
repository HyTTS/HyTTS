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
 * Represents a script, i.e., a sequence of JavaScript statements, that can be serialized to and
 * executed by the browser. A browser script can never capture any surrounding server variables
 * implicitly. All server variables must be passed explicitly for security reasons.
 */
export type BrowserScript = {
    readonly [browserScriptSymbol]: null;
    readonly hasContext: boolean;
    readonly serializeScript: SerializeScript;
};

/**
 * Represents a function that can be serialized to and executed by the browser. A browser function
 * can never capture any surrounding server variables implicitly. All server variables must be
 * passed explicitly for security reasons.
 */
export type BrowserFunc<T extends (...args: any[]) => any> = {
    readonly [browserFuncSymbol]: T | null;
    readonly serializeScript: SerializeScript;
};

/** Renders all browser scripts and functions registered by its children. */
export function BrowserScriptRenderer(props: PropsWithChildren) {
    // Contains the browser scripts or functions that have been registered while the renderer's
    // children are rendered. We have to generate the appropriate browser code for these scripts
    // after all children's output.
    const scripts = new Set<BrowserScript | BrowserFunc<any>>();

    return ScriptContext({
        value: (script) => scripts.add(script),
        children: toJsxExpression(
            async () => (await renderChildren(props.children)) + emitCode(scripts),
        ),
    });
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

export type ScriptProps = {
    readonly script: BrowserScript;
};

/**
 * Renders the given browser script, emitting the corresponding browser-side JavaScript code. The
 * emitted code also includes all transitively referenced browser functions. The given browser
 * script is emitted immediately in its own `<script>` tag; event handlers, on the other hand, are
 * collected and emitted at the end of the enclosing frame. It is thus fine to rely on the emitted
 * `<script>`'s position in the DOM, e.g., to retrieve the previous or enclosing DOM element.
 */
export function Script(props: ScriptProps) {
    return toJsxExpression(() => emitCode(new Set([props.script])));
}

/**
 * Registers the given event handler to be invoked when the event of the given event name is fired
 * on the element with the given id.
 */
export function useRegisterBrowserEventHandler(
    id: string,
    eventName: string,
    handler: BrowserFunc<(e: EventArgs) => void>,
) {
    useContext(ScriptContext)({
        [browserScriptSymbol]: null,
        hasContext: false,
        serializeScript: (registerFunction) => ({
            script: `hy.addEventListener("${id}", "${eventName}", ${registerFunction(handler)})`,
            context: "",
        }),
    });
}

export type HandlerProps = {
    readonly id: string;
    readonly eventName: string;
    readonly handler: BrowserFunc<(e: EventArgs) => void>;
};

/**
 * Registers the given event handler so that the corresponding browser-side JavaScript code will be
 * emitted at the end of the enclosing frame. The emitted code also includes all transitively
 * referenced browser functions.
 */
export function Handler(props: HandlerProps) {
    useRegisterBrowserEventHandler(props.id, props.eventName, props.handler);
    return null;
}

/** Checks if the given value is a browser script. */
export function isBrowserScript(value: unknown): value is BrowserScript {
    return value !== null && typeof value === "object" && browserScriptSymbol in value;
}

/** Checks if the given value is a browser function. */
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

type ScriptSet = Set<BrowserScript | BrowserFunc<any>>;
type SerializeScript = (registerFunction: (func: BrowserFunc<any>) => string) => SerializedScript;

const ScriptContext = createContext<(script: BrowserScript | BrowserFunc<any>) => void>({
    name: "browser scripts",
});

function emitCode(scripts: ScriptSet) {
    // The individual statements that we are going to render, i.e., variable declarations and
    // assignments, IIFEs, etc.
    const statements: string[] = [];

    // Generates names for JavaScript variables that are unique within this script renderer.
    const generateName = (() => {
        let index = 0;
        return () => `$${index++}`;
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
    scripts.forEach((script) => {
        if (isBrowserFunc(script)) renderFunction(script);
        else if (isBrowserScript(script)) renderScript(script);
        else throw new Error("Unknown script type.");
    });

    // We use an IIFE for all of this renderer's code so that we can be sure that all generated
    // names are unique within the context of this emitted code block and don't leak to the global scope.
    const code = `(()=>{${statements.join("").replaceAll("</script", "<\\/script")}})()`;
    return scripts.size > 0 ? `<script nonce="${useCspNonce()}">${code}</script>` : "";
}

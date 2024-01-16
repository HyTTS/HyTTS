import { z, type ZodType } from "zod";
import { type HttpMethod, httpMethods, useHttpContext, useRequester } from "@/http/http-context";
import { HttpError } from "@/http/http-error";
import { createContext, useContext } from "@/jsx/context";
import type { JsxComponent, JsxElement } from "@/jsx/jsx-types";
import { unpack } from "@/serialization/data-packing";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type RoutesDefinition<T extends Record<string, unknown>> = {
    readonly [Key in keyof T & string]: Key extends `${string}/${string}/${string}`
        ? "ERROR: Path segments cannot contain slashes except at the start."
        : Key extends `${`${HttpMethod} ` | ""}/${string} ${string}`
          ? "ERROR: Path segments cannot contain spaces."
          : Key extends `/:${infer Param}`
            ? Param extends `${string}:${string}`
                ? "ERROR: Path parameters cannot contain colons except at the start."
                : Param extends `${string}?`
                  ? Param extends `${string}?${string}?${string}`
                      ? "ERROR: Path parameters can only contain a question mark at the end."
                      : T[Key] extends ParamComponent<undefined, any>
                        ? T[Key]
                        : "ERROR: Schema for optional path parameter must handle `undefined` values."
                  : ParamComponent<any, any>
            : Key extends `/${infer Path}`
              ? Path extends `${string}:${string}`
                  ? "ERROR: Colons are not allowed in a path segment."
                  : Path extends `${string}?${string}`
                    ? "ERROR: Question marks are not allowed in a path segment."
                    : RoutesComponent<any>
              : Key extends `${HttpMethod} /${infer Path}`
                ? Path extends `${string}:${string}`
                    ? "ERROR: Colons are not allowed in a path segment."
                    : Path extends `${string}?${string}`
                      ? "ERROR: Question marks are not allowed in a path segment."
                      : JsxComponent | FormComponent<any> | RouteComponent<any, any>
                : "ERROR: Properties must start with '{HttpMethod} /' or just '/'.";
};

const routesSymbol = Symbol();
const routeSymbol = Symbol();
const paramSymbol = Symbol();
const formSymbol = Symbol();

export type RoutingComponent = JsxComponent<{
    readonly pathSegments: string[];
}>;

export type RoutesComponent<Def extends RoutesDefinition<Def>> = RoutingComponent & {
    readonly [routesSymbol]: Def | undefined;
    readonly kind: typeof routesSymbol;
};

export type RouteComponent<
    Params extends Record<string, unknown>,
    FormState extends Record<string, unknown>,
> = RoutingComponent & {
    readonly [routeSymbol]: [Params, FormState] | undefined;
    readonly kind: typeof routeSymbol;
};

export type ParamComponent<PathParam, Routes extends RoutesComponent<any>> = RoutingComponent & {
    readonly [paramSymbol]: [(param: PathParam) => void, Routes] | undefined;
    readonly kind: typeof paramSymbol;
};

export type FormElement<FormValues extends Record<string, unknown>> = JsxElement & {
    // Always `undefined` at runtime and only used at the type-level to infer the type of
    // the form values of an `Href`.
    readonly [formSymbol]: FormValues | undefined;
};

export type FormComponent<FormValues extends Record<string, unknown>> =
    () => FormElement<FormValues>;

export type Provide<T> = T | (() => T | Promise<T>);

type TypeMap = {
    [routesSymbol]: RoutesComponent<any>;
    [routeSymbol]: RouteComponent<any, any>;
    [paramSymbol]: ParamComponent<any, any>;
};

function tag<T extends keyof TypeMap>(symbol: T, component: RoutingComponent): TypeMap[T] {
    (component as any)[symbol] = undefined;
    (component as any).kind = symbol;
    return component as TypeMap[T];
}

function is<T extends keyof TypeMap>(symbol: T, value: unknown): value is TypeMap[T] {
    return !!value && typeof value === "function" && symbol in value;
}

/**
 * Renders a JSX component on a route match.
 *
 * @param schemaProvider The schema for the route's search or body parameter, depending on the
 *   route's HTTP method.
 * @param Handler The JSX component that renders the route's HTML output.
 */
export function route<
    ParamsIn extends Record<string, unknown> = {},
    ParamsOut extends Record<string, unknown> = {},
    FormValues extends Record<string, unknown> = {},
>(
    schemaProvider: Provide<ZodType<ParamsOut, any, ParamsIn>>,
    Handler: JsxComponent<ParamsOut> | FormComponent<FormValues>,
): RouteComponent<ParamsIn, FormValues> {
    return tag(routeSymbol, async ({ pathSegments }) => {
        const { method, searchParams, requestBody } = useHttpContext();
        if (pathSegments.length !== 0) {
            throw new HttpError(
                "NotFound",
                `Unmatched leftover path segments: ${pathSegments.map((s) => `'${s}'`).join(",")}`,
            );
        }

        if (method !== "GET" && useRequester() !== "HyTTS") {
            throw new HttpError(
                "BadRequest",
                "Non-GET requests originating from the browser are unsupported.",
            );
        }

        const schema =
            typeof schemaProvider === "function" ? await schemaProvider() : schemaProvider;

        const paramsSource = method === "GET" ? searchParams : requestBody;
        const params = parseUrlSearchParams(schema, paramsSource)!;

        return <Handler {...params} />;
    });
}

/**
 * Represents a set of routes that are matched against an incoming HTTP request to determine which
 * sub-routes to match or render.
 *
 * The routes can either be JSX components rendered on a request with optional search or body
 * parameters (depending on the HTTP method). Or you can forward to additional sets of routes,
 * potentially for lazy loading or just to decompose the route definition for reasons of
 * readability. Moreover, the set can also contain a dynamic path parameter.
 *
 * Note that the defined routes must not be ambiguous. Some ambiguity errors can be detected by the
 * TypeScript compiler, others might throw at runtime when the route definition is first loaded
 * (typically at server start, but potentially also later on due to lazy loading). In particular:
 *
 * - There can be only a single dynamic path parameter in a routes set.
 * - Route forwarding (e.g., `/abc`) and route definitions (e.g., `GET /abc`) cannot overlap.
 * - Route forwardings on `/` are only allowed if there is no path parameter.
 *
 * However, it _is_ OK to have both "GET /abc" and "POST /abc", because these can be disambiguated
 * based on the HTTP method.
 *
 * @param def The definition of the routes adhering to the constraints mentioned above.
 */
export function routes<Def extends RoutesDefinition<Def>>(def: Def): RoutesComponent<Def> {
    // A lookup table that returns the routing component to be rendered for a combination of
    // HTTP method and path segment.
    const lookup = Object.fromEntries(httpMethods.map((method) => [method, new Map()])) as Record<
        HttpMethod,
        Map<string, RouteComponent<any, any> | RoutesComponent<any>>
    >;

    // Represents the `/` route that forwards to a subrouter or the `/:param` route of
    // this router, of which there can be at most one, as the routing would otherwise be
    // ambiguous, since we can't know whether we should capture the parameter or forward
    // to the subrouter.
    let fallbackComponent: RoutesComponent<any> | ParamComponent<any, any> | undefined = undefined;

    function ensureIsValidPathSegment(pathSegment: string) {
        if (
            pathSegment.includes(":") ||
            pathSegment.includes("/") ||
            pathSegment.includes(" ") ||
            pathSegment.includes("?")
        ) {
            throw new Error(
                `Invalid space, slash, question mark, or colon in path segment '/${pathSegment}'.`,
            );
        }
    }

    function setFallbackComponent(
        component: RoutesComponent<any> | ParamComponent<any, any>,
        pathSegment: string,
    ) {
        ensureIsValidPathSegment(pathSegment);

        if (fallbackComponent) {
            throw new Error("A router can only have one path parameter or `/` route.");
        }

        fallbackComponent = component;
    }

    function addToLookup(
        methods: readonly (string | undefined)[],
        pathSegment: string | undefined,
        component: unknown,
    ) {
        if (methods.length === 0 || pathSegment === undefined) {
            throw new Error("Invalid methods or path segment.");
        }

        ensureIsValidPathSegment(pathSegment);

        for (const method of methods) {
            const httpMethod = method?.trim() as HttpMethod;
            if (!httpMethods.includes(httpMethod)) {
                throw new Error(`Unsupported HTTP method '${httpMethod}'.`);
            }

            if (lookup[httpMethod].has(pathSegment)) {
                throw new Error(`Duplicated path segment '${pathSegment}'.`);
            }

            if (is(routesSymbol, component) || is(routeSymbol, component)) {
                lookup[httpMethod].set(pathSegment, component);
            } else if (typeof component === "function") {
                const Component = component;
                lookup[httpMethod].set(
                    pathSegment,
                    route(z.object({}), () => <Component />),
                );
            } else {
                throw new Error("Invalid route component.");
            }
        }
    }

    for (const [key, value] of Object.entries(def)) {
        const route = key.trim();

        if (route.startsWith("/:")) {
            if (is(paramSymbol, value)) {
                setFallbackComponent(value, route.slice(2, route.endsWith("?") ? -1 : undefined));
            } else {
                throw new Error("Param def for a path parameter expected.");
            }
        } else if (route.startsWith("/")) {
            if (route === "/") {
                if (is(routesSymbol, value)) {
                    setFallbackComponent(value, route.slice(1));
                } else {
                    throw new Error("Router def for forwarding segment expected.");
                }
            } else {
                addToLookup(httpMethods, key.slice(1), value);
            }
        } else {
            const [method, pathSegment, ...rest] = route.split("/");
            if (rest.length !== 0) {
                throw new Error("Single slash expected in path segment.");
            }

            if (is(paramSymbol, value) || is(routesSymbol, value)) {
                throw new Error("Route def expected.");
            }

            addToLookup([method], pathSegment, value);
        }
    }

    if (is(routesSymbol, fallbackComponent)) {
        for (const httpMethod of httpMethods) {
            if (lookup[httpMethod].get("")) {
                throw new Error("A router can only have one path parameter or `/` route.");
            }
        }
    }

    return tag(routesSymbol, ({ pathSegments }) => {
        const httpContext = useHttpContext();
        let remainingPathSegments = pathSegments;
        let Component: RoutingComponent | undefined = lookup[httpContext.method].get(
            pathSegments[0] ?? "",
        );

        if (!Component && fallbackComponent) {
            Component = fallbackComponent;
        } else if (!Component) {
            throw new HttpError("NotFound");
        } else {
            remainingPathSegments = remainingPathSegments.slice(1);
        }

        return <Component pathSegments={remainingPathSegments} />;
    });
}

/**
 * A path parameter is a dynamic path segment that matches all values allowed by the given Zod
 * schema. There can be only one path parameter in a single routes definition to disambiguate
 * requests. The Zod schema is _not_ considered for disambiguation, similar to how JavaScript
 * doesn't allow function overloading based on parameter types.
 *
 * @param schemaProvider The Zod schema the path parameter must adhere to. If a parsing error
 *   occurs, status code 400 (bad request) is returned to the browser by default.
 * @param nestedRoutes The child routes that have access to the parsed parameter value.
 */
export function param<PathParamIn, PathParamOut, Router extends RoutesComponent<any>>(
    schemaProvider: Provide<ZodType<PathParamOut, any, PathParamIn>>,
    nestedRoutes: (pathParam: () => PathParamOut) => Router,
): ParamComponent<PathParamIn, Router> {
    const paramContext = createContext<PathParamOut>({ name: "path parameter" });
    const Component = nestedRoutes(() => useContext(paramContext));

    return tag(paramSymbol, async ({ pathSegments }) => {
        const paramSchema =
            typeof schemaProvider === "function" ? await schemaProvider() : schemaProvider;
        const param = unpack(
            paramSchema,
            pathSegments[0] ? decodeURIComponent(pathSegments[0]) : undefined,
        )!;

        return (
            <paramContext.Provider value={param}>
                <Component pathSegments={pathSegments.slice(1)} />
            </paramContext.Provider>
        );
    });
}

/**
 * Allows for lazy loading of nested routes definition. Thus, the code for these lazily loaded
 * routes doesn't get loaded on server start, but only once the first request is made that resolves
 * to one of those routes. Note that the code might be loaded anyway on server startup if the server
 * code gets bundled, for instance, or the file is non-lazily imported elsewhere.
 *
 * @param loadModule An asynchronous method that imports a file and returns the default export.
 *   Similar in use to the function expected by `await import`.
 * @param params If the lazily-loaded routes definition depends on path parameters, provide these
 *   parameters as the second argument so that they get passed through when the code is loaded.
 */
export function lazy<T extends RoutesComponent<any> | ((...p: any[]) => RoutesComponent<any>)>(
    loadModule: () => Promise<{ default: T }>,
    ...params: T extends RoutesComponent<any> ? [] : Parameters<T>
): T extends RoutesComponent<any> ? T : ReturnType<T> {
    let Component: RoutesComponent<any> | undefined = undefined;

    return tag(routesSymbol, async ({ pathSegments }) => {
        if (!Component) {
            const imported = (await loadModule()).default;
            Component = is(routesSymbol, imported) ? imported : imported(...params);
        }

        return <Component pathSegments={pathSegments} />;
    }) as any;
}

export type RouterProps<Routes extends RoutesComponent<any>> = {
    readonly routes: Routes;
};

/** A router that determines the route that should be rendered based on the current HTTP request. */
export function Router<Routes extends RoutesComponent<any>>({
    routes: Routes,
}: RouterProps<Routes>) {
    const { requestPath } = useHttpContext();
    return <Routes pathSegments={requestPath} />;
}

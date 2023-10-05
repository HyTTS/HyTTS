import cloneDeep from "lodash/cloneDeep";
import merge from "lodash/merge";
import { z, type ZodType } from "zod";
import { type HttpMethod, httpMethods, useHttpContext } from "@/http/http-context";
import { HttpError } from "@/http/http-error";
import { createContext, useContext } from "@/jsx/context";
import type { JsxComponent, JsxElement, PropsWithChildren } from "@/jsx/jsx-types";
import { unpack } from "@/serialization/data-packing";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type RoutesDefinition<T extends Record<string, unknown>> = {
    readonly [Key in keyof T & string]: Key extends `${string}/${string}/${string}`
        ? "ERROR: Path segments cannot contain slashes except at the start."
        : Key extends `${`${HttpMethod} ` | ""}/${string} ${string}`
        ? "ERROR: Path segments cannot contain spaces."
        : Key extends `/:${infer Path}`
        ? Path extends `${string}:${string}`
            ? "ERROR: Path parameters cannot contain colons except at the start."
            : ParamComponent<any, any>
        : Key extends `/${infer Path}`
        ? Path extends `${string}:${string}`
            ? "ERROR: Colons are not allowed in a path segment."
            : RoutesComponent<any>
        : Key extends `${HttpMethod} /${infer Path}`
        ? Path extends `${string}:${string}`
            ? "ERROR: Colons are not allowed in a path segment."
            : JsxComponent | FormComponent<any> | RouteComponent<any, any>
        : "ERROR: Properties must start with '{HttpMethod} /' or just '/'.";
};

const routesSymbol = Symbol();
const routeSymbol = Symbol();
const paramSymbol = Symbol();
const formSymbol = Symbol();

export type RoutingComponent = JsxComponent<{
    readonly parent: JsxComponent<PropsWithChildren>;
    readonly pathSegments: string[];
    readonly meta: Record<string, unknown>;
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
    readonly [paramSymbol]: [PathParam, Routes] | undefined;
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

export function createRouter<Meta extends Record<string, unknown>>(
    defaultMetaProvider: Provide<Meta>,
) {
    const metaContext = createContext<Meta>({ name: "route meta data" });

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

    function meta<FormValues extends Record<string, unknown>>(
        nested: FormComponent<FormValues>,
        metaProvider: Provide<Meta>,
    ): FormComponent<FormValues>;
    function meta<
        Params extends Record<string, unknown>,
        FormState extends Record<string, unknown>,
    >(
        nested: RouteComponent<Params, FormState>,
        metaProvider: Provide<Meta>,
    ): RouteComponent<Params, FormState>;
    function meta<PathParam, Routes extends RoutesComponent<any>>(
        nested: ParamComponent<PathParam, Routes>,
        metaProvider: Provide<Meta>,
    ): ParamComponent<PathParam, Routes>;
    function meta<Def extends RoutesDefinition<Def>>(
        nested: RoutesComponent<Def>,
        metaProvider: Provide<Meta>,
    ): RoutesComponent<Def>;
    function meta(nested: JsxComponent, metaProvider: Provide<Meta>): RouteComponent<{}, {}>;
    function meta(
        nested: RoutingComponent | JsxComponent,
        metaProvider: Provide<Meta>,
    ): RoutingComponent {
        let symbol = is(routesSymbol, nested)
            ? routesSymbol
            : is(routeSymbol, nested)
            ? routeSymbol
            : is(paramSymbol, nested)
            ? paramSymbol
            : undefined;

        if (!symbol) {
            symbol = routeSymbol;
            nested = self.route(z.any(), nested);
        }

        return tag(symbol, async ({ parent, meta: parentMeta, pathSegments }) => {
            const Nested = nested;
            const meta = typeof metaProvider === "function" ? await metaProvider() : metaProvider;

            return (
                <Nested
                    parent={parent}
                    meta={merge(cloneDeep(parentMeta), meta)}
                    pathSegments={pathSegments}
                />
            );
        });
    }

    const self = {
        /** Gets the meta values of the currently rendered route. */
        useMeta: () => useContext(metaContext),

        /**
         * Sets meta values for the nested routing component that are available in routes wrappers
         * higher up the component tree. The meta values are merged together as the routes
         * definitions are processed, so meta values closer to the current router overwrite meta
         * values declared higher up the component tree.
         *
         * @param nested The nested routing component that is extended with meta values.
         * @param metaValues The meta values that should be set.
         */
        meta,

        /**
         * Renders a JSX component on a route match.
         *
         * @param schemaProvider The schema for the route's search or body parameter, depending on
         *   the route's HTTP method.
         * @param Handler The JSX component that renders the route's HTML output.
         */
        route: <
            ParamsIn extends Record<string, unknown> = {},
            ParamsOut extends Record<string, unknown> = {},
            FormValues extends Record<string, unknown> = {},
        >(
            schemaProvider: Provide<ZodType<ParamsOut, any, ParamsIn>>,
            Handler: JsxComponent<ParamsOut> | FormComponent<FormValues>,
        ): RouteComponent<ParamsIn, FormValues> =>
            tag(routeSymbol, async ({ parent: Parent, pathSegments, meta }) => {
                const { method, searchParams, requestBody } = useHttpContext();
                if (pathSegments.length !== 0) {
                    throw new HttpError(
                        "NotFound",
                        `Unmatched leftover path segments: ${pathSegments
                            .map((s) => `'${s}'`)
                            .join(",")}`,
                    );
                }

                const schema =
                    typeof schemaProvider === "function" ? await schemaProvider() : schemaProvider;

                const defaultMeta =
                    typeof defaultMetaProvider === "function"
                        ? await defaultMetaProvider()
                        : defaultMetaProvider;

                const paramsSource = method === "GET" ? searchParams : requestBody;
                const params = parseUrlSearchParams(schema, paramsSource);

                return (
                    <metaContext.Provider value={merge(cloneDeep(defaultMeta), meta)}>
                        <Parent>
                            <Handler {...params} />
                        </Parent>
                    </metaContext.Provider>
                );
            }),

        /**
         * Represents a set of routes that are matched against an incoming HTTP request to determine
         * which sub-routes to match or render.
         *
         * The routes can either be JSX components rendered on a request with optional search or
         * body parameters (depending on the HTTP method). Or you can forward to additional sets of
         * routes, potentially for lazy loading or just to decompose the route definition for
         * reasons of readability. Moreover, the set can also contain a dynamic path parameter.
         *
         * Note that the defined routes must not be ambiguous. Some ambiguity errors can be detected
         * by the TypeScript compiler, others might throw at runtime when the route definition is
         * first loaded (typically at server start, but potentially also later on due to lazy
         * loading). In particular:
         *
         * - There can be only a single dynamic path parameter in a routes set.
         * - Route forwarding (e.g., `/abc`) and route definitions (e.g., `GET /abc`) cannot overlap.
         * - Route forwardings on `/` are only allowed if there is no path parameter.
         *
         * However, it _is_ OK to have both "GET /abc" and "POST /abc", because these can be
         * disambiguated based on the HTTP method.
         *
         * @param def The definition of the routes adhering to the constraints mentioned above.
         * @param wrapper An optional wrapper component that is applied around all child routes. It
         *   gets the JSX contents of the rendered route as the `children` prop, which must be
         *   rendered by the wrapper somewhere.
         */
        routes: <Def extends RoutesDefinition<Def>>(
            def: Def,
            wrapper?: JsxComponent<PropsWithChildren>,
        ): RoutesComponent<Def> => {
            // A lookup table that returns the routing component to be rendered for a combination of
            // HTTP method and path segment.
            const lookup = Object.fromEntries(
                httpMethods.map((method) => [method, new Map()]),
            ) as Record<HttpMethod, Map<string, RouteComponent<any, any> | RoutesComponent<any>>>;

            // Represents the `/` route that forwards to a subrouter or the `/:param` route of
            // this router, of which there can be at most one, as the routing would otherwise be
            // ambiguous, since we can't know whether we should capture the parameter or forward
            // to the subrouter.
            let fallbackComponent: RoutesComponent<any> | ParamComponent<any, any> | undefined =
                undefined;

            function ensureIsValidPathSegment(pathSegment: string) {
                if (
                    pathSegment.includes(":") ||
                    pathSegment.includes("/") ||
                    pathSegment.includes(" ")
                ) {
                    throw new Error("Invalid space, slash, or colon in path segment.");
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
                            self.route(z.object({}), () => <Component />),
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
                        setFallbackComponent(value, route.slice(2));
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

            const Wrapper = wrapper ?? (({ children }: PropsWithChildren) => <>{children}</>);

            return tag(routesSymbol, ({ parent: Parent, pathSegments, meta }) => {
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

                return (
                    <Component
                        pathSegments={remainingPathSegments}
                        meta={meta}
                        parent={({ children }) => (
                            <Parent>
                                <Wrapper>{children}</Wrapper>
                            </Parent>
                        )}
                    />
                );
            });
        },

        /**
         * A path parameter is a dynamic path segment that matches all values allowed by the given
         * Zod schema. There can be only one path parameter in a single routes definition to
         * disambiguate requests. The Zod schema is _not_ considered for disambiguation, similar to
         * how JavaScript doesn't allow function overloading based on parameter types.
         *
         * @param schemaProvider The Zod schema the path parameter must adhere to. If a parsing
         *   error occurs, status code 400 (bad request) is returned to the browser by default.
         * @param nestedRoutes The child routes that have access to the parsed parameter value.
         */
        param: <PathParamIn, PathParamOut, Router extends RoutesComponent<any>>(
            schemaProvider: Provide<ZodType<PathParamOut, any, PathParamIn>>,
            nestedRoutes: (pathParam: () => PathParamOut) => Router,
        ): ParamComponent<PathParamIn, Router> => {
            const paramContext = createContext<PathParamOut>({ name: "path parameter" });
            const Component = nestedRoutes(() => useContext(paramContext));

            return tag(paramSymbol, async ({ parent, pathSegments, meta }) => {
                const paramSchema =
                    typeof schemaProvider === "function" ? await schemaProvider() : schemaProvider;
                const param = unpack(paramSchema, decodeURIComponent(pathSegments[0] ?? ""))!;

                return (
                    <paramContext.Provider value={param}>
                        <Component
                            pathSegments={pathSegments.slice(1)}
                            parent={parent}
                            meta={meta}
                        />
                    </paramContext.Provider>
                );
            });
        },

        /**
         * Allows for lazy loading of nested routes definition. Thus, the code for these lazily
         * loaded routes doesn't get loaded on server start, but only once the first request is made
         * that resolves to one of those routes. Note that the code might be loaded anyway on server
         * startup if the server code gets bundled, for instance, or the file is non-lazily imported
         * elsewhere.
         *
         * @param loadModule An asynchronous method that imports a file and returns the default
         *   export. Similar in use to the function expected by `await import`.
         * @param params If the lazily-loaded routes definition depends on path parameters, provide
         *   these parameters as the second argument so that they get passed through when the code
         *   is loaded.
         */
        lazy: <T extends RoutesComponent<any> | ((...p: any[]) => RoutesComponent<any>)>(
            loadModule: () => Promise<{ default: T }>,
            ...params: T extends RoutesComponent<any> ? [] : Parameters<T>
        ): T extends RoutesComponent<any> ? T : ReturnType<T> => {
            let Component: RoutesComponent<any> | undefined = undefined;

            return tag(routesSymbol, async ({ parent, pathSegments, meta }) => {
                if (!Component) {
                    const imported = (await loadModule()).default;
                    Component = is(routesSymbol, imported) ? imported : imported(...params);
                }

                return <Component pathSegments={pathSegments} parent={parent} meta={meta} />;
            }) as any;
        },
    };

    return self;
}

export type RouterProps<Routes extends RoutesComponent<any>> = {
    readonly routes: Routes;
};

/** A router that determines the route that should be rendered based on the current HTTP request. */
export function Router<Routes extends RoutesComponent<any>>({
    routes: Routes,
}: RouterProps<Routes>) {
    const { requestPath } = useHttpContext();
    return (
        <Routes pathSegments={requestPath} parent={({ children }) => <>{children}</>} meta={{}} />
    );
}

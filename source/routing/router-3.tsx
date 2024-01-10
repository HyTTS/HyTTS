import type { ZodEnum, ZodType } from "zod";
import { type HttpMethod, useHttpContext } from "@/http/http-context";
import { HttpError } from "@/http/http-error";
import { ErrorBoundary } from "@/jsx/error-boundary";
import {
    isJsxExpression,
    type JsxComponent,
    type JsxElement,
    type JsxExpression,
    type PropsWithChildren,
} from "@/jsx/jsx-types";
import { unpack } from "@/serialization/data-packing";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type Provide<T> = T | (() => T | Promise<T>);

export const routesSymbol = Symbol();
export const pathParamsSymbol = Symbol();
export const searchParamsSymbol = Symbol();
export const bodyParamsSymbol = Symbol();
export const hashParamSymbol = Symbol();

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
                      : T[Key] extends ParamsConfig<typeof pathParamsSymbol, {}, any>
                        ? T[Key]
                        : "ERROR: Schema for optional path parameter must handle `undefined` values."
                  : ParamsConfig<typeof pathParamsSymbol, any, any>
            : Key extends `/${infer Path}`
              ? Path extends `${string}:${string}`
                  ? "ERROR: Colons are not allowed in a path segment."
                  : Path extends `${string}?${string}`
                    ? "ERROR: Question marks are not allowed in a path segment."
                    :
                          | RoutesConfig<any>
                          | ParamsConfig<typeof searchParamsSymbol, any, any>
                          | ParamsConfig<typeof bodyParamsSymbol, any, any>
                          | ParamsConfig<typeof hashParamSymbol, any, any>
              : Key extends `${HttpMethod} /${infer Path}`
                ? Path extends `${string}:${string}`
                    ? "ERROR: Colons are not allowed in a path segment."
                    : Path extends `${string}?${string}`
                      ? "ERROR: Question marks are not allowed in a path segment."
                      : JsxElement | JsxComponent
                : "ERROR: Properties must start with '{HttpMethod} /' or just '/'.";
};

type ParamsKind =
    | typeof pathParamsSymbol
    | typeof searchParamsSymbol
    | typeof bodyParamsSymbol
    | typeof hashParamSymbol;

export type RoutingComponentProps = { readonly pathSegments: string[] };
export type RoutingComponent<Config extends RoutingConfig> = Config &
    JsxComponent<RoutingComponentProps>;

export type RoutingConfig = RoutesConfig<any> | ParamsConfig<ParamsKind, any, any>;

export type RoutesConfig<Def extends RoutesDefinition<Def>> = {
    readonly kind: typeof routesSymbol;
    readonly typeInfo?: Def; // is that needed?
};

export type ParamsConfig<Kind extends ParamsKind, Params, Routes extends RoutingConfig> = {
    readonly kind: ParamsKind;
    readonly typeInfo?: [Kind, Params, Routes]; // is that needed?
};

function params<Kind extends ParamsKind>(
    kind: Kind,
    consumePathSegment: boolean,
    getParams: <Params extends Record<string, unknown>>(
        schema: ZodType<Params, any, any>,
        pathSegments: string[],
    ) => Params | undefined,
) {
    return <
        ParamsIn extends Record<string, unknown>,
        ParamsOut extends Record<string, unknown>,
        Routes extends RoutingComponent<RoutingConfig>,
    >(
        schemaProvider: Provide<ZodType<ParamsOut, any, ParamsIn>>,
        getRoutes: Routes extends RoutingComponent<ParamsConfig<Kind, any, any>>
            ? "ERROR: Unexpected path parameters."
            : (params: ParamsOut) => Routes,
    ): RoutingComponent<ParamsConfig<Kind, ParamsOut, Routes>> => {
        return createRoutingComponent(kind, async ({ pathSegments }: RoutingComponentProps) => {
            const params = getParams(
                typeof schemaProvider === "function" ? await schemaProvider() : schemaProvider,
                pathSegments,
            );

            const Routes = (getRoutes as (params: ParamsOut) => Routes)(params!);
            return <Routes pathSegments={pathSegments.slice(consumePathSegment ? 1 : 0)} />;
        });
    };
}

export const pathParams = params(pathParamsSymbol, true, (schema, pathSegments) =>
    unpack(schema, pathSegments[0] ? decodeURIComponent(pathSegments[0]) : undefined),
);

export const searchParams = params(searchParamsSymbol, false, (schema) =>
    parseUrlSearchParams(schema, useHttpContext().searchParams),
);

export const bodyParams = params(bodyParamsSymbol, false, (schema) =>
    parseUrlSearchParams(schema, useHttpContext().requestBody),
);

export function hashParam<
    const ParamValues extends [string, ...string[]],
    Routes extends RoutingComponent<RoutingConfig>,
>(
    paramValues: ParamValues,
    Routes: Routes extends RoutingComponent<ParamsConfig<typeof pathParamsSymbol, any, any>>
        ? "ERROR: Unexpected path parameters."
        : Routes,
): RoutingComponent<ParamsConfig<typeof hashParamSymbol, ParamValues, Routes>> {
    return createRoutingComponent(hashParamSymbol, ({ pathSegments }) => (
        <Routes pathSegments={pathSegments} />
    ));
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
 * - Route forwardings and route definitions cannot overlap.
 * - Route forwardings on `/` are only allowed if there is no path parameter.
 *
 * @param def The definition of the routes adhering to the constraints mentioned above.
 */
export function routes<Def extends RoutesDefinition<Def>>(
    def: Def,
): RoutingComponent<RoutesConfig<Def>> {
    const routes = Object.entries(def) as [
        string,
        JsxExpression | JsxComponent | RoutingComponent<RoutingConfig>,
    ][];

    return createRoutingComponent(routesSymbol, ({ pathSegments }) => {
        if (pathSegments.length === 0) {
            throw new HttpError("NotFound");
        }

        const { method } = useHttpContext();

        // Render the first matching route, otherwise throw a 404 error.
        for (const [route, Render] of routes) {
            // If we have a "leaf" route in the routing tree, we can render it directly as long as
            // we've consumed all path segments.
            if (!("kind" in Render)) {
                if (route === `${method} ${pathSegments[0]}`) {
                    if (pathSegments.length !== 1) {
                        throw new HttpError("NotFound");
                    } else if (isJsxExpression(Render)) {
                        return <>{Render}</>;
                    } else {
                        return <Render />;
                    }
                } else {
                    continue;
                }
            }

            // Otherwise, we have to descend recursively into the routing tree.
            switch (Render.kind) {
                case routesSymbol: {
                    if (pathSegments[0]?.startsWith(route)) {
                        return <Render pathSegments={pathSegments} />;
                    } else {
                        continue;
                    }
                }
                case pathParamsSymbol:
                case searchParamsSymbol:
                case bodyParamsSymbol:
                case hashParamSymbol: {
                    return <Render pathSegments={pathSegments} />;
                }
                default: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const exhaustiveSwitch: never = Render;
                    throw new Error("Invalid routes definition.");
                }
            }
        }

        throw new HttpError("NotFound");
    });
}

/**
 * Allows for lazy loading of nested routes definitions. Thus, the code for these lazily loaded
 * routes does not have to be loaded on server start, but only once the first request is made that
 * resolves to one of those routes.
 *
 * @param loadModule An asynchronous method that imports a file and returns the default export.
 * @param params If the lazily-loaded routes definition depends on routing parameters, provide these
 *   parameters so that they can get passed through when the code is lazily loaded and executed.
 */
export function lazy<Routes extends RoutingComponent<RoutesConfig<any>>, Args extends any[]>(
    loadModule: () => Promise<{ default: Routes | ((...args: Args) => Routes) }>,
    ...params: Args
): Routes {
    let Component: Routes | undefined;
    return createRoutingComponent(routesSymbol, async ({ pathSegments }) => {
        if (!Component) {
            const imported = (await loadModule()).default;
            if (!("kind" in imported)) {
                Component = imported(...params);
            } else if ("kind" in imported && imported.kind === routesSymbol) {
                Component = imported;
            } else {
                throw new Error("Invalid routes definition.");
            }
        }

        return <Component pathSegments={pathSegments} />;
    }) as Routes;
}

/**
 * Wraps a set of routes with a wrapper component. The wrapper component can be used to provide a
 * JSX context to the wrapped routes like a database object, it can render a layout around all
 * wrapped routes, it can authenticate the request, etc.
 *
 * @param Wrapper The wrapper component that is rendered around all wrapped routes.
 * @param routes The routes to wrap.
 */
export function wrapRoutes<Def extends RoutesDefinition<Def>>(
    Wrapper: JsxComponent<PropsWithChildren>,
    Routes: RoutingComponent<RoutesConfig<Def>>,
): RoutingComponent<RoutesConfig<Def>> {
    return createRoutingComponent(routesSymbol, ({ pathSegments }) => (
        <Wrapper>
            <Routes pathSegments={pathSegments} />
        </Wrapper>
    ));
}

export type CombinedRoutes<Def extends Record<string, unknown>> = Def extends RoutesDefinition<Def>
    ? RoutingComponent<RoutesConfig<Def>>
    : never;

/**
 * Combines two route configurations together, merging their defined routes. The resulting type
 * indicates an error if the two route configurations define the same path segment.
 */
export function combineRoutes<
    Def1 extends RoutesDefinition<Def1>,
    Def2 extends RoutesDefinition<Def2>,
>(
    Routes1: RoutingComponent<RoutesConfig<Def1>>,
    routes2: Extract<keyof Def1, keyof Def2> extends never
        ? "ERROR: Paths of the combined routes configs must not overlap."
        : RoutingComponent<RoutesConfig<Def2>>,
): CombinedRoutes<Def1 & Def2> {
    return createRoutingComponent(routesSymbol, ({ pathSegments }) => (
        <ErrorBoundary
            ErrorView={({ error }) => {
                // TODO: Can we distinguish this somehow else?
                if (error instanceof HttpError && error.errorCode === "NotFound") {
                    const Routes2 = routes2 as RoutingComponent<RoutesConfig<Def2>>;
                    return <Routes2 pathSegments={pathSegments} />;
                } else {
                    throw error;
                }
            }}
        >
            <Routes1 pathSegments={pathSegments} />
        </ErrorBoundary>
    )) as CombinedRoutes<Def1 & Def2>;
}

function createRoutingComponent<Kind extends RoutingConfig["kind"]>(
    kind: Kind,
    component: JsxComponent<RoutingComponentProps>,
) {
    return Object.assign(component, { kind });
}

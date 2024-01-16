import { z, type ZodType } from "zod";
import { type HttpMethod, useHttpContext, useRequester } from "@/http/http-context";
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
import type { Flatten } from "@/types";

export const routingSymbol = Symbol();
export const routesSymbol = Symbol();
export const pathParamSymbol = Symbol();
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
                      : T[Key] extends PathParamConfig<undefined, any>
                        ? T[Key]
                        : "ERROR: Schema for optional path parameter must handle `undefined` values."
                  : PathParamConfig<any, NestedRoutingConfig>
            : Key extends `/${infer Path}`
              ? Path extends `${string}:${string}`
                  ? "ERROR: Colons are not allowed in a path segment."
                  : Path extends `${string}?${string}`
                    ? "ERROR: Question marks are not allowed in a path segment."
                    : T[Key] extends RoutesConfig<any>
                      ? T[Key]
                      : T[Key] extends SearchParamsConfig<any, any>
                        ? T[Key]
                        : T[Key] extends BodyParamsConfig<any, any>
                          ? T[Key]
                          : T[Key] extends HashParamConfig<any, any>
                            ? T[Key]
                            : never
              : Key extends `${HttpMethod} /${infer Path}`
                ? Path extends `${string}:${string}`
                    ? "ERROR: Colons are not allowed in a path segment."
                    : Path extends `${string}?${string}`
                      ? "ERROR: Question marks are not allowed in a path segment."
                      : JsxElement | JsxComponent
                : "ERROR: Properties must start with '{HttpMethod} /' or just '/'.";
};

export type RoutingComponent = JsxComponent<{ pathSegments: string[] }>;

export type RoutesConfig<Def extends RoutesDefinition<Def>> = {
    readonly [routingSymbol]: typeof routesSymbol;
    readonly typeInfo?: Def;
    readonly Component: RoutingComponent;
};

export type PathParamConfig<
    Param,
    Routes extends NestedComponentOrRoutes<Param, NestedRoutingConfig>,
> = {
    readonly [routingSymbol]: typeof pathParamSymbol;
    readonly typeInfo?: [(params: Param) => void];
    readonly routes?: Routes;
    readonly Component: RoutingComponent;
};

export type SearchParamsConfig<
    Params,
    Routes extends NestedComponentOrRoutes<Params, NestedRoutingConfig>,
> = {
    readonly [routingSymbol]: typeof searchParamsSymbol;
    readonly routes?: Routes;
    readonly Component: RoutingComponent;
};

export type BodyParamsConfig<
    Params,
    Routes extends NestedComponentOrRoutes<Params, NestedRoutingConfig>,
> = {
    readonly [routingSymbol]: typeof bodyParamsSymbol;
    readonly routes?: Routes;
    readonly Component: RoutingComponent;
};

export type HashParamConfig<
    Param,
    Routes extends NestedComponentOrRoutes<Param, NestedRoutingConfig>,
> = {
    readonly [routingSymbol]: typeof hashParamSymbol;
    readonly routes?: Routes;
    readonly Component: RoutingComponent;
};

export type RoutingConfig =
    | RoutesConfig<any>
    | PathParamConfig<any, any>
    | SearchParamsConfig<any, any>
    | BodyParamsConfig<any, any>
    | HashParamConfig<any, any>;

export type NestedRoutingConfig = Exclude<RoutingConfig, PathParamConfig<any, any>>;
export type NestedComponentOrRoutes<Params, Nested extends NestedRoutingConfig> =
    | JsxElement
    | JsxComponent<Params>
    | Nested
    | ((params: Params) => Nested | Promise<Nested>);

async function renderNested<Params, Nested extends NestedRoutingConfig>(
    pathSegments: string[],
    params: Params,
    nested: NestedComponentOrRoutes<Params, Nested>,
): Promise<JsxElement> {
    if (nested === null || isJsxExpression(nested)) {
        return nested;
    } else if (routingSymbol in nested) {
        return <nested.Component pathSegments={pathSegments} />;
    } else if (nested instanceof Promise) {
        return await nested;
    } else {
        const result = await nested(params);
        if (result === null || isJsxExpression(result)) {
            return result;
        } else if (routingSymbol in result) {
            return <result.Component pathSegments={pathSegments} />;
        } else {
            throw new Error("Invalid nested routes.");
        }
    }
}

export function pathParam<
    ParamIn,
    ParamOut,
    Nested extends NestedComponentOrRoutes<ParamOut, NestedRoutingConfig>,
>(schema: ZodType<ParamOut, any, ParamIn>, nested: Nested): PathParamConfig<ParamOut, Nested> {
    return {
        [routingSymbol]: pathParamSymbol,
        Component: async ({ pathSegments }) => {
            return renderNested(
                pathSegments.slice(1),
                unpack(schema, pathSegments[0] ? decodeURIComponent(pathSegments[0]) : undefined)!,
                nested,
            );
        },
    };
}

export function searchParams<
    ParamsIn extends Record<string, unknown>,
    ParamsOut extends Record<string, unknown>,
    Nested extends NestedComponentOrRoutes<ParamsOut, NestedRoutingConfig>,
>(
    schema: ZodType<ParamsOut, any, ParamsIn>,
    nested: Nested,
): SearchParamsConfig<ParamsOut, Nested> {
    return {
        [routingSymbol]: searchParamsSymbol,
        Component: async ({ pathSegments }) => {
            return renderNested(
                pathSegments,
                parseUrlSearchParams(schema, useHttpContext().searchParams)!,
                nested,
            );
        },
    };
}

const y = searchParams(z.object({ q: z.string() }), <></>);
const y0 = searchParams(z.object({ q: z.string() }), null);
const y10 = searchParams(z.object({ q: z.string() }), () =>
    bodyParams(z.object({ x: z.string() }), ({ x }) => <></>),
);
const y101 = searchParams(z.object({ q: z.string() }), ({ q }) =>
    bodyParams(z.object({ x: z.string() }), ({ x }) => <></>),
);
const y3 = searchParams(z.object({ q: z.string() }), ({ q }) => <></>);
const y2 = searchParams(z.object({ q: z.string() }), routes({ "GET /": <></> }));
const y22 = searchParams(z.object({ q: z.string() }), ({ q }) => routes({ "GET /": <></> }));
const x = routes({
    "/": searchParams(z.object({ q: z.string() }), ({ q }) => <></>),
    "/2": searchParams(z.object({ q: z.string() }), ({ q }) => routes({ "GET /": <></> })),
    "/3": searchParams(z.object({ q: z.string() }), ({ q }) =>
        bodyParams(z.object({ x: z.string() }), ({ x }) => <></>),
    ),
});

export function bodyParams<
    ParamsIn extends Record<string, unknown>, // input is something that always takes string????
    ParamsOut extends Record<string, unknown>,
    Nested extends NestedComponentOrRoutes<ParamsOut, NestedRoutingConfig>,
>(schema: ZodType<ParamsOut, any, ParamsIn>, nested: Nested): BodyParamsConfig<ParamsOut, Nested> {
    return {
        [routingSymbol]: bodyParamsSymbol,
        Component: async ({ pathSegments }) => {
            return renderNested(
                pathSegments,
                parseUrlSearchParams(schema, useHttpContext().requestBody)!,
                nested,
            );
        },
    };
}

export function hashParam<
    const ParamValues extends [string, ...string[]],
    Nested extends NestedComponentOrRoutes<ParamValues, NestedRoutingConfig>,
>(_paramValues: ParamValues, nested: Nested): HashParamConfig<ParamValues, Nested> {
    return {
        [routingSymbol]: hashParamSymbol,
        Component: async ({ pathSegments }) => renderNested(pathSegments, undefined!, nested),
    };
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
export function routes<Def extends RoutesDefinition<Def>>(def: Def): RoutesConfig<Def> {
    const lookup = def as Record<string, NestedComponentOrRoutes<{}, NestedRoutingConfig>>;
    const paramsPaths = Object.keys(lookup).filter((key) => key.startsWith("/:"));
    const pathParamConfig = paramsPaths[0] ? lookup[paramsPaths[0]] : undefined;

    if (paramsPaths.length > 1) {
        throw new Error(`Invalid multiple path params '${paramsPaths.join(", ")}'.`);
    }

    return {
        [routingSymbol]: routesSymbol,
        Component: async ({ pathSegments }) => {
            const { method } = useHttpContext();

            console.log("==============", pathSegments);

            // If we're at the last path segment, there must be a matching GET or POST route.
            if (pathSegments.length <= 1) {
                const key = `${method} /${pathSegments[0] ?? ""}`;
                const match = lookup[key];
                console.log("exact route", key, !!match);
                if (match) {
                    return renderNested([], {}, match);
                }
            }

            // Otherwise, first check if we have a static path segment that matches.
            const key = `/${pathSegments[0] ?? ""}`;
            const match = lookup[key];
            console.log("static path segment", { key, match: match });
            if (match) {
                return renderNested(pathSegments.slice(1), {}, match);
            }

            // Else, check if we have a path param that matches, fall back to the '/' route,
            // or give up because we can't find a match.
            if (pathParamConfig) {
                console.log("params match", { params: paramsPaths });
                return renderNested(pathSegments, {}, pathParamConfig);
            } else {
                const fallback = lookup["/"];
                console.log("fallback", fallback);
                if (fallback) {
                    return renderNested(pathSegments, {}, fallback);
                } else {
                    throw new HttpError("NotFound");
                }
            }
        },
    };
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
export function lazy<Def extends RoutesDefinition<Def>, Args extends any[]>(
    loadModule: () => Promise<{
        default:
            | RoutesConfig<Def>
            | ((...args: Args) => RoutesConfig<Def> | Promise<RoutesConfig<Def>>);
    }>,
    ...params: Args
): RoutesConfig<Def> {
    let Component: RoutingComponent | undefined;
    return {
        [routingSymbol]: routesSymbol,
        Component: async ({ pathSegments }) => {
            if (!Component) {
                const imported = (await loadModule()).default;
                if (routingSymbol in imported) {
                    Component = imported.Component;
                } else if (typeof imported === "function") {
                    const nested = await imported(...params);
                    if (routingSymbol in nested) {
                        Component = nested.Component;
                    } else {
                        throw new Error("Invalid routes definition.");
                    }
                } else {
                    throw new Error("Invalid routes definition.");
                }
            }

            return <Component pathSegments={pathSegments} />;
        },
    };
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
    routes: RoutesConfig<Def>,
): RoutesConfig<Def> {
    return {
        ...routes,
        Component: ({ pathSegments }) => (
            <Wrapper>
                <routes.Component pathSegments={pathSegments} />
            </Wrapper>
        ),
    };
}

export type CombinedRoutes<Def extends Record<string, unknown>> = Def extends RoutesDefinition<Def>
    ? RoutesConfig<Def>
    : never;

/**
 * Combines two route configurations together, merging their defined routes. The resulting type
 * indicates an error if the two route configurations define the same path segment.
 */
export function combineRoutes<
    Def1 extends RoutesDefinition<Def1>,
    Def2 extends RoutesDefinition<Def2>,
>(
    routes1: RoutesConfig<Def1>,
    routes2: Extract<keyof Def1, keyof Def2> extends never
        ? "ERROR: Paths of the combined routes configs must not overlap."
        : RoutesConfig<Def2>,
): CombinedRoutes<Def1 & Def2> {
    return {
        [routingSymbol]: routesSymbol,
        Component: ({ pathSegments }) => (
            <ErrorBoundary
                ErrorView={({ error }) => {
                    if (error instanceof HttpError && error.errorCode === "NotFound") {
                        if (typeof routes2 === "object" && routingSymbol in routes2) {
                            return <routes2.Component pathSegments={pathSegments} />;
                        } else {
                            throw new Error("Invalid routes definition.");
                        }
                    } else {
                        throw error;
                    }
                }}
            >
                <routes1.Component pathSegments={pathSegments} />
            </ErrorBoundary>
        ),
    } as CombinedRoutes<Def1 & Def2>;
}

export type RoutesFunction<Routes extends RoutingConfig> = () => Routes | Promise<Routes>;
export type RouterProps<Routes extends RoutingConfig> = {
    readonly routes: RoutesFunction<Routes>;
};

/** A router that determines the route that should be rendered based on the current HTTP request. */
export async function Router<Routes extends RoutingConfig>(props: RouterProps<Routes>) {
    const { method, requestPath } = useHttpContext();
    const routes = await props.routes();

    if (method !== "GET" && useRequester() !== "HyTTS") {
        throw new HttpError(
            "BadRequest",
            "Non-GET requests originating from the browser are unsupported.",
        );
    }

    return <routes.Component pathSegments={requestPath} />;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface RegisterRoutes {
    // provided by library user:
    // routes: RoutingConfig;
}

export type GetRoutes = RegisterRoutes extends {
    routes: infer T extends NestedRoutingConfig;
}
    ? T
    : NestedRoutingConfig;

export type SomeRouteParams = {
    readonly path?: Record<string, unknown>;
    readonly search?: Record<string, unknown>;
    readonly body?: Record<string, unknown>;
    readonly hash?: string;
};

export type RoutesInfo<Routes extends NestedRoutingConfig = GetRoutes> = Flatten<{
    [T in CollectRoutes<Routes, "", {}, {}, {}, []> as T[1]]: {
        method: T[0];
        params: MakeEmptyPropertiesOptional<{
            path: T[2];
            search: T[3];
            body: T[4];
            hash: T[5][number];
        }>;
    };
}>;

type CollectRoutes<
    Routes extends NestedComponentOrRoutes<any, any>,
    Path extends string,
    PathParams extends Record<string, any>,
    SearchParams extends Record<string, any>,
    BodyParams extends Record<string, any>,
    HashParam extends string[],
> = Routes extends () => Promise<infer SubRoutes extends NestedRoutingConfig>
    ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams, BodyParams, HashParam>
    : Routes extends RoutesConfig<infer Def>
      ? CollectRoutesFromRoutesDefinition<
            Def,
            keyof Def,
            Path,
            PathParams,
            SearchParams,
            BodyParams,
            HashParam
        >
      : Routes extends SearchParamsConfig<infer Params, infer SubRoutes>
        ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams & Params, BodyParams, HashParam>
        : Routes extends BodyParamsConfig<infer Params, infer SubRoutes>
          ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams, BodyParams & Params, HashParam>
          : Routes extends HashParamConfig<infer Param extends string[], infer SubRoutes>
            ? CollectRoutes<
                  SubRoutes,
                  Path,
                  PathParams,
                  SearchParams,
                  BodyParams,
                  [...HashParam, ...Param]
              >
            : never;

type CollectRoutesFromRoutesDefinition<
    Routes extends RoutesDefinition<Routes>,
    Key extends keyof Routes,
    Path extends string,
    PathParams extends Record<string, any>,
    SearchParams extends Record<string, any>,
    BodyParams extends Record<string, any>,
    HashParam extends string[],
> = Key extends `${infer Method extends HttpMethod} /${infer SubPath}`
    ? [
          Method,
          `${Method} ${CombinePaths<Path, SubPath>}`,
          SubPath extends "" ? PathParams : Required<PathParams>,
          SearchParams,
          BodyParams,
          HashParam,
      ]
    : Key extends `/:${infer ParamPath}?`
      ? Routes[Key] extends PathParamConfig<infer Param, infer SubRoutes>
          ? CollectRoutes<
                SubRoutes,
                CombinePaths<Path, `:${ParamPath}`>,
                Required<PathParams> & { [K in ParamPath]?: Param },
                SearchParams,
                BodyParams,
                HashParam
            >
          : never
      : Key extends `/:${infer ParamPath}`
        ? Routes[Key] extends PathParamConfig<infer Param, infer SubRoutes>
            ? CollectRoutes<
                  SubRoutes,
                  CombinePaths<Path, `:${ParamPath}`>,
                  Required<PathParams> & { [K in ParamPath]: Param },
                  SearchParams,
                  BodyParams,
                  HashParam
              >
            : never
        : Key extends `/${infer SubPath}`
          ? CollectRoutes<
                Routes[Key],
                CombinePaths<Path, SubPath>,
                Required<PathParams>,
                SearchParams,
                BodyParams,
                HashParam
            >
          : never;

type CombinePaths<Path extends string, SubPath extends string> = Path extends `${"" | "/"}`
    ? SubPath extends ""
        ? "/"
        : `/${SubPath}`
    : SubPath extends ""
      ? Path
      : `${Path}/${SubPath}`;

type MakeEmptyPropertiesOptional<T extends Record<string, any>> = {
    [K in keyof T as keyof RemoveUnnecessaryProperties<T[K]> extends never
        ? never
        : T[K] extends []
          ? never
          : K]: T[K];
} & {
    [K in keyof T as keyof RemoveUnnecessaryProperties<T[K]> extends never
        ? K
        : T[K] extends []
          ? K
          : never]?: T[K];
};

type RemoveUnnecessaryProperties<T> = {
    [K in keyof T as keyof T[K] extends never ? never : K]: T[K];
};

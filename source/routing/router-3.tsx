import { z, type ZodEnum, ZodError, type ZodType } from "zod";
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
import { zLocalDate } from "@/serialization/date-time";
import { parseUrlSearchParams } from "@/serialization/url-params";
import type { Flatten } from "@/types";

export const routingSymbol = Symbol();
export const routesSymbol = Symbol();
export const paramsSymbol = Symbol();

export type RoutesDefinition<T extends Record<string, unknown>> = {
    readonly [Key in keyof T & string]: Key extends `${string}/${string}/${string}`
        ? "ERROR: Path segments cannot contain slashes except at the start."
        : Key extends `${`${HttpMethod} ` | ""}/${string} ${string}`
          ? "ERROR: Path segments cannot contain spaces."
          : Key extends `${`${HttpMethod} ` | ""}/:${infer Param}`
            ? Param extends ""
                ? "ERROR: Expected path parameter to be named."
                : Param extends `${string}:${string}`
                  ? "ERROR: Path parameters cannot contain colons except at the start."
                  : T[Key] extends ParamsConfig<
                          infer PathParam extends Record<Param, {}>,
                          any,
                          any,
                          any,
                          infer SubRoutes
                      >
                    ? keyof PathParam extends Param
                        ? Key extends `${HttpMethod} /:${string}`
                            ? SubRoutes extends JsxElement
                                ? T[Key]
                                : "ERROR: JSX element expected; cannot define sub-routes at this point."
                            : SubRoutes extends RoutesConfig<any>
                              ? T[Key]
                              : "ERROR: Additional sub-routes expected; cannot render JSX at this point."
                        : `ERROR: Expected only path parameter '${Param}' to be specified in 'path' schema.`
                    : `ERROR: Expected path parameter '${Param}' to be specified in 'path' schema.`
            : Key extends `/${infer Path}`
              ? Path extends `${string}:${string}`
                  ? "ERROR: Colons are not allowed in a path segment."
                  : T[Key] extends ParamsConfig<Record<string, unknown>, any, any, any, any>
                    ? "ERROR: Unexpected path parameter definition."
                    : T[Key] extends
                            | RoutesConfig<any>
                            | Promise<RoutesConfig<any>>
                            | ParamsConfig<any, any, any, any, RoutesConfig<any>>
                      ? T[Key]
                      : "ERROR: Expected a routes definition or a route params definition with sub routes."
              : Key extends `${HttpMethod} /${infer Path}`
                ? Path extends `${string}:${string}`
                    ? "ERROR: Colons are not allowed in a path segment."
                    : T[Key] extends ParamsConfig<Record<string, unknown>, any, any, any, any>
                      ? "ERROR: Unexpected path parameter definition."
                      : T[Key] extends
                              | JsxElement
                              | JsxComponent
                              | ParamsConfig<any, any, any, any, JsxElement>
                              | MethodDependantParamsConfig<
                                    Record<
                                        HttpMethod,
                                        ParamsConfig<undefined, any, any, any, JsxElement>
                                    >
                                >
                        ? T[Key]
                        : "ERROR: Expected a JSX element, a JSX component, or a route params definition with a nested JSX element."
                : "ERROR: Properties must start with '{HttpMethod} /' or just '/'.";
};

export type RoutingComponent = JsxComponent<{ pathSegments: string[] }>;

export type RoutesConfig<Def extends RoutesDefinition<Def>> = {
    readonly [routingSymbol]: typeof routesSymbol;
    readonly typeInfo?: Def;
    readonly Component: RoutingComponent;
};

export type ParamsConfig<
    PathParam extends Record<string, unknown> | undefined,
    SearchParams extends Record<string, unknown> | undefined,
    BodyParams extends Record<string, unknown> | undefined,
    HashParam extends string[] | undefined,
    Nested extends
        | JsxElement
        | ParamsConfig<any, any, any, any, any>
        | RoutesConfig<any>
        | MethodDependantParamsConfig<
              Record<HttpMethod, ParamsConfig<any, any, any, any, JsxElement>>
          >,
> = {
    readonly [routingSymbol]: typeof paramsSymbol;
    readonly typeInfo?: [PathParam, SearchParams, BodyParams, HashParam];
    readonly routes?: Nested;
    readonly Component: RoutingComponent;
};

export type MethodDependantParamsConfig<
    Params extends Record<HttpMethod, ParamsConfig<any, any, any, any, JsxElement>>,
> = Params;

export function routeParams<
    Nested extends (
        mergedParams: MergeProperties<SearchParams, MergeProperties<BodyParams, PathParam>>,
        params: { path: PathParam; search: SearchParams; body: BodyParams },
    ) =>
        | JsxElement
        | ParamsConfig<
              undefined,
              any, //Record<string, unknown> | undefined,
              any, //Record<string, unknown> | undefined,
              any, //string[] | undefined,
              any
          >
        | Promise<RoutesConfig<any>>
        | MethodDependantParamsConfig<
              Record<HttpMethod, ParamsConfig<any, any, any, any, JsxElement>>
          >,
    PathParam extends Record<string, unknown> | undefined = undefined,
    SearchParams extends Record<string, unknown> | undefined = undefined,
    BodyParams extends Record<string, unknown> | undefined = undefined,
    const HashParam extends [string, ...string[]] | undefined = undefined,
>(
    paramsSchemas: {
        readonly path?: ZodType<PathParam, any, any>;
        readonly search?: ZodType<SearchParams, any, any>;
        readonly body?: ZodType<BodyParams, any, any>;
        readonly hash?: HashParam;
    },
    nested: Nested,
): ReturnType<Nested> extends JsxElement
    ? ParamsConfig<PathParam, SearchParams, BodyParams, HashParam, JsxElement>
    : ReturnType<Nested> extends Promise<RoutesConfig<infer Nested2>>
      ? ParamsConfig<PathParam, SearchParams, BodyParams, HashParam, RoutesConfig<Nested2>>
      : ReturnType<Nested> extends ParamsConfig<
              infer Path2,
              infer Search2,
              infer Body2,
              infer Hash2,
              infer Nested2
          >
        ? ParamsConfig<
              MergeObjects<PathParam, Path2>,
              MergeObjects<SearchParams, Search2>,
              MergeObjects<BodyParams, Body2>,
              MergeHashes<HashParam, Hash2>,
              Nested2
          >
        : ReturnType<Nested> extends MethodDependantParamsConfig<infer ParamsMap>
          ? MethodDependantParamsConfig<{
                GET: ParamsMap["GET"] extends ParamsConfig<
                    infer Path2,
                    infer Search2,
                    infer Body2,
                    infer Hash2,
                    infer Nested2 extends JsxElement
                >
                    ? ParamsConfig<
                          MergeObjects<PathParam, Path2>,
                          MergeObjects<SearchParams, Search2>,
                          MergeObjects<BodyParams, Body2>,
                          MergeHashes<HashParam, Hash2>,
                          Nested2
                      >
                    : never;
                POST: ParamsMap["POST"] extends ParamsConfig<
                    infer Path2,
                    infer Search2,
                    infer Body2,
                    infer Hash2,
                    infer Nested2 extends JsxElement
                >
                    ? ParamsConfig<
                          MergeObjects<PathParam, Path2>,
                          MergeObjects<SearchParams, Search2>,
                          MergeObjects<BodyParams, Body2>,
                          MergeHashes<HashParam, Hash2>,
                          Nested2
                      >
                    : never;
            }>
          : never {
    return {
        [routingSymbol]: paramsSymbol,
        Component: async ({ pathSegments }) => {
            const { searchParams, requestBody } = useHttpContext();

            try {
                const path = paramsSchemas.path
                    ? unpack(paramsSchemas.path, pathSegments[0])
                    : undefined;

                const search = paramsSchemas.search
                    ? parseUrlSearchParams(paramsSchemas.search, searchParams)
                    : undefined;

                const body = paramsSchemas.body
                    ? parseUrlSearchParams(paramsSchemas.body, requestBody)
                    : undefined;

                return renderNested(
                    pathSegments.slice(paramsSchemas.path ? 1 : 0),
                    nested({ ...search, ...body, ...path } as any, { path, search, body } as any),
                );
            } catch (e: unknown) {
                if (e instanceof ZodError) {
                    throw new HttpError("BadRequest", e);
                } else {
                    throw e;
                }
            }
        },
    } satisfies ParamsConfig<any, any, any, any, any> as any;
}

const np1 = routeParams({ search: z.object({ id: z.string() }) }, (params) => routes({}));
const np2 = routeParams({ search: z.object({ id: z.string() }) }, (params) =>
    Promise.resolve(routes({ "GET /": <></> })),
);
const np3 = routeParams({ search: z.object({ id: z.string() }) }, (params) => <></>);
const np4 = routeParams({ search: z.object({ id: z.string() }) }, (params) =>
    Promise.resolve(<></>),
);
const np5 = routeParams({ search: z.object({ id: z.string() }) }, (params1, params1b) => {
    const ex = routeParams({ body: z.object({ x: z.number() }) }, (params2, params2b) => <>{x}</>);
    return ex;
});

const np7 = routeParams({ search: z.object({ id: z.string() }) }, (params1, params1b) => {
    return routeParams({ search: z.object({ bla: z.boolean() }) }, (params2, params2b) => <>{x}</>);
});

const np27 = routeParams({ search: z.object({ id: z.string() }) }, (params1, params1b) => {
    const X22 = routeParams({ search: z.object({ bla: z.boolean() }) }, (params2, params2b) => (
        <>{x}</>
    ));
    return X22;
});

const np8 = routeParams(
    { search: z.object({ id: z.string() }) },
    (params1, params1b) =>
        routeParams(
            { search: z.object({ bla: z.boolean() }), body: z.object({ x: z.number() }) },
            (params2, params2b) => <>{x}</>,
        ) as any as MethodDependantParamsConfig<{
            GET: ParamsConfig<undefined, { x: string }, undefined, undefined, JsxElement>;
            POST: ParamsConfig<undefined, undefined, { x: string }, undefined, JsxElement>;
        }>,
);

// const np1 = routeParams({}, (params) => routes({}));
// const np2 = routeParams({}, (params) => Promise.resolve(routes({ "GET /": <></> })));
// const np3 = routeParams({}, (params) => <></>);
// const np4 = routeParams({}, (params) => Promise.resolve(<></>));
// const np5 = routeParams({}, (params) => routeParams({}, (params) => routes({})));

// const p1 = routeParams({ path: z.object({ id: z.string() }) }, (params) => routes({}));
// const p2 = routeParams({ path: z.object({ id: z.string() }) }, (params) =>
//     Promise.resolve(routes({ "GET /": <></> })),
// );
// const p3 = routeParams({ path: z.object({ id: z.string() }) }, (params) => <></>);
// const p4 = routeParams({ path: z.object({ id: z.string() }) }, (params) => Promise.resolve(<></>));

// const ps1 = routeParams({ search: z.object({ id: z.string() }) }, (params) => routes({}));
// const ps2 = routeParams({ search: z.object({ id: z.string() }) }, (params) =>
//     Promise.resolve(routes({ "GET /": <></> })),
// );
// const ps3 = routeParams({ search: z.object({ id: z.string() }) }, (params) => <></>);
// const ps4 = routeParams({ search: z.object({ id: z.string() }) }, (params) =>
//     Promise.resolve(<></>),
// );

// const hps1 = routeParams(
//     {
//         hash: ["a", "b"],
//         path: z.object({ id: z.string() }),
//         search: z.object({ b: z.boolean() }),
//         body: z.object({ n: z.number() }),
//     },
//     (params) => routes({}),
// );
// const hps2 = routeParams(
//     {
//         hash: ["a", "b"],
//         path: z.object({ id: z.string() }),
//         search: z.object({ b: z.boolean() }),
//         body: z.object({ n: z.number() }),
//     },
//     (params) => Promise.resolve(routes({ "GET /": <></> })),
// );
// const hps3 = routeParams(
//     {
//         hash: ["a", "b"],
//         path: z.object({ id: z.string() }),
//         search: z.object({ b: z.boolean() }),
//         body: z.object({ n: z.number() }),
//     },
//     (params) => <></>,
// );
// const hps4 = routeParams(
//     {
//         hash: ["a", "b"],
//         path: z.object({ b: z.string() }),
//         search: z.object({ b: z.boolean() }),
//         body: z.object({ b: z.number() }),
//     },
//     (params, all) => Promise.resolve(<></>),
// );

// void routes({
//     "GET /": routeParams({}, (params) => routes({})),
//     "GET /2": <></>,
//     "GET /3": () => <></>,
//     "GET /4": routeParams({ path: z.object({}) }, (params) => routes({})),
//     "GET /5": routeParams({ search: z.object({}) }, (params) => routes({})),
//     "GET /6": routes({}),
//     "/": routeParams({}, (params) => routes({})),
//     "/:id": routeParams({ path: z.object({ i2d: z.number(), id: z.boolean() }) }, (params) =>
//         routes({}),
//     ),
//     "/:bla": () => <></>,
//     "/:bla2": routes({}),
//     "/:": <></>,
//     "/a": <></>,
//     "/b": () => <></>,
//     "/c": routes({ "GET /": <></> }),
//     "/d": routeParams({ path: z.object({}) }, (params) => routes({})),
//     "/e": routeParams({ search: z.object({}) }, (params) => routes({})),
//     "/f": routes(() => ({ "GET /": <></> })),
//     "/g": routes(() => Promise.resolve({ "GET /": <></> })),
// });

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
export async function routes<Routes extends Record<string, unknown> & RoutesDefinition<Routes>>(
    getRoutes: Routes | (() => Routes | Promise<Routes>),
): Promise<RoutesConfig<Routes>> {
    const routes = typeof getRoutes === "function" ? await getRoutes() : getRoutes;
    const lookup = routes as Record<
        string,
        | JsxElement
        | JsxComponent
        | ParamsConfig<any, any, any, any, any>
        | RoutesConfig<any>
        | Promise<RoutesConfig<any>>
    >;
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
                    return renderNested([], match);
                }
            }

            // Otherwise, first check if we have a static path segment that matches.
            const key = `/${pathSegments[0] ?? ""}`;
            const match = lookup[key];
            console.log("static path segment", { key, match: match });
            if (match) {
                return renderNested(pathSegments.slice(1), match);
            }

            // Else, check if we have a path param that matches, fall back to the '/' route,
            // or give up because we can't find a match.
            if (pathParamConfig) {
                console.log("params match", { params: paramsPaths });
                return renderNested(pathSegments, pathParamConfig);
            } else {
                const fallback = lookup["/"];
                console.log("fallback", fallback);
                if (fallback) {
                    return renderNested(pathSegments, fallback);
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
export function lazy<
    Def extends Record<string, unknown> & RoutesDefinition<Def>,
    Args extends any[],
>(
    loadModule: () => Promise<{
        default: Promise<RoutesConfig<Def>> | ((...args: Args) => Promise<RoutesConfig<Def>>);
    }>,
    ...params: Args
): RoutesConfig<Def> {
    let Component: RoutingComponent | undefined;
    return {
        [routingSymbol]: routesSymbol,
        Component: async ({ pathSegments }) => {
            if (!Component) {
                const imported = await (await loadModule()).default;
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
export function wrapRoutes<Def extends Record<string, unknown> & RoutesDefinition<Def>>(
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

type CombinedRoutes<Def extends Record<string, unknown>> = Def extends RoutesDefinition<Def>
    ? RoutesConfig<Def>
    : never;

/**
 * Combines two route configurations together, merging their defined routes. The resulting type
 * indicates an error if the two route configurations define the same path segment.
 */
export function combineRoutes<
    Def1 extends Record<string, unknown> & RoutesDefinition<Def1>,
    Def2 extends Record<string, unknown> & RoutesDefinition<Def2>,
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

export type RouterProps<Routes extends RoutesConfig<any>> = {
    readonly routes: Promise<Routes>;
};

/** A router that determines the route that should be rendered based on the current HTTP request. */
export async function Router<Routes extends RoutesConfig<any>>(props: RouterProps<Routes>) {
    const { method, requestPath } = useHttpContext();
    const routes = await props.routes;

    if (method !== "GET" && useRequester() !== "HyTTS") {
        throw new HttpError(
            "BadRequest",
            "Non-GET requests originating from the browser are unsupported.",
        );
    }

    return <routes.Component pathSegments={requestPath} />;
}

async function renderNested(
    pathSegments: string[],
    nested:
        | JsxElement
        | JsxComponent
        | ParamsConfig<any, any, any, any, any>
        | MethodDependantParamsConfig<Record<HttpMethod, ParamsConfig<any, any, any, any, any>>>
        | RoutesConfig<any>
        | Promise<RoutesConfig<any>>,
): Promise<JsxElement> {
    if (nested === null || isJsxExpression(nested)) {
        return nested;
    }

    const result = nested instanceof Promise ? await nested : nested;
    if (result === null || isJsxExpression(result)) {
        return result;
    } else if (routingSymbol in result) {
        return <result.Component pathSegments={pathSegments} />;
    } else if (typeof result === "function") {
        return result({});
    } else {
        // this type does not really exist at runtime
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const allMatched: MethodDependantParamsConfig<
            Record<HttpMethod, ParamsConfig<any, any, any, any, any>>
        > = result;

        throw new Error("Invalid nested routes.");
    }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface RegisterRoutes {
    // provided by library user:
    // routes: Promise<RoutesConfig<any>>;
}

export type GetRoutes = RegisterRoutes extends {
    routes: infer T extends Promise<RoutesConfig<any>>;
}
    ? Awaited<T>
    : RoutesConfig<{}>;

export type SomeRouteParams = {
    readonly path?: Record<string, unknown>;
    readonly search?: Record<string, unknown>;
    readonly body?: Record<string, unknown>;
    readonly hash?: string;
};

export type RoutesInfo<Routes extends RoutesConfig<any> = GetRoutes> = Flatten<{
    [T in CollectRoutes<Routes, "", RouteParams<{}, {}, {}, []>> as T[1]]: {
        method: T[0];
        params: Flatten<MakeEmptyPropertiesOptional<T[2]>>;
    };
}>;

type CollectRoutes<
    Routes extends RoutesConfig<any>,
    Path extends string,
    Params extends RouteParams<any, any, any, any>,
> = Routes extends RoutesConfig<infer Def>
    ? CollectRoutesFromRoutesDefinition<Def, keyof Def, Path, Params>
    : never;

type CollectRoutesFromRoutesDefinition<
    Routes extends RoutesDefinition<Routes>,
    Key extends keyof Routes,
    Path extends string,
    Params extends RouteParams<any, any, any, any>,
> = Key extends `${infer Method extends HttpMethod} /${infer SubPath}`
    ? [
          Method,
          `${Method} ${CombinePaths<Path, SubPath>}`,
          Routes[Key] extends ParamsConfig<any, any, any, any, JsxElement>
              ? CombineParams<Params, Routes[Key]>
              : Routes[Key] extends MethodDependantParamsConfig<infer ParamsMap>
                ? CombineParams<Params, ParamsMap[Method]>
                : Params,
      ]
    : Key extends `/:${infer ParamPath}`
      ? Routes[Key] extends ParamsConfig<
            any,
            any,
            any,
            any,
            infer SubRoutes extends RoutesConfig<any>
        >
          ? CollectRoutes<
                SubRoutes,
                CombinePaths<Path, `:${ParamPath}`>,
                CombineParams<Params, Routes[Key]>
            >
          : never
      : Key extends `/${infer SubPath}`
        ? Routes[Key] extends ParamsConfig<
              any,
              any,
              any,
              any,
              infer SubRoutes extends RoutesConfig<any>
          >
            ? CollectRoutes<
                  SubRoutes,
                  CombinePaths<Path, SubPath>,
                  CombineParams<Params, Routes[Key]>
              >
            : Routes[Key] extends RoutesConfig<any> | Promise<RoutesConfig<any>>
              ? CollectRoutes<Awaited<Routes[Key]>, CombinePaths<Path, SubPath>, Params>
              : never
        : never;

type CombinePaths<Path extends string, SubPath extends string> = Path extends `${"" | "/"}`
    ? SubPath extends ""
        ? "/"
        : `/${SubPath}`
    : SubPath extends ""
      ? Path
      : `${Path}/${SubPath}`;

type RouteParams<
    PathParams extends Record<string, any>,
    SearchParams extends Record<string, any>,
    BodyParams extends Record<string, any>,
    HashParam extends string[],
> = {
    path: PathParams;
    search: SearchParams;
    body: BodyParams;
    hash: HashParam;
};

type CombineParams<
    Params extends RouteParams<any, any, any, any>,
    Config extends ParamsConfig<any, any, any, any, any>,
> = Params extends RouteParams<infer Path1, infer Search1, infer Body1, infer Hash1>
    ? Config extends ParamsConfig<infer Path2, infer Search2, infer Body2, infer Hash2, any>
        ? RouteParams<
              MergeObjects<Path1, Path2>,
              MergeObjects<Search1, Search2>,
              MergeObjects<Body1, Body2>,
              MergeHashes<Hash1, Hash2>
          >
        : never
    : never;

type MergeObjects<
    T1 extends Record<string, any> | undefined,
    T2 extends Record<string, any> | undefined,
> = T2 extends undefined ? T1 : MergeProperties<T1, T2>;

type MergeHashes<
    Hash1 extends string[] | undefined,
    Hash2 extends string[] | undefined,
> = Hash1 extends string[]
    ? Hash2 extends string[]
        ? [...Hash1, ...Hash2]
        : Hash1
    : Hash2 extends string[]
      ? Hash2
      : [];

type MakeEmptyPropertiesOptional<T extends Record<string, any>> = {
    [K in keyof T as keyof RemoveUnnecessaryProperties<T[K]> extends never
        ? never
        : T[K] extends []
          ? never
          : K]: T[K] extends string[] ? T[K][number] : T[K];
} & {
    [K in keyof T as keyof RemoveUnnecessaryProperties<T[K]> extends never
        ? K
        : T[K] extends []
          ? K
          : never]?: T[K] extends string[] ? T[K][number] : T[K];
};

type RemoveUnnecessaryProperties<T> = {
    [K in keyof T as keyof T[K] extends never ? never : K]: T[K];
};

type MergeProperties<
    T1 extends Record<string, unknown> | undefined,
    T2 extends Record<string, unknown> | undefined,
> = Flatten<{
    [K in (keyof T1 | keyof T2) & string]: K extends keyof T2
        ? T2[K]
        : K extends keyof T1
          ? T1[K]
          : never;
}>;

const x = routes({
    // "GET /": <></>,
    // "GET /2": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) => <></>),
    // "/a": routeParams({ body: z.object({ x: z.boolean() }) }, (params) =>
    //     routes({
    //         "POST /x": <></>,
    //         "/y": routeParams({ search: z.object({ y: z.number() }) }, (params) =>
    //             routes({ "GET /": <></> }),
    //         ),
    //     }),
    // ),
    // "/b": routes({
    //     "/:b": routeParams({ path: z.object({ b: z.string() }) }, (params) =>
    //         routes({ "GET /a": <></> }),
    //     ),
    // }),
    // // "/c": routes({
    // //     "/:c": routeParams({ path: z.object({ c: z.string() }) }, (params) => <></>),
    // // }),
    // // "/d": routes({
    // //     "GET /:d": routeParams({ path: z.object({ d: z.string() }) }, (params) =>
    // //         routes({ "GET /": <></> }),
    // //     ),
    // // }),
    "/e": routes({
        "GET /:e": routeParams({ path: z.object({ e: z.string() }) }, (params) => <></>),
    }),
    // "/h": routeParams({ hash: ["a", "b", "c"] }, (params) => routes({ "GET /": <></> })),
    // "GET /1": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) =>
    //     routeParams({ body: z.object({ x: z.boolean() }) }, (params) =>
    //         routes({ "GET /nested": <></> }),
    //     ),
    // ),
    "/12": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) =>
        routes({
            "/": routeParams({ body: z.object({ x: z.boolean() }) }, (params) =>
                routes({ "GET /nested": <></> }),
            ),
        }),
    ),
    "GET /1": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) => <></>),
    // "GET /2": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) =>
    //     routes({ "GET /a": <></> }),
    // ),
    //"/a": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) => <></>),
    "/b": routeParams({ search: z.object({ id: zLocalDate() }) }, (params) =>
        routes({ "GET /a": <></> }),
    ),
});

type TT = RoutesInfo<Awaited<typeof x>>;

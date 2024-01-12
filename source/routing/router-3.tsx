import type { ZodType } from "zod";
import { type HttpMethod, useHttpContext, useRequester } from "@/http/http-context";
import { HttpError } from "@/http/http-error";
import { ErrorBoundary } from "@/jsx/error-boundary";
import {
    isJsxExpression,
    type JsxComponent,
    type JsxElement,
    type PropsWithChildren,
} from "@/jsx/jsx-types";
import { unpack } from "@/serialization/data-packing";
import { parseUrlSearchParams } from "@/serialization/url-params";
import type { Flatten } from "@/types";

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
                      : T[Key] extends ParamsConfig<typeof pathParamsSymbol, undefined, any>
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
                          | (() => Promise<RoutesConfig<any>>)
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
    readonly typeInfo?: [Kind, (params: Params) => void, Routes]; // is that needed?
};

export function pathParam<ParamIn, ParamOut, Routes extends RoutingComponent<RoutingConfig>>(
    schema: ZodType<ParamOut, any, ParamIn>,
    getRoutes: Routes extends RoutingComponent<ParamsConfig<typeof pathParamsSymbol, any, any>>
        ? "ERROR: Unexpected path parameters."
        : (params: ParamOut) => Routes,
): RoutingComponent<ParamsConfig<typeof pathParamsSymbol, ParamIn, Routes>> {
    return createRoutingComponent(
        pathParamsSymbol,
        async ({ pathSegments }: RoutingComponentProps) => {
            const param = unpack(
                schema,
                pathSegments[0] ? decodeURIComponent(pathSegments[0]) : undefined,
            );
            const Routes = (getRoutes as (params: ParamOut) => Routes)(param!);
            return <Routes pathSegments={pathSegments.slice(1)} />;
        },
    );
}

export function searchParams<
    ParamsIn extends Record<string, unknown>,
    ParamsOut extends Record<string, unknown>,
    Routes extends RoutingComponent<RoutingConfig>,
>(
    schema: ZodType<ParamsOut, any, ParamsIn>,
    getRoutes: Routes extends RoutingComponent<ParamsConfig<typeof pathParamsSymbol, any, any>>
        ? "ERROR: Unexpected path parameters."
        : (params: ParamsOut) => Routes,
): RoutingComponent<ParamsConfig<typeof searchParamsSymbol, ParamsOut, Routes>> {
    return createRoutingComponent(
        searchParamsSymbol,
        async ({ pathSegments }: RoutingComponentProps) => {
            const params = parseUrlSearchParams(schema, useHttpContext().searchParams);
            const Routes = (getRoutes as (params: ParamsOut) => Routes)(params!);
            return <Routes pathSegments={pathSegments} />;
        },
    );
}

export function bodyParams<
    ParamsIn extends Record<string, unknown>,
    ParamsOut extends Record<string, unknown>,
    Routes extends RoutingComponent<RoutingConfig>,
>(
    schema: ZodType<ParamsOut, any, ParamsIn>,
    getRoutes: Routes extends RoutingComponent<ParamsConfig<typeof pathParamsSymbol, any, any>>
        ? "ERROR: Unexpected path parameters."
        : (params: ParamsOut) => Routes,
): RoutingComponent<ParamsConfig<typeof bodyParamsSymbol, ParamsOut, Routes>> {
    return createRoutingComponent(
        bodyParamsSymbol,
        async ({ pathSegments }: RoutingComponentProps) => {
            const params = parseUrlSearchParams(schema, useHttpContext().requestBody);
            const Routes = (getRoutes as (params: ParamsOut) => Routes)(params!);
            return <Routes pathSegments={pathSegments} />;
        },
    );
}

export function hashParam<
    const ParamValues extends [string, ...string[]],
    Routes extends RoutingComponent<RoutingConfig>,
>(
    _paramValues: ParamValues,
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
    // const routes = Object.entries(def) as [
    //     string,
    //     (
    //         | JsxExpression
    //         | JsxComponent
    //         | RoutingComponent<RoutingConfig>
    //         | (() => Promise<RoutingComponent<RoutingConfig>>)
    //     ),
    // ][];

    const params = Object.keys(def).filter((key) => key.startsWith("/:"));
    const Params = params[0] && (def as any)[params[0]];
    const lookup = def as Record<
        string,
        | JsxElement
        | JsxComponent
        | RoutingComponent<RoutingConfig>
        | (() => Promise<RoutingComponent<RoutingConfig>>)
    >;

    if (params.length > 1) {
        throw new Error(`Invalid multiple path params '${params.join(", ")}'.`);
    }

    return createRoutingComponent(routesSymbol, async ({ pathSegments }) => {
        const { method } = useHttpContext();

        console.log("==============", pathSegments);

        // If we're at the last path segment, there must be a matching GET or POST route.
        if (pathSegments.length <= 1) {
            const key = `${method} /${pathSegments[0] ?? ""}`;
            const match = lookup[key];
            console.log("exact route", key, !!match);
            if (match) {
                if (isJsxExpression(match)) {
                    return match;
                } else if (!("kind" in match) && typeof match === "function") {
                    const result = await match();
                    if (!!result && !("kind" in result)) {
                        return result;
                    } else {
                        throw new Error("Invalid routes definition.");
                    }
                } else {
                    throw new Error("Invalid routes definition.");
                }
            }
        }

        // Otherwise, first check if we have a static path segment that matches.
        const key = `/${pathSegments[0] ?? ""}`;
        const Match = lookup[key];
        console.log("static path segment", { key, match: Match });
        if (Match) {
            if ("kind" in Match) {
                return <Match pathSegments={pathSegments.slice(1)} />;
            } else if (typeof Match === "function") {
                const SubMatch = await Match();
                if (!!SubMatch && typeof SubMatch === "function" && "kind" in SubMatch) {
                    return <SubMatch pathSegments={pathSegments.slice(1)} />;
                } else {
                    throw new Error("Invalid routes definition.");
                }
            } else {
                throw new Error("Invalid routes definition.");
            }
        }

        // Else, check if we have a path param that matches, fall back to the '/' route,
        // or give up because we can't find a match.
        if (params.length === 1) {
            console.log("params match", { params });
            return <Params pathSegments={pathSegments} />;
        } else {
            const Fallback = lookup["/"];
            console.log("fallback", Fallback);
            if (Fallback) {
                if ("kind" in Fallback) {
                    console.log("rendering fallback");
                    return <Fallback pathSegments={pathSegments} />;
                } else {
                    throw new Error("Invalid routes definition.");
                }
            } else {
                throw new HttpError("NotFound");
            }
        }

        // // Render the first matching route, otherwise throw a 404 error.
        // for (const [route, Render] of routes) {
        //     // If we have a "leaf" route in the routing tree, we can render it directly as long as
        //     // we've consumed all path segments.
        //     if (!("kind" in Render)) {
        //         console.log("match JSX", {
        //             route,
        //             Render,
        //             method,
        //             pathSegments,
        //             match: `${method} /${pathSegments[0] ?? ""}`,
        //         });
        //         if (route === `${method} /${pathSegments[0] ?? ""}`) {
        //             console.log("hier");
        //             if (pathSegments.length > 1) {
        //                 throw new HttpError("NotFound");
        //             } else if (isJsxExpression(Render)) {
        //                 return <>{Render}</>;
        //             } else {
        //                 return <Render />;
        //             }
        //         } else if (route === `/${pathSegments[0] ?? ""}`) {
        //             console.log("hier 2");
        //             const SubRender = await Render();
        //             if (isJsxExpression(Render)) {
        //                 return <>{SubRender}</>;
        //             } else {
        //                 return <SubRender pathSegments={pathSegments.slice(1)} />;
        //             }
        //         } else {
        //             continue;
        //         }
        //     }

        //     // Otherwise, we have to descend recursively into the routing tree.
        //     switch (Render.kind) {
        //         case routesSymbol: {
        //             console.log("routesSymbol", { pathSegments, route });
        //             if (pathSegments[0]?.startsWith(route.slice(1))) {
        //                 console.log("matched");
        //                 return <Render pathSegments={pathSegments.slice(route === "/" ? 0 : 1)} />;
        //             } else {
        //                 continue;
        //             }
        //         }
        //         case pathParamsSymbol:
        //         case searchParamsSymbol:
        //         case bodyParamsSymbol:
        //         case hashParamSymbol: {
        //             return <Render pathSegments={pathSegments} />;
        //         }
        //         default: {
        //             // eslint-disable-next-line @typescript-eslint/no-unused-vars
        //             const exhaustiveSwitch: never = Render;
        //             throw new Error("Invalid routes definition.");
        //         }
        //     }
        // }

        // throw new HttpError("NotFound");
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
    loadModule: () => Promise<{ default: Routes | ((...args: Args) => Routes | Promise<Routes>) }>,
    ...params: Args
): Routes {
    let Component: Routes | undefined;
    return createRoutingComponent(routesSymbol, async ({ pathSegments }) => {
        if (!Component) {
            const imported = (await loadModule()).default;
            if (!("kind" in imported)) {
                Component = await imported(...params);
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

export type RoutesFunction<Routes extends RoutingComponent<RoutingConfig>> = () =>
    | Routes
    | Promise<Routes>;

export type RouterProps<Routes extends RoutingComponent<RoutingConfig>> = {
    readonly routes: RoutesFunction<Routes>;
};

/** A router that determines the route that should be rendered based on the current HTTP request. */
export async function Router<Routes extends RoutingComponent<RoutingConfig>>({
    routes,
}: RouterProps<Routes>) {
    const { method, requestPath } = useHttpContext();
    const Routes = await routes();

    if (method !== "GET" && useRequester() !== "HyTTS") {
        throw new HttpError(
            "BadRequest",
            "Non-GET requests originating from the browser are unsupported.",
        );
    }

    return <Routes pathSegments={requestPath} />;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface RegisterRoutes {
    // routes: RoutingConfig;
}

export type GetRoutes = RegisterRoutes extends {
    routes: infer T extends RoutingConfig;
}
    ? T
    : RoutingConfig;

function createRoutingComponent<Kind extends RoutingConfig["kind"]>(
    kind: Kind,
    component: JsxComponent<RoutingComponentProps>,
) {
    return Object.assign(component, { kind });
}

export type SomeRouteParams = {
    readonly path?: Record<string, unknown>;
    readonly search?: Record<string, unknown>;
    readonly body?: Record<string, unknown>;
    readonly hash?: string;
};

export type RoutesInfo<Routes extends RoutingConfig = GetRoutes> = Flatten<{
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
    Routes extends RoutingConfig | (() => Promise<RoutingConfig>),
    Path extends string,
    PathParams extends Record<string, any>,
    SearchParams extends Record<string, any>,
    BodyParams extends Record<string, any>,
    HashParam extends string[],
> = Routes extends () => Promise<infer SubRoutes extends RoutingConfig>
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
      : Routes extends ParamsConfig<typeof searchParamsSymbol, infer Params, infer SubRoutes>
        ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams & Params, BodyParams, HashParam>
        : Routes extends ParamsConfig<typeof bodyParamsSymbol, infer Params, infer SubRoutes>
          ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams, BodyParams & Params, HashParam>
          : Routes extends ParamsConfig<
                  typeof hashParamSymbol,
                  infer Param extends string[],
                  infer SubRoutes
              >
            ? CollectRoutes<SubRoutes, Path, PathParams, SearchParams, BodyParams, Param>
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
      ? Routes[Key] extends ParamsConfig<typeof pathParamsSymbol, infer Param, infer SubRoutes>
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
        ? Routes[Key] extends ParamsConfig<typeof pathParamsSymbol, infer Param, infer SubRoutes>
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
    [K in keyof T as keyof RemoveUnnecessaryProperties2<T[K]> extends never
        ? never
        : T[K] extends []
          ? never
          : K]: T[K];
} & {
    [K in keyof T as keyof RemoveUnnecessaryProperties2<T[K]> extends never
        ? K
        : T[K] extends []
          ? K
          : never]?: T[K];
};

type RemoveUnnecessaryProperties2<T> = {
    [K in keyof T as keyof T[K] extends never ? never : K]: T[K];
};

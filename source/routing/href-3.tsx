import { z } from "zod";
import { type HttpMethod, httpMethods } from "@/http/http-context";
import {
    bodyParams,
    type bodyParamsSymbol,
    hashParam,
    type hashParamSymbol,
    type ParamsConfig,
    pathParams,
    type pathParamsSymbol,
    routes,
    type RoutesConfig,
    type RoutesDefinition,
    type RoutingComponent,
    type RoutingConfig,
    searchParams,
    type searchParamsSymbol,
} from "@/routing/router-3";
import { toUrlSearchParams } from "@/serialization/url-params";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Router {
    //   readonly routingTree: RoutingComponent<RoutingConfig>;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Router {
    readonly routingTree: typeof y;
}

/**
 * Creates a URL to a route with the provided route params; excluding the body params which cannot
 * be encoded into a URL. The resulting URL can be used as a the `href` prop of an anchor tag or in
 * a `fetch` request, for instance.
 */
export function toUrl<Path extends RoutePaths>(path: Path, ...params: ToUrlParams<Path>): string {
    const [method, url] = path.split(" ");
    const httpMethod = method as HttpMethod;
    if (!httpMethods.includes(httpMethod) || !url) {
        throw new Error(`Invalid HTTP method in path '${path}'.`);
    }

    if (params.length === 0) {
        return url;
    } else {
        const { path, search, hash } = params[0] as any;
        return (
            (path ? replacePathParams(url, path) : url) +
            (search ? `?${toUrlSearchParams(search)}` : "") +
            (hash ? `#${hash}` : "")
        );
    }

    function replacePathParams(url: string, pathParams: Record<string, unknown> | undefined) {
        Object.entries(pathParams ?? {}).forEach(([key, value]) => {
            const parameter = value ? `/${encodeURIComponent(`${value}`)}` : "";
            url = url.replaceAll(`/:${key}`, parameter);
        });

        // There might be leftover optional path parameters that we have to remove
        url = url.replaceAll(/\/:[^/]*/g, "");

        // If the URL is now empty, return "/" so that the URL always starts with a leading slash
        return url ? url : "/";
    }
}

const y = routes({
    "GET /": () => null,
    "/a": routes({
        "POST /b": () => null,
        "/:c?": pathParams(z.object({ c: z.string() }), ({ c }) =>
            routes({
                "GET /": () => null,
                "GET /d": () => null,
                "/d": searchParams(z.object({ d: z.string() }), ({ d }) =>
                    routes({
                        "GET /e": () => null,
                        "/f": bodyParams(z.object({ f: z.string() }), ({ f }) =>
                            routes({
                                "GET /g": () => null,
                                "/h": hashParam(
                                    ["a", "b", "c"],
                                    routes({
                                        "GET /i": () => null,
                                        "/:j?": pathParams(
                                            z.object({ j: z.string().default("") }),
                                            ({ j }) =>
                                                routes({
                                                    "POST /k": () => null,
                                                }),
                                        ),
                                    }),
                                ),
                            }),
                        ),
                    }),
                ),
            }),
        ),
    }),
});

function xx() {
    type X = AllRoutes;
    type X2 = RoutePaths;
    type X3 = RouteParams<"GET /a/:c/d/f/h/i">;

    const a = toUrl("GET /");
    const a2 = toUrl("GET /a/:c/d/e", { path: { c: "c" }, search: { d: "d" } });
    const b = toUrl("GET /a/:c/d/f/h/i", {
        path: { c: "c" },
        search: { d: "d" },
        hash: "a",
    });

    const yz = toUrl("GET /a/:c/d/f/h/i", {
        path: { c: "" },
        search: { d: "" },
        hash: "a",
    });
}

export type RoutePaths = keyof AllRoutes;
export type RouteMethod<Path extends RoutePaths> = AllRoutes[Path]["method"];
export type RouteParams<Path extends RoutePaths> = AllRoutes[Path]["params"];

type ToUrlParams<Path extends RoutePaths> = keyof RouteParams<Path> extends never
    ? []
    : [params: Flatten<Omit<RouteParams<Path>, "body">>];

type CollectRoutes<
    Routes extends RoutingConfig,
    Path extends string,
    PathParams extends Record<string, any>,
    SearchParams extends Record<string, any>,
    BodyParams extends Record<string, any>,
    HashParam extends string[],
> = Routes extends RoutesConfig<infer Def>
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
      ? Routes[Key] extends RoutingComponent<
            ParamsConfig<typeof pathParamsSymbol, infer Param, infer SubRoutes>
        >
          ? CollectRoutes<
                SubRoutes,
                CombinePaths<Path, `:${ParamPath}`>,
                Required<PathParams> & Partial<Param>,
                SearchParams,
                BodyParams,
                HashParam
            >
          : never
      : Key extends `/:${infer ParamPath}`
        ? Routes[Key] extends RoutingComponent<
              ParamsConfig<typeof pathParamsSymbol, infer Param, infer SubRoutes>
          >
            ? CollectRoutes<
                  SubRoutes,
                  CombinePaths<Path, `:${ParamPath}`>,
                  Required<PathParams> & Param,
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

type AllRoutes = Flatten<{
    [T in CollectRoutes<Router["routingTree"], "", {}, {}, {}, []> as T[1]]: {
        method: T[0];
    } & {
        params: RemoveEmptyProperties<{
            readonly path: T[2];
            readonly search: T[3];
            readonly body: T[4];
            readonly hash: T[5][number];
        }>;
    };
}>;

type Flatten<T> = T extends infer U ? { [K in keyof U]: Flatten<U[K]> } : never;

type RemoveEmptyProperties<T extends Record<string, any>> = {
    [K in keyof T as keyof T[K] extends never ? never : T[K] extends [] ? never : K]: T[K];
};

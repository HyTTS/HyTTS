import type { RoutingDefinition, LazyRoutingDefinition, Action, Route } from "./routing";

const routeUrlSymbol = Symbol();
const actionUrlSymbol = Symbol();

export type RouteUrl = {
    readonly url: string;
    [routeUrlSymbol]: null;
};

export type ActionUrl = {
    readonly url: string;
    readonly actionParams: string;
    [actionUrlSymbol]: null;
};

export function createUrls<
    T extends RoutingDefinition,
    Get extends Record<string, Array<any>> = GetEndpoints<ToEndpoints<T>>,
    Post extends Record<string, Array<any>> = PostEndpoints<ToEndpoints<T>>
>(
    // This parameter is only used for type inference. We don't use the route definition's data directly,
    // as we don't want to load the associated modules just because we have to generate some URL.
    _: T
): {
    readonly route: <Url extends keyof Get & string>(route: Url, ...params: Get[Url]) => RouteUrl;
    readonly action: <Url extends keyof Post & string>(
        route: Url,
        ...params: Post[Url]
    ) => ActionUrl;
} {
    return {
        route: (route: string, ...params: Record<string, unknown>[]) => {
            const hasPathParams = route.includes(":");
            const searchParams = params?.[hasPathParams ? 1 : 0];
            const urlSearchParams = searchParams ? "?" + toUrlSearchParams(searchParams) : "";

            return {
                url:
                    (hasPathParams ? replacePathParams(route, params?.[0]) : route) +
                    urlSearchParams,
                [routeUrlSymbol]: null,
            };
        },

        action: (action: string, ...params: Record<string, unknown>[]) => {
            const hasPathParams = action.includes(":");
            return {
                url: hasPathParams ? replacePathParams(action, params?.[0]) : action,
                actionParams: toUrlSearchParams(params?.[hasPathParams ? 1 : 0]),
                [actionUrlSymbol]: null,
            };
        },
    };

    function replacePathParams(path: string, pathParams: Record<string, unknown> | undefined) {
        Object.entries(pathParams ?? {}).forEach(([key, value]) => {
            path = path.replaceAll(`:${key}`, `${value}`);
        });

        return path;
    }
}

type Endpoint = {
    readonly path: string;
    readonly verb: "get" | "post";
    readonly routeParams?: any;
    readonly searchParams?: any;
    readonly bodyParams?: any;
};

type ToEndpoint<T extends RoutingDefinition, Path extends string> = ToEndpoints<T> extends infer E
    ? E extends Endpoint
        ? {
              path: JoinPaths<Path, E["path"]>;
              verb: E["verb"];
              searchParams: E["searchParams"];
              routeParams: E["routeParams"];
              bodyParams: E["bodyParams"];
          }
        : never
    : never;

type ToEndpoints<T extends RoutingDefinition> = {
    [Path in keyof T & string]: T[Path] extends Route<infer PathParams, infer SearchParams>
        ? { path: Path; verb: "get"; routeParams: PathParams; searchParams: SearchParams }
        : T[Path] extends Action<infer PathParams, infer ActionParams>
        ? { path: Path; verb: "post"; routeParams: PathParams; bodyParams: ActionParams }
        : T[Path] extends [
              Route<infer PathParams1, infer SearchParams>,
              Action<infer PathParams2, infer ActionParams>
          ]
        ?
              | { path: Path; verb: "get"; routeParams: PathParams1; searchParams: SearchParams }
              | { path: Path; verb: "post"; routeParams: PathParams2; bodyParams: ActionParams }
        : T[Path] extends LazyRoutingDefinition
        ? ToEndpoint<Awaited<ReturnType<T[Path]>>["default"], Path>
        : T[Path] extends RoutingDefinition
        ? ToEndpoint<T[Path], Path>
        : never;
}[keyof T & string];

type GetEndpoints<T extends Endpoint> = {
    [E in Extract<T, { verb: "get" }> as NormalizePath<E["path"]>]: unknown extends E["routeParams"]
        ? unknown extends E["searchParams"]
            ? []
            : [searchParams: E["searchParams"]]
        : unknown extends E["searchParams"]
        ? [routeParams: E["routeParams"]]
        : [routeParams: E["routeParams"], searchParams: E["searchParams"]];
};

type PostEndpoints<T extends Endpoint> = {
    [E in Extract<T, { verb: "post" }> as NormalizePath<
        E["path"]
    >]: unknown extends E["routeParams"]
        ? unknown extends E["bodyParams"]
            ? []
            : [actionParams: E["bodyParams"]]
        : unknown extends E["bodyParams"]
        ? [routeParams: E["routeParams"]]
        : [routeParams: E["routeParams"], actionParams: E["bodyParams"]];
};

type TrimSlashes<Path extends string> = Path extends `/${infer U}/`
    ? U
    : Path extends `/${infer U}`
    ? U
    : Path extends `${infer U}/`
    ? U
    : Path;

type JoinPaths<Path1 extends string, Path2 extends string> = TrimSlashes<Path1> extends ""
    ? TrimSlashes<Path2> extends ""
        ? "/"
        : `/${TrimSlashes<Path2>}/`
    : TrimSlashes<Path2> extends ""
    ? `/${TrimSlashes<Path1>}/`
    : `/${TrimSlashes<Path1>}/${TrimSlashes<Path2>}/`;

type NormalizePath<Path extends string> = JoinPaths<Path, "">;

function trimSlashes<Path extends string>(path: Path): TrimSlashes<Path> {
    const hasStartingSlash = path.startsWith("/");
    const hasEndingSlash = path.endsWith("/");

    return path.slice(
        hasStartingSlash ? 1 : 0,
        hasEndingSlash ? -1 : undefined
    ) as TrimSlashes<Path>;
}

export function joinPaths<Path1 extends string, Path2 extends string>(
    path1: Path1,
    path2: Path2
): JoinPaths<Path1, Path2> {
    const a = trimSlashes(path1);
    const b = trimSlashes(path2);

    return (a && b ? `/${a}/${b}/` : a ? `/${a}/` : b ? `/${b}/` : "/") as JoinPaths<Path1, Path2>;
}

// TODO
function toUrlSearchParams(_: any) {
    return "";
}

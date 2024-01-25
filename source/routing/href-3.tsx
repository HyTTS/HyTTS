import { z } from "zod";
import { type HttpMethod, httpMethods } from "@/http/http-context";
import type { JsxComponent, JsxElement } from "@/jsx/jsx-types";
import {
    type FormParamsConfig,
    type GetRoutes,
    type ParamsConfig,
    routeParams,
    routes,
    type RoutesConfig,
    type RoutesInfo,
    type SomeRouteParams,
} from "@/routing/router-3";
import { toUrlSearchParams } from "@/serialization/url-params";
import type { Flatten } from "@/types";

export type HrefOptions<
    Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
    Path extends string = "",
> = { readonly href: Path } & Flatten<RemoveUnnecessaryProperties<Info[Path]["params"]>>;

/**
 * Represents an hypertext reference to another route, consisting of the referenced route's URL, the
 * HTTP method to retrieve it, and all required path, search, body, and hash parameters.
 */
export type Href<Method extends HttpMethod> = {
    readonly [hrefSymbol]: null;

    /** The HTTP method that must be used to retrieve the route. */
    readonly method: Method;

    /** The URL of the referenced route that includes all path, search, and hash parameters. */
    readonly url: string;

    /**
     * The URL-encoded body parameters for the route for non-GET routes. In the latest HTTP
     * specifications, even GET routes support body parameters, but the precise semantics are
     * unclear.
     */
    readonly body: string;
};

export function isHref(value: unknown): value is Href<HttpMethod> {
    return !!value && typeof value === "object" && hrefSymbol in value;
}

/**
 * Creates a function that allows creating `Href`s from a route and the provided route parameters;
 * excluding the body params which cannot be encoded into a URL. The resulting URL can be used as a
 * the `href` prop of an anchor tag or in a `fetch` request, for instance.
 */
export function createHref<
    Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
>() {
    return <Path extends keyof Info & string>(
        path: Path,
        ...routeParams: ToUrlParams<Info[Path]["params"]>
    ): Href<Info[Path]["method"]> => {
        const [httpMethod, url] = path.split(" ");
        const method = httpMethod as HttpMethod;
        if (!httpMethods.includes(method) || !url) {
            throw new Error(`Invalid HTTP method in path '${path}'.`);
        }

        const params = (routeParams[0] ?? {}) as SomeRouteParams;
        return {
            [hrefSymbol]: null,
            method,
            url:
                (url.includes(":") ? replacePathParams(url, params.path) : url) +
                (params.search ? `?${toUrlSearchParams(params.search)}` : "") +
                (params.hash ? `#${params.hash}` : ""),
            body: toUrlSearchParams(params.body),
        };

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
    };
}

const hrefSymbol = Symbol();

type ToUrlParams<Params> = keyof RemoveUnnecessaryProperties<Params> extends never
    ? []
    : [params: Flatten<RemoveUnnecessaryProperties<Params>>];

type RemoveUnnecessaryProperties<T> = {
    [K in keyof T as T[K] extends infer U | undefined
        ? keyof U extends never
            ? never
            : K
        : K]: T[K];
};

// export const href = createHref();

function Q(props: { q: string }) {
    return <></>;
}

const y = routes({
    "GET /": () => null,
    "GET /depends": routeParams({}, () => <></>) as any as FormParamsConfig<{
        GET: ParamsConfig<undefined, { x: string }, undefined, undefined, JsxElement>;
        POST: ParamsConfig<undefined, undefined, { x: string }, undefined, JsxElement>;
    }>,
    "POST /depends": routeParams({}, () => <></>) as any as FormParamsConfig<{
        GET: ParamsConfig<undefined, { x: string }, undefined, undefined, JsxElement>;
        POST: ParamsConfig<undefined, undefined, { x: string }, undefined, JsxElement>;
    }>,
    "GET /search": routeParams({ search: z.object({ q: z.string() }) }, Q),
    "GET /search2": routeParams({ search: z.object({ q: z.string() }) }, ({ q }) => <Q q={q} />),
    "/search3": routeParams({ search: z.object({ q: z.string() }) }, ({ q }) =>
        routes({ "GET /": <Q q={q} /> }),
    ),
    "/nested": routeParams({ search: z.object({ q: z.string() }) }, ({ q }) => {
        const x = routeParams(
            {
                // path: z.object({ id: z.boolean() }),
                search: z.object({ q2: z.string() }),
                body: z.object({ x: z.number() }),
            },
            (p) => routes({ "GET /": <>{p}</> }),
        );
        return x;
    }),
    "GET /nested2": routeParams({ search: z.object({ q: z.string() }) }, ({ q }) => {
        const x = routeParams(
            {
                //path: z.object({ id: z.boolean() }),
                search: z.object({ q2: z.string() }),
                body: z.object({ x: z.number() }),
            },
            (p) => <>{p}</>,
        );
        return x;
    }),
    "GET /nested3": routeParams(
        { search: z.object({ q: z.string() }) },
        ({ q }) =>
            routeParams({}, (p) => <>{p}</>) as any as FormParamsConfig<{
                GET: ParamsConfig<undefined, { x: string }, undefined, undefined, JsxElement>;
                POST: ParamsConfig<undefined, undefined, { x: string }, undefined, JsxElement>;
            }>,
    ),
    "POST /nested3": routeParams(
        { search: z.object({ q: z.string() }) },
        ({ q }) =>
            routeParams({}, (p) => <>{p}</>) as any as FormParamsConfig<{
                GET: ParamsConfig<undefined, { x: string }, undefined, undefined, JsxElement>;
                POST: ParamsConfig<undefined, undefined, { x: string }, undefined, JsxElement>;
            }>,
    ),
    "/search-async": routeParams({ search: z.object({ q: z.string() }) }, ({ q }) =>
        Promise.resolve(routes({ "GET /": <Q q={q} /> })),
    ),
    "GET /body": routeParams({ body: z.object({ x: z.string() }) }, (s) => <>{s}</>),
    "/a": routes({
        "POST /b": () => null,
        "/:c": routeParams({ path: z.object({ c: z.string() }) }, (c) =>
            routes({
                "GET /": () => null,
                "GET /d": () => null,
                "/d": routeParams({ search: z.object({ d: z.string() }) }, ({ d }) =>
                    routes({
                        "GET /e": () => null,
                        "/f": routeParams({ body: z.object({ f: z.string() }) }, ({ f }) =>
                            routes({
                                "GET /g": () => null,
                                "/h": routeParams({ hash: ["a", "b", "c"] }, (s) =>
                                    routes({
                                        "GET /i": () => null,
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
    type TT = RoutesInfo;

    const toUrl = createHref<typeof y>();
    const a = toUrl("GET /");
    const nes = toUrl("GET /nested", { search: { q: "", q2: "q" }, body: { x: 1 } });
    const nes2 = toUrl("GET /nested2", { search: { q: "", q2: "q" }, body: { x: 1 } });
    const nes23 = toUrl("GET /nested3", { search: { q: "", x: "q" } });
    const pnes23 = toUrl("POST /nested3", { search: { q: "" }, body: { x: "q" } });
    const d = toUrl("GET /depends", { search: { x: "x" } });
    const d2 = toUrl("POST /depends", { body: { x: "x" } });
    const a2 = toUrl("GET /a/:c/d/e", { params: { c: "c" }, search: { d: "d" } });
    const b = toUrl("GET /a/:c/d/f/h/i", {
        params: { c: "c" },
        search: { d: "d" },
        body: { f: "f" },
        hash: "a",
    });
    const yz = toUrl("GET /a/:c/d/f/h/i", {
        params: { c: "1" },
        search: { d: "" },
        body: { f: "f" },
        hash: "b",
    });

    // type HrefOptions2<
    //     Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    //     Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
    //     Path extends keyof Info & string = "",
    // > = { readonly href: Path } & Flatten<RemoveUnnecessaryProperties<Info[Path]["params"]>>;

    type Comp<Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes> = {
        // eslint-disable-next-line @typescript-eslint/prefer-function-type
        <
            Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
            Path extends keyof Info & string = "",
        >(
            p: HrefOptions<Routes, Info, Path>,
        ): JsxElement;
    };

    function X<
        Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
        Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
        Path extends keyof Info & string = string,
    >(p: HrefOptions<Routes, Info, Path>) {
        return null!;
    }

    // const C: Comp = (p) => null;

    type Q = HrefOptions;

    // type LinkComponent = {
    //     // eslint-disable-next-line @typescript-eslint/prefer-function-type
    //     <
    //         Routes extends RoutesConfig<any> | Promise<RoutesConfig<any>> = GetRoutes,
    //         Info extends Record<string, any> = RoutesInfo<Awaited<Routes>>,
    //         Path extends keyof Info & string = "",
    //     >(
    //         p: NavigationProps<Routes, Info, Path>,
    //     ): JsxElement;
    // };

    // const Y: LinkComponent = (p) => null;

    // <C<typeof y>></C>;

    X<typeof y>({ href: "" });

    <X<typeof y, RoutesInfo, "GET /a/:c/d/f/h/i">
        href="GET /a/:c/d/f/h/i"
        params={{ c: "1" }}
        body={{ f: "1" }}
        search={{ d: "" }}
        hash="a"
    ></X>;

    // <Y path="GET /"></Y>;

    // type X4 = RoutesInfo["GET /a/:c/d/e"];
    // type qqqq = RoutesInfo["GET /a/:c"]["params"];
    // type X31 = RoutesInfo["GET /"]["params"];
    // type X34 = RoutesInfo["GET /a/:c"]["params"];
    // type X3 = RoutesInfo["GET /a/:c/d/f/h/i"]["params"];
    // type X33 = ToUrlParams<RoutesInfo["GET /"]["params"]>;
    // type X331 = ToUrlParams<RoutesInfo["GET /a/:c"]["params"]>;
    // type X3231 = ToUrlParams<RoutesInfo["GET /a/:c/d/f/g"]["params"]>;
    // const tu = createHref();
    const zzzz = toUrl("GET /a/:c/d/e", { params: { c: "c" }, search: { d: "d" } });
    // tu("GET /");
    // tu("GET /a/:c", {});
    // tu("GET /a/:c", { path: { c: "c" } });
    // tu("GET /a/:c/d/e", { path: { c: "c" }, search: { d: "d" } });
    // type X = RoutesInfo;
    // type X2 = RoutesInfo["GET /a/:c/d/f/h/i"]["method"];
}

// declare module "@/routing/router-3" {
//     // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
//     interface RegisterRoutes {
//         routes: typeof y;
//     }
// }

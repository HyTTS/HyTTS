import { type HttpMethod, httpMethods } from "@/http/http-context";
import type {
    FormComponent,
    ParamComponent,
    RouteComponent,
    RoutesComponent,
    RoutesDefinition,
} from "@/routing/router";
import { toUrlSearchParams } from "@/serialization/url-params";

const hrefSymbol = Symbol();

/**
 * Defines the type of the form values expected by a non-GET route. Form values can never be
 * provided explicitly when creating an {@link Href}, instead they are always implicitly sent by the
 * forms infrastructure.
 *
 * Note that the actual type is a function such that two {@link Href} instances can only be assigned
 * if they depend on the exact same form values.
 */
export type FormValues<T extends Record<string, unknown>> = (values: T) => T;

/**
 * Represents an hypertext reference to another route, consisting of the referenced route's URL, the
 * HTTP method to retrieve it, and all required path and route parameters.
 */
export type Href<
    Method extends HttpMethod,
    Form extends Method extends "GET" ? FormValues<{}> : FormValues<any> = FormValues<{}>,
> = {
    readonly url: string;
    readonly method: Method;
    readonly body: string | undefined;
    readonly form?: Form;
    [hrefSymbol]: null;
};

export function isHref(value: unknown): value is Href<HttpMethod, any> {
    return !!value && typeof value === "object" && hrefSymbol in value;
}

export type HrefCreator<Routes extends RoutesComponent<any>> = ReturnType<
    typeof getHrefs<Routes, GetHrefs<Routes>>
>;

/**
 * Takes a set of routes starting at the application's root route in form of a
 * {@link RoutesComponent} and returns an object that can be used to construct {@link Href}s, i.e.,
 * references to the routes contained in the {@link RoutesComponent}, in a fully type-safe way.
 *
 * @param routes The set of routes the hrefs should be generated for. This parameter is only used
 *   for type inference. Its value is ignored at runtime to allow for lazy loading of sub-routers
 *   once they are first requested.
 */
export function getHrefs<
    Routes extends RoutesComponent<any>,
    Hrefs extends Record<string, any> = GetHrefs<Routes>,
>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    routes: Routes,
): <Ref extends keyof Hrefs & string>(
    href: Ref,
    ...params: Hrefs[Ref]["params"]
) => Href<Hrefs[Ref]["method"], Hrefs[Ref]["formState"]> {
    return (href: string, ...params: Record<string, unknown>[]) => {
        const [method, url] = href.split(" ");
        const httpMethod = method as HttpMethod;
        if (!httpMethods.includes(httpMethod) || !url) {
            throw new Error("Invalid href.");
        }

        const hasPathParams = url.includes(":");
        const routeParams = toUrlSearchParams(params[hasPathParams ? 1 : 0]);

        return {
            url:
                (hasPathParams ? replacePathParams(url, params[0]) : url) +
                (routeParams && httpMethod === "GET" ? `?${routeParams}` : ""),
            method: httpMethod,
            body: httpMethod !== "GET" ? routeParams : undefined,
            [hrefSymbol]: null,
        };

        function replacePathParams(url: string, pathParams: Record<string, unknown> | undefined) {
            Object.entries(pathParams ?? {}).forEach(([key, value]) => {
                const parameter = encodeURIComponent(`${value}`);
                if (parameter === "") {
                    throw new Error(`Value required for path parameter '${key}'.`);
                }

                url = url.replaceAll(`:${key}`, parameter);
            });

            return url;
        }
    };
}

type GetHrefs<Routes extends RoutesComponent<any>> = ToHrefLookup<
    CollectRoutesFromRouter<Routes, "", {}>
>;

type CollectRoutesFromRouter<
    Routes extends RoutesComponent<any>,
    Path extends string,
    PathParams extends Record<string, any>,
> = Routes extends RoutesComponent<infer Def>
    ? CollectRoutesFromRouterDefinition<Def, keyof Def, Path, PathParams>
    : never;

type CollectRoutesFromRouterDefinition<
    Routes extends RoutesDefinition<Routes>,
    Key extends keyof Routes,
    Path extends string,
    PathParams extends Record<string, any>,
> = Key extends `${infer Method extends HttpMethod} /${infer SubPath}`
    ? Routes[Key] extends RouteComponent<infer Params, infer Form>
        ? [Method, `${Method} ${CombinePaths<Path, SubPath>}`, PathParams, Params, FormValues<Form>]
        : Routes[Key] extends FormComponent<infer Form>
        ? [Method, `${Method} ${CombinePaths<Path, SubPath>}`, PathParams, {}, FormValues<Form>]
        : [Method, `${Method} ${CombinePaths<Path, SubPath>}`, PathParams, {}, FormValues<{}>]
    : Key extends `/:${infer ParamPath}`
    ? Routes[Key] extends ParamComponent<infer Param, infer Sub>
        ? CollectRoutesFromRouter<
              Sub,
              CombinePaths<Path, `:${ParamPath}`>,
              PathParams & { [K in ParamPath]: Param }
          >
        : never
    : Key extends `/${infer SubPath}`
    ? CollectRoutesFromRouter<Routes[Key], CombinePaths<Path, SubPath>, PathParams>
    : never;

type CombinePaths<Path extends string, SubPath extends string> = Path extends `${"" | "/"}`
    ? SubPath extends ""
        ? "/"
        : `/${SubPath}`
    : SubPath extends ""
    ? Path
    : `${Path}/${SubPath}`;

type ToHrefLookup<
    RouteInfo extends [
        method: HttpMethod,
        url: string,
        pathParams: Record<string, any>,
        routeParams: Record<string, any>,
        formState: Record<string, any>,
    ],
> = {
    [T in RouteInfo as T[1]]: {
        params: keyof T[2] extends never
            ? keyof T[3] extends never
                ? []
                : [routeParams: T[3]]
            : keyof T[3] extends never
            ? [pathParams: T[2]]
            : [pathParams: T[2], routeParams: T[3]];
        method: T[0];
        formState: T[4];
    };
};

import type { JsxComponent } from "@/jsx/jsx-types";
import type { RouteFilters } from "@/routing/route-filters";
import type { ZodType, ZodTypeDef, z } from "zod";

const routingSymbol = Symbol();

export type ObjectSchema = ZodType<Record<string, unknown> | undefined, ZodTypeDef, any>;
export type ParamsSchema<TParams extends ObjectSchema> =
    | TParams
    | (() => TParams | Promise<TParams>)
    | undefined;

export type RouteParams<TPathParams extends ObjectSchema, TSearchParams extends ObjectSchema> = {
    readonly pathParams?: ParamsSchema<TPathParams>;
    readonly searchParams?: ParamsSchema<TSearchParams>;
};

export type ActionParams<TPathParams extends ObjectSchema, TActionParams extends ObjectSchema> = {
    readonly pathParams?: ParamsSchema<TPathParams>;
    readonly actionParams?: ParamsSchema<TActionParams>;
};

export type RouteProps<TPathParams extends ObjectSchema, TSearchParams extends ObjectSchema> = {
    pathParams: unknown extends TPathParams ? undefined : z.output<TPathParams>;
    searchParams: unknown extends TSearchParams ? undefined : z.output<TSearchParams>;
};

export type ActionProps<TPathParams extends ObjectSchema, TActionParams extends ObjectSchema> = {
    pathParams: unknown extends TPathParams ? undefined : z.output<TPathParams>;
    actionParams: unknown extends TActionParams ? undefined : z.output<TActionParams>;
};

/**
 * Represents a fully-typed route, i.e., a server endpoint that can be requested with the
 * HTTP 'GET' verb.
 */
export type Route<
    TPathParams extends ObjectSchema,
    TSearchParams extends ObjectSchema
> = ReturnType<typeof route<TPathParams, TSearchParams>>;

/**
 * Represents a fully-typed action, i.e., a server endpoint that can be requested with the
 * HTTP 'POST' verb.
 */
export type Action<
    TPathParams extends ObjectSchema,
    TActionParams extends ObjectSchema
> = ReturnType<typeof action<TPathParams, TActionParams>>;

/**
 * Creates a fully-typed route (i.e., a request with the HTTP 'GET' verb) that the browser can
 * navigate to via anchor tags, for instance. By convention, rendering a route is expected to
 * be side-effect free, however, that is not a strict requirement.
 * @param routeFilters The route filters to apply before executing the `handler`.
 * @param params The path and search params required by and available to the `handler`.
 * @param handler The JSX component that renders the route.
 * @param options Additional options affecting the route's behavior.
 * @returns Returns an object that must be used within a `RoutingDefinition`.
 */
export function route<TPathParams extends ObjectSchema, TSearchParams extends ObjectSchema>(
    routeFilters: RouteFilters,
    params: RouteParams<TPathParams, TSearchParams>,
    handler: JsxComponent<RouteProps<TPathParams, TSearchParams>>,
    options: { readonly noDocument?: boolean } = {}
) {
    return { [routingSymbol]: "route" as const, routeFilters, ...params, handler, options };
}

/**
 * Creates a fully-typed action (i.e., a request with the HTTP 'POST' verb) that is typically
 * used in conjunction with a form tag or with special action buttons. In most cases, actions
 * carry out a side effect and then update the UI.
 * @param actionFilters The route filters to apply before executing the `handler`.
 * @param params The path and action params required by and available to the `handler`.
 * @param handler The JSX component that carries out the action and renders the UI.
 * @param options Additional options affecting the action's behavior.
 * @returns Returns an object that must be used within a `RoutingDefinition`.
 */
export function action<TPathParams extends ObjectSchema, TActionParams extends ObjectSchema>(
    actionFilters: RouteFilters,
    params: ActionParams<TPathParams, TActionParams>,
    handler: JsxComponent<ActionProps<TPathParams, TActionParams>>,
    options: { readonly noDocument?: boolean } = {}
) {
    return { [routingSymbol]: "action" as const, actionFilters, ...params, handler, options };
}

/**
 * A lazy routing definition is lazy-loaded upon the first request to one of its direct or
 * indirect routes or actions. Typically, there are multiple `RoutingDefinitions` spread
 * across several files, which are lazily imported using `await import` to speed up server
 * startup and hot reload scenarios.
 */
export type LazyRoutingDefinition = () => Promise<{ readonly default: RoutingDefinition }>;

/**
 * A routing definition represents a set of `Route`s and `Action`s from which an Express
 * router can be deduced and which TypeScript uses to generate URLs in a fully type-safe
 * way.
 */
export type RoutingDefinition = {
    [path: string]:
        | Route<any, any>
        | Action<any, any>
        | RoutingDefinition
        | LazyRoutingDefinition
        | [Route<any, any>, Action<any, any>];
};

export function isRoute(obj: Record<string, unknown>): obj is Route<any, any> {
    return routingSymbol in obj && obj[routingSymbol] === "route";
}

export function isAction(obj: Record<string, unknown>): obj is Action<any, any> {
    return routingSymbol in obj && obj[routingSymbol] === "action";
}

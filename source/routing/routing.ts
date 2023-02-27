import type { ZodType } from "zod";
import type { JsxComponent } from "..";
import type { RouteFilters } from "./route-filters";

const routingSymbol = Symbol();

export type RouteParams<TPathParams, TSearchParams> = {
    readonly pathParams?: ZodType<TPathParams>;
    readonly searchParams?: ZodType<TSearchParams>;
};

export type ActionParams<TPathParams, TActionParams> = {
    readonly pathParams?: ZodType<TPathParams>;
    readonly actionParams?: ZodType<TActionParams>;
};

export type Route<TPathParams, TSearchParams> = ReturnType<
    typeof route<TPathParams, TSearchParams>
>;

export type Action<TPathParams, TActionParams> = ReturnType<
    typeof action<TPathParams, TActionParams>
>;

export function route<TPathParams, TSearchParams>(
    routeFilters: RouteFilters,
    params: RouteParams<TPathParams, TSearchParams>,
    handler: JsxComponent<RouteParams<TPathParams, TSearchParams>>,
    options: { readonly noDocument?: boolean } = {}
) {
    return { [routingSymbol]: "route", routeFilters, params, handler, options };
}

export function action<TPathParams, TActionParams>(
    actionFilters: RouteFilters,
    params: ActionParams<TPathParams, TActionParams>,
    handler: JsxComponent<ActionParams<TPathParams, TActionParams>>,
    options: { readonly noDocument?: boolean } = {}
) {
    return { [routingSymbol]: "action", actionFilters, params, handler, options };
}

export type LazyRoutingDefinition = () => Promise<{ readonly default: RoutingDefinition }>;

export type RoutingDefinition = {
    [path: string]:
        | Route<any, any>
        | Action<any, any>
        | RoutingDefinition
        | LazyRoutingDefinition
        | [Route<any, any>, Action<any, any>];
};

import type { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";

const routeFilterSymbol = Symbol();

export type RouteFilter = JsxComponent<PropsWithChildren> & {
    [routeFilterSymbol]: null;
};

/**
 * Creates a new route filter, which basically is a JSX component that is executed before a
 * route's or action's handler is invoked. It is typically used to enable or disable routes
 * based on feature flags or to implement authentication and authorization. There can be none,
 * one, or multiple route filters per route or action.
 */
export function createRouteFilter(component: JsxComponent<PropsWithChildren>): RouteFilter {
    return Object.assign(component, { [routeFilterSymbol]: null });
}

export type RouteFilters = RouteFilter | RouteFilter[];

import type { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";

const routeFilterSymbol = Symbol();

export type RouteFilter = JsxComponent<PropsWithChildren> & {
    [routeFilterSymbol]: null;
};

export function createRouteFilter(component: JsxComponent<PropsWithChildren>): RouteFilter {
    return Object.assign(component, { [routeFilterSymbol]: null });
}

export type RouteFilters = RouteFilter | RouteFilter[];

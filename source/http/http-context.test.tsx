import {
    AbsoluteRedirect,
    Redirect,
    useHttpStatusCode,
    useResponseHeader,
    useUrlSearchParams,
} from "@/http/http-context";
import type { RoutingDefinition} from "@/routing/routing";
import { route } from "@/routing/routing";
import type { RouteUrl} from "@/routing/urls";
import { createUrls } from "@/routing/urls";
import { runTestApp } from "@/test-helpers";
import { z } from "zod";

describe("http-context", () => {
    it("supports an HTTP redirect to a route", () =>
        runTestApp(
            () => {
                const routes = {
                    "/a": route([], {}, () => <Redirect to={createUrls(routes).route("/b/")} />),
                    "/b": route([], {}, () => <>b</>),
                } satisfies RoutingDefinition;

                return routes;
            },
            async (urls, fetchRoute) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("b");
            },
        ));

    it("throws for an HTTP redirect to an absolute URL if someone fakes a `RouteUrl`", () =>
        runTestApp(
            () => {
                const routes = {
                    "/a": route([], {}, () => (
                        <Redirect to={{ url: "https://google.com" } as RouteUrl} />
                    )),
                } satisfies RoutingDefinition;

                return routes;
            },
            async (urls, fetchRoute) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(500);
                expect(await routeResponse.text()).toContain("Redirecting to absolute URLs");
            },
        ));

    it("supports an HTTP redirect to an absolute URL", () =>
        runTestApp(
            () => {
                const routes = {
                    "/a": route([], {}, () => <AbsoluteRedirect to="https://www.google.de" />),
                    "/b": route([], {}, () => <>b</>),
                } satisfies RoutingDefinition;

                return routes;
            },
            async (urls, fetchRoute) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(200);
                expect(routeResponse.url).toBe("https://www.google.de/");
            },
        ));

    it("supports setting HTTP headers", () =>
        runTestApp(
            {
                "/single": route([], {}, () => {
                    useResponseHeader("x-test", 1);
                    return <></>;
                }),
                "/multiple": route([], {}, () => {
                    useResponseHeader("x-test1", 1);
                    useResponseHeader("x-test2", 2);
                    return <></>;
                }),
                "/overwrite": route([], {}, () => {
                    useResponseHeader("x-test", 1);
                    useResponseHeader("x-test", 2);
                    return <></>;
                }),
            },
            async (urls, fetchRoute) => {
                const singleResponse = await fetchRoute(urls.route("/single/"));
                expect(singleResponse.headers.get("x-test")).toBe("1");

                const multipleResponse = await fetchRoute(urls.route("/multiple/"));
                expect(multipleResponse.headers.get("x-test1")).toBe("1");
                expect(multipleResponse.headers.get("x-test2")).toBe("2");

                const overwriteResponse = await fetchRoute(urls.route("/overwrite/"));
                expect(overwriteResponse.headers.get("x-test")).toBe("2");
            },
        ));

    it("supports setting the HTTP status code", () =>
        runTestApp(
            {
                "/single": route([], {}, () => {
                    useHttpStatusCode(400);
                    return <></>;
                }),
                "/overwrite": route([], {}, () => {
                    useHttpStatusCode(400);
                    useHttpStatusCode(401);
                    return <></>;
                }),
            },
            async (urls, fetchRoute) => {
                const singleResponse = await fetchRoute(urls.route("/single/"));
                expect(singleResponse.status).toBe(400);

                const overwriteResponse = await fetchRoute(urls.route("/overwrite/"));
                expect(overwriteResponse.status).toBe(401);
            },
        ));

    it("supports obtaining the request's search params", () =>
        runTestApp(
            {
                "/r": route([], { searchParams: z.object({ a: z.string() }) }, () => {
                    const { a } = useUrlSearchParams(z.object({ a: z.string() }));
                    return <>{a}</>;
                }),
            },
            async (urls, fetchRoute) => {
                const response = await fetchRoute(urls.route("/r/", { a: "xyz" }));
                expect(response.status).toBe(200);
                expect(await response.text()).toBe("xyz");
            },
        ));
});

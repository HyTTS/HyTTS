import { useHttpStatusCode } from "@/http/http-context";
import { createRouteFilter } from "@/routing/route-filters";
import { action, route } from "@/routing/routing";
import { runTestApp } from "@/test-helpers";

describe("route filters", () => {
    it("supports empty list of filters", () =>
        runTestApp(
            {
                "/a": route([], {}, () => <>route</>),
                "/b": action([], {}, () => <>action</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("route");

                const routeAction = await fetchAction(urls.action("/b/"));
                expect(routeAction.status).toBe(200);
                expect(await routeAction.text()).toBe("action");
            }
        ));

    it("supports a single filter", () => {
        const filter = createRouteFilter((props) => <>single filter {props.children}</>);
        return runTestApp(
            {
                "/a": route([filter], {}, () => <>a</>),
                "/b": route(filter, {}, () => <>b</>),
                "/c": action([filter], {}, () => <>c</>),
                "/d": action(filter, {}, () => <>d</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponseA = await fetchRoute(urls.route("/a/"));
                expect(routeResponseA.status).toBe(200);
                expect(await routeResponseA.text()).toBe("single filter a");

                const routeResponseB = await fetchRoute(urls.route("/b/"));
                expect(routeResponseB.status).toBe(200);
                expect(await routeResponseB.text()).toBe("single filter b");

                const actionResponseC = await fetchAction(urls.action("/c/"));
                expect(actionResponseC.status).toBe(200);
                expect(await actionResponseC.text()).toBe("single filter c");

                const actionResponseD = await fetchAction(urls.action("/d/"));
                expect(actionResponseD.status).toBe(200);
                expect(await actionResponseD.text()).toBe("single filter d");
            }
        );
    });

    it("supports multiple filters", () => {
        const filter1 = createRouteFilter((props) => <>filter 1 {props.children}</>);
        const filter2 = createRouteFilter((props) => <>filter 2 {props.children}</>);

        return runTestApp(
            {
                "/a": route([filter1, filter2], {}, () => <>a</>),
                "/b": action([filter1, filter2], {}, () => <>b</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("filter 1 filter 2 a");

                const actionResponse = await fetchAction(urls.action("/b/"));
                expect(actionResponse.status).toBe(200);
                expect(await actionResponse.text()).toBe("filter 1 filter 2 b");
            }
        );
    });

    it("allows filters to send errors", () => {
        const filter = createRouteFilter(() => {
            useHttpStatusCode(401);
            return <>filter error</>;
        });

        return runTestApp(
            {
                "/a": route([filter], {}, () => <>a</>),
                "/b": action([filter], {}, () => <>b</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(urls.route("/a/"));
                expect(routeResponse.status).toBe(401);
                expect(await routeResponse.text()).toBe("filter error");

                const actionResponse = await fetchAction(urls.action("/b/"));
                expect(actionResponse.status).toBe(401);
                expect(await actionResponse.text()).toBe("filter error");
            }
        );
    });
});

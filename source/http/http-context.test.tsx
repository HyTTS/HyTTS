import { z } from "zod";
import {
    AbsoluteRedirect,
    Redirect,
    useHttpStatusCode,
    useRequestedFrameId,
    useRequester,
    useRequestHeader,
    useResponseHeader,
    useUrlSearchParams,
} from "@/http/http-context";
import { getHrefs, type Href } from "@/routing/href";
import { route, routes } from "@/routing/router";
import { runTestApp } from "@/test-helpers";

describe("http-context", () => {
    it("supports an HTTP redirect to a route", () => {
        const rs = routes({
            "GET /a": () => <Redirect href={href("GET /b")} />,
            "GET /b": () => <>b</>,
        });
        const href = getHrefs<typeof rs>();

        return runTestApp(rs, async (href, fetch) => {
            const routeResponse = await fetch(href("GET /a"));
            expect(routeResponse.status).toBe(200);
            expect(await routeResponse.text()).toBe("b");
        });
    });

    it("throws for an HTTP redirect to an absolute URL if someone fakes a `RouteUrl`", () =>
        runTestApp(
            routes({
                "GET /a": () => <Redirect href={{ url: "https://google.com" } as Href<"GET">} />,
                "GET /b": () => <>b</>,
            }),
            async (href, fetch) => {
                const routeResponse = await fetch(href("GET /a"));
                expect(routeResponse.status).toBe(500);
            },
        ));

    it("supports an HTTP redirect to an absolute URL", () =>
        runTestApp(
            routes({
                "GET /a": () => <AbsoluteRedirect href="https://www.google.com" />,
                "GET /b": () => <>b</>,
            }),
            async (href, fetch) => {
                const routeResponse = await fetch(href("GET /a"));
                expect(routeResponse.status).toBe(200);
                expect(routeResponse.url).toBe("https://www.google.com/");
            },
        ));

    it("supports getting and setting HTTP headers", () =>
        runTestApp(
            routes({
                "GET /single": () => {
                    useResponseHeader("x-test", "1");
                    return <>{useRequestHeader("test")}</>;
                },
                "GET /multiple": () => {
                    useResponseHeader("x-test1", "1");
                    useResponseHeader("x-test2", "2");
                    return <></>;
                },
                "GET /overwrite": () => {
                    useResponseHeader("x-test", "1");
                    useResponseHeader("x-test", "2");
                    return <></>;
                },
            }),
            async (href, fetch) => {
                const singleResponse = await fetch(href("GET /single"), { test: "abc" });
                expect(singleResponse.headers.get("x-test")).toBe("1");
                expect(await singleResponse.text()).toBe("abc");

                const multipleResponse = await fetch(href("GET /multiple"));
                expect(multipleResponse.headers.get("x-test1")).toBe("1");
                expect(multipleResponse.headers.get("x-test2")).toBe("2");

                const overwriteResponse = await fetch(href("GET /overwrite"));
                expect(overwriteResponse.headers.get("x-test")).toBe("2");
            },
        ));

    it("supports setting the HTTP status code", () =>
        runTestApp(
            routes({
                "GET /single": () => {
                    useHttpStatusCode(400);
                    return <></>;
                },
                "GET /overwrite": () => {
                    useHttpStatusCode(400);
                    useHttpStatusCode(401);
                    return <></>;
                },
            }),
            async (href, fetch) => {
                const singleResponse = await fetch(href("GET /single"));
                expect(singleResponse.status).toBe(400);

                const overwriteResponse = await fetch(href("GET /overwrite"));
                expect(overwriteResponse.status).toBe(401);
            },
        ));

    it("supports accessing search params via hook", () =>
        runTestApp(
            routes({
                "GET /single": route(z.object({ x: z.string() }), () => {
                    const { x } = useUrlSearchParams(z.object({ x: z.string() }));
                    return <>{x}</>;
                }),
            }),
            async (href, fetch) => {
                const singleResponse = await fetch(href("GET /single", { x: "test" }));
                expect(await singleResponse.text()).toBe("test");
            },
        ));

    it("distinguishes between requests originating from the browser or HyTTS", () =>
        runTestApp(
            routes({
                "GET /single": () => {
                    return <>{useRequester()}</>;
                },
            }),
            async (href, fetch) => {
                const browserResponse = await fetch(href("GET /single"));
                expect(await browserResponse.text()).toBe("browser");

                const hyResponse = await fetch(href("GET /single"), { "x-hy": "true" });
                expect(await hyResponse.text()).toBe("HyTTS");
            },
        ));

    it("returns the frame id of the current request", () =>
        runTestApp(
            routes({
                "GET /id": () => {
                    return <>{useRequestedFrameId() ?? "-"}</>;
                },
            }),
            async (href, fetch) => {
                const browserResponse = await fetch(href("GET /id"), {
                    "x-hy-frame-id": "test",
                });
                expect(await browserResponse.text()).toBe("test");

                const hyResponse = await fetch(href("GET /id"));
                expect(await hyResponse.text()).toBe("-");
            },
        ));
});

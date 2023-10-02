import { z } from "zod";
import { Redirect, useHttpStatusCode, useResponseHeader } from "@/http/http-context";
import type { Href } from "@/routing/href";
import { createRouter } from "@/routing/router";
import { runTestApp } from "@/test-helpers";

describe("express-middleware", () => {
    it("provides access to the HTTP request for routing and param retrieval", () =>
        runTestApp(
            routes({
                "/:n": param(z.number(), (n) =>
                    routes({
                        "/:s": param(z.string(), (s) =>
                            routes({
                                "GET /a": route(z.object({ b: z.number() }), ({ b }) => (
                                    <>
                                        GET {s()} {n()} {b}
                                    </>
                                )),
                                "POST /b": route(z.object({ b: z.number() }), ({ b }) => (
                                    <>
                                        POST {s()} {n()} {b}
                                    </>
                                )),
                            }),
                        ),
                    }),
                ),
            }),
            async (href, fetch) => {
                const getResponse = await fetch(href("GET /:n/:s/a", { n: 1, s: "t" }, { b: 2 }));
                expect(await getResponse.text()).toBe("GET t 1 2");

                const postResponse = await fetch(href("POST /:n/:s/b", { n: 1, s: "t" }, { b: 2 }));
                expect(await postResponse.text()).toBe("POST t 1 2");
            },
        ));

    it("allows modifying the HTTP response", () =>
        runTestApp(
            routes({
                "GET /statusCode": () => {
                    useHttpStatusCode(201);
                    return <>status: 201</>;
                },
                "GET /headers": () => {
                    useResponseHeader("x-test", "test");
                    return <>header</>;
                },
                "GET /redirect": () => (
                    <Redirect href={{ url: "/statusCode", method: "GET" } as Href<"GET">} />
                ),
            }),
            async (href, fetch) => {
                const statusCodeResponse = await fetch(href("GET /statusCode"));
                expect(await statusCodeResponse.text()).toBe("status: 201");
                expect(statusCodeResponse.status).toBe(201);

                const headerResponse = await fetch(href("GET /headers"));
                expect(await headerResponse.text()).toBe("header");
                expect(headerResponse.headers.get("x-test")).toBe("test");

                const redirectResponse = await fetch(href("GET /redirect"));
                expect(await redirectResponse.text()).toBe("status: 201");
                expect(redirectResponse.status).toBe(201);
            },
        ));
});

const { routes, route, param } = createRouter({});

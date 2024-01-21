/* eslint-disable jest/no-commented-out-tests */
import { z } from "zod";
import { type HttpMethod, HttpResponse, Redirect } from "@/http/http-context";
import { renderToString } from "@/jsx/jsx-runtime";
import { createHref, type Href } from "@/routing/href-3";
import { lazy, Router, routes, type RoutesConfig } from "@/routing/router-3";

describe("routing", () => {
    describe("basics routes", () => {
        it("allows routes for multiple HTTP methods", async () => {
            const rs = routes({ "GET /": () => <>g</>, "POST /": <>p</> });
            const href = createHref<typeof rs>();

            expect(href("GET /").url).toBe("/");
            expect(href("POST /").url).toBe("/");

            expect(href("GET /").method).toBe("GET");
            expect(href("POST /").method).toBe("POST");

            expect(href("GET /").body).toBe("");
            expect(href("POST /").body).toBe("");

            expect(await render(rs, href("GET /"))).toBe("g");
            expect(await render(rs, href("POST /"))).toBe("p");
            expect(await render(rs, href("POST /"))).toBe("p");

            // @ts-expect-error
            href("GET /a");

            // @ts-expect-error
            href("POST /a");

            // @ts-expect-error
            href("GET /", {});

            // @ts-expect-error
            href("POST /", {});
        });

        it("allows multiple different routes", async () => {
            const rs = routes({ "GET /a": () => <>a</>, "GET /b": () => <>b</> });
            const href = createHref<typeof rs>();

            expect(href("GET /a").url).toBe("/a");
            expect(await render(rs, href("GET /a"))).toBe("a");

            expect(href("GET /b").url).toBe("/b");
            expect(await render(rs, href("GET /b"))).toBe("b");

            // @ts-expect-error
            href("POST /a");

            // @ts-expect-error
            href("POST /b");

            // @ts-expect-error
            href("GET /a", {});
        });

        it("allows nested routes", async () => {
            const rs = routes({
                "GET /a": () => <>a</>,
                "/c": routes({
                    "GET /d": () => <>d</>,
                    "/f": routes({ "GET /g": () => <>g</> }),
                    "/": routes({ "GET /e": () => <>e</> }),
                }),
                "/": routes({ "GET /b": () => <>b</> }),
            });
            const href = createHref<typeof rs>();

            expect(href("GET /a").url).toBe("/a");
            expect(await render(rs, href("GET /a"))).toBe("a");

            expect(href("GET /b").url).toBe("/b");
            expect(await render(rs, href("GET /b"))).toBe("b");

            expect(href("GET /c/d").url).toBe("/c/d");
            expect(await render(rs, href("GET /c/d"))).toBe("d");

            expect(href("GET /c/e").url).toBe("/c/e");
            expect(await render(rs, href("GET /c/e"))).toBe("e");

            expect(href("GET /c/f/g").url).toBe("/c/f/g");
            expect(await render(rs, href("GET /c/f/g"))).toBe("g");

            // @ts-expect-error
            href("GET /");

            // @ts-expect-error
            href("GET /c/f/g", {});

            // @ts-expect-error
            href("GET /c");

            // @ts-expect-error
            href("GET /c/f");
        });

        it("matches the final route exactly, returning a 404 for leftover path segments", async () => {
            const rs = routes({ "/a": routes({ "GET /b": () => <>ab</> }) });
            const href = createHref<typeof rs>();

            expect(await render(rs, href("GET /a/b"))).toBe("ab");
            await expect(render(rs, (href as any)("GET /a/b/c"))).rejects.toThrow("NotFound");
        });

        it("disallows non-GET requests from the browser", async () => {
            const rs = routes({ "POST /p": <>test</> });
            const href = createHref<typeof rs>();

            expect(await render(rs, href("POST /p"))).toBe("test");
            await expect(() => render(rs, href("POST /p"), () => undefined)).rejects.toThrow(
                "BadRequest",
            );
        });

        it.todo("allows untyped routers where everything is string-based");

        it("supports routes that redirect", async () => {
            const rs = routes({
                "GET /redirect": () => <Redirect href={href("GET /target")} />,
                "GET /target": <></>,
                "POST /redirect": () => (
                    <Redirect
                        // @ts-expect-error
                        href={href("POST /redirect")}
                    />
                ),
            });
            const href = createHref<typeof rs>();

            expect(await getRedirectUrl(rs, href("GET /redirect"))).toBe("/target");
        });

        it("supports asynchronous routes definitions", async () => {
            const rs = routes(async () => {
                const result = await Promise.resolve("test");
                return {
                    "GET /": () => <>{result}</>,
                    "/sub": routes(async () => {
                        const result = await Promise.resolve("sub");
                        return {
                            "GET /": () => <>{result}</>,
                        };
                    }),
                };
            });
            const href = createHref<typeof rs>();

            expect(href("GET /").url).toBe("/");
            expect(href("GET /sub").url).toBe("/sub");

            expect(await render(rs, href("GET /"))).toBe("test");
            expect(await render(rs, href("GET /sub"))).toBe("sub");
        });

        it("supports lazily-loaded routes", async () => {
            const rs = routes({
                "/test": lazy(() =>
                    Promise.resolve({
                        default: () => routes({ "GET /abc": () => <>t</> }),
                    }),
                ),
                "/params": lazy(
                    () =>
                        Promise.resolve({
                            default: (n: number) => routes({ "GET /abc": () => <>{n}</> }),
                        }),
                    17,
                ),
                "/params-async": lazy(
                    () =>
                        Promise.resolve({
                            default: async (n: number) => {
                                const result = await Promise.resolve(n + 1);
                                return routes({ "GET /abc": () => <>{result}</> });
                            },
                        }),
                    17,
                ),
                "/type-error": lazy(
                    () =>
                        Promise.resolve({
                            default: (n: number) => routes({ "GET /abc": () => <>{n}</> }),
                        }),
                    // @ts-expect-error
                    "test",
                ),
                "/": lazy(() =>
                    Promise.resolve({
                        default: () => routes({ "POST /": () => <>p</> }),
                    }),
                ),
            });
            const href = createHref<typeof rs>();

            expect(href("POST /").url).toBe("/");
            expect(href("GET /test/abc").url).toBe("/test/abc");
            expect(href("GET /params/abc").url).toBe("/params/abc");
            expect(href("GET /params-async/abc").url).toBe("/params-async/abc");

            expect(await render(rs, href("POST /"))).toBe("p");
            expect(await render(rs, href("GET /test/abc"))).toBe("t");
            expect(await render(rs, href("GET /params/abc"))).toBe("17");
            expect(await render(rs, href("GET /params-async/abc"))).toBe("18");
        });

        it.todo("matches in the correct order");
    });

    //     //     describe("routing tree validation", () => {
    //     //         it("throws when the specified route kind and the route component don't match", () => {
    //     //             expect(() => routes({ "/": param(z.object({}), () => routes({})) as any })).toThrow();
    //     //             expect(() => routes({ "/": route(z.object({}), () => <></>) as any })).toThrow();

    //     //             expect(() =>
    //     //                 routes({ "GET /": lazy(() => Promise.resolve({ default: routes({}) })) as any }),
    //     //             ).toThrow();
    //     //             expect(() =>
    //     //                 routes({ "GET /": param(z.object({}), () => routes({})) as any }),
    //     //             ).toThrow();
    //     //             expect(() => routes({ "GET /": 1 as any })).toThrow();

    //     //             expect(() => routes({ "/:p": route(z.object({}), () => <></>) as any })).toThrow();
    //     //             expect(() => routes({ "/:p": routes({}) as any })).toThrow();
    //     //         });

    //     //         it("does not allow same route twice", () => {
    //     //             routes({
    //     //                 "GET /a": () => <></>,
    //     //                 // @ts-expect-error
    //     //                 "GET /a": () => <></>,
    //     //             });

    //     //             routes({
    //     //                 "POST /a": () => <></>,
    //     //                 // @ts-expect-error
    //     //                 "POST /a": () => <></>,
    //     //             });

    //     //             expect(() =>
    //     //                 routes({
    //     //                     "GET /": () => <></>,
    //     //                     // TODO: @ts-expect-error
    //     //                     "/": routes({}),
    //     //                 }),
    //     //             ).toThrow("can only have one");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     "/": routes({}),
    //     //                     // TODO: @ts-expect-error
    //     //                     "/:p": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).toThrow("can only have one");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     "/:p": param(z.string(), () => routes({})),
    //     //                     // TODO: @ts-expect-error
    //     //                     "/:q": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).toThrow("can only have one");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     "/x": routes({}),
    //     //                     // TODO: @ts-expect-error
    //     //                     "GET /x": () => <></>,
    //     //                 }),
    //     //             ).toThrow("Duplicated");
    //     //         });

    //     //         it("allows `GET /` and a path parameter at the same time`", () => {
    //     //             expect(() =>
    //     //                 routes({
    //     //                     "GET /": () => <></>,
    //     //                     "/:p": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).not.toThrow();
    //     //         });

    //     //         it("forbids malformed routes", () => {
    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "UNSUPPORTED /a": () => <></>,
    //     //                 }),
    //     //             ).toThrow("Unsupported HTTP method");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     y: () => <></>,
    //     //                 }),
    //     //             ).toThrow("Invalid");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "GET /a/b": () => <></>,
    //     //                 }),
    //     //             ).toThrow("Single slash");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "GET /a b": () => <></>,
    //     //                 }),
    //     //             ).toThrow("space");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "GET /a:b": () => <></>,
    //     //                 }),
    //     //             ).toThrow("colon");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "/a:b": () => <></>,
    //     //                 }),
    //     //             ).toThrow("colon");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "/:a:b": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).toThrow("space");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "/:a/b": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).toThrow("slash");

    //     //             expect(() =>
    //     //                 routes({
    //     //                     // @ts-expect-error
    //     //                     "/:a b": param(z.string(), () => routes({})),
    //     //                 }),
    //     //             ).toThrow("space");

    //     //     expect(() =>
    //     //     // @ts-expect-error
    //     //     routes({ "GET /:s?": () => <></> }),
    //     // ).toThrow("Invalid space, slash, question mark, or colon");

    //     // expect(() =>
    //     //     // @ts-expect-error
    //     //     routes({ "GET /?": () => <></> }),
    //     // ).toThrow("Invalid space, slash, question mark, or colon");

    //     // expect(() =>
    //     //     // @ts-expect-error
    //     //     routes({ "/?": routes({}) }),
    //     // ).toThrow("Invalid space, slash, question mark, or colon");

    //     // expect(() =>
    //     //     // @ts-expect-error
    //     //     routes({ "/:q??": param(z.string(), () => routes({})) }),
    //     // ).toThrow("Invalid space, slash, question mark, or colon");
    //     //         });
    //     //     });

    //     describe("parameters", () => {
    //         it("supports (nested) path params", async () => {
    //             const rs = () =>
    //                 routes({
    //                     "/:n": pathParam(z.number(), (n) =>
    //                         routes({
    //                             "GET /n-only": () => <>{n}</>,
    //                             "/:s": pathParam(z.string(), (s) =>
    //                                 routes({
    //                                     "GET /sn": () => {
    //                                         // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                         const shouldBeString: string = s;

    //                                         // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                         const shouldBeNumber: number = n;

    //                                         return (
    //                                             <>
    //                                                 {s} {n}
    //                                             </>
    //                                         );
    //                                     },
    //                                 }),
    //                             ),
    //                         }),
    //                     ),
    //                 });
    //             const href = createHref<typeof rs>();

    //             expect(href("GET /:n/n-only", { path: { n: 18 } }).body).toBe("");
    //             expect(href("GET /:n/n-only", { path: { n: 18 } }).url).toBe("/18/n-only");
    //             expect(href("GET /:n/n-only", { path: { n: 18 } }).method).toBe("GET");
    //             expect(await render(rs, href("GET /:n/n-only", { path: { n: 18 } }))).toBe("18");

    //             expect(href("GET /:n/:s/sn", { path: { s: "get?", n: 17 } }).body).toBe("");
    //             expect(href("GET /:n/:s/sn", { path: { s: "get?", n: 17 } }).url).toBe("/17/get%3F/sn");
    //             expect(href("GET /:n/:s/sn", { path: { s: "get?", n: 17 } }).method).toBe("GET");
    //             expect(await render(rs, href("GET /:n/:s/sn", { path: { s: "get?", n: 17 } }))).toBe(
    //                 "get? 17",
    //             );
    //             expect(await render(rs, href("GET /:n/:s/sn", { path: { s: "test", n: 31 } }))).toBe(
    //                 "test 31",
    //             );
    //             await expect(() =>
    //                 render(rs, href("GET /:n/:s/sn", { path: { s: "", n: 31 } })),
    //             ).rejects.toThrow("NotFound");

    //             // @ts-expect-error
    //             href("GET /:n/n-only");

    //             // @ts-expect-error
    //             href("GET /:n/n-only", {});

    //             // @ts-expect-error
    //             href("GET /:n/n-only", { path: { n: "17" } });

    //             // @ts-expect-error
    //             href("GET /:n/:s/sn");

    //             // @ts-expect-error
    //             href("GET /:n/:s/sn", {});

    //             // @ts-expect-error
    //             href("GET /:n/:s/sn", { path: { s: 17 } });

    //             // @ts-expect-error
    //             href("GET /:n/:s/sn", { path: { n: "17" } });

    //             await expect(() =>
    //                 render(rs, href("GET /:n/n-only", { path: { n: "ab" as any } })),
    //             ).rejects.toThrow("BadRequest");

    //             await expect(() =>
    //                 render(rs, href("GET /:n/:s/sn", { path: { s: "s", n: "a" as any } })),
    //             ).rejects.toThrow("BadRequest");

    //             await expect(() =>
    //                 render(rs, { url: "/1//sn", method: "GET" } as Href<"GET">),
    //             ).rejects.toThrow("NotFound");
    //         });

    //         it("supports optional path params", async () => {
    //             const rs = () =>
    //                 routes({
    //                     "/:n?": pathParam(z.string().max(4).optional(), (n) =>
    //                         routes({
    //                             "GET /": () => {
    //                                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                 const shouldBeString: string | undefined = n;
    //                                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                 const m: typeof n = undefined;

    //                                 return <>n: {n ?? "undefined"}</>;
    //                             },
    //                             "/:m?": pathParam(z.string().optional(), (m) =>
    //                                 routes({
    //                                     "GET /": () => (
    //                                         <>
    //                                             n: {n} m: {m}
    //                                         </>
    //                                     ),
    //                                 }),
    //                             ),
    //                         }),
    //                     ),
    //                     "/default": routes({
    //                         "/:n?": pathParam(z.string().max(4).default("x"), (n) =>
    //                             routes({
    //                                 "GET /": () => {
    //                                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                     const shouldBeString: string = n;

    //                                     return <>n: {n}</>;
    //                                 },
    //                             }),
    //                         ),
    //                     }),
    //                     "/type-error1": routes({
    //                         // @ts-expect-error
    //                         "/:n?": pathParam(z.string(), () => routes({})),
    //                     }),
    //                     "/required-param-with-optional-schema": routes({
    //                         "/:n": pathParam(z.string().optional(), (n) =>
    //                             routes({
    //                                 "GET /": () => {
    //                                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //                                     const shouldBeString: string | undefined = n;
    //                                     return <>n: {n}</>;
    //                                 },
    //                             }),
    //                         ),
    //                     }),
    //                 });
    //             const href = createHref<typeof rs>();

    //             expect(href("GET /:n", { path: { n: "a:?" } }).url).toBe("/a%3A%3F");
    //             expect(href("GET /:n", { path: { n: undefined } }).url).toBe("/");
    //             expect(href("GET /:n", {}).url).toBe("/");
    //             expect(href("GET /:n/:m", { path: { n: "a" } }).url).toBe("/a");
    //             expect(href("GET /:n/:m", { path: { n: "a", m: undefined } }).url).toBe("/a");
    //             expect(href("GET /:n/:m", { path: { n: "a", m: "b" } }).url).toBe("/a/b");

    //             // @ts-expect-error
    //             href("GET /:n/:m", {});
    //             // @ts-expect-error
    //             href("GET /:n/:m", { path: {} });
    //             // @ts-expect-error
    //             href("GET /:n/:m", { path: { n: undefined, m: undefined } });
    //             // @ts-expect-error
    //             href("GET /:n/:m", { path: { m: "b" } });

    //             // @ts-expect-error
    //             href("GET /:n");

    //             expect(await render(rs, href("GET /:n", { path: { n: "a?b?" } }))).toBe("n: a?b?");
    //             expect(await render(rs, href("GET /:n", {}))).toBe("n: undefined");

    //             expect(await render(rs, href("GET /default/:n", { path: { n: "a?b?" } }))).toBe(
    //                 "n: a?b?",
    //             );
    //             expect(await render(rs, href("GET /default/:n", {}))).toBe("n: x");

    //             await expect(() =>
    //                 render(rs, href("GET /:n", { path: { n: "abcdef" } })),
    //             ).rejects.toThrow("BadRequest");

    //             expect(await render(rs, href("GET /:n/:m", { path: { n: "a" } }))).toBe("n: a");
    //             expect(await render(rs, href("GET /:n/:m", { path: { n: "a", m: undefined } }))).toBe(
    //                 "n: a",
    //             );
    //             expect(await render(rs, href("GET /:n/:m", { path: { n: "a", m: "b" } }))).toBe(
    //                 "n: a m: b",
    //             );
    //         });

    //         //     it("supports (nested) search params", async () => {
    //         //         const rs = routes({
    //         //             "GET /component": () => <>component</>,
    //         //             "GET /search": route(z.object({ s: z.string(), n: z.number() }), ({ s, n }) => {
    //         //                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                 const shouldBeString: string = s;

    //         //                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                 const shouldBeNumber: number = n;

    //         //                 return (
    //         //                     <>
    //         //                         {s} {n}
    //         //                     </>
    //         //                 );
    //         //             }),
    //         //             "GET /ignore": route(z.object({ n: z.number() }), () => {
    //         //                 return <>ignore</>;
    //         //             }),
    //         //             "POST /body": route(z.object({ s: z.string(), n: z.number() }), ({ s, n }) => {
    //         //                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                 const shouldBeString: string = s;

    //         //                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                 const shouldBeNumber: number = n;

    //         //                 return (
    //         //                     <>
    //         //                         {s} {n}
    //         //                     </>
    //         //                 );
    //         //             }),
    //         //         });
    //         //         const href = createHref<typeof rs>();

    //         //         expect(href("GET /component").body).toBeUndefined();
    //         //         expect(href("GET /component").url).toBe("/component");
    //         //         expect(href("GET /component").method).toBe("GET");
    //         //         expect(await render(rs, href("GET /component"))).toBe("component");

    //         //         expect(href("GET /ignore", { n: 17 }).body).toBeUndefined();
    //         //         expect(href("GET /ignore", { n: 17 }).url).toBe("/ignore?n=17");
    //         //         expect(href("GET /ignore", { n: 17 }).method).toBe("GET");
    //         //         expect(await render(rs, href("GET /ignore", { n: 17 }))).toBe("ignore");

    //         //         expect(href("GET /search", { s: "get?", n: 17 }).body).toBeUndefined();
    //         //         expect(href("GET /search", { s: "get?", n: 17 }).url).toBe("/search?s=get%3F&n=17");
    //         //         expect(href("GET /search", { s: "get?", n: 17 }).method).toBe("GET");
    //         //         expect(await render(rs, href("GET /search", { s: "get?", n: 17 }))).toBe("get? 17");

    //         //         // @ts-expect-error
    //         //         href("GET /search");

    //         //         // @ts-expect-error
    //         //         href("GET /search", {});

    //         //         // @ts-expect-error
    //         //         href("GET /search", { s: "test", n: "17" });

    //         //         expect(href("POST /body", { s: "post?", n: 17 }).body).toBe("s=post%3F&n=17");
    //         //         expect(href("POST /body", { s: "post?", n: 17 }).url).toBe("/body");
    //         //         expect(href("POST /body", { s: "post?", n: 17 }).method).toBe("POST");
    //         //         expect(await render(rs, href("POST /body", { s: "post?", n: 17 }))).toBe("post? 17");

    //         //         // @ts-expect-error
    //         //         href("POST /body");

    //         //         // @ts-expect-error
    //         //         href("POST /body", {});

    //         //         // @ts-expect-error
    //         //         href("POST /body", { s: "test", n: "17" });

    //         //         await expect(() => render(rs, href("POST /body", { n: 17 } as any))).rejects.toThrow(
    //         //             "BadRequest",
    //         //         );

    //         //         await expect(() => render(rs, href("GET /search", { n: 17 } as any))).rejects.toThrow(
    //         //             "BadRequest",
    //         //         );

    //         //         await expect(() =>
    //         //             render(rs, href("POST /body", { s: "", n: "b" } as any)),
    //         //         ).rejects.toThrow("BadRequest");

    //         //         await expect(() =>
    //         //             render(rs, href("GET /search", { s: "", n: "a" } as any)),
    //         //         ).rejects.toThrow("BadRequest");
    //         //     });

    //         //     it.todo("supports (nested) body params");

    //         //     it.todo("supports (nested) hash params");

    //         //     it("supports all kinds of parameters at the same time", async () => {
    //         //         const rs = routes({
    //         //             "/:n": param(z.number(), (n) =>
    //         //                 routes({
    //         //                     "GET /": route(z.object({ s: z.string() }), ({ s }) => (
    //         //                         <>
    //         //                             GET {s} {n()}
    //         //                         </>
    //         //                     )),
    //         //                     "POST /": route(z.object({ s: z.string() }), ({ s }) => (
    //         //                         <>
    //         //                             POST {s} {n()}
    //         //                         </>
    //         //                     )),
    //         //                 }),
    //         //             ),
    //         //         });
    //         //         const href = createHref<typeof rs>();

    //         //         expect(href("GET /:n", { n: 18 }, { s: "test?" }).body).toBeUndefined();
    //         //         expect(href("GET /:n", { n: 18 }, { s: "test?" }).url).toBe("/18?s=test%3F");
    //         //         expect(href("GET /:n", { n: 18 }, { s: "test?" }).method).toBe("GET");
    //         //         expect(await render(rs, href("GET /:n", { n: 18 }, { s: "test?" }))).toBe("GET test? 18");

    //         //         expect(href("POST /:n", { n: 18 }, { s: "test?" }).body).toBe("s=test%3F");
    //         //         expect(href("POST /:n", { n: 18 }, { s: "test?" }).url).toBe("/18");
    //         //         expect(href("POST /:n", { n: 18 }, { s: "test?" }).method).toBe("POST");
    //         //         expect(await render(rs, href("POST /:n", { n: 18 }, { s: "test?" }))).toBe("POST test? 18");

    //         //         // @ts-expect-error
    //         //         href("GET /:n");

    //         //         // @ts-expect-error
    //         //         href("GET /:n", { n: 18 });

    //         //         // @ts-expect-error
    //         //         href("GET /:n", { n: 18 }, { s: 1 });

    //         //         // @ts-expect-error
    //         //         href("GET /:n", { n: "ab" }, { s: "" });
    //         //     });
    //     });

    //     describe("parameter schemas", () => {
    //         // it("supports dynamically computed schemas for all kinds of parameters", async () => {
    //         //     const rs = async () =>
    //         //         routes({
    //         //             "/:n": pathParam(await Promise.resolve(z.number()), async (n) =>
    //         //                 routes({
    //         //                     "/": searchParams(
    //         //                         await Promise.resolve(z.object({ s: z.string() })),
    //         //                         ({ s }) =>
    //         //                             routes({
    //         //                                 "GET /": () => {
    //         //                                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                                     const x: string = s;
    //         //                                     return (
    //         //                                         <>
    //         //                                             GET {s} {n()}
    //         //                                         </>
    //         //                                     );
    //         //                                 },
    //         //                             }),
    //         //                     ),
    //         //                 }),
    //         //             ),
    //         //         });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /:n", { n: 18 }, { s: "test?" }))).toBe(
    //         //         "GET test? 18",
    //         //     );
    //         // });
    //         // it("supports transforming schemas for all kinds of parameters", async () => {
    //         //     const rs = routes({
    //         //         "/:n": pathParam(
    //         //             z.string().transform((s) => s.length),
    //         //             (n) =>
    //         //                 routes({
    //         //                     "GET /": route(
    //         //                         z.object({ s: z.string().transform((s) => s.length) }),
    //         //                         ({ s }) => {
    //         //                             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                             const a: number = s;
    //         //                             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                             const b: () => number = n;
    //         //                             return (
    //         //                                 <>
    //         //                                     GET {s} {n()}
    //         //                                 </>
    //         //                             );
    //         //                         },
    //         //                     ),
    //         //                 }),
    //         //         ),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /:n", { n: "ab" }, { s: "test?" }))).toBe("GET 5 2");
    //         // });
    //         // it("supports more complex schemas for all kinds of parameters", async () => {
    //         //     const rs = routes({
    //         //         "/:n": param(zLocalDate(), (n) =>
    //         //             routes({
    //         //                 "GET /": route(z.object({ d: zLocalDate() }), ({ d }) => {
    //         //                     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                     const x: LocalDate = d;
    //         //                     return (
    //         //                         <>
    //         //                             {`${d}`} {`${n()}`}
    //         //                         </>
    //         //                     );
    //         //                 }),
    //         //             }),
    //         //         ),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     const now = LocalDate.now();
    //         //     expect(await render(rs, href("GET /:n", { n: now }, { d: now }))).toBe(`${now} ${now}`);
    //         // });
    //         // it("supports object-level refinements for all kinds of parameters", async () => {
    //         //     const rs = routes({
    //         //         "GET /": route(
    //         //             z.object({ s: z.string() }).refine((o) => o.s !== ""),
    //         //             ({ s }) => {
    //         //                 // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //                 const x: string = s;
    //         //                 return <>{s}</>;
    //         //             },
    //         //         ),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /", { s: "test?" }))).toBe("test?");
    //         //     await expect(() => render(rs, href("GET /", { s: "" }))).rejects.toThrow("BadRequest");
    //         // });
    //         // it("supports intersected schemas for all kinds of parameters", async () => {
    //         //     const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
    //         //     const rs = routes({
    //         //         "GET /": route(z.object({ d: schema }), ({ d: { a, b } }) => {
    //         //             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //             const x: string = a;
    //         //             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //             const y: number = b;
    //         //             return (
    //         //                 <>
    //         //                     {a} {b}
    //         //                 </>
    //         //             );
    //         //         }),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /", { d: { a: "test?", b: 1 } }))).toBe("test? 1");
    //         // });
    //         // it("supports optional properties for all kinds of parameters", async () => {
    //         //     const rs = routes({
    //         //         "GET /": route(z.object({ d: z.string().optional() }), ({ d }) => {
    //         //             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //             const x: string | undefined = d;
    //         //             return <>{d}</>;
    //         //         }),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /", { d: "test" }))).toBe("test");
    //         //     expect(await render(rs, href("GET /", {}))).toBe("");
    //         //     // @ts-expect-error
    //         //     href("GET /");
    //         // });
    //         // it("supports default properties for all kinds of parameters", async () => {
    //         //     const rs = routes({
    //         //         "GET /": route(z.object({ d: z.string().default("abc") }), ({ d }) => {
    //         //             // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         //             const x: string = d;
    //         //             return <>{d}</>;
    //         //         }),
    //         //     });
    //         //     const href = createHref<typeof rs>();
    //         //     expect(await render(rs, href("GET /", { d: "test" }))).toBe("test");
    //         //     expect(await render(rs, href("GET /", {}))).toBe("abc");
    //         //     // @ts-expect-error
    //         //     href("GET /");
    //         // });
    //         // // eslint-disable-next-line jest/expect-expect
    //         // it("does not allow non-object-like schemas for route params", () => {
    //         //     routes({
    //         //         "GET /n": route(
    //         //             // @ts-expect-error
    //         //             z.number(),
    //         //             () => <></>,
    //         //         ),
    //         //         "GET /b": route(
    //         //             // @ts-expect-error
    //         //             z.boolean(),
    //         //             () => <></>,
    //         //         ),
    //         //         "GET /s": route(
    //         //             // @ts-expect-error
    //         //             z.string(),
    //         //             () => <></>,
    //         //         ),
    //         //     });
    //         // });
    //     });
});

async function render(
    routes: Promise<RoutesConfig<any>>,
    href: Href<HttpMethod>,
    getHeader?: (header: string) => string | undefined,
) {
    const { html } = await executeRouter(routes, href, getHeader);
    return html;
}

async function getRedirectUrl(routes: Promise<RoutesConfig<any>>, href: Href<HttpMethod>) {
    const { redirectUrl } = await executeRouter(routes, href);
    return redirectUrl;
}

async function executeRouter(
    routes: Promise<RoutesConfig<any>>,
    href: Href<HttpMethod>,
    getHeader: (header: string) => string | undefined = (name) =>
        name === "x-hy" ? "true" : undefined,
) {
    const url = new URL(href.url, "http://example.com");
    let redirectUrl = "";

    return {
        get redirectUrl() {
            return redirectUrl;
        },
        html: await renderToString(
            <HttpResponse
                value={{
                    method: href.method,
                    requestPath: url.pathname.split("/"),
                    searchParams: url.search,
                    requestBody: href.body,
                    redirect: (url) => (redirectUrl = url),
                    getHeader,
                    setHeader: () => {
                        throw new Error("unsupported");
                    },
                    setStatusCode: () => {},
                }}
            >
                <Router routes={routes} />
            </HttpResponse>,
        ),
    };
}

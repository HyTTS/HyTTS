import { LocalDate } from "@js-joda/core";
import { z } from "zod";
import { createForm, useFormProperty } from "@/form/form";
import { HttpResponse, Redirect } from "@/http/http-context";
import { renderToString } from "@/jsx/jsx-runtime";
import { type FormValues, getHrefs, type Href } from "@/routing/href";
import { createRouter, Router, type RoutesComponent } from "@/routing/router";
import { zLocalDate } from "@/serialization/date-time";

describe("routing", () => {
    it("allows routes for multiple HTTP methods", async () => {
        const rs = routes({ "GET /": () => <>g</>, "POST /": () => <>p</> });
        const href = getHrefs(rs);

        expect(href("GET /").body).toBeUndefined();
        expect(href("GET /").url).toBe("/");
        expect(href("GET /").method).toBe("GET");
        expect(href("POST /").form).toBeUndefined();
        expect(await render(rs, href("GET /"))).toBe("g");

        expect(href("POST /").body).toBe("");
        expect(href("POST /").url).toBe("/");
        expect(href("POST /").method).toBe("POST");
        expect(href("POST /").form).toBeUndefined();
        expect(await render(rs, href("POST /"))).toBe("p");

        // @ts-expect-error
        href("GET /a");

        // @ts-expect-error
        href("POST /a");

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const x: Href<"GET"> = href("GET /");

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const y: Href<"POST"> = href("POST /");
    });

    it("allows multiple different routes", async () => {
        const rs = routes({ "GET /a": () => <>a</>, "GET /b": () => <>b</> });
        const href = getHrefs(rs);

        expect(href("GET /a").body).toBeUndefined();
        expect(href("GET /a").url).toBe("/a");
        expect(href("GET /a").method).toBe("GET");
        expect(await render(rs, href("GET /a"))).toBe("a");

        expect(href("GET /b").body).toBeUndefined();
        expect(href("GET /b").url).toBe("/b");
        expect(href("GET /b").method).toBe("GET");
        expect(await render(rs, href("GET /b"))).toBe("b");

        // @ts-expect-error
        href("POST /a");

        // @ts-expect-error
        href("POST /b");
    });

    it("throws when the specified route kind and the route component don't match", () => {
        expect(() => routes({ "/": param(z.object({}), () => routes({})) as any })).toThrow();
        expect(() => routes({ "/": route(z.object({}), () => <></>) as any })).toThrow();

        expect(() =>
            routes({ "GET /": lazy(() => Promise.resolve({ default: routes({}) })) as any }),
        ).toThrow();
        expect(() => routes({ "GET /": param(z.object({}), () => routes({})) as any })).toThrow();
        expect(() => routes({ "GET /": 1 as any })).toThrow();

        expect(() => routes({ "/:p": route(z.object({}), () => <></>) as any })).toThrow();
        expect(() => routes({ "/:p": routes({}) as any })).toThrow();
    });

    it("does not allow same route twice", () => {
        routes({
            "GET /a": () => <></>,
            // @ts-expect-error
            "GET /a": () => <></>,
        });

        routes({
            "POST /a": () => <></>,
            // @ts-expect-error
            "POST /a": () => <></>,
        });

        expect(() =>
            routes({
                "GET /": () => <></>,
                // TODO: @ts-expect-error
                "/": routes({}),
            }),
        ).toThrow("can only have one");

        expect(() =>
            routes({
                "/": routes({}),
                // TODO: @ts-expect-error
                "/:p": param(z.string(), () => routes({})),
            }),
        ).toThrow("can only have one");

        expect(() =>
            routes({
                "/:p": param(z.string(), () => routes({})),
                // TODO: @ts-expect-error
                "/:q": param(z.string(), () => routes({})),
            }),
        ).toThrow("can only have one");

        expect(() =>
            routes({
                "/x": routes({}),
                // TODO: @ts-expect-error
                "GET /x": () => <></>,
            }),
        ).toThrow("Duplicated");
    });

    it("allows `GET /` and a path parameter at the same time`", () => {
        expect(() =>
            routes({
                "GET /": () => <></>,
                "/:p": param(z.string(), () => routes({})),
            }),
        ).not.toThrow();
    });

    it("forbids malformed routes", () => {
        expect(() =>
            routes({
                // @ts-expect-error
                "UNSUPPORTED /a": () => <></>,
            }),
        ).toThrow("Unsupported HTTP method");

        expect(() =>
            routes({
                // @ts-expect-error
                y: () => <></>,
            }),
        ).toThrow("Invalid");

        expect(() =>
            routes({
                // @ts-expect-error
                "GET /a/b": () => <></>,
            }),
        ).toThrow("Single slash");

        expect(() =>
            routes({
                // @ts-expect-error
                "GET /a b": () => <></>,
            }),
        ).toThrow("space");

        expect(() =>
            routes({
                // @ts-expect-error
                "GET /a:b": () => <></>,
            }),
        ).toThrow("colon");

        expect(() =>
            routes({
                // @ts-expect-error
                "/a:b": () => <></>,
            }),
        ).toThrow("colon");

        expect(() =>
            routes({
                // @ts-expect-error
                "/:a:b": param(z.string(), () => routes({})),
            }),
        ).toThrow("space");

        expect(() =>
            routes({
                // @ts-expect-error
                "/:a/b": param(z.string(), () => routes({})),
            }),
        ).toThrow("slash");

        expect(() =>
            routes({
                // @ts-expect-error
                "/:a b": param(z.string(), () => routes({})),
            }),
        ).toThrow("space");
    });

    it("supports lazily-loaded routes", async () => {
        const rs = routes({
            "/": lazy(() =>
                Promise.resolve({
                    default: routes({ "POST /": () => <>p</> }),
                }),
            ),
            "/test": lazy(() =>
                Promise.resolve({
                    default: routes({ "GET /abc": () => <>t</> }),
                }),
            ),
            "/params": lazy(
                () =>
                    Promise.resolve({
                        default: (n: number) => routes({ "GET /abc": () => <>{n}</> }),
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
        });
        const href = getHrefs(rs);

        expect(href("POST /").body).toBe("");
        expect(href("POST /").url).toBe("/");
        expect(href("POST /").method).toBe("POST");
        expect(await render(rs, href("POST /"))).toBe("p");

        expect(href("GET /test/abc").body).toBeUndefined();
        expect(href("GET /test/abc").url).toBe("/test/abc");
        expect(href("GET /test/abc").method).toBe("GET");
        expect(await render(rs, href("GET /test/abc"))).toBe("t");

        expect(href("GET /params/abc").body).toBeUndefined();
        expect(href("GET /params/abc").url).toBe("/params/abc");
        expect(href("GET /params/abc").method).toBe("GET");
        expect(await render(rs, href("GET /params/abc"))).toBe("17");
    });

    it("supports route params", async () => {
        const rs = routes({
            "GET /component": () => <>component</>,
            "GET /search": route(z.object({ s: z.string(), n: z.number() }), ({ s, n }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const shouldBeString: string = s;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const shouldBeNumber: number = n;

                return (
                    <>
                        {s} {n}
                    </>
                );
            }),
            "GET /ignore": route(z.object({ n: z.number() }), () => {
                return <>ignore</>;
            }),
            "POST /body": route(z.object({ s: z.string(), n: z.number() }), ({ s, n }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const shouldBeString: string = s;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const shouldBeNumber: number = n;

                return (
                    <>
                        {s} {n}
                    </>
                );
            }),
        });
        const href = getHrefs(rs);

        expect(href("GET /component").body).toBeUndefined();
        expect(href("GET /component").url).toBe("/component");
        expect(href("GET /component").method).toBe("GET");
        expect(await render(rs, href("GET /component"))).toBe("component");

        expect(href("GET /ignore", { n: 17 }).body).toBeUndefined();
        expect(href("GET /ignore", { n: 17 }).url).toBe("/ignore?n=17");
        expect(href("GET /ignore", { n: 17 }).method).toBe("GET");
        expect(await render(rs, href("GET /ignore", { n: 17 }))).toBe("ignore");

        expect(href("GET /search", { s: "get?", n: 17 }).body).toBeUndefined();
        expect(href("GET /search", { s: "get?", n: 17 }).url).toBe("/search?s=get%3F&n=17");
        expect(href("GET /search", { s: "get?", n: 17 }).method).toBe("GET");
        expect(await render(rs, href("GET /search", { s: "get?", n: 17 }))).toBe("get? 17");

        // @ts-expect-error
        href("GET /search");

        // @ts-expect-error
        href("GET /search", {});

        // @ts-expect-error
        href("GET /search", { s: "test", n: "17" });

        expect(href("POST /body", { s: "post?", n: 17 }).body).toBe("s=post%3F&n=17");
        expect(href("POST /body", { s: "post?", n: 17 }).url).toBe("/body");
        expect(href("POST /body", { s: "post?", n: 17 }).method).toBe("POST");
        expect(await render(rs, href("POST /body", { s: "post?", n: 17 }))).toBe("post? 17");

        // @ts-expect-error
        href("POST /body");

        // @ts-expect-error
        href("POST /body", {});

        // @ts-expect-error
        href("POST /body", { s: "test", n: "17" });

        await expect(() => render(rs, href("POST /body", { n: 17 } as any))).rejects.toThrow(
            "BadRequest",
        );

        await expect(() => render(rs, href("GET /search", { n: 17 } as any))).rejects.toThrow(
            "BadRequest",
        );

        await expect(() =>
            render(rs, href("POST /body", { s: "", n: "b" } as any)),
        ).rejects.toThrow("BadRequest");

        await expect(() =>
            render(rs, href("GET /search", { s: "", n: "a" } as any)),
        ).rejects.toThrow("BadRequest");
    });

    it("supports (nested) path params", async () => {
        const rs = routes({
            "/:n": param(z.number(), (n) =>
                routes({
                    "GET /n-only": () => <>{n()}</>,
                    "/:s": param(z.string(), (s) =>
                        routes({
                            "GET /sn": () => {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const shouldBeString: () => string = s;

                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const shouldBeNumber: () => number = n;

                                return (
                                    <>
                                        {s()} {n()}
                                    </>
                                );
                            },
                        }),
                    ),
                }),
            ),
        });
        const href = getHrefs(rs);

        expect(() => href("GET /:n/:s/sn", { n: 1, s: "" })).toThrow("for path parameter 's'.");

        expect(href("GET /:n/n-only", { n: 18 }).body).toBeUndefined();
        expect(href("GET /:n/n-only", { n: 18 }).url).toBe("/18/n-only");
        expect(href("GET /:n/n-only", { n: 18 }).method).toBe("GET");
        expect(await render(rs, href("GET /:n/n-only", { n: 18 }))).toBe("18");

        expect(href("GET /:n/:s/sn", { s: "get?", n: 17 }).body).toBeUndefined();
        expect(href("GET /:n/:s/sn", { s: "get?", n: 17 }).url).toBe("/17/get%3F/sn");
        expect(href("GET /:n/:s/sn", { s: "get?", n: 17 }).method).toBe("GET");
        expect(await render(rs, href("GET /:n/:s/sn", { s: "get?", n: 17 }))).toBe("get? 17");
        expect(await render(rs, href("GET /:n/:s/sn", { s: "test", n: 31 }))).toBe("test 31");

        // @ts-expect-error
        href("GET /:n/n-only");

        // @ts-expect-error
        href("GET /:n/n-only", {});

        // @ts-expect-error
        href("GET /:n/n-only", { n: "17" });

        // @ts-expect-error
        href("GET /:n/:s/sn");

        // @ts-expect-error
        href("GET /:n/:s/sn", {});

        // @ts-expect-error
        href("GET /:n/:s/sn", { s: 17 });

        // @ts-expect-error
        href("GET /:n/:s/sn", { n: "17" });

        await expect(() => render(rs, href("GET /:n/n-only", { n: "ab" } as any))).rejects.toThrow(
            "BadRequest",
        );

        await expect(() =>
            render(rs, href("GET /:n/:s/sn", { s: "s", n: "a" } as any)),
        ).rejects.toThrow("BadRequest");

        await expect(() =>
            render(rs, { url: "/1//sn", method: "GET" } as Href<"GET">),
        ).rejects.toThrow("NotFound");
    });

    it("supports both path and route params at the same time", async () => {
        const rs = routes({
            "/:n": param(z.number(), (n) =>
                routes({
                    "GET /": route(z.object({ s: z.string() }), ({ s }) => (
                        <>
                            GET {s} {n()}
                        </>
                    )),
                    "POST /": route(z.object({ s: z.string() }), ({ s }) => (
                        <>
                            POST {s} {n()}
                        </>
                    )),
                }),
            ),
        });
        const href = getHrefs(rs);

        expect(href("GET /:n", { n: 18 }, { s: "test?" }).body).toBeUndefined();
        expect(href("GET /:n", { n: 18 }, { s: "test?" }).url).toBe("/18?s=test%3F");
        expect(href("GET /:n", { n: 18 }, { s: "test?" }).method).toBe("GET");
        expect(await render(rs, href("GET /:n", { n: 18 }, { s: "test?" }))).toBe("GET test? 18");

        expect(href("POST /:n", { n: 18 }, { s: "test?" }).body).toBe("s=test%3F");
        expect(href("POST /:n", { n: 18 }, { s: "test?" }).url).toBe("/18");
        expect(href("POST /:n", { n: 18 }, { s: "test?" }).method).toBe("POST");
        expect(await render(rs, href("POST /:n", { n: 18 }, { s: "test?" }))).toBe("POST test? 18");

        // @ts-expect-error
        href("GET /:n");

        // @ts-expect-error
        href("GET /:n", { n: 18 });

        // @ts-expect-error
        href("GET /:n", { n: 18 }, { s: 1 });

        // @ts-expect-error
        href("GET /:n", { n: "ab" }, { s: "" });
    });

    it("supports dynamically computed schemas for both path and route params", async () => {
        const rs = routes({
            "/:n": param(
                () => Promise.resolve(z.number()),
                (n) =>
                    routes({
                        "GET /": route(
                            () => Promise.resolve(z.object({ s: z.string() })),
                            ({ s }) => {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const x: string = s;

                                return (
                                    <>
                                        GET {s} {n()}
                                    </>
                                );
                            },
                        ),
                    }),
            ),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /:n", { n: 18 }, { s: "test?" }))).toBe("GET test? 18");
    });

    it("supports transforming schemas for path and route params", async () => {
        const rs = routes({
            "/:n": param(
                z.string().transform((s) => s.length),
                (n) =>
                    routes({
                        "GET /": route(
                            z.object({ s: z.string().transform((s) => s.length) }),
                            ({ s }) => {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const a: number = s;

                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const b: () => number = n;

                                return (
                                    <>
                                        GET {s} {n()}
                                    </>
                                );
                            },
                        ),
                    }),
            ),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /:n", { n: "ab" }, { s: "test?" }))).toBe("GET 5 2");
    });

    it("supports more complex schemas for path and route params", async () => {
        const rs = routes({
            "/:n": param(zLocalDate(), (n) =>
                routes({
                    "GET /": route(z.object({ d: zLocalDate() }), ({ d }) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const x: LocalDate = d;
                        return (
                            <>
                                {`${d}`} {`${n()}`}
                            </>
                        );
                    }),
                }),
            ),
        });
        const href = getHrefs(rs);

        const now = LocalDate.now();
        expect(await render(rs, href("GET /:n", { n: now }, { d: now }))).toBe(`${now} ${now}`);
    });

    it("supports object-level refinements for route params", async () => {
        const rs = routes({
            "GET /": route(
                z.object({ s: z.string() }).refine((o) => o.s !== ""),
                ({ s }) => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const x: string = s;
                    return <>{s}</>;
                },
            ),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /", { s: "test?" }))).toBe("test?");
        await expect(() => render(rs, href("GET /", { s: "" }))).rejects.toThrow("BadRequest");
    });

    it("supports intersected schemas for route params", async () => {
        const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
        const rs = routes({
            "GET /": route(z.object({ d: schema }), ({ d: { a, b } }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const x: string = a;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const y: number = b;

                return (
                    <>
                        {a} {b}
                    </>
                );
            }),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /", { d: { a: "test?", b: 1 } }))).toBe("test? 1");
    });

    it("supports optional properties for route params", async () => {
        const rs = routes({
            "GET /": route(z.object({ d: z.string().optional() }), ({ d }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const x: string | undefined = d;
                return <>{d}</>;
            }),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /", { d: "test" }))).toBe("test");
        expect(await render(rs, href("GET /", {}))).toBe("");

        // @ts-expect-error
        href("GET /");
    });

    it("supports default properties for route params", async () => {
        const rs = routes({
            "GET /": route(z.object({ d: z.string().default("abc") }), ({ d }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const x: string = d;
                return <>{d}</>;
            }),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /", { d: "test" }))).toBe("test");
        expect(await render(rs, href("GET /", {}))).toBe("abc");

        // @ts-expect-error
        href("GET /");
    });

    // eslint-disable-next-line jest/expect-expect
    it("does not allow non-object-like schemas for route params", () => {
        routes({
            "GET /n": route(
                // @ts-expect-error
                z.number(),
                () => <></>,
            ),
            "GET /b": route(
                // @ts-expect-error
                z.boolean(),
                () => <></>,
            ),
            "GET /s": route(
                // @ts-expect-error
                z.string(),
                () => <></>,
            ),
        });
    });

    it("supports forms", async () => {
        const form = createForm("form", z.object({ s: z.string(), n: z.number() }), () => {
            const { value: s } = useFormProperty((s) => s.s);
            const { value: n } = useFormProperty((s) => s.n);

            return (
                <>
                    {s} {n}
                </>
            );
        });
        const rs = routes({ "POST /": () => form.updateState((s) => s) });
        const href = getHrefs(rs);

        expect(href("POST /").body).toBe("");
        expect(href("POST /").url).toBe("/");
        expect(href("POST /").method).toBe("POST");
        expect(href("POST /").form).toBeUndefined();
        await expect(() => render(rs, href("POST /"))).rejects.toThrow("BadRequest");
        expect(await render(rs, { ...href("POST /"), body: "s=abc&n=17" })).toBe(
            '<hy-frame id="f_form">abc 17</hy-frame>',
        );

        let x: Href<"POST", FormValues<{ s: string; n: number }>> = href("POST /");

        // @ts-expect-error
        const a: Href<"POST", FormValues<{ s: string }>> = x;

        // @ts-expect-error
        x = a;
    });

    it("supports JSX wrapping an entire set of route", async () => {
        const rs = routes(
            {
                "/a": routes({ "GET /b": () => <>ab</> }, ({ children }) => (
                    <span>{children}</span>
                )),
            },
            ({ children }) => <p>{children}</p>,
        );
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /a/b"))).toBe("<p><span>ab</span></p>");
    });

    it("supports routes that redirect", async () => {
        const rs = routes({
            "GET /redirect": () => <Redirect href={href("GET /target")} />,
            "GET /target": () => <></>,
        });
        const href = getHrefs(rs);

        expect(await getRedirectUrl(rs, href("GET /redirect"))).toBe("/target");
    });

    it("matches the final route exactly, returning a 404 for leftover path segments", async () => {
        const rs = routes({
            "/a": routes({
                "GET /b": () => <>ab</>,
            }),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /a/b"))).toBe("ab");
        await expect(() => render(rs, href("GET /a/b/c" as any))).rejects.toThrow("NotFound");
    });

    it("supports meta objects", async () => {
        const RenderMeta = () => {
            const { a, b, c, d, e, f } = useMeta();
            return (
                <>
                    {a ?? "-"} {b ?? "-"} {c ?? "-"} {d ?? "-"} {e ?? "-"} {f ?? "-"}
                </>
            );
        };

        const form = createForm("form", z.object({ s: z.string() }), RenderMeta);

        const rs = routes({
            "GET /outer": RenderMeta,
            "/nested": meta(
                routes({
                    "GET /outer": RenderMeta,
                    "GET /inner1": meta(RenderMeta, { c: "c1", e: "e1" }),
                    "GET /inner2": meta(route(z.object({ s: z.string() }), RenderMeta), {
                        c: "c2",
                        e: "e2",
                    }),
                    "/:p": meta(
                        param(z.string(), () =>
                            routes({
                                "GET /outer": RenderMeta,
                                "GET /inner1": meta(RenderMeta, { a: "a1", d: "d1", e: "e1" }),
                                "GET /inner2": meta(
                                    route(z.object({ s: z.string() }), RenderMeta),
                                    { b: "b2", c: "c2", d: "d2", e: "e2" },
                                ),
                                "POST /form": meta(() => form.updateState((s) => s), {
                                    b: "bf",
                                    c: "cf",
                                }),
                            }),
                        ),
                        { a: "aaa", b: "bbb", c: "ccc" },
                    ),
                }),
                { a: "aa", b: "bb", e: "ee" },
            ),
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /outer"))).toBe("a - - - - f");
        expect(await render(rs, href("GET /nested/outer"))).toBe("aa bb - - ee f");
        expect(await render(rs, href("GET /nested/inner1"))).toBe("aa bb c1 - e1 f");
        expect(await render(rs, href("GET /nested/inner2", { s: "" }))).toBe("aa bb c2 - e2 f");
        expect(await render(rs, href("GET /nested/:p/outer", { p: "p" }))).toBe(
            "aaa bbb ccc - ee f",
        );
        expect(await render(rs, href("GET /nested/:p/inner1", { p: "p" }))).toBe(
            "a1 bbb ccc d1 e1 f",
        );
        expect(await render(rs, href("GET /nested/:p/inner2", { p: "p" }, { s: "" }))).toBe(
            "aaa b2 c2 d2 e2 f",
        );
        expect(await render(rs, { ...href("POST /nested/:p/form", { p: "p" }), body: "s=a" })).toBe(
            '<hy-frame id="f_form">aaa bf cf - ee f</hy-frame>',
        );
    });

    it("supports async meta functions", async () => {
        type Meta = { a?: string; b?: string; c?: string };
        const { routes, meta, useMeta } = createRouter<Meta>(() =>
            Promise.resolve({ a: "a", b: "b", c: "c" }),
        );

        const RenderMeta = () => {
            const { a, b, c } = useMeta();
            return (
                <>
                    {a} {b} {c}
                </>
            );
        };

        const rs = meta(
            routes({
                "GET /meta": meta(RenderMeta, () => Promise.resolve({ b: "bb" })),
            }),
            () => Promise.resolve({ a: "aa" }),
        );
        const href = getHrefs(rs);

        expect(await render(rs, href("GET /meta"))).toBe("aa bb c");
    });

    it("disallows non-GET requests from the browser", async () => {
        const rs = routes({
            "POST /p": () => <>test</>,
        });
        const href = getHrefs(rs);

        expect(await render(rs, href("POST /p"))).toBe("test");
        await expect(() => render(rs, href("POST /p"), () => undefined)).rejects.toThrow(
            "BadRequest",
        );
    });
});

type Meta = {
    readonly a?: string;
    readonly b?: string;
    readonly c?: string;
    readonly d?: string;
    readonly e?: string;
    readonly f?: string;
};

const { lazy, param, route, routes, meta, useMeta } = createRouter<Meta>({ a: "a", f: "f" });

async function render(
    routes: RoutesComponent<any>,
    href: Href<any, any>,
    getHeader?: (header: string) => string | undefined,
) {
    const { html } = await executeRouter(routes, href, getHeader);
    return html;
}

async function getRedirectUrl(routes: RoutesComponent<any>, href: Href<any, any>) {
    const { redirectUrl } = await executeRouter(routes, href);
    return redirectUrl;
}

async function executeRouter(
    routes: RoutesComponent<any>,
    href: Href<any, any>,
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
                    requestBody: href.body ?? "",
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

import { Redirect } from "@/routing/http-context";
import { route, action } from "@/routing/routing";
import { createUrls } from "@/routing/urls";
import { z } from "zod";

describe("urls", () => {
    it("supports routing definitions without any params", () => {
        const urls = createUrls({
            r: route([], {}, handler),
            a: action([], {}, handler),
        });

        expect(urls.route("/r/").url).toBe("/r/");
        expect(urls.action("/a/").url).toBe("/a/");
        expect(urls.action("/a/").actionParams).toBe("");

        // @ts-expect-error
        urls.route("/r/", {});
        // @ts-expect-error
        urls.action("/a/", {});

        // @ts-expect-error
        urls.action("/r/");
        // @ts-expect-error
        urls.route("/a/");
    });

    it("supports nested routing definitions", () => {
        const urls = createUrls({
            a: { r: route([], {}, handler), a: action([], {}, handler) },
            b: {
                r: route([], {}, handler),
                a: action([], {}, handler),
                x: route([], {}, handler),
                y: action([], {}, handler),
            },
        });

        expect(urls.route("/a/r/").url).toBe("/a/r/");
        expect(urls.action("/a/a/").url).toBe("/a/a/");
        expect(urls.route("/b/r/").url).toBe("/b/r/");
        expect(urls.action("/b/a/").url).toBe("/b/a/");
        expect(urls.route("/b/x/").url).toBe("/b/x/");
        expect(urls.action("/b/y/").url).toBe("/b/y/");

        // @ts-expect-error
        urls.route("/a/", {});
        // @ts-expect-error
        urls.route("/a/x", {});
        // @ts-expect-error
        urls.action("/a/y", {});
    });

    it("supports routing definitions with (nested) path params", () => {
        const urls = createUrls({
            "r/:a": route([], { pathParams: z.object({ a: z.number() }) }, handler),
            "a/:b": action([], { pathParams: z.object({ b: z.boolean() }) }, handler),
            "n/:n": {
                "x/:s": route(
                    [],
                    { pathParams: z.object({ n: z.number(), s: z.string() }) },
                    handler
                ),
                "y/:t": action(
                    [],
                    { pathParams: z.object({ n: z.number(), t: z.string() }) },
                    handler
                ),
            },
        });

        expect(urls.route("/r/:a/", { a: 1 }).url).toBe("/r/1/");
        expect(urls.action("/a/:b/", { b: true }).url).toBe("/a/true/");
        expect(urls.action("/a/:b/", { b: true }).actionParams).toBe("");
        expect(urls.route("/n/:n/x/:s/", { n: 1, s: "s" }).url).toBe("/n/1/x/s/");
        expect(urls.action("/n/:n/y/:t/", { n: 2, t: "t" }).url).toBe("/n/2/y/t/");

        // @ts-expect-error
        urls.route("/r/:a/", {});
        // @ts-expect-error
        urls.route("/r/:a/", { a: true });
        // @ts-expect-error
        urls.action("/a/:b/", {});
        // @ts-expect-error
        urls.action("/a/:b/", { b: 1 });

        // @ts-expect-error
        urls.action("/r/");
        // @ts-expect-error
        urls.route("/a/");
    });

    it("supports lazy routing definitions", () => {
        const urls = createUrls({
            lazy: async () => ({
                default: { r: route([], {}, handler), a: action([], {}, handler) },
            }),
        });

        expect(urls.route("/lazy/r/").url).toBe("/lazy/r/");
        expect(urls.action("/lazy/a/").url).toBe("/lazy/a/");

        // @ts-expect-error
        urls.route("/lazy/r/", {});
        // @ts-expect-error
        urls.action("/laxy/a", {});
    });

    it("supports lazy routing definitions with nested path params", () => {
        const urls = createUrls({
            "n/:n": async () => ({
                default: {
                    "x/:s": route(
                        [],
                        { pathParams: z.object({ n: z.number(), s: z.string() }) },
                        handler
                    ),
                    "y/:t": action(
                        [],
                        { pathParams: z.object({ n: z.number(), t: z.string() }) },
                        handler
                    ),
                },
            }),
        });

        expect(urls.route("/n/:n/x/:s/", { n: 1, s: "s" }).url).toBe("/n/1/x/s/");
        expect(urls.action("/n/:n/y/:t/", { n: 2, t: "t" }).url).toBe("/n/2/y/t/");

        // @ts-expect-error
        urls.route("/n/:n/x/:s/", {});
        // @ts-expect-error
        urls.route("/n/:n/x/:s/", { a: true });
        // @ts-expect-error
        urls.action("/n/:n/y/:t/", {});
        // @ts-expect-error
        urls.action("/n/:n/y/:t/", { b: 1 });
        // @ts-expect-error
        urls.route("/n/:n/y/:s/");
        // @ts-expect-error
        urls.action("/n/:n/y/:t/");
    });

    it("handles duplicated path params", () => {
        const pathParams = z.object({ n: z.number() });
        const urls = createUrls({
            "r/:n/:n": route([], { pathParams }, handler),
            "n/:n": { "x/:n": route([], { pathParams }, handler) },
            "m/:n": async () => ({
                default: { "x/:n": route([], { pathParams }, handler) },
            }),
        });

        expect(urls.route("/r/:n/:n/", { n: 1 }).url).toBe("/r/1/1/");
        expect(urls.route("/n/:n/x/:n/", { n: 1 }).url).toBe("/n/1/x/1/");
        expect(urls.route("/m/:n/x/:n/", { n: 1 }).url).toBe("/m/1/x/1/");
    });

    it("supports search params only for routes", () => {
        const urls = createUrls({
            r: route(
                [],
                { searchParams: z.object({ n: z.number().optional(), s: z.string() }) },
                handler
            ),
        });

        expect(urls.route("/r/", { s: "s", n: 1 }).url).toBe("/r/?s=s&n=1");
        expect(urls.route("/r/", { s: "" }).url).toBe("/r/?s=");

        // @ts-expect-error
        urls.route("/r/");
        // @ts-expect-error
        urls.route("/r/", {});
        // @ts-expect-error
        urls.route("/r/", { s: 1 });
        // @ts-expect-error
        urls.route("/r/", { s: "", n: "" });
    });

    it("supports action params for actions", () => {
        const urls = createUrls({
            r: action(
                [],
                { actionParams: z.object({ n: z.number().optional(), s: z.string() }) },
                handler
            ),
        });

        const action1 = urls.action("/r/", { s: "s", n: 1 });
        const action2 = urls.action("/r/", { s: "" });

        expect(action1.url).toBe("/r/");
        expect(action1.actionParams).toBe("s=s&n=1");
        expect(action2.url).toBe("/r/");
        expect(action2.actionParams).toBe("s=");

        // @ts-expect-error
        urls.action("/r/");
        // @ts-expect-error
        urls.action("/r/", {});
        // @ts-expect-error
        urls.action("/r/", { s: 1 });
        // @ts-expect-error
        urls.action("/r/", { s: "", n: "" });
    });

    it("supports path and search params for routes", () => {
        const urls = createUrls({
            "r/:n/:s/": route(
                [],
                {
                    pathParams: z.object({ n: z.number(), s: z.string() }),
                    searchParams: z.object({ n: z.number().optional(), s: z.string() }),
                },
                handler
            ),
        });

        expect(urls.route("/r/:n/:s/", { s: "s", n: 2 }, { s: "s", n: 1 }).url).toBe(
            "/r/2/s/?s=s&n=1"
        );
        expect(urls.route("/r/:n/:s/", { s: "s", n: 1 }, { s: "" }).url).toBe("/r/1/s/?s=");

        // @ts-expect-error
        urls.route("/r/:n/:s/");
        // @ts-expect-error
        urls.route("/r/:n/:s/", {});
        // @ts-expect-error
        urls.route("/r/:n/:s/", {}, {});
        // @ts-expect-error
        urls.route("/r/:n/:s/", { s: "s", n: 1 }, { s: 1 });
        // @ts-expect-error
        urls.route("/r/:n/:s/", { s: 2, n: 1 }, { s: "" });
    });

    it("supports path and action params for actions", () => {
        const urls = createUrls({
            "r/:n/:s/": action(
                [],
                {
                    pathParams: z.object({ n: z.number(), s: z.string() }),
                    actionParams: z.object({ n: z.number().optional(), s: z.string() }),
                },
                handler
            ),
        });

        const action1 = urls.action("/r/:n/:s/", { s: "s", n: 2 }, { s: "s", n: 1 });
        const action2 = urls.action("/r/:n/:s/", { s: "s", n: 2 }, { s: "" });

        expect(action1.url).toBe("/r/2/s/");
        expect(action1.actionParams).toBe("s=s&n=1");
        expect(action2.url).toBe("/r/2/s/");
        expect(action2.actionParams).toBe("s=");

        // @ts-expect-error
        urls.action("/r/:n/:s/");
        // @ts-expect-error
        urls.action("/r/:n/:s/", {});
        // @ts-expect-error
        urls.action("/r/:n/:s/", {}, {});
        // @ts-expect-error
        urls.action("/r/:n/:s/", { s: "s", n: 1 }, { s: 1 });
        // @ts-expect-error
        urls.action("/r/:n/:s/", { s: 2, n: 1 }, { s: "" });
    });

    it("supports dynamically computed params", () => {
        const urls = createUrls({
            "r/:n/": route(
                [],
                {
                    pathParams: () => z.object({ n: z.number() }),
                    searchParams: () => z.object({ n: z.number().optional(), s: z.string() }),
                },
                handler
            ),
            "a/:n/": action(
                [],
                {
                    pathParams: () => z.object({ n: z.number() }),
                    actionParams: () => z.object({ n: z.number().optional(), s: z.string() }),
                },
                handler
            ),
        });

        expect(urls.route("/r/:n/", { n: 2 }, { s: "s", n: 1 }).url).toBe("/r/2/?s=s&n=1");
        expect(urls.action("/a/:n/", { n: 1 }, { s: "" }).url).toBe("/a/1/");
    });

    it("supports routes that redirect", () => {
        const urls = createUrls({
            "/a": route([], {}, () => <Redirect to={urls.route("/b/")} />),
            "/b": route([], {}, handler),
        });
    });
});

const handler = () => <></>;

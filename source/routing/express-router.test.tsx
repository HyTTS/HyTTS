import { route, action, Route } from "@/routing/routing";
import { zLocalDate } from "@/serialization/date-time";
import { LocalDate } from "@js-joda/core";
import { z } from "zod";
import { runTestApp } from "@/test-helpers";
import { createContext, useContext } from "@/jsx/context";

describe("express-router", () => {
    it("supports routing definitions without any params", () =>
        runTestApp(
            {
                r: route([], {}, () => <>r</>),
                a: action([], {}, () => <>a</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(urls.route("/r/"));
                const actionResponse = await fetchAction(urls.action("/a/"));

                expect(routeResponse.status).toBe(200);
                expect(actionResponse.status).toBe(200);

                expect(await routeResponse.text()).toBe("r");
                expect(await actionResponse.text()).toBe("a");
            }
        ));

    it("uses correct HTTP method for routes and actions", () =>
        runTestApp(
            {
                r: route([], {}, () => <>r</>),
                a: action([], {}, () => <>a</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(urls.route("/a/" as any));
                const actionResponse = await fetchAction(urls.action("/r/" as any));

                expect(routeResponse.status).toBe(404);
                expect(actionResponse.status).toBe(404);
            }
        ));

    it("supports nested routing definitions", () =>
        runTestApp(
            {
                a: { r: route([], {}, () => <>ar</>), a: action([], {}, () => <>aa</>) },
                b: {
                    r: route([], {}, () => <>br</>),
                    a: action([], {}, () => <>ba</>),
                    x: route([], {}, () => <>bx</>),
                    y: action([], {}, () => <>by</>),
                },
            },
            async (urls, fetchRoute, fetchAction) => {
                expect(await (await fetchRoute(urls.route("/a/r/"))).text()).toBe("ar");
                expect(await (await fetchAction(urls.action("/a/a/"))).text()).toBe("aa");
                expect(await (await fetchRoute(urls.route("/b/r/"))).text()).toBe("br");
                expect(await (await fetchAction(urls.action("/b/a/"))).text()).toBe("ba");
                expect(await (await fetchRoute(urls.route("/b/x/"))).text()).toBe("bx");
                expect(await (await fetchAction(urls.action("/b/y/"))).text()).toBe("by");
            }
        ));

    it("supports routing definitions with (nested) path params", () =>
        runTestApp(
            {
                "r/:a": route([], { pathParams: z.object({ a: z.number() }) }, (props) => (
                    <>{props.pathParams.a}</>
                )),
                "a/:b": action([], { pathParams: z.object({ b: z.boolean() }) }, (props) => (
                    <>{props.pathParams.b.toString()}</>
                )),
                "n/:n": {
                    "x/:s": route(
                        [],
                        { pathParams: z.object({ n: z.number(), s: z.string() }) },
                        (props) => (
                            <>
                                {props.pathParams.n}
                                {props.pathParams.s}
                            </>
                        )
                    ),
                    "y/:t": action(
                        [],
                        { pathParams: z.object({ n: z.number(), t: z.string() }) },
                        (props) => (
                            <>
                                {props.pathParams.n}
                                {props.pathParams.t}
                            </>
                        )
                    ),
                },
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse1 = await fetchRoute(urls.route("/r/:a/", { a: 17 }));
                const routeResponse2 = await fetchRoute(
                    urls.route("/n/:n/x/:s/", { n: 33, s: "test" })
                );
                const actionResponse1 = await fetchAction(urls.action("/a/:b/", { b: false }));
                const actionResponse2 = await fetchAction(
                    urls.action("/n/:n/y/:t/", { n: 4, t: "test" })
                );

                expect(routeResponse1.status).toBe(200);
                expect(actionResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);
                expect(actionResponse2.status).toBe(200);

                expect(await routeResponse1.text()).toBe("17");
                expect(await actionResponse1.text()).toBe("false");
                expect(await routeResponse2.text()).toBe("33test");
                expect(await actionResponse2.text()).toBe("4test");
            }
        ));

    it("unifies duplicated path params", () =>
        runTestApp(
            {
                "r/:a/:a": route([], { pathParams: z.object({ a: z.number() }) }, (props) => (
                    <>{props.pathParams.a}</>
                )),
                "n/:n": {
                    "x/:n": route([], { pathParams: z.object({ n: z.number() }) }, (props) => (
                        <>{props.pathParams.n}</>
                    )),
                },
            },
            async (urls, fetchRoute) => {
                const routeResponse1 = await fetchRoute(urls.route("/r/:a/:a/", { a: 1 }));
                const routeResponse2 = await fetchRoute(urls.route("/n/:n/x/:n/", { n: 2 }));

                expect(routeResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);

                expect(await routeResponse1.text()).toBe("1");
                expect(await routeResponse2.text()).toBe("2");
            }
        ));

    it("supports lazy routing definitions with nested path params", () =>
        runTestApp(
            {
                "r/:a": async () => ({
                    default: {
                        "x/:s": route(
                            [],
                            { pathParams: z.object({ a: z.number(), s: z.string() }) },
                            (props) => (
                                <>
                                    {props.pathParams.a}
                                    {props.pathParams.s}
                                </>
                            )
                        ),
                        "y/:t": action(
                            [],
                            { pathParams: z.object({ a: z.number(), t: z.string() }) },
                            (props) => (
                                <>
                                    {props.pathParams.a}
                                    {props.pathParams.t}
                                </>
                            )
                        ),
                    },
                }),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(
                    urls.route("/r/:a/x/:s/", { a: 33, s: "test" })
                );
                const actionResponse = await fetchAction(
                    urls.action("/r/:a/y/:t/", { a: 4, t: "test" })
                );

                expect(routeResponse.status).toBe(200);
                expect(actionResponse.status).toBe(200);

                expect(await routeResponse.text()).toBe("33test");
                expect(await actionResponse.text()).toBe("4test");
            }
        ));

    it("gracefully handles thrown errors when loading lazy routing definitions", () =>
        runTestApp(
            {
                "r/": async (): Promise<{ default: { x: Route<any, any> } }> => {
                    throw new Error("test");
                },
                "t/": route([], {}, () => <>test</>),
            },
            async (urls, fetchRoute) => {
                // Ensure the error is ignored every time the failing route is called and that
                // we can still call other routes regardless.
                for (let i = 0; i < 2; ++i) {
                    const errorResponse = await fetchRoute(urls.route("/r/x/"));
                    const routeResponse = await fetchRoute(urls.route("/t/"));

                    expect(errorResponse.status).toBe(500);
                    expect(routeResponse.status).toBe(200);

                    expect(await errorResponse.text()).toBe("Internal Server Error");
                    expect(await routeResponse.text()).toBe("test");
                }
            }
        ));

    it("supports search params only for routes", () =>
        runTestApp(
            {
                r: route(
                    [],
                    { searchParams: z.object({ a: z.number(), b: z.string() }) },
                    (props) => (
                        <>
                            {props.searchParams.a}
                            {props.searchParams.b}
                        </>
                    )
                ),
            },
            async (urls, fetchRoute) => {
                const routeResponse = await fetchRoute(urls.route("/r/", { a: 1, b: "test" }));
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("1test");
            }
        ));

    it("supports action params only for actions", () =>
        runTestApp(
            {
                r: action(
                    [],
                    { actionParams: z.object({ a: z.number(), b: z.string() }) },
                    (props) => (
                        <>
                            {props.actionParams.a}
                            {props.actionParams.b}
                        </>
                    )
                ),
            },
            async (urls, _, fetchAction) => {
                const routeResponse = await fetchAction(urls.action("/r/", { a: 1, b: "test" }));
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("1test");
            }
        ));

    it("supports path and search params for routes", () =>
        runTestApp(
            {
                "r/:r": route(
                    [],
                    {
                        pathParams: z.object({ r: z.string() }),
                        searchParams: z.object({ a: z.number(), b: z.string() }),
                    },
                    (props) => (
                        <>
                            {props.pathParams.r}
                            {props.searchParams.a}
                            {props.searchParams.b}
                        </>
                    )
                ),
            },
            async (urls, fetchRoute) => {
                const routeResponse = await fetchRoute(
                    urls.route("/r/:r/", { r: "route" }, { a: 1, b: "test" })
                );
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("route1test");
            }
        ));

    it("supports path and action params for actions", () =>
        runTestApp(
            {
                "r/:r": action(
                    [],
                    {
                        pathParams: z.object({ r: z.string() }),
                        actionParams: z.object({ a: z.number(), b: z.string() }),
                    },
                    (props) => (
                        <>
                            {props.pathParams.r}
                            {props.actionParams.a}
                            {props.actionParams.b}
                        </>
                    )
                ),
            },
            async (urls, _, fetchAction) => {
                const routeResponse = await fetchAction(
                    urls.action("/r/:r/", { r: "action" }, { a: 1, b: "test" })
                );
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("action1test");
            }
        ));

    it("supports transformed types for all kinds of params", () =>
        runTestApp(
            {
                "r/:r": [
                    route(
                        [],
                        {
                            pathParams: z.object({ r: zLocalDate() }),
                            searchParams: z.object({ a: zLocalDate() }),
                        },
                        (props) => (
                            <>
                                {props.pathParams.r.toJSON()}
                                {props.searchParams.a.toJSON()}
                            </>
                        )
                    ),
                    action(
                        [],
                        {
                            pathParams: z.object({ r: zLocalDate() }),
                            actionParams: z.object({ a: zLocalDate() }),
                        },
                        (props) => (
                            <>
                                {props.pathParams.r.toJSON()}
                                {props.actionParams.a.toJSON()}
                            </>
                        )
                    ),
                ],
            },
            async (urls, fetchRoute, fetchAction) => {
                const data = LocalDate.of(2023, 4, 27);
                const routeResponse = await fetchRoute(
                    urls.route("/r/:r/", { r: data }, { a: data })
                );
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("2023-04-272023-04-27");

                const actionResponse = await fetchAction(
                    urls.action("/r/:r/", { r: data }, { a: data })
                );
                expect(actionResponse.status).toBe(200);
                expect(await actionResponse.text()).toBe("2023-04-272023-04-27");
            }
        ));

    it("handles optional params correctly", () => {
        const schema = z.object({ a: z.string() }).optional();
        return runTestApp(
            {
                "/a": route([], { searchParams: schema }, (props) => <>{props.searchParams?.a}</>),
                "/b": action([], { actionParams: schema }, (props) => <>{props.actionParams?.a}</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse1 = await fetchRoute(urls.route("/a/", { a: "test" }));
                const routeResponse2 = await fetchRoute(urls.route("/a/", undefined));
                expect(routeResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);
                expect(await routeResponse1.text()).toBe("test");
                expect(await routeResponse2.text()).toBe("");

                const actionResponse1 = await fetchAction(urls.action("/b/", { a: "test" }));
                const actionResponse2 = await fetchAction(urls.action("/b/", undefined));
                expect(actionResponse1.status).toBe(200);
                expect(actionResponse2.status).toBe(200);
                expect(await actionResponse1.text()).toBe("test");
                expect(await actionResponse2.text()).toBe("");
            }
        );
    });

    it("handles default values for params correctly", () => {
        const schema = z.object({ a: z.string() }).default({ a: "default" });
        return runTestApp(
            {
                "/a": route([], { searchParams: schema }, (props) => <>{props.searchParams.a}</>),
                "/b": action([], { actionParams: schema }, (props) => <>{props.actionParams.a}</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse1 = await fetchRoute(urls.route("/a/", { a: "test" }));
                const routeResponse2 = await fetchRoute(urls.route("/a/", undefined));
                expect(routeResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);
                expect(await routeResponse1.text()).toBe("test");
                expect(await routeResponse2.text()).toBe("default");

                const actionResponse1 = await fetchAction(urls.action("/b/", { a: "test" }));
                const actionResponse2 = await fetchAction(urls.action("/b/", undefined));
                expect(actionResponse1.status).toBe(200);
                expect(actionResponse2.status).toBe(200);
                expect(await actionResponse1.text()).toBe("test");
                expect(await actionResponse2.text()).toBe("default");
            }
        );
    });

    it("handles optional params properties correctly", () => {
        const schema = z.object({ a: z.string().optional() });
        return runTestApp(
            {
                "/a": route([], { searchParams: schema }, (props) => <>{props.searchParams?.a}</>),
                "/b": action([], { actionParams: schema }, (props) => <>{props.actionParams?.a}</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse1 = await fetchRoute(urls.route("/a/", { a: "test" }));
                const routeResponse2 = await fetchRoute(urls.route("/a/", {}));
                expect(routeResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);
                expect(await routeResponse1.text()).toBe("test");
                expect(await routeResponse2.text()).toBe("");

                const actionResponse1 = await fetchAction(urls.action("/b/", { a: "test" }));
                const actionResponse2 = await fetchAction(urls.action("/b/", {}));
                expect(actionResponse1.status).toBe(200);
                expect(actionResponse2.status).toBe(200);
                expect(await actionResponse1.text()).toBe("test");
                expect(await actionResponse2.text()).toBe("");
            }
        );
    });

    it("handles default values for params properties correctly", () => {
        const schema = z.object({ a: z.string().default("default") });
        return runTestApp(
            {
                "/a": route([], { searchParams: schema }, (props) => <>{props.searchParams.a}</>),
                "/b": action([], { actionParams: schema }, (props) => <>{props.actionParams.a}</>),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse1 = await fetchRoute(urls.route("/a/", { a: "test" }));
                const routeResponse2 = await fetchRoute(urls.route("/a/", {}));
                expect(routeResponse1.status).toBe(200);
                expect(routeResponse2.status).toBe(200);
                expect(await routeResponse1.text()).toBe("test");
                expect(await routeResponse2.text()).toBe("default");

                const actionResponse1 = await fetchAction(urls.action("/b/", { a: "test" }));
                const actionResponse2 = await fetchAction(urls.action("/b/", {}));
                expect(actionResponse1.status).toBe(200);
                expect(actionResponse2.status).toBe(200);
                expect(await actionResponse1.text()).toBe("test");
                expect(await actionResponse2.text()).toBe("default");
            }
        );
    });

    it("supports dynamically computed, synchronous params", () =>
        runTestApp(
            {
                "r/:n/": route(
                    [],
                    {
                        pathParams: () => z.object({ n: z.number() }),
                        searchParams: () => z.object({ n: z.number().optional(), s: z.string() }),
                    },
                    ({ pathParams, searchParams }) => (
                        <>
                            {pathParams.n}
                            {searchParams.n}
                            {searchParams.s}
                        </>
                    )
                ),
                "a/:n/": action(
                    [],
                    {
                        pathParams: () => z.object({ n: z.number() }),
                        actionParams: () => z.object({ n: z.number().optional(), s: z.string() }),
                    },
                    ({ pathParams, actionParams }) => (
                        <>
                            {pathParams.n}
                            {actionParams.n}
                            {actionParams.s}
                        </>
                    )
                ),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(
                    urls.route("/r/:n/", { n: 1 }, { n: 2, s: "x" })
                );
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("12x");

                const actionResponse = await fetchAction(
                    urls.action("/a/:n/", { n: 1 }, { n: 2, s: "x" })
                );
                expect(actionResponse.status).toBe(200);
                expect(await actionResponse.text()).toBe("12x");
            }
        ));

    it("supports dynamically computed, asynchronous params", () => {
        async function defer<T>(value: T): Promise<T> {
            return new Promise<T>((resolve) => setTimeout(() => resolve(value), 1));
        }

        return runTestApp(
            {
                "r/:n/": route(
                    [],
                    {
                        pathParams: () => defer(z.object({ n: z.number() })),
                        searchParams: () =>
                            defer(z.object({ n: z.number().optional(), s: z.string() })),
                    },
                    ({ pathParams, searchParams }) => (
                        <>
                            {pathParams.n}
                            {searchParams.n}
                            {searchParams.s}
                        </>
                    )
                ),
                "a/:n/": action(
                    [],
                    {
                        pathParams: () => defer(z.object({ n: z.number() })),
                        actionParams: () =>
                            defer(z.object({ n: z.number().optional(), s: z.string() })),
                    },
                    ({ pathParams, actionParams }) => (
                        <>
                            {pathParams.n}
                            {actionParams.n}
                            {actionParams.s}
                        </>
                    )
                ),
            },
            async (urls, fetchRoute, fetchAction) => {
                const routeResponse = await fetchRoute(
                    urls.route("/r/:n/", { n: 1 }, { n: 2, s: "x" })
                );
                expect(routeResponse.status).toBe(200);
                expect(await routeResponse.text()).toBe("12x");

                const actionResponse = await fetchAction(
                    urls.action("/a/:n/", { n: 1 }, { n: 2, s: "x" })
                );
                expect(actionResponse.status).toBe(200);
                expect(await actionResponse.text()).toBe("12x");
            }
        );
    });

    it("allows access to the app context during params computation", () => {
        const state = { count: 0 };
        const appContext = createContext<{ count: number }>();

        function increaseCount() {
            useContext(appContext).count += 1;
            return z.object({});
        }

        return runTestApp(
            {
                "r/:n/": route(
                    [],
                    {
                        pathParams: () => increaseCount(),
                        searchParams: () => increaseCount(),
                    },
                    () => <></>
                ),
                "a/:n/": action(
                    [],
                    {
                        pathParams: () => increaseCount(),
                        actionParams: () => increaseCount(),
                    },
                    () => <></>
                ),
            },
            async (urls, fetchRoute, fetchAction) => {
                await fetchRoute(urls.route("/r/:n/", {}, {}));
                expect(state.count).toBe(2);

                await fetchAction(urls.action("/a/:n/", {}, {}));
                expect(state.count).toBe(4);
            },
            ({ children }) => <appContext.Provider value={state}>{children}</appContext.Provider>
        );
    });
});

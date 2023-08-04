/* eslint-disable jest/expect-expect */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import { action, route, type RoutingDefinition } from "@/routing/routing";

describe("routing", () => {
    it("does not pass params to handler when none are specified", () => {
        const x = {
            a: route([], {}, (props) => {
                const p: undefined = props.pathParams;
                const s: undefined = props.searchParams;
                return <></>;
            }),
            b: action([], {}, (props) => {
                const p: undefined = props.pathParams;
                const a: undefined = props.actionParams;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("allows handler without props when route or action has no params", () => {
        const x = {
            a: route([], {}, () => <></>),
            b: action([], {}, () => <></>),
        } satisfies RoutingDefinition;
    });

    it("allows handlers to ignore params", () => {
        const x = {
            a: route([], { pathParams }, () => <></>),
            b: action([], { pathParams }, () => <></>),
            c: route([], { searchParams }, () => <></>),
            d: action([], { actionParams }, () => <></>),
            e: route([], { pathParams, searchParams }, () => <></>),
            f: action([], { pathParams, actionParams }, () => <></>),
        } satisfies RoutingDefinition;
    });

    it("types path params correctly", () => {
        const x = {
            a: route([], { pathParams }, (props) => {
                const p: number = props.pathParams.p;
                const s: undefined = props.searchParams;
                return <></>;
            }),
            b: action([], { pathParams }, (props) => {
                const p: number = props.pathParams.p;
                const a: undefined = props.actionParams;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("types search and action params correctly", () => {
        const x = {
            a: route([], { searchParams }, (props) => {
                const p: undefined = props.pathParams;
                const s: z.infer<typeof searchParams> = props.searchParams;
                return <></>;
            }),
            b: action([], { actionParams }, (props) => {
                const p: undefined = props.pathParams;
                const a: z.infer<typeof actionParams> = props.actionParams;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("types path, search, and action params correctly", () => {
        const x = {
            a: route([], { pathParams, searchParams }, (props) => {
                const p: number = props.pathParams.p;
                const s: z.infer<typeof searchParams> = props.searchParams;
                return <></>;
            }),
            b: action([], { pathParams, actionParams }, (props) => {
                const p: number = props.pathParams.p;
                const a: z.infer<typeof actionParams> = props.actionParams;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("handles transformed params types correctly", () => {
        const schema = z.object({ a: z.string().transform((s) => s.length) });
        const x = {
            a: route([], { pathParams: schema, searchParams: schema }, (props) => {
                const a1: number = props.pathParams.a;
                const a2: number = props.searchParams.a;
                return <></>;
            }),
            b: action([], { pathParams: schema, actionParams: schema }, (props) => {
                const a1: number = props.pathParams.a;
                const a2: number = props.actionParams.a;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("handles object-level params refinements correctly", () => {
        const schema = z.object({ a: z.string() }).refine((o) => o.a !== "");
        const x = {
            a: route([], { pathParams: schema, searchParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.searchParams.a;
                return <></>;
            }),
            b: action([], { pathParams: schema, actionParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.actionParams.a;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("handles intersected params types correctly", () => {
        const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));

        const x = {
            a: route([], { pathParams: schema, searchParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.searchParams.a;
                const b1: number = props.pathParams.b;
                const b2: number = props.searchParams.b;
                return <></>;
            }),
            b: action([], { pathParams: schema, actionParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.actionParams.a;
                const b1: number = props.pathParams.b;
                const b2: number = props.actionParams.b;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("handles optional params correctly", () => {
        const schema = z.object({ a: z.string() }).optional();

        const x = {
            a: route([], { pathParams: schema, searchParams: schema }, (props) => {
                const a1: string | undefined = props.pathParams?.a;
                const a2: string | undefined = props.searchParams?.a;
                return <></>;
            }),
            b: action([], { pathParams: schema, actionParams: schema }, (props) => {
                const a1: string | undefined = props.pathParams?.a;
                const a2: string | undefined = props.actionParams?.a;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("handles default values for params correctly", () => {
        const schema = z.object({ a: z.string() }).default({ a: "" });

        const x = {
            a: route([], { pathParams: schema, searchParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.searchParams.a;
                return <></>;
            }),
            b: action([], { pathParams: schema, actionParams: schema }, (props) => {
                const a1: string = props.pathParams.a;
                const a2: string = props.actionParams.a;
                return <></>;
            }),
        } satisfies RoutingDefinition;
    });

    it("does not allow non-object-like types", () => {
        const x = {
            // @ts-expect-error
            a: route([], { pathParams: z.number() }, () => <></>),
            // @ts-expect-error
            b: action([], { pathParams: z.boolean() }, () => <></>),
            // @ts-expect-error
            c: route([], { searchParams: z.string() }, () => <></>),
            // @ts-expect-error
            d: action([], { actionParams: z.literal("a") }, () => <></>),
        } satisfies RoutingDefinition;
    });
});

const pathParams = z.object({ p: z.number() });
const searchParams = z.object({ sort: z.string() });
const actionParams = z.object({ id: z.string() });

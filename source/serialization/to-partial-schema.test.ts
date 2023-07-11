/* eslint-disable @typescript-eslint/no-unused-vars */

import { toPartialSchema } from "@/serialization/to-partial-schema";
import { zLocalDate } from "@/serialization/date-time";
import { LocalDate } from "@js-joda/core";
import { z } from "zod";

describe("structural form schema", () => {
    it("accepts `null` and `undefined`", () => {
        const schema = toPartialSchema(
            z.object({ n: z.number().nullable(), d: z.number().optional() }),
        );

        const parseResult = schema.parse({ n: null, d: undefined });
        expect(parseResult).toEqual({ n: null, d: undefined });

        const x: { n: string | number | null; d?: string | number | undefined } = parseResult;
        const y: typeof parseResult = x;
    });

    it("returns default values", () => {
        const schema = toPartialSchema(
            z.object({
                n: z.number().default(1),
                s: z.string().default("test"),
                b: z.boolean().default(true),
            }),
        );

        const parseResult = schema.parse({});
        expect(parseResult).toEqual({ n: 1, s: "test", b: true });

        const x: { n: number | string; s: string; b: boolean | string } = parseResult;
        const y: typeof parseResult = x;
    });

    it("returns strings or actual types for all leaf properties in objects", () => {
        const schema = toPartialSchema(z.object({ b: z.number(), d: zLocalDate() }));

        const parseResult1 = schema.parse({ b: 3, d: "test" });
        expect(parseResult1).toEqual({ b: 3, d: "test" });

        const parseResult2 = schema.parse({ b: "test", d: LocalDate.of(2023, 12, 1) });
        expect(parseResult2).toEqual({ b: "test", d: LocalDate.of(2023, 12, 1) });

        const x: { b: number | string; d: LocalDate | string } = parseResult1;
        const y: typeof parseResult1 = x;
    });

    it("supports object schema modifiers", () => {
        const schema1 = toPartialSchema(z.object({ b: z.number() }).strict());
        expect(() => schema1.parse({ b: 3, d: true })).toThrowError("Unrecognized key(s)");

        const schema2 = toPartialSchema(z.object({ b: z.number() }).passthrough());

        const parseResult2 = schema2.parse({ b: 3, d: true });
        expect(parseResult2).toEqual({ b: 3, d: true });

        const x2: { b: number | string } = parseResult2;
        const y2: typeof parseResult2 = x2;

        const schema3 = toPartialSchema(z.object({ b: z.number() }).partial());

        const parseResult3 = schema3.parse({});
        expect(parseResult3).toEqual({});

        const x3: { b?: number | string } = parseResult3;
        const y3: typeof parseResult3 = x3;
    });

    it("returns strings or actual types for all leaf array elements", () => {
        const schema = toPartialSchema(
            z.object({ b: z.number().array(), d: zLocalDate().array() }),
        );

        const parseResult1 = schema.parse({ b: ["a", "b"], d: ["test"] });
        expect(parseResult1).toEqual({ b: ["a", "b"], d: ["test"] });

        const parseResult2 = schema.parse({ b: [3, -1], d: [LocalDate.of(2020, 2, 1)] });
        expect(parseResult2).toEqual({ b: [3, -1], d: [LocalDate.of(2020, 2, 1)] });

        const x: { b: (number | string)[]; d: (string | LocalDate)[] } = parseResult1;
        const y: typeof parseResult1 = x;
    });

    it("returns strings or actual types for nested objects and arrays", () => {
        const schema = toPartialSchema(
            z.object({ b: z.object({ x: z.number().array() }).array() }),
        );

        const parseResult1 = schema.parse({ b: [{ x: ["a", "b"] }, { x: ["c", "d"] }] });
        expect(parseResult1).toEqual({ b: [{ x: ["a", "b"] }, { x: ["c", "d"] }] });

        const parseResult2 = schema.parse({ b: [{ x: [1, 2] }, { x: [3, 4] }] });
        expect(parseResult2).toEqual({ b: [{ x: [1, 2] }, { x: [3, 4] }] });

        const x: { b: { x: (number | string)[] }[] } = parseResult1;
        const y: typeof parseResult1 = x;
    });

    it("returns strings, booleans, and default 'false' for Boolean leaf properties", () => {
        const schema = toPartialSchema(z.object({ b: z.boolean() }));

        expect(schema.parse({ b: true })).toEqual({ b: true });
        expect(schema.parse({ b: false })).toEqual({ b: false });
        expect(schema.parse({ b: "test" })).toEqual({ b: "test" });
        expect(schema.parse({ b: undefined })).toEqual({ b: false });
        expect(schema.parse({})).toEqual({ b: false });

        const x: { b: string | boolean } = schema.parse({ b: true });
        const y: ReturnType<typeof schema.parse> = x;
    });

    it("accepts intersections", () => {
        const schema = toPartialSchema(
            z.object({ b: z.number() }).and(z.object({ d: zLocalDate() })),
        );

        const parseResult1 = schema.parse({ b: "a", d: "b" });
        expect(parseResult1).toEqual({ b: "a", d: "b" });

        const parseResult2 = schema.parse({ b: 3, d: LocalDate.of(2023, 12, 1) });
        expect(parseResult2).toEqual({ b: 3, d: LocalDate.of(2023, 12, 1) });

        const x: { b: number | string; d: LocalDate | string } = parseResult1;
        const y: typeof parseResult1 = x;
    });

    it("accepts unions", () => {
        const schema = toPartialSchema(
            z.object({ b: z.number() }).or(z.object({ d: zLocalDate() })),
        );

        const parseResult1 = schema.parse({ b: "a" });
        expect(parseResult1).toEqual({ b: "a" });

        const parseResult2 = schema.parse({ d: "b" });
        expect(parseResult2).toEqual({ d: "b" });

        const parseResult3 = schema.parse({ b: 3 });
        expect(parseResult3).toEqual({ b: 3 });

        const parseResult4 = schema.parse({ d: LocalDate.of(1999, 1, 9) });
        expect(parseResult4).toEqual({ d: LocalDate.of(1999, 1, 9) });

        const x: { b: number | string } | { d: LocalDate | string } = parseResult1;
        const y: typeof parseResult1 = x;
    });

    it("fails validation for array instead of object", () => {
        const schema = toPartialSchema(z.object({ b: z.object({ x: z.number() }) }));
        expect(() => schema.parse({ b: ["1"] })).toThrowError("Expected object, received array");
    });

    it("fails validation for object instead of array", () => {
        const schema = toPartialSchema(z.object({ b: z.number().array() }));
        expect(() => schema.parse({ b: { x: "1" } })).toThrowError(
            "Expected array, received object",
        );
    });

    it("fails validation for missing object", () => {
        const schema = toPartialSchema(z.object({ b: z.object({ x: z.number() }) }));
        expect(() => schema.parse({ b: undefined })).toThrowError("Required");
        expect(() => schema.parse({})).toThrowError("Required");
    });

    it("accepts missing optional object", () => {
        const schema = toPartialSchema(z.object({ b: z.object({ x: z.number() }).optional() }));
        expect(schema.parse({ b: undefined })).toEqual({});
        expect(schema.parse({})).toEqual({});

        const x: { b?: { x: string | number } } = schema.parse({});
        const y: ReturnType<typeof schema.parse> = x;
    });

    it("fails validation for missing array", () => {
        const schema = toPartialSchema(z.object({ b: z.number().array() }));
        expect(() => schema.parse({ b: undefined })).toThrowError("Required");
        expect(() => schema.parse({})).toThrowError("Required");
    });

    it("accepts missing optional array", () => {
        const schema = toPartialSchema(z.object({ b: z.number().array().optional() }));
        expect(schema.parse({ b: undefined })).toEqual({});
        expect(schema.parse({})).toEqual({});

        const x: { b?: (string | number)[] } = schema.parse({});
        const y: ReturnType<typeof schema.parse> = x;
    });

    it("ignores all non-structural validations on leaf schemas", () => {
        const schema = toPartialSchema(
            z.object({
                b: z.number().min(10),
                s: z.string().email(),
                a: z.boolean().array().min(10),
            }),
        );

        const parseResult1 = schema.parse({ b: "1", s: "test", a: ["true"] });
        expect(parseResult1).toEqual({ b: "1", s: "test", a: ["true"] });

        const parseResult = schema.parse({ b: 1, s: "test", a: [true] });
        expect(parseResult).toEqual({ b: 1, s: "test", a: [true] });
    });

    it("ignores all failing refinements", () => {
        const schema = toPartialSchema(
            z
                .object({
                    b: z.number().refine((x) => x > 10),
                    s: z.string().refine((x) => x.length > 10),
                    a: z
                        .boolean()
                        .array()
                        .refine((a) => a.length > 0),
                })
                .refine((x) => x.b + x.s.length > 100),
        );

        const parseResult1 = schema.parse({ b: "1", s: "test", a: ["true", "false"] });
        expect(parseResult1).toEqual({ b: "1", s: "test", a: ["true", "false"] });

        const parseResult2 = schema.parse({ b: 1, s: "test", a: [true, false] });
        expect(parseResult2).toEqual({ b: 1, s: "test", a: [true, false] });
    });

    it("executes all successful preprocessors", () => {
        const schema = toPartialSchema(
            z.object({ b: z.preprocess((x) => (Array.isArray(x) ? x.length : -1), z.number()) }),
        );

        const parseResult1 = schema.parse({ b: "test" });
        expect(parseResult1).toEqual({ b: -1 });

        const parseResult2 = schema.parse({ b: [true, false] });
        expect(parseResult2).toEqual({ b: 2 });

        const x: { b: string | number } = schema.parse({});
        const y: ReturnType<typeof schema.parse> = x;
    });

    it("ignores all failing preprocessors", () => {
        const schema1 = toPartialSchema(z.object({ b: z.preprocess((x) => x, z.number()) }));
        const schema2 = toPartialSchema(z.object({ b: z.preprocess(() => "", z.number()) }));

        const parseResult1 = schema1.parse({ b: "test" });
        expect(parseResult1).toEqual({ b: "test" });

        // Unclear: Is that the desired behavior?
        const parseResult2 = schema2.parse({ b: "test" });
        expect(parseResult2).toEqual({ b: "" });
    });

    it("skips all synchronous transforms", () => {
        const schema = toPartialSchema(
            z
                .object({
                    a: z
                        .boolean()
                        .array()
                        .transform((a) => a.length),
                })
                .transform((o) => ({ x: o.a })),
        );

        const parseResult = schema.parse({ a: [true, false] });
        expect(parseResult).toEqual({ a: [true, false] });
    });

    it("skips all asynchronous transforms", async () => {
        const schema = toPartialSchema(
            z
                .object({
                    a: z
                        .boolean()
                        .array()
                        .transform(async (a) => a.length),
                })
                .transform(async (o) => ({ x: o.a })),
        );

        const parseResult = await schema.parseAsync({ a: [true, false] });
        expect(parseResult).toEqual({ a: [true, false] });
    });

    it("skips transforms for invalid data", () => {
        const schema = toPartialSchema(
            z.object({
                s: z
                    .string()
                    .email()
                    .transform((s) => s.length),
                a: z
                    .boolean()
                    .array()
                    .min(10)
                    .transform((a) => a.length),
            }),
        );

        const parseResult = schema.parse({ s: "test", a: [true, false] });
        expect(parseResult).toEqual({ s: "test", a: [true, false] });
    });

    it("ignores async refinements", () => {
        const schema = toPartialSchema(
            z.object({
                s: z.string().refine(async () => false),
            }),
        );

        const parseResult = schema.parse({ s: "test" });
        expect(parseResult).toEqual({ s: "test" });
    });
});
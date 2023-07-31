import { LocalDate } from "@js-joda/core";
import each from "jest-each";
import { z } from "zod";
import { zLocalDate } from "@/serialization/date-time";
import { parseUrlSearchParams, toUrlSearchParams } from "@/serialization/url-params";
import type { ZodType, ZodTypeDef } from "zod";

describe("uRL search params", () => {
    function roundtrip<T extends Record<string, unknown>, Def extends ZodTypeDef, I>(
        schema: ZodType<T, Def, I>,
        obj: T,
    ) {
        return parseUrlSearchParams(schema, toUrlSearchParams(obj));
    }

    it("uses dot notation for objects and arrays", () => {
        const obj = { a: { b: [1, 2], c: "test" }, d: true };
        const params = toUrlSearchParams(obj);
        expect(params).toBe("a.b.0=1&a.b.1=2&a.c=test&d=true");

        expect(
            parseUrlSearchParams(
                z.object({ a: z.object({ b: z.number().array(), c: z.string() }), d: z.boolean() }),
                params,
            ),
        ).toStrictEqual(obj);
    });

    it("returns empty string for null and undefined and void schema", () => {
        expect(toUrlSearchParams(undefined)).toBe("");
        expect(toUrlSearchParams(undefined)).toBe("");
        expect(toUrlSearchParams(null)).toBe("");
    });

    it("handles empty or missing values correctly", () => {
        expect(parseUrlSearchParams(undefined, undefined)).toBeUndefined();
        expect(
            parseUrlSearchParams(z.object({ a: z.string() }).optional(), undefined),
        ).toBeUndefined();
        expect(
            parseUrlSearchParams(z.object({ a: z.string().optional() }), undefined),
        ).toStrictEqual({
            a: undefined,
        });
        expect(
            parseUrlSearchParams(z.object({ a: z.string().default("t") }), undefined),
        ).toStrictEqual({
            a: "t",
        });

        expect(parseUrlSearchParams(undefined, null)).toBeUndefined();
        expect(parseUrlSearchParams(z.object({ a: z.string() }).optional(), null)).toBeUndefined();
        expect(parseUrlSearchParams(z.object({ a: z.string().optional() }), null)).toStrictEqual({
            a: undefined,
        });
        expect(parseUrlSearchParams(z.object({ a: z.string().default("t") }), null)).toStrictEqual({
            a: "t",
        });

        expect(parseUrlSearchParams(undefined, "")).toBeUndefined();
        expect(parseUrlSearchParams(z.object({ a: z.string() }).optional(), "")).toBeUndefined();
        expect(parseUrlSearchParams(z.object({ a: z.string().optional() }), "")).toStrictEqual({
            a: undefined,
        });
        expect(parseUrlSearchParams(z.object({ a: z.string().default("t") }), "")).toStrictEqual({
            a: "t",
        });
    });

    it("ignores query prefix", () => {
        expect(parseUrlSearchParams(z.object({ a: z.string() }), "?a=b")).toStrictEqual({ a: "b" });
        expect(parseUrlSearchParams(z.object({ a: z.string() }), "a=b")).toStrictEqual({ a: "b" });
    });

    it("should return schema's default values", () => {
        const schema = z.object({
            n: z.number().default(17),
            s: z.string().default("test"),
        });

        expect(parseUrlSearchParams(schema, "")).toStrictEqual({ n: 17, s: "test" });
        expect(parseUrlSearchParams(schema, "?n=3")).toStrictEqual({ n: 3, s: "test" });
        expect(parseUrlSearchParams(schema, "?s=hi")).toStrictEqual({ n: 17, s: "hi" });
        expect(parseUrlSearchParams(schema, "?n=3&s=hi")).toStrictEqual({ n: 3, s: "hi" });
    });

    it("should not place `undefined` values into the URL recursively", () => {
        expect(toUrlSearchParams({ a: undefined, b: 3 })).toBe("b=3");
        expect(decodeURIComponent(toUrlSearchParams({ a: [{ a: undefined, b: 3 }] }))).toBe(
            "a.0.b=3",
        );
    });

    it("should not place equals sign for `null` values into the URL recursively", () => {
        expect(toUrlSearchParams({ a: null, b: 3 })).toBe("a&b=3");
        expect(decodeURIComponent(toUrlSearchParams({ a: [{ a: null, b: 3 }] }))).toBe(
            "a.0.a&a.0.b=3",
        );
    });

    it("roundtrip nested objects", () => {
        expect(
            roundtrip(z.object({ o: z.object({ a: z.boolean() }) }), { o: { a: true } }),
        ).toStrictEqual({ o: { a: true } });
    });

    it("roundtrip nested objects and arrays", () => {
        expect(
            roundtrip(
                z.object({ o: z.object({ a: z.object({ b: z.boolean() }).array() }).array() }),
                { o: [{ a: [{ b: true }] }] },
            ),
        ).toStrictEqual({ o: [{ a: [{ b: true }] }] });
    });

    it("should throw if object key contains a '.'", () => {
        expect(() => roundtrip(z.object({ "a.b": z.boolean() }), { "a.b": true })).toThrow(
            "Invalid symbol '.'",
        );
    });

    it("should roundtrip nested arrays", () => {
        expect(
            roundtrip(z.object({ o: z.array(z.boolean().array()) }), { o: [[true, false]] }),
        ).toStrictEqual({ o: [[true, false]] });
    });

    each([0, 10, -10, 3.14]).it("should roundtrip number '%s'", (n: number) => {
        expect(roundtrip(z.object({ n: z.number() }), { n })).toStrictEqual({ n });
    });

    each([true, false]).it("should roundtrip boolean '%s'", (b: boolean) => {
        expect(roundtrip(z.object({ b: z.boolean() }), { b })).toStrictEqual({ b });
    });

    each(["", "  ", "test", "\"'\\"]).it("should roundtrip string '%s'", (s: string) => {
        expect(roundtrip(z.object({ s: z.string() }), { s })).toStrictEqual({ s });
    });

    it("should roundtrip string with default null value", () => {
        expect(
            roundtrip(z.object({ s: z.string().nullable().default(null) }), { s: null }),
        ).toStrictEqual({ s: null });
    });

    it("cannot roundtrip empty arrays", () => {
        expect(toUrlSearchParams({ a: [] })).toBe("");

        expect(
            roundtrip(z.object({ a: z.number().array().nullable() }), { a: null }),
        ).toStrictEqual({
            a: null,
        });
        expect(
            roundtrip(z.object({ a: z.number().array().optional() }), { a: undefined }),
        ).toStrictEqual({ a: undefined });
        expect(roundtrip(z.object({ a: z.number().array().optional() }), { a: [] })).toStrictEqual({
            a: undefined,
        });
    });

    it("cannot overwrite previous array values", () => {
        // The second `a.0=` causes qs to generate a nested array, which then fails the Zod schema validation...
        expect(() =>
            parseUrlSearchParams(z.object({ a: z.number().array() }), "a.0=0&a.1=1&a.0=2"),
        ).toThrow("Expected number, received array");
    });

    it("should roundtrip arrays", () => {
        expect(roundtrip(z.object({ a: z.number().array() }), { a: [1, 2] })).toStrictEqual({
            a: [1, 2],
        });

        expect(roundtrip(z.object({ a: z.string().array() }), { a: ["a", "b"] })).toStrictEqual({
            a: ["a", "b"],
        });
    });

    it("should roundtrip dates", () => {
        const date = new Date();
        expect(roundtrip(z.object({ a: z.date() }), { a: date })).toStrictEqual({
            a: date,
        });
    });

    it("should compact into a sparse array for small indices", () => {
        expect(
            parseUrlSearchParams(z.object({ a: z.number().array() }), "?a.0=0&a.10=10&a.99=99"),
        ).toStrictEqual({ a: [0, 10, 99] });
    });

    it("should throw for arrays with holes", () => {
        expect(() =>
            parseUrlSearchParams(z.object({ a: z.number().array() }), "?a.0=10&a.10000=10000"),
        ).toThrow("is not an array");
    });

    it("should handle special characters", () => {
        expect(toUrlSearchParams({ s: "&?" })).toBe("s=%26%3F");

        const s = "<>\\'&@\"^%?";
        expect(roundtrip(z.object({ s: z.string() }), { s })).toStrictEqual({ s });
    });

    it("should roundtrip LocalDate or throw for invalid value", () => {
        const now = LocalDate.now();
        expect(roundtrip(z.object({ now: zLocalDate() }), { now })).toStrictEqual({ now });

        const array = [now.minusDays(7), now, now.plusDays(1)];
        const schema = z.object({ d: z.array(zLocalDate()) });

        expect(roundtrip(schema, { d: [now] })).toStrictEqual({ d: [now] });
        expect(roundtrip(schema, { d: array })).toStrictEqual({ d: array });

        expect(() => parseUrlSearchParams(z.object({ now: zLocalDate() }), "now=test")).toThrow(
            "Not a local date",
        );
    });

    it("should roundtrip enums", () => {
        const schema = z.object({ t: z.enum(["a", "b"]) });
        expect(roundtrip(schema, { t: "a" })).toStrictEqual({ t: "a" });
        expect(roundtrip(schema, { t: "b" })).toStrictEqual({ t: "b" });
    });

    it("protects against prototype poisoning", () => {
        const result = parseUrlSearchParams(
            z.object({ a: z.object({ b: z.string().optional() }) }),
            "a.b=test&a.__proto__.b=a",
        );

        expect(result).toStrictEqual({ a: { b: "test" } });
        expect((result as any).b).toBeUndefined();
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);

        expect(() =>
            parseUrlSearchParams(z.object({ a: z.string().array() }), "a[0]=1&a[1]=2&a.length=100"),
        ).toThrow("Data is not an array");
    });

    it("throws when `string` is passed where `number` is expected", () => {
        expect(() => parseUrlSearchParams(z.object({ a: z.number() }), "a=test")).toThrow(
            "Expected number, received string",
        );
    });
});

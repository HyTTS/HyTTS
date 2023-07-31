import { LocalDate } from "@js-joda/core";
import each from "jest-each";
import { z } from "zod";
import { zLocalDate } from "@/serialization/date-time";
import { parseUrlSearchParams, toUrlSearchParams } from "@/serialization/url-params";
import type { ZodType, ZodTypeDef } from "zod";

describe("URL search params", () => {
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
        ).toEqual(obj);
    });

    it("returns empty string for null and undefined and void schema", () => {
        expect(toUrlSearchParams(undefined)).toBe("");
        expect(toUrlSearchParams(undefined)).toBe("");
        expect(toUrlSearchParams(null)).toBe("");
    });

    it("handles empty or missing values correctly", () => {
        expect(parseUrlSearchParams(undefined, undefined)).toBe(undefined);
        expect(parseUrlSearchParams(z.object({ a: z.string() }).optional(), undefined)).toBe(
            undefined,
        );
        expect(parseUrlSearchParams(z.object({ a: z.string().optional() }), undefined)).toEqual({
            a: undefined,
        });
        expect(parseUrlSearchParams(z.object({ a: z.string().default("t") }), undefined)).toEqual({
            a: "t",
        });

        expect(parseUrlSearchParams(undefined, null)).toBe(undefined);
        expect(parseUrlSearchParams(z.object({ a: z.string() }).optional(), null)).toBe(undefined);
        expect(parseUrlSearchParams(z.object({ a: z.string().optional() }), null)).toEqual({
            a: undefined,
        });
        expect(parseUrlSearchParams(z.object({ a: z.string().default("t") }), null)).toEqual({
            a: "t",
        });

        expect(parseUrlSearchParams(undefined, "")).toBe(undefined);
        expect(parseUrlSearchParams(z.object({ a: z.string() }).optional(), "")).toBe(undefined);
        expect(parseUrlSearchParams(z.object({ a: z.string().optional() }), "")).toEqual({
            a: undefined,
        });
        expect(parseUrlSearchParams(z.object({ a: z.string().default("t") }), "")).toEqual({
            a: "t",
        });
    });

    it("ignores query prefix", () => {
        expect(parseUrlSearchParams(z.object({ a: z.string() }), "?a=b")).toEqual({ a: "b" });
        expect(parseUrlSearchParams(z.object({ a: z.string() }), "a=b")).toEqual({ a: "b" });
    });

    it("should return schema's default values", () => {
        const schema = z.object({
            n: z.number().default(17),
            s: z.string().default("test"),
        });

        expect(parseUrlSearchParams(schema, "")).toEqual({ n: 17, s: "test" });
        expect(parseUrlSearchParams(schema, "?n=3")).toEqual({ n: 3, s: "test" });
        expect(parseUrlSearchParams(schema, "?s=hi")).toEqual({ n: 17, s: "hi" });
        expect(parseUrlSearchParams(schema, "?n=3&s=hi")).toEqual({ n: 3, s: "hi" });
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
        ).toEqual({ o: { a: true } });
    });

    it("roundtrip nested objects and arrays", () => {
        expect(
            roundtrip(
                z.object({ o: z.object({ a: z.object({ b: z.boolean() }).array() }).array() }),
                { o: [{ a: [{ b: true }] }] },
            ),
        ).toEqual({ o: [{ a: [{ b: true }] }] });
    });

    it("should throw if object key contains a '.'", () => {
        expect(() => roundtrip(z.object({ "a.b": z.boolean() }), { "a.b": true })).toThrow(
            "Invalid symbol '.'",
        );
    });

    it("should roundtrip nested arrays", () => {
        expect(
            roundtrip(z.object({ o: z.array(z.boolean().array()) }), { o: [[true, false]] }),
        ).toEqual({ o: [[true, false]] });
    });

    each([0, 10, -10, 3.14]).it("should roundtrip number '%s'", (n: number) => {
        expect(roundtrip(z.object({ n: z.number() }), { n })).toEqual({ n });
    });

    each([true, false]).it("should roundtrip boolean '%s'", (b: boolean) => {
        expect(roundtrip(z.object({ b: z.boolean() }), { b })).toEqual({ b });
    });

    each(["", "  ", "test", "\"'\\"]).it("should roundtrip string '%s'", (s: string) => {
        expect(roundtrip(z.object({ s: z.string() }), { s })).toEqual({ s });
    });

    it("should roundtrip string with default null value", () => {
        expect(
            roundtrip(z.object({ s: z.string().nullable().default(null) }), { s: null }),
        ).toEqual({ s: null });
    });

    it("cannot roundtrip empty arrays", () => {
        expect(toUrlSearchParams({ a: [] })).toBe("");

        expect(roundtrip(z.object({ a: z.number().array().nullable() }), { a: null })).toEqual({
            a: null,
        });
        expect(roundtrip(z.object({ a: z.number().array().optional() }), { a: undefined })).toEqual(
            { a: undefined },
        );
        expect(roundtrip(z.object({ a: z.number().array().optional() }), { a: [] })).toEqual({
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
        expect(roundtrip(z.object({ a: z.number().array() }), { a: [1, 2] })).toEqual({
            a: [1, 2],
        });

        expect(roundtrip(z.object({ a: z.string().array() }), { a: ["a", "b"] })).toEqual({
            a: ["a", "b"],
        });
    });

    it("should roundtrip dates", () => {
        const date = new Date();
        expect(roundtrip(z.object({ a: z.date() }), { a: date })).toEqual({
            a: date,
        });
    });

    it("should compact into a sparse array for small indices", () => {
        expect(
            parseUrlSearchParams(z.object({ a: z.number().array() }), "?a.0=0&a.10=10&a.99=99"),
        ).toEqual({ a: [0, 10, 99] });
    });

    it("should throw for arrays with holes", () => {
        expect(() =>
            parseUrlSearchParams(z.object({ a: z.number().array() }), "?a.0=10&a.10000=10000"),
        ).toThrow("is not an array");
    });

    it("should handle special characters", () => {
        expect(toUrlSearchParams({ s: "&?" })).toBe("s=%26%3F");

        const s = "<>\\'&@\"^%?";
        expect(roundtrip(z.object({ s: z.string() }), { s })).toEqual({ s });
    });

    it("should roundtrip LocalDate or throw for invalid value", () => {
        const now = LocalDate.now();
        expect(roundtrip(z.object({ now: zLocalDate() }), { now })).toEqual({ now });

        const array = [now.minusDays(7), now, now.plusDays(1)];
        const schema = z.object({ d: z.array(zLocalDate()) });

        expect(roundtrip(schema, { d: [now] })).toEqual({ d: [now] });
        expect(roundtrip(schema, { d: array })).toEqual({ d: array });

        expect(() => parseUrlSearchParams(z.object({ now: zLocalDate() }), "now=test")).toThrow(
            "Not a local date",
        );
    });

    it("should roundtrip enums", () => {
        const schema = z.object({ t: z.enum(["a", "b"]) });
        expect(roundtrip(schema, { t: "a" })).toEqual({ t: "a" });
        expect(roundtrip(schema, { t: "b" })).toEqual({ t: "b" });
    });

    it("protects against prototype poisoning", () => {
        const result = parseUrlSearchParams(
            z.object({ a: z.object({ b: z.string().optional() }) }),
            "a.b=test&a.__proto__.b=a",
        );

        expect(result).toEqual({ a: { b: "test" } });
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

import { pack, unpack } from "@/serialization/data-packing";
import { zLocalDate } from "@/serialization/date-time";
import { LocalDate } from "@js-joda/core";
import { z } from "zod";

describe("data packing", () => {
    it("handles `undefined`", () => {
        expect(pack(undefined)).toBe(undefined);
        expect(unpack(z.undefined(), undefined)).toBe(undefined);
        expect(() => unpack(z.undefined(), "test")).toThrow("Expected undefined, received string");
    });

    it("handles `null`", () => {
        expect(pack(null)).toBe(null);
        expect(unpack(z.null(), null)).toBe(null);
        expect(() => unpack(z.null(), "test")).toThrow("Expected null, received string");
    });

    it("handles `unknown`", () => {
        expect(unpack(z.unknown(), "1")).toBe("1");
    });

    it("handles `any`", () => {
        expect(unpack(z.any(), "1")).toBe("1");
    });

    it("handles `boolean`", () => {
        expect(pack(true)).toBe("true");
        expect(pack(false)).toBe("false");
        expect(unpack(z.boolean(), "false")).toBe(false);
        expect(unpack(z.boolean(), "true")).toBe(true);
        expect(() => unpack(z.boolean(), "test")).toThrow("Expected boolean, received string");
    });

    it("handles `number`", () => {
        expect(pack(1)).toBe("1");
        expect(pack(-3.14)).toBe("-3.14");
        expect(unpack(z.number(), "1")).toBe(1);
        expect(unpack(z.number(), "-3.14")).toBe(-3.14);
        expect(() => unpack(z.number(), "test")).toThrow("Expected number, received string");
    });

    it("handles `string`", () => {
        expect(pack("")).toBe("");
        expect(pack("abc\"'")).toBe("abc\"'");
        expect(unpack(z.string(), "")).toBe("");
        expect(unpack(z.string(), "abc\"'")).toBe("abc\"'");
    });

    it("handles literals", () => {
        expect(unpack(z.literal(1), "1")).toBe(1);
        expect(unpack(z.literal(true), "true")).toBe(true);
        expect(unpack(z.literal("abc\"'"), "abc\"'")).toBe("abc\"'");
        expect(() => unpack(z.literal(Symbol()), "")).toThrow("Literals are only supported for");
    });

    it("handles enums", () => {
        expect(unpack(z.enum(["a", "b"]), "a")).toBe("a");
        expect(unpack(z.enum(["a", "b"]), "b")).toBe("b");
        expect(() => unpack(z.enum(["a", "b"]), "c")).toThrow("Invalid enum value");
    });

    it("handles `Date`", () => {
        const date = new Date();
        expect(pack(date)).toBe(date.toISOString());
        expect(unpack(z.date(), date.toISOString())).toEqual(date);
    });

    it("handles custom schema", () => {
        expect(
            unpack(
                z.custom((v) => v !== "1"),
                "2",
            ),
        ).toBe("2");
        expect(() =>
            unpack(
                z.custom((v) => v !== "1"),
                "1",
            ),
        ).toThrow();
    });

    it("handles plain objects", () => {
        expect(pack({ a: 1, b: "", c: null })).toEqual({ a: "1", b: "", c: null });
        expect(pack({ a: { b: { c: 1 }, d: true } })).toEqual({ a: { b: { c: "1" }, d: "true" } });

        expect(
            unpack(z.object({ a: z.number(), b: z.string(), c: z.null() }), {
                a: "1",
                b: "",
                c: null,
            }),
        ).toEqual({ a: 1, b: "", c: null });

        expect(
            unpack(z.object({ a: z.object({ b: z.object({ c: z.number() }), d: z.boolean() }) }), {
                a: { b: { c: "1" }, d: "true" },
            }),
        ).toEqual({ a: { b: { c: 1 }, d: true } });

        expect(() => unpack(z.object({}), "test")).toThrow("Data is not an object.");
    });

    it("handles intersections", () => {
        const schema = z.object({ a: z.number() }).and(z.object({ b: z.string(), c: z.null() }));
        expect(unpack(schema, { a: "1", b: "", c: null })).toEqual({ a: 1, b: "", c: null });
        expect(() => unpack(schema, { a: "1" })).toThrow("Required");
        expect(() => unpack(schema, { b: "1", c: null })).toThrow("Required");
    });

    it("handles objects with custom `toString()`", () => {
        const now = LocalDate.now();
        expect(pack(now)).toEqual(now.toString());

        expect(unpack(zLocalDate(), now.toString())).toEqual(now);
        expect(() => unpack(zLocalDate(), "test")).toThrow("Not a local date");
    });

    it("throws for class instances", () => {
        class X {
            constructor(public a: number) {}
        }
        expect(() => pack(new X(1))).toThrow("Cannot pack object with prototype.");
    });

    it("handles arrays", () => {
        expect(pack([1, 2, 3])).toEqual(["1", "2", "3"]);
        expect(pack([false, true])).toEqual(["false", "true"]);
        expect(unpack(z.number().array(), ["1", "2", "3"])).toEqual([1, 2, 3]);
        expect(unpack(z.boolean().array(), ["false", "true"])).toEqual([false, true]);

        expect(pack([[1, 2], [3]])).toEqual([["1", "2"], ["3"]]);
        expect(unpack(z.number().array().array(), [["1", "2"], ["3"]])).toEqual([[1, 2], [3]]);

        expect(() => unpack(z.string().array(), "test")).toThrow("Data is not an array.");
    });

    it("handles nested arrays and objects arrays", () => {
        expect(pack([{ a: [1, 2] }])).toEqual([{ a: ["1", "2"] }]);
        expect(unpack(z.object({ a: z.number().array() }).array(), [{ a: ["1", "2"] }])).toEqual([
            { a: [1, 2] },
        ]);
    });

    it("unpacks despite `nullable` schema", () => {
        expect(unpack(z.number().nullable(), "1")).toBe(1);
        expect(unpack(z.number().nullable(), null)).toBe(null);
    });

    it("unpacks despite `nullish` schema", () => {
        expect(unpack(z.number().nullish(), "1")).toBe(1);
        expect(unpack(z.number().nullish(), null)).toBe(null);
        expect(unpack(z.number().nullish(), undefined)).toBe(undefined);
    });

    it("unpacks despite `default`` schema", () => {
        expect(unpack(z.number().default(17), "1")).toBe(1);
        expect(unpack(z.number().default(17), undefined)).toBe(17);
    });

    it("unpacks despite `optional`` schema", () => {
        expect(unpack(z.number().optional(), "1")).toBe(1);
    });

    it("unpacks despite `effect`` schema and applies effects", () => {
        expect(
            unpack(
                z
                    .number()
                    .refine(() => true)
                    .transform((v) => v + 11),
                "1",
            ),
        ).toBe(12);
    });

    it("throws if property name contains '.'", () => {
        expect(() => pack({ "a.b": 1 })).toThrow("Invalid symbol '.'");
        expect(() => unpack(z.object({ "a.b": z.number() }), { "a.b": "1" })).toThrow(
            "Invalid symbol '.'",
        );
    });

    it("handles unions of primitive types", () => {
        const schema = z.number().or(z.string());
        expect(unpack(schema, "1")).toBe(1);
        expect(unpack(schema, " 1")).toBe(" 1");
        expect(unpack(schema, "3.14")).toBe(3.14);
        expect(unpack(schema, "")).toBe("");
        expect(unpack(schema, "test")).toBe("test");
    });

    it("handles unions of transformed primitive types", () => {
        const schema = z
            .number()
            .min(3)
            .or(z.string().transform((s) => s.length));

        expect(unpack(schema, "1")).toBe(1);
        expect(unpack(schema, " 1")).toBe(2);
        expect(unpack(schema, "3.14")).toBe(3.14);
        expect(unpack(schema, "")).toBe(0);
        expect(unpack(schema, "test")).toBe(4);
    });

    it("handles unions of transformed primitive types where the output is not accepted as the input", () => {
        const schema = z
            .boolean()
            .transform((b) => (b ? 1 : 0))
            .or(z.string().transform((s) => s.length));

        expect(unpack(schema, "true")).toBe(1);
        expect(unpack(schema, "false")).toBe(0);
        expect(unpack(schema, "3.14")).toBe(4);
        expect(unpack(schema, "")).toBe(0);
        expect(unpack(schema, "test")).toBe(4);
    });

    it("handles js-joda types", () => {
        expect(unpack(zLocalDate(), "2023-05-01")).toEqual(LocalDate.of(2023, 5, 1));
    });
});

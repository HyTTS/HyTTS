import mapValues from "lodash/mapValues";
import {
    ZodAny,
    ZodArray,
    ZodBoolean,
    ZodDate,
    ZodDefault,
    ZodEffects,
    ZodEnum,
    ZodIntersection,
    ZodLiteral,
    ZodNull,
    ZodNullable,
    ZodNumber,
    ZodObject,
    ZodOptional,
    ZodString,
    ZodType,
    ZodTypeAny,
    ZodTypeDef,
    ZodUndefined,
    ZodUnion,
    ZodUnknown,
    z,
} from "zod";

export type PackedData = undefined | null | string | { [key: string]: PackedData } | PackedData[];

/**
 * Packs the given `value` such that its structure (e.g., arrays, objects, nested arrays and objects, ...) is
 * maintained while all "leaf properties" are serialized into `string`s, except for `null` and `undefined`.
 * "Leaf properties" are `boolean`, `number`, `Date` as well as any type that provides its own implementation
 * of the `toString()` method.
 */
export function pack(value: unknown): PackedData {
    if (value === undefined || value === null) {
        return value;
    } else if (typeof value === "boolean" || typeof value === "number") {
        return value.toString();
    } else if (typeof value === "string") {
        return value;
    } else if (value instanceof Date) {
        return value.toISOString();
    } else {
        if (Array.isArray(value)) {
            return value.map((e) => pack(e));
        } else if (typeof value === "object") {
            // If the object provides a custom `toString()` method somewhere in its inheritance
            // chain (but not the default implementation from `Object`), use that to serialize the value.
            if (
                value.toString !== Object.prototype.toString &&
                typeof value.toString === "function"
            ) {
                return value.toString();
            }

            // We don't support serialization of objects with prototypes right now because they are somewhat
            // hard to roundtrip correctly, but we probably could in the future.
            if (Object.getPrototypeOf(value) !== Object.prototype) {
                throw new Error("Cannot pack object with prototype.");
            }

            return mapValues(value, (value: unknown, key: string) => {
                if (key.includes(".")) {
                    // We can't roundtrip in this case...
                    throw new Error(`Invalid symbol '.' in property name '${key}'.`);
                }
                return pack(value);
            }) as PackedData;
        } else {
            throw new Error(`Unable to pack '${value}'.`);
        }
    }
}

/**
 * Recursively goes through the given `schema` and `data` together to unpack `data` in correspondence with
 * the `schema`. That is, the structure of `schema` is enforced and all "leaf components" (see `pack` above)
 * are deserialized from `string` into the type expected by the Zod schema. Also, all validations and
 * transformations defined by the Zod schema are carried out.
 */
export function unpack<Output, Def extends ZodTypeDef, Input>(
    schema: ZodType<Output, Def, Input> | undefined,
    data: PackedData,
): Output | undefined {
    if (!schema) {
        return undefined;
    }

    return schema.parse(unpackRecursive(schema, data, false));

    function unpackRecursive(schema: ZodType, data: any, insideUnion: boolean): any {
        if (
            data === undefined ||
            data === null ||
            schema instanceof ZodString ||
            schema instanceof ZodUndefined ||
            schema instanceof ZodNull ||
            schema instanceof ZodUnknown
        ) {
            return data;
        } else if (schema instanceof ZodNumber) {
            return typeof data === "string" && /^[+-]?\d+(\.\d+)?$/.test(data)
                ? Number(data)
                : data;
        } else if (schema instanceof ZodBoolean) {
            return data === "true" ? true : data === "false" ? false : data;
        } else if (schema instanceof ZodDate) {
            const date = new Date(data);
            return isNaN(date.valueOf()) ? data : date;
        } else if (schema instanceof ZodAny) {
            return data;
        } else if (schema instanceof ZodLiteral) {
            if (typeof schema.value === "boolean")
                return unpackRecursive(z.boolean(), data, insideUnion);
            else if (typeof schema.value === "number")
                return unpackRecursive(z.number(), data, insideUnion);
            else if (typeof schema.value === "string") return data;
            else {
                throw new Error(
                    "Literals are only supported for `boolean`, `number`, and `string`.",
                );
            }
        } else if (schema instanceof ZodObject) {
            if (insideUnion) {
                throw new Error("Objects are not supported within unions.");
            }

            if (!(typeof data === "object")) {
                throw new Error("Data is not an object.");
            }

            return mapValues(schema.shape, (value, key) => {
                if (key.includes(".")) {
                    // We can't roundtrip in this case...
                    throw new Error(`Invalid symbol '.' in property name '${key}'.`);
                }
                return unpackRecursive(value, data[key], false);
            });
        } else if (schema instanceof ZodArray) {
            if (insideUnion) {
                throw new Error("Arrays are not supported within unions.");
            }

            if (!Array.isArray(data)) {
                // This happens, for example, when qs converts an array into an object as a security precaution...
                throw new Error(
                    "Data is not an array. Possibly, the maximum allowed array size is exceeded.",
                );
            }

            return data.map((e: string) => unpackRecursive(schema.element, e, false));
        } else if (schema instanceof ZodNullable) {
            return unpackRecursive(schema.unwrap(), data, insideUnion);
        } else if (schema instanceof ZodDefault) {
            return unpackRecursive(schema.removeDefault(), data, insideUnion);
        } else if (schema instanceof ZodOptional) {
            return unpackRecursive(schema.unwrap(), data, insideUnion);
        } else if (schema instanceof ZodEnum) {
            return data;
        } else if (schema instanceof ZodEffects) {
            return unpackRecursive(schema.innerType(), data, insideUnion);
        } else if (schema instanceof ZodIntersection) {
            return {
                ...unpackRecursive(schema._def.left, data, insideUnion),
                ...unpackRecursive(schema._def.right, data, insideUnion),
            };
        } else if (schema instanceof ZodUnion) {
            // This is a best-effort implementation for unions that uses the first option that somehow
            // matches. It might return a different result compared to Zod's standard parse function due
            // to this function's string coercion behavior. Also, we currently do not support nested objects
            // or arrays within unions.
            // Since this implementation might be somewhat problematic, it is not officially documented.
            // It is mostly used for HyTTS-internal types.
            for (const option of (schema as ZodUnion<[ZodTypeAny]>).options) {
                const transformedData = unpackRecursive(option, data, true);
                const result = option.safeParse(transformedData);
                if (result.success) {
                    // Return the recursively obtained data that we now know will successfully parse when
                    // the outer function returns. We can't return the already parsed `result.data` here,
                    // as we don't know if the schema accepts its own output as its input.
                    return transformedData;
                }
            }

            // We couldn't parse the data, so just return it unmodified an let the top-level parsing
            // generate the error.
            return data;
        } else {
            throw new Error(`Unable to deserialize '${schema.constructor.name}'.`);
        }
    }
}

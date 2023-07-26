import { ZodDefault, ZodOptional, ZodType, ZodTypeDef } from "zod";
import { stringify, parse } from "qs";
import { unpack, pack } from "@/serialization/data-packing";

/**
 * Parses the given URL search params using the given Zod schema. The schema must be an object schema,
 * and you should consider adding default values where necessary, so that missing properties in the URL do
 * not cause parsing errors. Some advanced Zod types are not fully supported, such as unions.
 */
export function parseUrlSearchParams<
    Output extends Record<string, unknown> | undefined,
    Def extends ZodTypeDef,
    Input,
>(
    schema: ZodType<Output, Def, Input> | undefined,
    paramsString: string | null | undefined,
): Output | undefined {
    return unpack(
        schema,
        !paramsString
            ? schema instanceof ZodDefault || schema instanceof ZodOptional
                ? undefined
                : {}
            : parse(paramsString, {
                  // Enable dot notation for properties, e.g., `a.b.c=d`.
                  allowDots: true,
                  // Parse values without `=` to `null`, e.g., for `a&b=`, `a` is `null` and `b` is `""`.
                  strictNullHandling: true,
                  // Ignore the leading `?`, if any.
                  ignoreQueryPrefix: true,
                  // Do not allow arrays with more than 100 elements so that noone can attempt a denial of
                  // service attack by sending, e.g., `&a[10000000000]=0`.
                  arrayLimit: 100,
              }),
    );
}

/**
 * Converts the given object into an URL-encoded search params string.
 */
export function toUrlSearchParams<T extends Record<string, unknown>>(
    obj: T | null | undefined,
): string {
    if (!obj) {
        return "";
    }

    return stringify(pack(obj), {
        // Enable dot notation for properties, e.g., `a.b.c=d`.
        allowDots: true,
        // Writes `null` values as `a` instead of `a=`.
        strictNullHandling: true,
        // Use `a[0][0]` for arrays so that multi-dimensional arrays work reliably.
        arrayFormat: "indices",
        // Replace `a[0]` with `a.0` (which does not require URL encoding) to make URLs more readable.
        // For some reason, with `allowDots` above, qs only does this for object keys but not for array indices.
        encoder: (value: string, _, __, mode) =>
            encodeURIComponent(
                mode === "key" ? value.replaceAll("]", "").replaceAll("[", ".") : value,
            ),
    });
}

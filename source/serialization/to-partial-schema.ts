import mapValues from "lodash/mapValues";
import {
    z,
    ZodAny,
    ZodArray,
    ZodBoolean,
    ZodDefault,
    ZodEffects,
    ZodEnum,
    ZodIntersection,
    ZodNull,
    ZodNullable,
    ZodNumber,
    ZodObject,
    ZodOptional,
    type ZodRawShape,
    ZodString,
    type ZodType,
    type ZodTypeAny,
    ZodUndefined,
    ZodUnion,
} from "zod";

/**
 * Transforms the given input schema into a partial one. A partial schema enforces the structure of
 * some object recursively, but does not enforce all other kinds of validations or value and type
 * transformations carried out by the original schema.
 *
 * The browser always sends all form data as an URL-encoded request body to the server. This
 * unprocessed form data is thus never valid according to the form's schema if it expects any type
 * other than `string` somewhere. However, we want to be able to validate forms and show meaningful
 * validation errors to the user when the form is rerendered, so we have to be able to deal with
 * partially valid form state. So in order to be able to safely work with such invalid form data,
 * we at least want to have the guarantee that the structure of the data, e.g., nested objects and
 * arrayness, matches our expectations. The partial schema thus fails parsing when there any
 * structural schema violation. Afterwards, we can safely traverse the data using the array methods
 * or `Object.entries`, and so on. That is, we can be sure at this point that noone was able to tamper
 * with the structure of the data.
 *
 * If the structure of the data is indeed valid, the partial schema returns an object that might be
 * either partially or fully valid according to the original schema. The partial schema, however,
 * never runs any validations, refinements, nor transforms. Also, it always allows values of type
 * string for all leaf object properties and leaf array elements where some other data type is
 * expected; object nesting and arrayness, on the other hand, is always guaranteed.
 *
 * So if partial validation fails, we can still rerender the form with helpful error messages for the
 * user. This also allows us, for example, to modify the form data before rerendering the form, e.g.,
 * in order to correct some invalid input automatically or by adding or removing form array elements.
 * In doing so, we have to be able to cope with non-validated and untransformed string values where
 * we would usually expect something different in a fully-validated context, but we can work with
 * the actual property types and validated values in some cases, e.g., when assigning new values.
 */
export function toPartialSchema<T extends ZodTypeAny>(schema: T): ToPartialSchema<T> {
    return recurse(schema) as any;

    function recurse(schema: ZodType): ZodType {
        if (schema instanceof ZodString) {
            // Ignore all validations defined for a string schema by creating a new one.
            return z.string();
        } else if (schema instanceof ZodUndefined) {
            return z.undefined();
        } else if (schema instanceof ZodNull) {
            return z.null();
        } else if (schema instanceof ZodNumber) {
            // Ignore all validations defined for a number schema by creating a new one.
            return z.number().or(z.string());
        } else if (schema instanceof ZodBoolean) {
            // Ignore all validations defined for a Boolean schema by creating a new one.
            // The browser doesn't send anything for checkboxes when they're not checked, so default to `false`.
            return z.boolean().or(z.string()).default(false);
        } else if (schema instanceof ZodEnum) {
            return schema.or(z.string());
        } else if (schema instanceof ZodObject) {
            const shape = mapValues(schema.shape, (value) => recurse(value));
            const x = new ZodObject({ ...schema._def, shape: () => shape });
            return x;
        } else if (schema instanceof ZodArray) {
            return z.array(recurse(schema.element), schema._def);
        } else if (schema instanceof ZodNullable) {
            return recurse(schema.unwrap()).nullable();
        } else if (schema instanceof ZodDefault) {
            return recurse(schema.removeDefault()).default(schema._def.defaultValue());
        } else if (schema instanceof ZodEffects) {
            switch (schema._def.effect.type) {
                case "refinement":
                case "transform":
                    // Ignore all refinements and transforms, because its better to have the expected
                    // property type without validations than a string value. And as soon as some
                    // validation or refinement fails, we no longer know whether transforms work as
                    // expected.
                    return recurse(schema.innerType());
                case "preprocess":
                    return new ZodEffects({
                        ...schema._def,
                        schema: recurse(schema.innerType()),
                    });
                default: {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const switchGuard: never = schema._def.effect;
                    throw new Error("Unknown effect type.");
                }
            }
        } else if (schema instanceof ZodOptional) {
            return recurse(schema.unwrap()).optional();
        } else if (schema instanceof ZodIntersection) {
            return recurse(schema._def.left).and(recurse(schema._def.right));
        } else if (schema instanceof ZodUnion) {
            return z.union(schema.options.map(recurse));
        } else if (schema instanceof ZodAny) {
            return schema;
        } else {
            throw new Error(`Unsupported Zod schema '${schema.constructor.name}'.`);
        }
    }
}

export type ToPartialSchema<T extends ZodTypeAny> = T extends ZodObject<
    infer S extends ZodRawShape,
    infer U,
    infer C
>
    ? ZodObject<{ [K in keyof S]: ToPartialSchema<S[K]> }, U, C>
    : T extends ZodArray<infer U, infer C>
    ? ZodArray<ToPartialSchema<U>, C>
    : T extends ZodNullable<infer U>
    ? ZodNullable<ToPartialSchema<U>>
    : T extends ZodDefault<infer U>
    ? ZodDefault<ToPartialSchema<U>>
    : T extends ZodEffects<infer U>
    ? ZodUnion<[ToPartialSchema<U>, ZodString]>
    : T extends ZodOptional<infer U>
    ? ZodOptional<ToPartialSchema<U>>
    : T extends ZodIntersection<infer U, infer V>
    ? ZodIntersection<ToPartialSchema<U>, ToPartialSchema<V>>
    : T extends ZodUnion<infer U>
    ? ZodUnion<ConvertUnionCases<U>>
    : ZodUnion<[T, ZodString]>;

type ConvertUnionCases<T extends readonly ZodTypeAny[]> = T extends [infer U extends ZodTypeAny]
    ? [ToPartialSchema<U>]
    : T extends [infer U extends ZodTypeAny, ...infer V extends ZodTypeAny[]]
    ? [ToPartialSchema<U>, ...ConvertUnionCases<V>]
    : never;

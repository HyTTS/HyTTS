/*

In HyTTS, almost arbitrary JavaScript objects can be serialized and deserialized to roundtrip them through the browser,
for example, in action body parameters (forms, non-form-based POST requests) or URL search query parameters. In both 
cases, the serialized format is an URL-encoded query string, i.e., `?a=x&b=y&c=z`. Such a query string by itself as no 
nested structure, no arrays, and all values are string-based. Additionally, path parameters such as `/a/:x/b/:y` also 
have to be serialized and deserialized from and to strings, in this case supporting neither nesting nor arrays, however.

HyTTS allows the developer to use nested objects, arrays, and non-string types for an improved developer experience for
both action and search parameters as well as non-string types (but no nesting and arrays) for path parameters. HyTTS 
thus provides a serialization and deserialization infrastructure based on Zod for validation and qs for parsing to 
convert from those easy-to-use JavaScript objects to the string reprsentation and vice versa with full type safety. All 
of this, of course, is highly security-critical.

The developer must provide a Zod schema for each route, search, or action parameter. This schema always receives strings
to subsequently parse, validate, and transform into the resulting value. For primitive, built-in types such as
`boolean` and `number`, HyTTS takes care of the string transformation, thus making it possible to just use `z.number()`,
for example. For custom types, e.g., when parsing a joda-js `LocalDate`, the developer must use a Zod schema such as
`z.string().transform(v => { ... validation and transformation ... })`. When serializing such a type, HyTTS just calls the 
`toString()` method on the provided value when the value defines it in its own prototype, otherwise it falls back to
object serialization, thus serializing each property of the object separately. Instances of classes, or, more generally,
values with non-`Object` prototypes without a custom `toString()`, cannot be serialized; only plain JavaScript objects
are currently supported.

Nested objects are serialized by "dot-joining" the property path, e.g., a value of `{ a: { b: true }}` is serialized as
`?a.b=true`. Similarily, arrays are serialized by making the index explicit, e.g., a value of `{ a: [1, 2] }` is 
serialized as `?a.0=1&a.1=2`. For security reasons, there is an upper limit on the maximum allowed array length, so
that something like `?a.0=1&a.100000000=2` is immediately rejected without causing any denial-of-service problems.
Arrays and objects can be freely nested within each other.

During deserialization, the necessary string-to-final-type transformations and validations are carried out in addition
to the structural validation (nesting, arrays) of the input. While this is implicitly done by the Zod schema, forms are
an interesting exception. In this case, we sometimes also want to use the provided values even though validation fails,
namely when the user hasn't filled out the form correctly. But nevertheless, the structure of the data must always be
valid. We thus need two separate Zod schemas for forms: One that only validates the structure (nesting, array-ness) 
while ignoring all string-to-final-type transformations and further validations, and one that validates everything.
For reasons of convenience, the developer only has to provide the final Zod schema, and HyTTS computes the structure-
only schema automatically from it. In order to be able to derive this schema, HyTTS has to analyze the provided final
Zod schema, unfortunately (currently?) disallowing any custom, third-party class derived from `ZodType`.

In addition to not allowing any third-party `ZodType` instances (if possible, use `z.custom()` instead), there are also 
some additional restrictions on the set of supported first-party Zod types. In some cases, there is no (or no secure) 
string representation of a type (e.g., for `ZodNever`, `ZodPromise`, or `ZodFunction`), while in other cases support
could potentially be added in the future. Probably the largest restriction right now is that `ZodUnion` is unsupported 
in the general case.

*/

import { ZodFirstPartyTypeKind, z } from "zod";

// This is only used to get notified about new first-party Zod types when Zod is updated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const supporedFirstPartyTypes: Record<ZodFirstPartyTypeKind, boolean> = {
    // Fully supported Zod types:
    [z.ZodFirstPartyTypeKind.ZodString]: true,
    [z.ZodFirstPartyTypeKind.ZodNumber]: true,
    [z.ZodFirstPartyTypeKind.ZodBoolean]: true,
    [z.ZodFirstPartyTypeKind.ZodDate]: true,
    [z.ZodFirstPartyTypeKind.ZodNull]: true,
    [z.ZodFirstPartyTypeKind.ZodArray]: true,
    [z.ZodFirstPartyTypeKind.ZodObject]: true,
    [z.ZodFirstPartyTypeKind.ZodIntersection]: true,
    [z.ZodFirstPartyTypeKind.ZodLiteral]: true,
    [z.ZodFirstPartyTypeKind.ZodEnum]: true,
    [z.ZodFirstPartyTypeKind.ZodEffects]: true,
    [z.ZodFirstPartyTypeKind.ZodOptional]: true,
    [z.ZodFirstPartyTypeKind.ZodNullable]: true,
    [z.ZodFirstPartyTypeKind.ZodDefault]: true,
    [z.ZodFirstPartyTypeKind.ZodUnknown]: true,

    // Zod types with partial support:
    [z.ZodFirstPartyTypeKind.ZodUnion]: false, // mostly HyTTS-internal
    [z.ZodFirstPartyTypeKind.ZodAny]:
        true /* because of `z.custom()`, must not be used for structured data
                and be able to convert from string */,

    // Currenly unsupported Zod types, but might potentially be supported in the future:
    [z.ZodFirstPartyTypeKind.ZodNaN]: false,
    [z.ZodFirstPartyTypeKind.ZodBigInt]: false,
    [z.ZodFirstPartyTypeKind.ZodTuple]: false,
    [z.ZodFirstPartyTypeKind.ZodRecord]: false,
    [z.ZodFirstPartyTypeKind.ZodMap]: false,
    [z.ZodFirstPartyTypeKind.ZodSet]: false,
    [z.ZodFirstPartyTypeKind.ZodBranded]: false,
    [z.ZodFirstPartyTypeKind.ZodPipeline]: false,
    [z.ZodFirstPartyTypeKind.ZodCatch]: false,
    [z.ZodFirstPartyTypeKind.ZodLazy]: false,
    [z.ZodFirstPartyTypeKind.ZodNativeEnum]: false,

    // Zod types for which there is no (secure) string representation:
    [z.ZodFirstPartyTypeKind.ZodUndefined]: false, // but optional properties are supported
    [z.ZodFirstPartyTypeKind.ZodNever]: false,
    [z.ZodFirstPartyTypeKind.ZodVoid]: false,
    [z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion]: false,
    [z.ZodFirstPartyTypeKind.ZodFunction]: false,
    [z.ZodFirstPartyTypeKind.ZodPromise]: false,
    [z.ZodFirstPartyTypeKind.ZodSymbol]: false,
};

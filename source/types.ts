/**
 * Forces the TypeScript compiler to compute the canonical representation of a given type. E.g., `{
 * a: string } & { b: number }` becomes `{ a: string, b: number }`.
 */
export type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

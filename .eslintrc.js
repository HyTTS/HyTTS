module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    plugins: ["no-relative-import-paths"],
    rules: {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/ban-types": [
            "error",
            {
                types: {
                    extendDefaults: true,
                    "{}": false,
                },
            },
        ],
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                vars: "all",
                args: "after-used",
                argsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],
        "no-relative-import-paths/no-relative-import-paths": ["warn", { allowSameFolder: true }],
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-implicit-any-catch": ["warn", { allowExplicitAny: true }],
        "@typescript-eslint/no-empty-interface": "off",
        "no-console": "off",
        eqeqeq: ["error", "always"],
    },
};

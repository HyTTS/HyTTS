module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
    },
    reportUnusedDisableDirectives: true,
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    plugins: ["no-relative-import-paths"],
    rules: {
        "@typescript-eslint/await-thenable": "error",
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
        "@typescript-eslint/consistent-generic-constructors": "warn",
        "@typescript-eslint/consistent-type-assertions": "error",
        "@typescript-eslint/consistent-type-definitions": ["error", "type"],
        "@typescript-eslint/default-param-last": "error",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/member-ordering": [
            "error",
            {
                classes: ["field", "constructor", "method"],
            },
        ],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                selector: ["class", "typeAlias"],
                format: ["PascalCase"],
            },
        ],
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-implicit-any-catch": ["warn", { allowExplicitAny: true }],
        "@typescript-eslint/no-misused-promises": [
            "error",
            {
                checksVoidReturn: {
                    // Suppress errors in JSX handlers
                    attributes: false,
                },
            },
        ],
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/method-signature-style": "error",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                vars: "all",
                args: "after-used",
                argsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/prefer-includes": "error",
        "@typescript-eslint/prefer-string-starts-ends-with": "error",
        "default-case-last": "error",
        eqeqeq: ["error", "always"],
        "no-console": "error",
        "no-constructor-return": "error",
        "no-extra-bind": "error",
        "no-lone-blocks": "error",
        "no-new-wrappers": "error",
        "no-restricted-imports": [
            "error",
            { paths: [{ name: "@/index", message: "Import from the actual path instead." }] },
        ],
        "no-relative-import-paths/no-relative-import-paths": ["warn", { allowSameFolder: true }],
        "no-self-compare": "error",
        "no-useless-rename": "warn",
        "no-unreachable-loop": "error",
        "valid-typeof": "error",
    },
};

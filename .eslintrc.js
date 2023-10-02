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
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/strict-type-checked",
        "plugin:@typescript-eslint/stylistic-type-checked",
        "plugin:import/recommended",
        "plugin:import/typescript",
    ],
    plugins: ["no-relative-import-paths", "import", "jest", "jsdoc"],
    settings: {
        "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    rules: {
        "jsdoc/no-undefined-types": 1,
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/ban-types": ["warn", { types: { extendDefaults: true, "{}": false } }],
        "@typescript-eslint/consistent-type-definitions": ["warn", "type"],
        "@typescript-eslint/consistent-type-imports": "warn",
        "@typescript-eslint/explicit-member-accessibility": "warn",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-import-type-side-effects": "warn",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/no-base-to-string": "off",
        "@typescript-eslint/no-confusing-void-expression": ["warn", { ignoreArrowShorthand: true }],
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
        "@typescript-eslint/no-var-requires": "off",
        "default-case-last": "warn",
        "dot-notation": "warn",
        eqeqeq: ["warn", "always"],
        "import/first": "warn",
        "import/order": [
            "warn",
            {
                groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
                "newlines-between": "never",
                alphabetize: { order: "asc", caseInsensitive: true },
            },
        ],
        "import/no-duplicates": ["warn", { "prefer-inline": true }],
        "import/no-empty-named-blocks": "warn",
        "no-console": "warn",
        "no-constructor-return": "warn",
        "no-extra-bind": "warn",
        "no-lone-blocks": "warn",
        "no-new-wrappers": "warn",
        "no-restricted-imports": [
            "error",
            {
                paths: [{ name: "@/index", message: "Import from the source file instead." }],
            },
        ],
        "no-relative-import-paths/no-relative-import-paths": ["warn", { allowSameFolder: true }],
        "no-self-compare": "warn",
        "no-useless-rename": "warn",
        "no-unreachable-loop": "warn",
        "sort-imports": ["warn", { ignoreCase: true, ignoreDeclarationSort: true }],
        "valid-typeof": "warn",
        quotes: ["warn", "double", { allowTemplateLiterals: false, avoidEscape: true }],
    },
    overrides: [
        {
            files: ["source/**/*.test.ts", "source/**/*.test.tsx"],
            plugins: ["jest"],
            extends: ["plugin:jest/all"],
            rules: {
                "jest/max-expects": "off",
                "jest/no-conditional-in-test": "off",
                "jest/no-standalone-expect": "off",
                "jest/no-test-return-statement": "off",
                "jest/prefer-expect-assertions": "off",
                "jest/prefer-expect-resolves": "off",
                "jest/require-hook": "off",
                "jest/require-to-throw-message": "off",
                "jest/expect-expect": ["error", { assertFunctionNames: ["expect*", "test*"] }],
            },
        },
        {
            files: ["*.browser.*"],
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        patterns: [
                            {
                                group: ["@/*"],
                                message: "Browser files may only import from '$/...'.",
                                allowTypeImports: true,
                            },
                            {
                                group: ["@/browser/*"],
                                message: "Use '$/...' syntax for importing browser files.",
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ["*.ts"],
            excludedFiles: ["*.test.ts", "*.browser.ts"],
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        patterns: [
                            {
                                group: ["\\$/*"],
                                message: "Imports of '*.browser.*' files are disallowed.",
                                allowTypeImports: true,
                            },
                            {
                                group: ["@/browser/*"],
                                message: "Use '$/...' syntax for importing browser files.",
                            },
                        ],
                    },
                ],
            },
        },
    ],
};

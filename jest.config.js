/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

/** @type {import("jest").Config} */
// eslint-disable-next-line no-undef
module.exports = {
    moduleNameMapper: {
        "@/(.*)": "<rootDir>/source/$1",
        "\\$/(.*)": "<rootDir>/source/browser/$1",
    },
    roots: ["./source"],
    setupFilesAfterEnv: ["./jest.setup.ts"],
    testEnvironment: "node",
    transform: { "^.+\\.(t|j)sx?$": "./jest.transform.js" },
};

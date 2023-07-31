/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

/** @type {import('jest').Config} */
module.exports = {
    moduleNameMapper: { "@/(.*)": "<rootDir>/source/$1" },
    roots: ["./source"],
    setupFilesAfterEnv: ["./jest.setup.ts"],
    testEnvironment: "node",
    transform: { "^.+\\.(t|j)sx?$": "./jest.transform.js" },
};

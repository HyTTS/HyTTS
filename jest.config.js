/* eslint-disable no-undef */

/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

module.exports = {
    moduleNameMapper: { "@/(.*)": "<rootDir>/source/$1" },
    roots: ["./source"],
    testEnvironment: "node",
    transform: { "^.+\\.(t|j)sx?$": "./jest.transform.js" },
};

/* eslint-disable no-undef */

const { transformSync } = require("esbuild");
const path = require("path");

const loaders = ["js", "jsx", "ts", "tsx", "json"];

module.exports = {
    canInstrument: true,
    createTransformer: () => ({
        process(content, filename) {
            const extName = path.extname(filename).slice(1);
            const loader = loaders.includes(extName) ? extName : "text";

            const result = transformSync(content, {
                define: { "process.env.NODE_ENV": '"development"' },
                jsx: "automatic",
                jsxDev: false,
                jsxImportSource: "@/jsx",
                format: "cjs",
                target: "esnext",
                platform: "node",
                loader,
                sourcemap: true,
                sourcesContent: false,
                sourcefile: filename,
            });

            let { map, code } = result;
            map = {
                ...JSON.parse(result.map),
                sourcesContent: null,
            };

            code =
                code +
                "\n//# sourceMappingURL=data:application/json;base64," +
                Buffer.from(JSON.stringify(map)).toString("base64");

            return { code, map };
        },
    }),
};

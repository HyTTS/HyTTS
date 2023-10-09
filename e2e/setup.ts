import { register } from "esbuild-register/dist/node";

register({
    jsx: "automatic",
    jsxImportSource: "@/jsx",
    jsxDev: false,
    format: "cjs",
    target: "esnext",
    platform: "node",
});

export default function globalSetup() {}

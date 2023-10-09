/* eslint-disable no-console */
/* eslint-disable import/no-named-as-default-member */

import { createServer } from "http";
import * as path from "path";
import { watch } from "chokidar";
import { type BuildResult, context, formatMessages } from "esbuild";
import express, { type RequestHandler, type Response } from "express";
import debounce from "lodash/debounce";
import { Server as SocketIoServer } from "socket.io";
import type { InitializeServer } from "examples/server";

const httpPort = 3700;
const changeDebounceIntervalMs = 100;

const rootDir = path.resolve(__dirname, "../");
const watchedDirs = [
    path.join(rootDir, "source"),
    path.join(rootDir, "public"),
    path.join(rootDir, "examples"),
];
const serverBundleDir = path.join(rootDir, "/tmp/dev");
const serverBundleFile = "server";
const serverBundlePath = path.join(serverBundleDir, serverBundleFile);

export function main() {
    const app = express();

    app.disable("x-powered-by");
    app.set("query parser", (queryString: string) => queryString);
    app.use(express.text({ type: "application/x-www-form-urlencoded" }));

    const httpServer = createServer(app);
    const builder = createBundler();

    const socketIo = new SocketIoServer(httpServer);
    socketIo.on("connection", (socket) => {
        socket.emit("changed", Date.now());
    });

    let requestListenerPromise: Promise<RequestHandler> = Promise.resolve((_req, res) =>
        res.status(500).send("Server is initializing..."),
    );

    onFilesChanged(
        watchedDirs,
        debounce(() => {
            const start = performance.now();
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete require.cache[serverBundlePath + ".js"];

            requestListenerPromise = (async () => {
                try {
                    await builder();

                    const { initializeServer } = require(serverBundlePath);
                    const server = (initializeServer as InitializeServer)();

                    return server;
                } catch (e: unknown) {
                    console.error(e);
                    return (_req, res) => void onError(res, e);
                } finally {
                    console.log(`Server started in ${(performance.now() - start).toFixed(2)}ms.`);
                }
            })();

            socketIo.emit("changed", Date.now());
        }, changeDebounceIntervalMs),
    );

    serveStaticFiles();

    app.use(
        (req, res, next) =>
            void requestListenerPromise
                .then((rl) => rl(req, res, next))
                .catch((e) => onError(res, e)),
    );

    httpServer.listen(httpPort, () => {
        console.log(`Server is listening on port ${httpPort}.`);
    });

    function onFilesChanged(dirs: string[], callback: () => void) {
        watch(dirs, {}).on("ready", callback).on("all", callback);
    }

    function serveStaticFiles() {
        app.get("/hot-reloader.js", (_req, res) =>
            res.contentType("text/javascript").send(
                `
                    import { io } from "/socket.io-client.mjs"; 
                    let last; 
                    io().on("changed", (current) => { 
                        if (last < current) 
                            document.location.reload(); 
                        last = current; 
                    });
                `,
            ),
        );

        app.get("/socket.io-client.mjs", (_req, res) =>
            res.sendFile(
                path.join(rootDir, "node_modules/socket.io-client/dist/socket.io.esm.min.js"),
            ),
        );

        app.get("/socket.io.esm.min.js.map", (_req, res) =>
            res.sendFile(
                path.join(rootDir, "node_modules/socket.io-client/dist/socket.io.esm.min.js.map"),
            ),
        );

        app.use((req, res, next) => {
            if (req.path === "/favicon.ico") {
                res.sendStatus(404);
            } else {
                next();
            }
        });

        app.use(express.static(path.join(rootDir, "tmp/public"), { immutable: false, maxAge: 0 }));
    }
}

async function onError(res: Response, e: unknown) {
    res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>Error</title>
                <script type="module" src="/hot-reloader.js"></script>
            </head>
            <body>
                <pre>${await printEsBuildError(e)}</pre>
            </body>
        </html>`);
}

function createBundler(): () => Promise<BuildResult> {
    const esbuildContext = context({
        outdir: serverBundleDir,
        minify: false,
        logLevel: "silent",
        jsx: "automatic",
        jsxDev: false,
        metafile: false,
        entryPoints: ["./examples/server.tsx"],
        entryNames: serverBundleFile,
        bundle: true,
        sourcemap: "inline",
        splitting: false,
        format: "cjs",
        target: "esnext",
        platform: "node",
        external: [
            "./node_modules/*",
            // Exclude ESM modules due to: https://github.com/evanw/esbuild/issues/1975#issuecomment-1057953382
            "zod",
        ],
        define: { "process.env.NODE_ENV": '"development"' },
    });

    return async () => {
        const buildResult = await (await esbuildContext).rebuild();

        if (buildResult.errors.length) {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw buildResult;
        } else {
            return buildResult;
        }
    };
}

async function printEsBuildError(error: unknown): Promise<unknown> {
    if (isEsBuildError(error)) {
        if (error.warnings.length) {
            const consoleMessages = await formatMessages(error.warnings, {
                kind: "warning",
                color: true,
            });
            console.warn(...consoleMessages);
        }

        if (error.errors.length) {
            const consoleMessages = await formatMessages(error.errors, {
                kind: "error",
                color: true,
            });
            console.error(...consoleMessages);

            const errorMessages = await formatMessages(error.errors, {
                kind: "error",
                color: false,
            });

            return `EsBuild errors:\n${errorMessages.join("\n")}`;
        }
    } else if (error instanceof Error) {
        console.error(error);
        return error.stack;
    } else {
        console.error(error);
    }

    return error;

    function isEsBuildError(error: unknown): error is Pick<BuildResult, "errors" | "warnings"> {
        return (
            typeof error === "object" &&
            error !== null &&
            Array.isArray((error as any).warnings) &&
            Array.isArray((error as any).errors)
        );
    }
}

main();

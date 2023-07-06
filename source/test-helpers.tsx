import { createServer } from "http";
import { AddressInfo } from "net";
import express, { Express } from "express";
import { Server } from "http";
import { toExpressRouter } from "@/routing/express-router";
import { RoutingDefinition } from "@/routing/routing";
import { Urls, RouteUrl, ActionUrl, createUrls } from "@/routing/urls";
import { createRenderCallback } from "./http/render-callback";
import { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";

type UseAppCallback<TReturn = void> = (
    fetch: typeof global.fetch,
    baseUrl: string,
) => TReturn | Promise<TReturn>;

/**
 * Starts an HTTP server for the given Express app on a random port for the duration of the given callback.
 * The callback receives a `fetch` method that can be used to make requests to the test server as well as
 * the base URL of the test server.
 */
async function testApp<TReturn>(
    app: Express,
    callback: UseAppCallback<TReturn>,
): Promise<Awaited<TReturn>> {
    let server: Server | undefined = undefined;
    try {
        // Listening on port 0 lets the OS assign a free port.
        server = await new Promise<Server>((resolve) => {
            const server = createServer(app).listen(0, () => resolve(server));
        });
        const port = (server.address() as AddressInfo).port;
        const baseUrl = `http://localhost:${port}`;

        return await callback((url, init) => fetch(`${baseUrl}${url}`, init), baseUrl);
    } finally {
        // We don't have to await the close operation, because the OS takes care of using other, unused
        // ports in all concurrent and subsequent tests.
        server?.close();
    }
}

/**
 * Starts an Express app for testing purposes based on the given `routingDefinition`. Provides the URLs
 * for the routes as well as two fetch functions for routes and actions to the callback that executes
 * the actual testing logic.
 */
export function runTestApp<T extends RoutingDefinition>(
    routingDefinition: T | (() => T),
    useApp: (
        urls: Urls<T>,
        fetchRoute: (route: RouteUrl) => Promise<Response>,
        fetchAction: (action: ActionUrl) => Promise<Response>,
    ) => Promise<void>,
    appContext: JsxComponent<PropsWithChildren> = ({ children }) => <>{children}</>,
) {
    const routes =
        typeof routingDefinition === "function" ? routingDefinition() : routingDefinition;

    const renderCallback = createRenderCallback({
        document: ({ children }) => <>{children}</>,
        appContext,
        errorView: ({ error }) => <>non-fatal: {`${error}`}</>,
        fatalErrorView: (error) => `fatal: ${error}`,
    });

    const app = express();
    app.set("query parser", (queryString: string) => queryString);
    app.use(express.text({ type: "application/x-www-form-urlencoded" }));
    app.use(toExpressRouter(routes, renderCallback));

    return testApp(app, (fetch) =>
        useApp(
            createUrls(routes),
            (route) => fetch(route.url),
            (action) =>
                fetch(action.url, {
                    method: "POST",
                    body: action.actionParams,
                    headers: { "content-type": "application/x-www-form-urlencoded" },
                }),
        ),
    );
}

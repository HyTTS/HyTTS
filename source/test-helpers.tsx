import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express, text } from "express";
import { createExpressMiddleware } from "@/routing/express-middleware";
import { getHrefs, type Href, type HrefCreator } from "@/routing/href";
import { Router, type RoutesComponent } from "@/routing/router";

type UseAppCallback<TReturn = void> = (
    fetch: (url: string, init?: RequestInit) => Promise<Response>,
    baseUrl: string,
) => TReturn | Promise<TReturn>;

/**
 * Starts an HTTP server for the given Express app on a random port for the duration of the given
 * callback. The callback receives a `fetch` method that can be used to make requests to the test
 * server as well as the base URL of the test server.
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
 * Starts an Express app for testing purposes based on the given `routes`. Provides the URLs for the
 * routes as well as two fetch functions for routes and actions to the callback that executes the
 * actual testing logic.
 */
export function runTestApp<T extends RoutesComponent<any>>(
    routes: T,
    useApp: (
        href: HrefCreator<T>,
        fetch: (href: Href<any, any>) => Promise<Response>,
    ) => Promise<void>,
) {
    const app = express();
    app.set("query parser", (queryString: string) => queryString);
    app.use(text({ type: "application/x-www-form-urlencoded" }));
    app.use(createExpressMiddleware(<Router routes={routes} />, (error) => `fatal: ${error}`));

    return testApp(app, (fetch) =>
        useApp(getHrefs(routes), (href) =>
            fetch(
                href.url,
                href.method === "GET"
                    ? {}
                    : {
                          method: "POST",
                          body: href.body,
                          headers: { "content-type": "application/x-www-form-urlencoded" },
                      },
            ),
        ),
    );
}

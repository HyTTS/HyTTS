import { Redirect, useHttpStatusCode, useResponseHeader } from "@/http/http-context";
import { RenderOptions, createRenderCallback } from "@/http/render-callback";
import { createRouteFilter } from "@/routing/route-filters";
import { route } from "@/routing/routing";
import { Response } from "express";
import { createUrls } from "@/routing/urls";
import { createContext, useContext } from "@/jsx/context";

describe("renderer", () => {
    it("renders a working component in a document", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            document: ({ children }) => <html>{children}</html>,
        });

        await render(() => <>test</>, res, [], true);

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("<html>test</html>");
    });

    it("renders a working component without a document", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            document: ({ children }) => <html>{children}</html>,
        });

        await render(() => <>test</>, res, [], false);

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("test");
    });

    it("applies route filters", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);

        await render(
            () => <>test</>,
            res,
            [createRouteFilter(({ children }) => <>filter {children}</>)],
            false
        );

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("filter test");
    });

    it("handles redirects", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);
        const urls = createUrls({ "/a": route([], {}, () => <></>) });

        await render(() => <Redirect to={urls.route("/a/")} />, res, [], false);

        expect(res.content).toBe("");
        expect(res.url).toBe("/a/");
    });

    it("sends the correct HTTP status code", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);

        await render(
            () => {
                useHttpStatusCode(401);
                return <>test</>;
            },
            res,
            [],
            false
        );

        expect(res.statusCode).toBe(401);
        expect(res.content).toBe("test");
    });

    it("sends the correct HTTP headers", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);

        await render(
            () => {
                useResponseHeader("x-test", "test");
                return <>test</>;
            },
            res,
            [],
            false
        );

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("test");
        expect(res.headers).toEqual([["x-test", "test"]]);
    });

    it("handles errors during JSX rendering in a document", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            document: ({ children }) => <html>{children}</html>,
        });

        await render(
            () => {
                throw new Error("test");
            },
            res,
            [],
            true
        );

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("<html>non-fatal: Error: test</html>");
    });

    it("handles errors during JSX rendering without a document", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            document: ({ children }) => <html>{children}</html>,
        });

        await render(
            () => {
                throw new Error("test");
            },
            res,
            [],
            false
        );

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("non-fatal: Error: test");
    });

    it("handles errors during error view rendering", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            errorView: () => {
                throw new Error("error view error");
            },
        });

        await render(
            () => {
                throw new Error("test");
            },
            res,
            [],
            false
        );

        expect(res.statusCode).toBe(500);
        expect(res.content).toBe("fatal: Error: error view error");
    });

    it("handles errors in routes filter", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);

        await render(
            () => <></>,
            res,
            [
                createRouteFilter(() => {
                    throw new Error("test");
                }),
            ],
            false
        );

        expect(res.statusCode).toBe(500);
        expect(res.content).toBe("fatal: Error: test");
    });

    it("handles errors during fatal error view rendering", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            errorView: () => {
                throw new Error("error view error");
            },
            fatalErrorView: () => {
                throw new Error("fatal view error");
            },
        });

        expect(() =>
            render(
                () => {
                    throw new Error("test");
                },
                res,
                [],
                false
            )
        ).rejects.toThrowError();
    });

    it("makes the app context available to the handler", async () => {
        const res = createResponse();
        const render = createRenderCallback(renderOptions);

        await render(() => <>{useContext(appContext)}</>, res, [], false);

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("app-context");
    });

    it("makes the app context available to non-fatal error view", async () => {
        const res = createResponse();
        const render = createRenderCallback({
            ...renderOptions,
            errorView: ({ error }) => (
                <>
                    {useContext(appContext)} {`${error}`}
                </>
            ),
        });

        await render(
            () => {
                throw new Error("test");
            },
            res,
            [],
            false
        );

        expect(res.statusCode).toBe(200);
        expect(res.content).toBe("app-context Error: test");
    });
});

const appContext = createContext<string>();

const renderOptions: RenderOptions = {
    document: ({ children }) => <>{children}</>,
    appContext: ({ children }) => (
        <appContext.Provider value="app-context">{children}</appContext.Provider>
    ),
    errorView: ({ error }) => <>non-fatal: {`${error}`}</>,
    fatalErrorView: (error) => `fatal: ${error}`,
};

function createResponse() {
    const self = {
        statusCode: 200,
        status: (status: number) => (self.statusCode = status),
        sendStatus: (status: number) => (self.statusCode = status),
        content: "",
        send: (content: string) => (self.content = content),
        url: "",
        redirect: (url: string) => (self.url = url),
        headers: [] as [string, string][],
        setHeader: (name: string, value: string) => self.headers.push([name, value]),
    };

    return self as any as typeof self & Response;
}
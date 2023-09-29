import { createContext, useContext } from "@/jsx/context";
import { ErrorBoundary } from "@/jsx/error-boundary";
import { jsxs, renderToString } from "@/jsx/jsx-runtime";
import type { JsxElement, PropsWithChildren } from "@/jsx/jsx-types";

describe("jsx rendering", () => {
    describe("basics", () => {
        it("renders the empty string for a fragment", () => testJsx(<></>, ""));

        it("renders `null` as empty string", () => testJsx(null, ""));

        it("throws for unexpected JSX type", () => {
            expect(() => jsxs({} as any, {})).toThrow();
        });

        it("renders an empty `<div>`", async () => {
            await testJsx(<div></div>, "<div></div>");
            await testJsx(<div />, "<div></div>");
        });

        it("renders a void element like `<input>` correctly", async () => {
            await testJsx(<input />, "<input>");
            await testJsx(<input></input>, "<input>");
        });
    });

    describe("attributes", () => {
        it("does not render `null` or `undefined` attributes", async () => {
            await testJsx(<div id={undefined} />, "<div></div>");
            await testJsx(<div id={null!} />, "<div></div>");
        });

        it("renders `boolean` attributes", async () => {
            await testJsx(<input checked={true} />, '<input checked="true">');
            await testJsx(<input checked />, '<input checked="true">');
            await testJsx(<input checked={false} />, '<input checked="false">');
        });

        it("renders `number` attributes", async () => {
            await testJsx(<input step={1} />, '<input step="1">');
            await testJsx(<input step={1.4} />, '<input step="1.4">');
        });

        it("renders `string` attributes", async () => {
            await testJsx(<div id="id" />, '<div id="id"></div>');
            await testJsx(<div class="" />, '<div class=""></div>');
        });

        it("escapes `string` attributes only when necessary", async () => {
            await testJsx(<div id='"' />, '<div id="&quot;"></div>');
            await testJsx(<div id="&" />, '<div id="&amp;"></div>');
            await testJsx(<div id={'"&"'} />, '<div id="&quot;&amp;&quot;"></div>');
            await testJsx(<div id="'" />, '<div id="\'"></div>');
            await testJsx(<div id="\" />, '<div id="\\"></div>');
        });

        it("renders multiple attributes", () =>
            testJsx(
                <input step={1} checked id="id" class="test" />,
                '<input step="1" checked="true" id="id" class="test">',
            ));

        it("throws for unsupported attribute types", async () => {
            await expect(() => renderToString(<div id={(() => {}) as any} />)).rejects.toThrow();
            await expect(() => renderToString(<div id={{} as any} />)).rejects.toThrow();
        });
    });

    describe("event handlers", () => {
        it("ignores `null` and `undefined` values for event handlers", async () => {
            await testJsx(<div browser:onclick={undefined}></div>, "<div></div>");
            await testJsx(<div browser:onclick={null!}></div>, "<div></div>");
        });

        it.todo("synthesizes an id if none was explicitly specified");

        it.todo("renders the script to attach an event handler");

        it.todo("throws when an unsupported value is set for an event handler");
    });

    describe("children", () => {
        // eslint-disable-next-line jest/expect-expect
        it("should raise type error if children are provided but component has no `children` prop", () => {
            const C1 = () => null;
            const C2 = (props: PropsWithChildren) => <>{props.children}</>;

            // There should be an error for C1 if children are provided, but not for C2
            // @ts-expect-error
            <C1>hi</C1>;
            <C2>hi</C2>;
        });

        it("does not render children for void elements like `<input>`", () =>
            testJsx(<input>test</input>, "<input>"));

        it("does not render `null` or `undefined` children", async () => {
            await testJsx(<div>{null}</div>, "<div></div>");
            await testJsx(<div>{undefined}</div>, "<div></div>");
        });

        it("does not render `boolean` children", async () => {
            await testJsx(<div>{true}</div>, "<div></div>");
            await testJsx(<div>{false}</div>, "<div></div>");
        });

        it("renders `number` children", async () => {
            await testJsx(<div>{1}</div>, "<div>1</div>");
            await testJsx(<div>{3.14}</div>, "<div>3.14</div>");
        });

        it("renders `string` children", async () => {
            await testJsx(<div>1234 5678</div>, "<div>1234 5678</div>");
            await testJsx(<div>&lt; &quot;</div>, '<div>&lt; "</div>');
        });

        it("escapes `string` children when necessary", async () => {
            const s = "</div> \\ \"' &";
            await testJsx(<div>{s}</div>, "<div>&lt;/div> \\ \"' &amp;</div>");
            await testJsx(<div>{"<&<"}</div>, "<div>&lt;&amp;&lt;</div>");
            await testJsx(<div>{"a<b&c<"}</div>, "<div>a&lt;b&amp;c&lt;</div>");
        });

        it("renders `array` children", async () => {
            const a = [1, false, "a", "<>\"\\'"];
            await testJsx(<div>{a}</div>, "<div>1a&lt;>\"\\'</div>");
            await testJsx(<div>{[a, a]}</div>, "<div>1a&lt;>\"\\'1a&lt;>\"\\'</div>");
        });

        it("renders nested children", async () => {
            await testJsx(
                <div>
                    <p>
                        <span class="red">hello</span> test
                    </p>
                </div>,
                '<div><p><span class="red">hello</span> test</p></div>',
            );
        });

        it("renders mixed children", async () => {
            await testJsx(
                <div>
                    a &lt; 1 {"a"} {"<"} {1} {true} {["<"]} {[[[["<"], "<"], "<"], "&"]}
                </div>,
                "<div>a &lt; 1 a &lt; 1  &lt; &lt;&lt;&lt;&amp;</div>",
            );
        });

        it("throws for unsupported children types", async () => {
            await expect(() => renderToString(<div>{{} as any}</div>)).rejects.toThrow();
            await expect(() => renderToString(<div>{(() => {}) as any}</div>)).rejects.toThrow();
        });
    });

    describe("components", () => {
        it("renders single synchronous component", async () => {
            const C = () => <div>test</div>;
            await testJsx(<C />, "<div>test</div>");
        });

        it("renders nothing if synchronous component returns `null`", async () => {
            const C = () => null;
            await testJsx(<C />, "");
        });

        it("renders single asynchronous component", async () => {
            const C = async () => <div>{await sleep("test")}</div>;
            await testJsx(<C />, "<div>test</div>");
        });

        it("renders nothing if asynchronous component returns `null`", async () => {
            const C = async () => await sleep(null);
            await testJsx(<C />, "");
        });

        it("renders nested synchronous components", async () => {
            const C1 = (props: PropsWithChildren<{ id: string }>) => (
                <div id={props.id}>{props.children}</div>
            );
            const C2 = (props: { id: string }) => <C1 {...props}>test</C1>;
            await testJsx(<C2 id="c" />, '<div id="c">test</div>');
        });

        it("renders nested asynchronous components", async () => {
            const C1 = async (props: PropsWithChildren<{ id: string }>) => (
                <div id={props.id}>
                    {props.children} {await sleep("world")}
                </div>
            );
            const C2 = async (props: { id: string }) => <C1 {...props}>{await sleep("hello")}</C1>;
            await testJsx(<C2 id="c" />, '<div id="c">hello world</div>');
        });

        it("renders all asynchronous children concurrently", async () => {
            let count = 1;

            const C0 = () => <>0-{count} </>;

            const C1 = async () => {
                const c = await sleep(count, 10);
                count += 1;
                return <>1-{c} </>;
            };

            const C2 = async () => (
                <>
                    <C0 />
                    {new Array(3).fill(0).map(() => (
                        <C1 />
                    ))}
                    <C0 />
                </>
            );

            await testJsx(<C2 />, "0-1 1-1 1-1 1-1 0-1 ");
            expect(count).toBe(4);
        });

        it("renders components lazily", async () => {
            let count = 0;

            const C1 = () => {
                ++count;
                return <>{count}</>;
            };

            const C2 = (props: { a: JsxElement; b: JsxElement }) => <>{props.a}</>;

            await testJsx(<C2 a={<C1 />} b={<C1 />} />, "1");
            expect(count).toBe(1);
        });
    });

    describe("error boundary", () => {
        it("renders its synchronous children when no error is thrown", async () => {
            await testJsx(
                <ErrorBoundary ErrorView={() => <>error</>}>success</ErrorBoundary>,
                "success",
            );
        });

        it("renders its asynchronous children when no error is thrown", async () => {
            const C = async () => <>{await sleep("success")}</>;
            await testJsx(
                <ErrorBoundary ErrorView={() => <>error</>}>
                    <C />
                </ErrorBoundary>,
                "success",
            );
        });

        it("renders its error view when its synchronous children throw", async () => {
            const C = () => {
                throw new Error("test-error");
            };

            await testJsx(
                <ErrorBoundary ErrorView={(props) => <>{(props.error as Error).message}</>}>
                    <C />
                </ErrorBoundary>,
                "test-error",
            );
        });

        it("renders its error view when its asynchronous children throw", async () => {
            const C = async () => {
                await sleep("success", 10);
                throw new Error("test-error");
            };

            await testJsx(
                <ErrorBoundary ErrorView={(props) => <>{(props.error as Error).message}</>}>
                    <C />
                </ErrorBoundary>,
                "test-error",
            );
        });
    });

    describe("context", () => {
        const testContext = createContext<number>();

        it("throws when context is used even though it is not provided and it has no default value", async () => {
            const C = () => {
                useContext(testContext);
                return null;
            };

            await expect(() => renderToString(<C />)).rejects.toThrow();
        });

        it("returns configured default value when context is used even though it is not provided", async () => {
            const defaultContext = createContext({ default: { value: 1 } });
            const C = () => <>{useContext(defaultContext)}</>;

            await testJsx(<C />, "1");
        });

        it("returns the context's value when only one context exists in the ancestors", async () => {
            const C = () => <>{useContext(testContext)}</>;
            await testJsx(
                <testContext.Provider value={17}>
                    <C />
                </testContext.Provider>,
                "17",
            );
        });

        it("returns the value of the context set in the closest ancestor", async () => {
            const C1 = () => <>{useContext(testContext)}</>;
            const C2 = () => (
                <>
                    <C1 />{" "}
                    <testContext.Provider value={33}>
                        <C1 />
                    </testContext.Provider>{" "}
                    <C1 />
                </>
            );

            await testJsx(
                <testContext.Provider value={17}>
                    <C2 />
                </testContext.Provider>,
                "17 33 17",
            );
        });

        it("returns the value of the correct context if there are multiple ones", async () => {
            const otherContext = createContext<string>();
            const C = () => (
                <>
                    {useContext(testContext)} {useContext(otherContext)}
                </>
            );

            await testJsx(
                <testContext.Provider value={17}>
                    <otherContext.Provider value="test">
                        <C />
                    </otherContext.Provider>
                </testContext.Provider>,
                "17 test",
            );
        });

        it("shares the context between all asynchronous siblings", async () => {
            let count = 0;
            const otherContext = createContext<() => {}>();

            const C = async (props: { idx: number }) => {
                await sleep("", (2 - props.idx) * 10);
                useContext(otherContext)();
                return null;
            };

            await testJsx(
                <otherContext.Provider value={() => count++}>
                    {new Array(3).fill(0).map((_, idx) => (
                        <C idx={idx} />
                    ))}
                </otherContext.Provider>,
                "",
            );

            expect(count).toBe(3);
        });

        it("supports individual contexts for each asynchronous sibling", async () => {
            const C1 = async () => {
                await sleep("", 10);
                return <>{useContext(testContext)}-</>;
            };

            const C2 = async (props: { idx: number }) => {
                await sleep("", (2 - props.idx) * 10);
                return (
                    <testContext.Provider value={props.idx}>
                        <C1 />
                    </testContext.Provider>
                );
            };

            await testJsx(
                <testContext.Provider value={33}>
                    <C1 />
                    {new Array(3).fill(0).map((_, idx) => (
                        <C2 idx={idx} />
                    ))}
                    <C1 />
                </testContext.Provider>,
                "33-0-1-2-33-",
            );
        });
    });
});

async function testJsx(jsx: JsxElement, expected: string) {
    expect(await renderToString(jsx)).toBe(expected);
}

function sleep<T>(value: T, ms = 0) {
    return new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
}

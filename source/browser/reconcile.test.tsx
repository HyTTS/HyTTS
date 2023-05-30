/** @jest-environment jsdom */

import { reconcile } from "@/browser/reconcile.browser";

document.head.append(create("meta", { name: "hy-csp-nonce", content: "test" }));

describe("reconcile", () => {
    describe("basics", () => {
        it("reconciles text nodes", () => {
            const div1 = create("div");
            const text = document.createTextNode("abc");
            div1.append(text);

            const div2 = create("div");
            div2.append(document.createTextNode("def"));

            expect(reconcile(div1, div2)).toBe(div1);
            expect(text.textContent).toBe("def");
        });

        it("does not reconcile nodes of different types", () => {
            const div = create("div");
            const text = document.createTextNode("abc");
            div.append(text);

            const span = create("span");
            span.append(document.createTextNode("def"));

            expect(reconcile(div, span)).toBe(span);
            expect(span.textContent).toBe("def");
        });
    });

    describe("attributes", () => {
        describe("regular attributes", () => {
            it("adds new attributes", () => {
                const div1 = create("div");
                const div2 = create("div", { id: "def" });

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.id).toBe("def");
            });

            it("removes removed attributes", () => {
                const div1 = create("div", { id: "abc" });
                const div2 = create("div");

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.getAttribute("id")).toBe(null);
            });

            it("updates changed attributes", () => {
                const div1 = create("div", { id: "abc" });
                const div2 = create("div", { id: "def" });

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.id).toBe("def");
            });
        });

        describe("view-only attributes", () => {
            it("does not add view-only attributes", () => {
                const div1 = create("div");
                const div2 = create("div", { "data-hy-view-x": "abc" });

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.getAttribute("data-hy-view-x")).toBe(null);
            });

            it("does not remove view-only attributes", () => {
                const div1 = create("div", { "data-hy-view-x": "abc" });
                const div2 = create("div");

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.getAttribute("data-hy-view-x")).toBe("abc");
            });

            it("does not update view-only attributes", () => {
                const div1 = create("div", { "data-hy-view-x": "abc" });
                const div2 = create("div", { "data-hy-view-x": "def" });

                expect(reconcile(div1, div2)).toBe(div1);
                expect(div1.getAttribute("data-hy-view-x")).toBe("abc");
            });
        });

        describe("style attributes", () => {
            it("does not change height of textarea", () => {
                const textarea1 = create("textarea");
                textarea1.style.height = "500px";

                const textarea2 = create("textarea");
                textarea2.style.height = "600px";

                expect(reconcile(textarea1, textarea2)).toBe(textarea1);
                expect(textarea1.style.height).toBe("500px");
            });

            // TODO: Tests for style merging once implemented.
        });
    });

    describe("children", () => {
        describe("add children", () => {
            it("adds new children for empty element", () => {
                const div1 = create("div");
                const div2 = create("div");
                const p = create("p");
                const span = create("span");
                div2.append(p, span);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p, span]);
            });

            it("adds new children at the end", () => {
                const div1 = create("div");
                const a1 = create("a");
                div1.append(a1);

                const div2 = create("div");
                const a2 = create("a");
                const p = create("p");
                div2.append(a2, p);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, p]);
            });

            it("adds new children at the beginning", () => {
                const div1 = create("div");
                const a1 = create("a");
                div1.append(a1);

                const div2 = create("div");
                const a2 = create("a");
                const p = create("p");
                div2.append(p, a2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p, a2]); // a1 cannot be reconciled here
            });

            it("adds new children in the middle", () => {
                const div1 = create("div");
                const a1 = create("a");
                const p1 = create("p");
                div1.append(a1, p1);

                const div2 = create("div");
                const a2 = create("a");
                const p2 = create("p");
                const span = create("span");
                div2.append(a2, span, p2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, span, p2]); // p1 cannot be reconciled here
            });
        });

        describe("remove children", () => {
            it("removes all children for empty element", () => {
                const div1 = create("div");
                const div2 = create("div");
                const p = create("p");
                const span = create("span");
                div1.append(p, span);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([]);
            });

            it("removes children at the end", () => {
                const div1 = create("div");
                const a1 = create("a");
                const p = create("p");
                div1.append(a1, p);

                const div2 = create("div");
                const a2 = create("a");
                div2.append(a2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1]);
            });

            it("removes children at the beginning", () => {
                const div1 = create("div");
                const a1 = create("a");
                const p = create("p");
                div1.append(p, a1);

                const div2 = create("div");
                const a2 = create("a");
                div2.append(a2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a2]); // a1 cannot be reconciled here
            });

            it("removes children in the middle", () => {
                const div1 = create("div");
                const a1 = create("a");
                const p1 = create("p");
                const span = create("span");
                div1.append(a1, span, p1);

                const div2 = create("div");
                const a2 = create("a");
                const p2 = create("p");
                div2.append(a2, p2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, p2]); // p1 cannot be reconciled here
            });
        });

        describe("updates children", () => {
            it("updates attributes of children", () => {
                const div1 = create("div");
                const div2 = create("div");
                const p1 = create("p", { id: "abc" });
                const p2 = create("p", { id: "def" });

                div1.append(p1);
                div2.append(p2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p1]);
                expect(p1.getAttribute("id")).toBe("def");
            });

            it("updates children of children", () => {
                const div1 = create("div");
                const div2 = create("div");
                const p1 = create("p");
                const p2 = create("p");
                const span = create("span");

                p2.append(span);

                div1.append(p1);
                div2.append(p2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p1]);
                expect(getChildren(p1)).toEqual([span]);
            });

            it("replaces children of children", () => {
                const div1 = create("div");
                const div2 = create("div");
                const p1 = create("p");
                const p2 = create("p");
                const span = create("span");
                const a = create("a");

                p1.append(a);
                p2.append(span);

                div1.append(p1);
                div2.append(p2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p1]);
                expect(getChildren(p1)).toEqual([span]);
            });
        });

        describe("<script /> children", () => {
            it("updates the nonce of script children", () => {
                const div1 = create("div");
                const div2 = create("div");
                const script = create("script", { nonce: "abc" });

                div2.append(script);

                expect(reconcile(div1, div2)).toBe(div1);
                expect((getChildren(div1)[0] as HTMLScriptElement).nonce).toBe("test");
            });

            it("always creates a new script", () => {
                const div1 = create("div");
                const div2 = create("div");
                const script1 = create("script");
                const script2 = create("script");

                div1.append(script1);
                div2.append(script2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)[0]).not.toEqual(script1);
                expect(getChildren(div1)[0]).not.toEqual(script2);
            });
        });

        describe("keyed children", () => {
            it("prepends new keyed child while reconciling the rest", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                div1.append(a1, span1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const span2 = create("span", { id: "test", "data-hy-key": "k2" });
                const p = create("p", { "data-hy-key": "k3" });
                div2.append(p, a2, span2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p, a1, span1]);
                expect(span1.getAttribute("id")).toBe("test");
            });

            it("prepends unkeyed child at the beginning while reconciling the rest", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                div1.append(a1, span1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const span2 = create("span", { id: "test", "data-hy-key": "k2" });
                const p = create("p");
                div2.append(p, a2, span2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p, a1, span1]);
                expect(span1.getAttribute("id")).toBe("test");
            });

            it("insert new keyed child somewhere in-between while reconciling the rest", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                const b1 = create("b", { "data-hy-key": "k3" });
                div1.append(a1, span1, b1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const span2 = create("span", { id: "test", "data-hy-key": "k2" });
                const b2 = create("b", { "data-hy-key": "k3" });
                const p = create("p", { "data-hy-key": "k4" });
                div2.append(a2, span2, p, b2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, span1, p, b1]);
                expect(span1.getAttribute("id")).toBe("test");
            });

            it("removes keyed child somewhere in the middle while reconciling the rest", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                const b1 = create("b", { "data-hy-key": "k3" });
                const p = create("p", { "data-hy-key": "k4" });
                div1.append(a1, span1, p, b1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const span2 = create("span", { id: "test", "data-hy-key": "k2" });
                const b2 = create("b", { "data-hy-key": "k3" });
                div2.append(a2, span2, b2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, span1, b1]);
                expect(span1.getAttribute("id")).toBe("test");
            });

            it("reverses the order of all keyed children while reconciling the rest", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                const b1 = create("b", { "data-hy-key": "k3" });
                const p1 = create("p", { "data-hy-key": "k4" });
                div1.append(a1, span1, p1, b1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const span2 = create("span", { id: "test", "data-hy-key": "k2" });
                const b2 = create("b", { "data-hy-key": "k3" });
                const p2 = create("p", { "data-hy-key": "k4" });
                div2.append(b2, p2, span2, a2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([b1, p1, span1, a1]);
                expect(span1.getAttribute("id")).toBe("test");
            });

            it("does not reconcile different elements with same key", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                const b1 = create("b", { "data-hy-key": "k3" });
                div1.append(a1, span1, b1);

                const div2 = create("div");
                const a2 = create("a", { "data-hy-key": "k1" });
                const p2 = create("p", { "data-hy-key": "k2" });
                const b2 = create("b", { "data-hy-key": "k3" });
                div2.append(a2, p2, b2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([a1, p2, b1]);
            });

            it("does not reconcile different elements with same key while reordering", () => {
                const div1 = create("div");
                const a1 = create("a", { "data-hy-key": "k1" });
                const span1 = create("span", { "data-hy-key": "k2" });
                const b1 = create("b", { "data-hy-key": "k3" });
                div1.append(a1, span1, b1);

                const div2 = create("div", { "data-hy-key": "k" });
                const a2 = create("a", { "data-hy-key": "k1" });
                const p2 = create("p", { "data-hy-key": "k2" });
                const b2 = create("b", { "data-hy-key": "k3" });
                div2.append(p2, b2, a2);

                expect(reconcile(div1, div2)).toBe(div1);
                expect(getChildren(div1)).toEqual([p2, b1, a1]);
            });
        });
    });
});

function create(elementType: string, attributes: Record<string, string> = {}) {
    const element = document.createElement(elementType);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    return element;
}

function getChildren(element: Element) {
    const children: Node[] = [];

    for (let child = element.firstChild; child; child = child.nextSibling) {
        children.push(child);
    }

    return children;
}

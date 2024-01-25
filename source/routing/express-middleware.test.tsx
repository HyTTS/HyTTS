// import { z } from "zod";
// import { HttpHeader, HttpStatusCode, Redirect } from "@/http/http-context";
// import type { Href } from "@/routing/href";
// import { param, route, routes } from "@/routing/router";
// import { runTestApp } from "@/test-helpers";

// describe("express-middleware", () => {
//     it("provides access to the HTTP request for routing and param retrieval", () =>
//         runTestApp(
//             routes({
//                 "/:n": param(z.number(), (n) =>
//                     routes({
//                         "/:s": param(z.string(), (s) =>
//                             routes({
//                                 "GET /a": route(z.object({ b: z.number() }), ({ b }) => (
//                                     <>
//                                         GET {s()} {n()} {b}
//                                     </>
//                                 )),
//                                 "POST /b": route(z.object({ b: z.number() }), ({ b }) => (
//                                     <>
//                                         POST {s()} {n()} {b}
//                                     </>
//                                 )),
//                             }),
//                         ),
//                     }),
//                 ),
//             }),
//             async (href, fetch) => {
//                 const getResponse = await fetch(href("GET /:n/:s/a", { n: 1, s: "t" }, { b: 2 }));
//                 expect(await getResponse.text()).toBe("GET t 1 2");

//                 const postResponse = await fetch(href("POST /:n/:s/b", { n: 1, s: "t" }, { b: 2 }));
//                 expect(await postResponse.text()).toBe("POST t 1 2");
//             },
//         ));

//     it("allows modifying the HTTP response", () =>
//         runTestApp(
//             routes({
//                 "GET /statusCode": () => <HttpStatusCode code={201}>status: 201</HttpStatusCode>,
//                 "GET /headers": () => (
//                     <HttpHeader name="x-test" value="test">
//                         header
//                     </HttpHeader>
//                 ),
//                 "GET /redirect": () => (
//                     <Redirect href={{ url: "/statusCode", method: "GET" } as Href<"GET">} />
//                 ),
//             }),
//             async (href, fetch) => {
//                      const statusCodeResponse = await fetch(href("GET /statusCode"));
//                 expect(await statusCodeResponse.text()).toBe("status: 201");
//                 expect(statusCodeResponse.status).toBe(201);

//                 const headerResponse = await fetch(href("GET /headers"));
//                 expect(await headerResponse.text()).toBe("header");
//                 expect(headerResponse.headers.get("x-test")).toBe("test");

//                 const redirectResponse = await fetch(href("GET /redirect"));
//                 expect(await redirectResponse.text()).toBe("status: 201");
//                 expect(redirectResponse.status).toBe(201);
//             },
//         ));

//     it("invokes the error callback for fatal errors", () =>
//         runTestApp(
//             routes({
//                 "GET /error": () => {
//                     throw new Error("test");
//                 },
//             }),
//             async (href, fetch) => {
//                 const response = await fetch(href("GET /error"));
//                 expect(await response.text()).toBe("fatal-error-callback: Error: test");
//                 expect(response.status).toBe(500);
//             },
//         ));

// it("disallows requests with the wrong mime type", async () => {
//     const rs = routes({ "GET /p": <>test</> });
//     const href = createHref<typeof rs>();

//     await expect(() => render(rs, href("GET /p"), () => undefined)).rejects.toThrow(
//         "BadRequest",
//     );
// });

// });

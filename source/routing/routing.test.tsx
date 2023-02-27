import { z } from "zod";
import { action, route, RoutingDefinition } from "./routing";
import { createUrls } from "./urls";

describe("routing", () => {
    it("codegen", async () => {});
});

const pathParams = z.object({ p: z.number() });
const searchParams = z.object({ sort: z.string() });
const actionParams = z.object({ id: z.string() });

const routes = {
    "/no-params": route([], {}, () => <>test</>),
    "/search-params": route([], { searchParams }, () => <>test</>),
    "/path-params/:p": route([], { pathParams }, () => <>test</>),
    "/path-and-search-params": route([], { pathParams, searchParams }, () => <>test</>),
    "/action-no-params": action([], {}, () => <>test</>),
    "/action-action-params": action([], { actionParams }, () => <>test</>),
    "/action-path-params/:p": action([], { pathParams }, () => <>test</>),
    "/action-path-and-action-params": action([], { pathParams, actionParams }, () => <>test</>),
    "/lazy": async () => ({ default: subRoutes }),
    "/both": [
        route([], { searchParams }, () => <>test</>),
        action([], { actionParams }, () => <>test</>),
    ],
    "/test/": {
        "/other": route([], {}, () => null),
    },
} satisfies RoutingDefinition;

const subRoutes = {
    "/sub-route": route([], { pathParams }, () => <>nested route</>),
    "/action": action([], { pathParams }, () => <>nested action</>),
} satisfies RoutingDefinition;

export const urls = createUrls(routes);

urls.route("/no-params/");
urls.route("/path-params/:p/", { p: 1 });
urls.route("/search-params/", { sort: "a" });
urls.route("/path-and-search-params/", { p: 1 }, { sort: "a" });
urls.route("/lazy/sub-route/", { p: 1 });
urls.route("/both/", { sort: "a" });
urls.route("/test/other/");

urls.action("/action-no-params/");
urls.action("/action-path-params/:p/", { p: 11 });
urls.action("/action-action-params/", { id: "a" });
urls.action("/action-path-and-action-params/", { p: 1 }, { id: "a" });
urls.action("/lazy/action/", { p: 1 });
urls.action("/both/", { id: "1" });

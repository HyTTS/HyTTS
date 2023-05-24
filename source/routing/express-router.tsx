import {
    type Action,
    type ObjectSchema,
    type ParamsSchema,
    type Route,
    type RoutingDefinition,
    isAction,
    isRoute,
} from "@/routing/routing";
import { joinPaths } from "@/routing/urls";
import { unpack } from "@/serialization/data-packing";
import { parseUrlSearchParams } from "@/serialization/url-params";
import { Router } from "express";
import type { RenderCallback } from "@/http/render-callback";
import { getRequestBody, getSearchParams } from "@/http/http-context";

/**
 * Creates an Express-based router for the given `routingDefinition`. The returned `Router` can then
 * be hooked into the Express middleware pipeline using `expressApp.use`.
 */
export function toExpressRouter(
    routingDefinition: RoutingDefinition,
    render: RenderCallback
): Router {
    const expressRouter = Router({ mergeParams: true });
    visit(routingDefinition, "");

    function visit(routingDefinition: RoutingDefinition, pathPrefix: string) {
        for (const path in routingDefinition) {
            const def = routingDefinition[path];

            if (Array.isArray(def)) {
                registerRoute(path, def[0]);
                registerAction(path, def[1]);
            } else if (typeof def === "function") {
                let nestedRouter: Router | undefined = undefined;
                expressRouter.use(joinPaths(pathPrefix, path), async (req, res, next) => {
                    if (!nestedRouter) {
                        nestedRouter = toExpressRouter((await def()).default, render);
                    }
                    nestedRouter(req, res, next);
                });
            } else if (typeof def === "object") {
                if (isRoute(def)) {
                    registerRoute(path, def);
                } else if (isAction(def)) {
                    registerAction(path, def);
                } else {
                    visit(def, joinPaths(pathPrefix, path));
                }
            } else {
                throw new Error(`Unknown routing definition '${routingDefinition}'.`);
            }
        }

        function registerRoute(
            path: string,
            {
                routeFilters,
                handler: Handler,
                pathParams,
                searchParams,
                options,
            }: Route<ObjectSchema, ObjectSchema>
        ) {
            expressRouter.get(joinPaths(pathPrefix, path), (req, res) =>
                render(
                    async () => (
                        <Handler
                            pathParams={unpack(await getSchema(pathParams), req.params)}
                            searchParams={parseUrlSearchParams(
                                await getSchema(searchParams),
                                getSearchParams(req)
                            )}
                        />
                    ),
                    res,
                    routeFilters,
                    !options.noDocument
                )
            );
        }

        function registerAction(
            path: string,
            {
                actionFilters,
                handler: Handler,
                pathParams,
                actionParams,
                options,
            }: Action<ObjectSchema, ObjectSchema>
        ) {
            expressRouter.post(joinPaths(pathPrefix, path), (req, res) =>
                render(
                    async () => (
                        <Handler
                            pathParams={unpack(await getSchema(pathParams), req.params)}
                            actionParams={parseUrlSearchParams(
                                await getSchema(actionParams),
                                getRequestBody(req)
                            )}
                        />
                    ),
                    res,
                    actionFilters,
                    !options.noDocument
                )
            );
        }
    }

    return expressRouter;
}

async function getSchema(
    schemaOrFactory: ParamsSchema<ObjectSchema>
): Promise<ObjectSchema | undefined> {
    return typeof schemaOrFactory === "function" ? await schemaOrFactory() : schemaOrFactory;
}

import { type externalApi, initialize } from "$/main.browser";

initialize();

declare global {
    const hy: typeof externalApi;
}

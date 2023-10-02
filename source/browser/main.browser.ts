import { updateFrame } from "$/frame.browser";
import { interceptClicks, interceptHistoryChanges, navigateTo } from "$/navigation.browser";

interceptClicks();
interceptHistoryChanges();

const externalApi = {
    navigateTo,
    updateFrame,
} as const;

declare global {
    const hy: typeof externalApi;
}

(window as any).hy = externalApi;

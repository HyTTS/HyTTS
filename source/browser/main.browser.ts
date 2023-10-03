import { addEventListener } from "$/events.browser";
import { updateFrame } from "$/frame.browser";
import { interceptClicks, interceptHistoryChanges, navigateTo } from "$/navigation.browser";

interceptClicks();
interceptHistoryChanges();

const externalApi = {
    navigateTo,
    updateFrame,
    addEventListener,
} as const;

declare global {
    const hy: typeof externalApi;
}

(window as any).hy = externalApi;

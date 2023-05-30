import { interceptClicks, interceptHistoryChanges } from "@/browser/navigation.browser";
import {
    executeAction,
    loadRoute,
    navigateToAction,
    navigateToRoute,
    updateFrame,
} from "@/browser/frame.browser";

interceptClicks();
interceptHistoryChanges();

const externalApi = {
    executeAction,
    loadRoute,
    navigateToAction,
    navigateToRoute,
    updateFrame,
} as const;

declare global {
    const hy: typeof externalApi;
}

(window as any).hy = externalApi;

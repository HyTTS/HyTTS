import { addEventListener } from "$/events.browser";
import { interceptForms, submitForm } from "$/form.browser";
import { updateFrame } from "$/frame.browser";
import { interceptClicks, interceptHistoryChanges, navigateTo } from "$/navigation.browser";

interceptClicks();
interceptForms();
interceptHistoryChanges();

const externalApi = {
    navigateTo,
    updateFrame,
    addEventListener,
    submitForm,
} as const;

declare global {
    const hy: typeof externalApi;
}

(window as any).hy = externalApi;

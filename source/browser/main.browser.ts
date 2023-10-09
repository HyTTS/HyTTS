import { addEventListener } from "$/events.browser";
import { interceptForms, submitForm } from "$/form.browser";
import { updateFrame } from "$/frame.browser";
import { interceptClicks, interceptHistoryChanges, navigateTo } from "$/navigation.browser";

export function initialize() {
    (window as any).hy = externalApi;

    interceptClicks();
    interceptForms();
    interceptHistoryChanges();
}

export const externalApi = {
    navigateTo,
    updateFrame,
    addEventListener,
    submitForm,
} as const;

const eventRemovalSymbol = Symbol();

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Element {
        [eventRemovalSymbol]?: AbortController[];
    }
}

export function addEventListener(
    elementId: string,
    eventName: string,
    eventListener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
) {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Unable to find element with id '${elementId}'.`);
    }

    const abortController = new AbortController();
    const eventOptions: AddEventListenerOptions =
        typeof options === "boolean"
            ? { capture: options, signal: abortController.signal }
            : { ...options, signal: abortController.signal };

    if (typeof options === "object" && options.signal) {
        options.signal.addEventListener("abort", () => abortController.abort());
    }

    element.addEventListener(eventName, eventListener, eventOptions);
    element[eventRemovalSymbol] ??= [];
    element[eventRemovalSymbol].push(abortController);
}

export function removeEventListeners(element: Element) {
    element[eventRemovalSymbol]?.forEach((abortController) => abortController.abort());
}

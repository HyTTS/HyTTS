import {
    extractFrameFromResponse,
    fetchFrame,
    type FrameId,
    rootFrameId,
    updateFrame,
} from "$/frame.browser";

export type SubmissionOptions = {
    /** The URL that should be submitted to. */
    readonly href: string;
    /** The form element that should be submitted. */
    readonly form: HTMLFormElement;
    /** URL-encoded, optional data that is sent in addition to the form data. */
    readonly additionalData?: string;
    /**
     * Selects the frame that should be updated with the request's response. If none is given,
     * updates the form's nearest ancestor frame.
     */
    readonly frameId?: FrameId;
    /**
     * If `true`, updates the browser's history stack after successful form submission with either
     * `href` or, if the server redirects, the redirect URL. Defaults to `true` for form submissions
     * targeting the root frame.
     */
    readonly updateHistory?: boolean;
};

export async function submitForm({
    href,
    form,
    additionalData,
    frameId,
    updateHistory,
}: SubmissionOptions): Promise<void> {
    let response: Response = undefined!;
    let submissionSuccessful = false;
    const formFrameId = getFormFrameId(form);

    await updateFrame(formFrameId, async (frame, signal) => {
        response = await fetchFrame(frame, href, {
            method: "POST",
            body: createFormRequestBody(form, additionalData),
            signal,
        });

        // If the server returned an error, update the form's frame with all of the validation errors
        // found by the server. Otherwise, don't update the form's frame but the selected target frame
        // down below. Note that we explicitly do this update outside of this `updateFrame` call to
        // prevent a deadlock, as the inner `updateFrame` would wait for the outer `updateFrame` to
        // complete when canceling frame child updates, but the outer `updateFrame` would also wait
        // for the inner `updateFrame`, hence a deadlock.
        submissionSuccessful = response.status < 300;
        return submissionSuccessful
            ? undefined
            : await extractFrameFromResponse(frame, response, signal);
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (submissionSuccessful) {
        // We always assume the root frame to exist in the DOM. Otherwise, `updateFrame` will throw an
        // easy-to-understand error for us.
        frameId ??=
            document
                .getElementById(formFrameId)
                ?.parentElement?.closest("hy-frame")
                ?.getAttribute("id") ?? rootFrameId;

        await updateFrame(frameId, (frame, signal) =>
            extractFrameFromResponse(frame, response, signal),
        );

        // Only update the history if so configured. If nothing is specified, update the history by default
        // for the root frame, but not for all other frames.
        if (updateHistory ?? frameId === rootFrameId) {
            history.pushState(null, "", response.redirected ? response.url : href);
        }
    }
}

export type ValidationOptions = {
    /** The URL that should be used for validation. */
    readonly href: string;
    /** The form element that should be validated. */
    readonly form: HTMLFormElement;
};

/** Validates the form without submitting it. */
export async function validateForm({ href, form }: ValidationOptions): Promise<void> {
    await updateFrame(getFormFrameId(form), async (frame, signal) =>
        extractFrameFromResponse(
            frame,
            await fetchFrame(frame, href, {
                method: "POST",
                body: createFormRequestBody(form),
                signal,
                headers: { "x-hy-validate-form": "true" },
            }),
            signal,
        ),
    );
}

/** Specifies a set of attributes that control the behavior of a form. */
export type FormOptions = {
    /**
     * The id of the frame that should be updated with the HTML returned by the server. Specified on
     * the form element with the `data-hy-frame` attribute.
     */
    readonly hyFrame?: FrameId;
    /** The URL of the route that should be used to validate the form without submitting it. */
    readonly hyValidate?: string;
};

/**
 * Intercepts all form submission and change events, checking whether the event target is a form
 * that should be handled by HyTTS. If so, triggers the appropriate form submission or validation.
 * The exact behavior must be specified using `data-*` attributes as described by the `FormOptions`
 * of the target's `dataset` property.
 */
export function interceptForms() {
    document.addEventListener("submit", (e: SubmitEvent) => {
        const [form, options] = getForm(e);

        if (!form || !options) {
            return;
        }

        e.preventDefault();
        void submitForm({
            href: form.action,
            form,
            frameId: options.hyFrame,
        });
    });

    document.addEventListener("change", (e: Event) => {
        const [form, options] = getForm(e);

        if (!form || !options?.hyValidate) {
            return;
        }

        e.preventDefault();
        void validateForm({
            href: options.hyValidate,
            form,
        });
    });

    function getForm(e: Event): [HTMLFormElement | undefined, FormOptions | undefined] {
        // The events we're interested in are either raised on the form or on one of its inputs, in
        // which case we have to retrieve the form the input belongs to.
        const form =
            e.target instanceof HTMLFormElement
                ? e.target
                : e.target && "form" in e.target && e.target.form instanceof HTMLFormElement
                ? e.target.form
                : undefined;

        if (e.defaultPrevented || !form) {
            return [undefined, undefined];
        }

        const options = form.dataset as FormOptions | undefined;

        if (form.method.toUpperCase() !== "POST" || !form.action || !options?.hyValidate) {
            return [undefined, undefined];
        }

        return [form, options];
    }
}

/**
 * Assembles the body of a form request, submitting the form data in a special `$form` variable
 * understood by the server. Also supports sending additional route data in the body.
 */
export function createFormRequestBody(form: HTMLFormElement, additionalData?: string) {
    const params = new URLSearchParams();

    for (const [name, value] of new FormData(form)) {
        params.append("$form." + name, value as string);
    }

    return params.toString() + (additionalData ? `&${additionalData}` : "");
}

function getFormFrameId(form: HTMLFormElement) {
    return `${form.getAttribute("id")}@frame`;
}

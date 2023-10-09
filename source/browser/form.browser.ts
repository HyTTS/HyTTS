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
    const formData = new FormData(form);

    await updateFrame(formFrameId, async (frame, signal) => {
        response = await fetchFrame(frame, href, {
            method: "POST",
            body: createFormRequestBody(formData, additionalData),
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
    } else {
        forceServerValues(form, formData);
        forEachFormField(form, markAsTouched);
        forEachFormField(form, updateValidationErrorVisibility);
    }
}

export type UpdateFormOptions = {
    /** The URL that should be used to render the updated form. */
    readonly href: string;
    /** The form element that should be updated. */
    readonly form: HTMLFormElement;
    /**
     * Marks form fields as touched after the form update is completed.
     *
     * - All: Affects all fields contained in the form _after_ the update.
     * - Existing: Affects all fields contained in the form _before_ the update.
     * - None (default): Does not mark any fields as touched.
     */
    readonly markFieldsAsTouched?: "none" | "all" | "existing";
    /** URL-encoded additional route parameters that should be sent along with the form. */
    readonly additionalData?: string;
};

/**
 * Sends the current form data to the server, updating the current DOM with the new form state
 * returned by the server. Returns a value indicating whether the form has any validation errors
 * after the update.
 */
export async function updateForm({
    href,
    form,
    additionalData,
    markFieldsAsTouched,
}: UpdateFormOptions): Promise<"valid" | "invalid"> {
    let validationState: "valid" | "invalid" = undefined!;
    const formData = new FormData(form);

    await updateFrame(getFormFrameId(form), async (frame, signal) => {
        const response = await fetchFrame(frame, href, {
            method: "POST",
            body: createFormRequestBody(formData, additionalData),
            signal,
            headers: { "x-hy-validate-form": "true" },
        });

        validationState = response.status < 300 ? "valid" : "invalid";
        const newFrame = await extractFrameFromResponse(frame, response, signal);

        if (markFieldsAsTouched === "existing") {
            forEachFormField(form, markAsTouched);
        }

        return newFrame;
    });

    forceServerValues(form, formData);

    if (markFieldsAsTouched === "all") {
        forEachFormField(form, markAsTouched);
    }

    forEachFormField(form, updateValidationErrorVisibility);
    return validationState;
}

/** Specifies a set of attributes that control the behavior of a form. */
export type FormOptions = {
    /**
     * The id of the frame that should be updated with the HTML returned by the server. Specified on
     * the form element with the `data-hy-frame` attribute.
     */
    readonly hyFrame?: FrameId;
    /**
     * The URL of the route that should be used to validate the form without submitting it.
     * Specified on the form element with the `data-hy-validate` attribute.
     */
    readonly hyValidate?: string;
};

/**
 * Intercepts all form submissions, and form field input and change events, checking whether the
 * event should be handled by HyTTS. If so, triggers the appropriate form submission or validation
 * and updates form field state as necessary.
 */
export function interceptForms() {
    document.addEventListener("submit", (e: SubmitEvent) => {
        if (!e.defaultPrevented && shouldHandleForm(e.target)) {
            const options = e.target.dataset as FormOptions | undefined;
            if (!options) {
                return;
            }

            e.preventDefault();
            void submitForm({ href: e.target.action, form: e.target, frameId: options.hyFrame });
        }
    });

    document.addEventListener("change", (e: Event) => {
        if (!e.defaultPrevented && isFormField(e.target) && shouldHandleForm(e.target.form)) {
            const options = e.target.form.dataset as FormOptions | undefined;
            if (!options?.hyValidate) {
                return;
            }

            e.preventDefault();
            void updateForm({ href: options.hyValidate, form: e.target.form });
        }
    });

    document.addEventListener("focusin", (e: Event) => {
        if (!e.defaultPrevented && isFormField(e.target) && shouldHandleForm(e.target.form)) {
            // Store the original server value so that we can later check whether we should show
            // a (potentially as-of-now hidden) validation error if the element loses focus without
            // any modifications. This happens, for instance, when the user clicks away
            // immediately or she types something and undoes all changes. In these cases, the
            // change event isn't fired. Which is good, because it avoids an unnecessary server
            // roundtrip, but we still want to show the validation error again, if there is one.
            storeValueOnFocusIn(e.target);
        }
    });

    document.addEventListener("focusout", (e: Event) => {
        if (!e.defaultPrevented && isFormField(e.target) && shouldHandleForm(e.target.form)) {
            // As soon as the field loses the focus, mark is as touched so that validation errors are shown.
            markAsTouched(e.target);

            // If the value hasn't changed, the user either didn't type anything or she undid all of
            // her changes before leaving the element. In that case, ensure that the validation error,
            // if there was one, is shown again. This validation error was hidden when the user started
            // typing.
            if (wasChangedWhileFocused(e.target)) {
                // We have to force the update because `document.activeElement` is still the current
                // field at this point (at least in some browsers).
                updateValidationErrorVisibility(e.target, true);
            }
        }
    });

    document.addEventListener("input", (e) => {
        if (!e.defaultPrevented && isFormField(e.target) && shouldHandleForm(e.target.form)) {
            // When a form field changes, we immediately hide any validation errors, which feels better
            // than continuing to show the error while the user is typing and the input is potentially
            // valid already. Once the element loses focus and the change event is raised, the server
            // tells us whether the element is actually valid, and if not, the validation error will be
            // shown again. If no change event is raised, the focusout event handler above takes care
            // of showing the current validation error again.
            showValidationError(e.target, false);
        }
    });

    function shouldHandleForm(element: EventTarget | null): element is HTMLFormElement {
        return (
            !!element &&
            element instanceof HTMLFormElement &&
            element.method.toUpperCase() === "POST" &&
            !!element.action
        );
    }
}

/**
 * Assembles the body of a form request, submitting the form data in a special `$form` variable
 * understood by the server. Also supports sending additional route data in the body.
 */
function createFormRequestBody(formData: FormData, additionalData?: string) {
    const params = new URLSearchParams();

    for (const [name, value] of formData) {
        params.append("$form." + name, value as string);
    }

    return params.toString() + (additionalData ? `&${additionalData}` : "");
}

/** Each form is wrapped in a frame with a well-known id generated from the form's id. */
function getFormFrameId(form: HTMLFormElement) {
    return `${form.getAttribute("id")}@frame`;
}

/**
 * Checks whether the server sent a different value for a form field than what was sent to it when
 * the form update operation was started. If so, the server changed value, and this updated value is
 * reflected in the DOM.
 *
 * Thus, the server always "wins", even for conflicting concurrent modifications. This is maybe not
 * the best user experience, but it's an unlikely situation and if the client value took precedence,
 * the validation error rendered by the server would potentially be inconsistent should it be shown
 * again, e.g., when the user undoes her modifications and then un-focuses the field element.
 *
 * @param form The current form element in the DOM after the update has been reconciled.
 * @param sentFieldValues The field values as they were stored in the DOM when the form update was
 *   started.
 */
function forceServerValues(form: HTMLFormElement, sentFieldValues: FormData): void {
    forEachFormField(form, (field) => {
        if (field instanceof HTMLSelectElement) {
            const serverValue =
                field.querySelector<HTMLOptionElement>("option[selected]")?.value ?? "";
            const wasChangedByServer = sentFieldValues.get(field.name) !== serverValue;

            if (wasChangedByServer) {
                field.value = serverValue;
            }
        } else {
            const wasChangedByServer = sentFieldValues.get(field.name) !== field.defaultValue;
            if (wasChangedByServer) {
                field.value = field.defaultValue;
            }
        }
    });
}

/**
 * Updates the validation error visibility of the form field. Validation errors are shown if and
 * only if the server marked the element as invalid and the element has already been touched by the
 * user. Ignores the active element unless `updateActiveElement` is `true`.
 */
function updateValidationErrorVisibility(field: FormField, updateActiveElement = false): void {
    const showError = !isValid(field) && isTouched(field);
    if (updateActiveElement || document.activeElement !== field) {
        showValidationError(field, showError);
    }
}

/** Shows or hides the form field's validation error. */
function showValidationError(field: FormField, showError: boolean): void {
    // This string is never shown because interactive form validation is disabled for the parent form..
    const errorShown = "invalid";
    // The empty string tells the browser that this element is in fact valid.
    const errorHidden = "";

    field.setCustomValidity(showError ? errorShown : errorHidden);
}

/**
 * Checks whether the form field has any validation errors. This is property is managed by the
 * server and changed to reflect the current validation state during reconciliation.
 */
function isValid(field: FormField): boolean {
    return field.getAttribute("aria-invalid") !== "true";
}

/** Marks the form field as touched, meaning that validation errors are shown from now on. */
function markAsTouched(field: FormField): void {
    field.setAttribute("data-hy-view-touched", "true");
}

/**
 * Checks whether the form field has already been touched by the user, either explicitly by
 * interacting with the element, or implicitly by submitting the form. This is client-only state
 * that "survives" reconciliation.
 */
function isTouched(field: FormField): boolean {
    return field.getAttribute("data-hy-view-touched") === "true";
}

/**
 * Stores the field's value rendered by the server until the next form update. The attribute the
 * server value is stored in is removed during reconciliation.
 */
function storeValueOnFocusIn(field: FormField): void {
    field.setAttribute("data-hy-view-focusin-value", field.value);
}

/** Checks whether the field still has the value that it had when the field was last focused. */
function wasChangedWhileFocused(field: FormField): boolean {
    return field.getAttribute("data-hy-view-focusin-value") === field.value;
}

function forEachFormField(form: HTMLFormElement, action: (field: FormField) => void) {
    for (const e of form.elements) {
        if (isFormField(e)) {
            action(e);
        }
    }
}

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isFormField(element: unknown): element is FormField {
    return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
    );
}

import get from "lodash/get";
import { z, type ZodType, type ZodTypeDef } from "zod";
import { createFrame, type FrameMetadata } from "@/dom/frame";
import { collectPath, type PropertySelector } from "@/form/property-path";
import { HttpStatusCode, useHttpContext, useRequestHeader } from "@/http/http-context";
import type { JSX, JsxComponent, JsxElement } from "@/jsx/jsx-types";
import type { FormValues, Href } from "@/routing/href";
import type { FormElement } from "@/routing/router";
import { toPartialSchema, type ToPartialSchema } from "@/serialization/to-partial-schema";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type SomeFormSchema = ZodType<Record<string, unknown>, ZodTypeDef, any>;

export type FormProps<FormState extends Record<string, unknown>> = Omit<
    JSX.FormHTMLAttributes<HTMLFormElement>,
    "id" | "name" | "method" | "action" | "novalidate"
> & {
    /**
     * A reference to the POST route that handles the form's submission. Used regardless of whether
     * the form is submitted explicitly by clicking a submit button or implicitly, e.g., by pressing
     * the Enter key inside a text input field.
     */
    readonly onSubmit: Href<"POST", FormValues<FormState>>;
    /**
     * A reference to the POST route that validates the form after every change. If `undefined`,
     * uses the `onSubmit` route for validation.
     */
    readonly onValidate?: Href<"POST", FormValues<FormState>>;
    /**
     * The frame to update once the form was submitted successfully. If none is given, updates the
     * form's nearest ancestor frame.
     */
    readonly target?: FrameMetadata;
};

export type FormButtonProps<FormState extends Record<string, unknown>> = Omit<
    JSX.HTMLAttributes<HTMLButtonElement>,
    "type"
> & {
    /** The route the form data should be submitted to when this button is clicked. */
    readonly href: Href<"POST", FormValues<FormState>>;
    /**
     * Marks form fields as touched after the form update is completed.
     *
     * - All: Affects all fields contained in the form _after_ the update.
     * - Existing: Affects all fields contained in the form _before_ the update.
     * - None (default): Does not mark any fields as touched.
     */
    readonly markFieldsAsTouched?: "none" | "all" | "existing";
    /** If `true`, the form fields remain enabled while the form update is in progress. */
    readonly keepFieldsEnabled?: boolean;
};

export type FormContext<FormStateSchema extends SomeFormSchema> = ReturnType<
    typeof createFormContext<FormStateSchema>
>;

export type Form<FormStateSchema extends SomeFormSchema> = ReturnType<
    typeof createForm<FormStateSchema>
>;

export type FormProperty<TValue> = {
    readonly name: string;
    readonly value: TValue;
    readonly hasError: boolean;
    readonly error: string | undefined;
};

function createFormContext<FormStateSchema extends SomeFormSchema>(
    schema: FormStateSchema,
    frameId: string,
    formId: string,
    formState: unknown,
) {
    type InputFormState = z.input<FormStateSchema>;
    type PartialFormState = z.output<ToPartialSchema<FormStateSchema>>;

    // At this point, we can be sure that the given form state structurally matches the Zod schema.
    // So we can use the Zod schema to validate the user's input, subsequently showing all validation
    // errors when rerendering the form.
    const parseResult = schema.safeParse(formState);
    const [state, errors] = parseResult.success
        ? [parseResult.data, {}]
        : [
              formState,
              Object.fromEntries(
                  parseResult.error.issues.map((issue) => [issue.path.join("."), issue.message]),
              ),
          ];

    const context = <TValue,>(
        propertyPath: PropertySelector<PartialFormState, TValue>,
    ): FormProperty<TValue> => {
        const path = collectPath(propertyPath);
        const value = get(state, path) as TValue;
        const error = get(errors, path) as string | undefined;
        return { value, error, name: path, hasError: !!error };
    };

    context.formId = formId;
    context.frameId = frameId;

    context.Form = ({
        target,
        onSubmit,
        onValidate,
        ...props
    }: FormProps<InputFormState>): JsxElement => {
        return (
            <form
                {...props}
                id={formId}
                name={formId}
                method="post"
                action={onSubmit.url}
                data-hy-validate={onValidate?.url ?? onSubmit.url}
                data-hy-frame={target?.frameId}
                novalidate
            />
        );
    };

    context.Button = ({
        href,
        markFieldsAsTouched,
        keepFieldsEnabled,
        ...props
    }: FormButtonProps<InputFormState>): JsxElement => {
        return (
            <button
                {...props}
                type="button"
                data-hy-method={href.method}
                data-hy-frame={frameId}
                data-hy-url={href.url}
                data-hy-body={href.body}
                data-hy-form={formId}
                data-hy-mark-as-touched={markFieldsAsTouched}
            />
        );
    };

    return context;
}

export function createForm<FormStateSchema extends SomeFormSchema>(
    formId: string,
    formStateSchema: FormStateSchema | (() => FormStateSchema | Promise<FormStateSchema>),
    FormContent: JsxComponent<{ form: FormContext<FormStateSchema> }>,
) {
    type InputFormState = z.input<FormStateSchema>;
    type PartialFormState = z.output<ToPartialSchema<FormStateSchema>>;

    if (formId.includes("@")) {
        throw new Error("You cannot use '@' as part of a form id.");
    }

    const frameId = `${formId}@frame`;
    const Frame = createFrame(frameId);
    const getSchema = async () =>
        typeof formStateSchema === "function" ? await formStateSchema() : formStateSchema;

    const Form = async ({ formState }: { formState: PartialFormState }) => {
        return (
            <Frame>
                <FormContent
                    form={createFormContext<FormStateSchema>(
                        await getSchema(),
                        frameId,
                        formId,
                        formState,
                    )}
                />
            </Frame>
        );
    };

    async function getPartialFormState(): Promise<PartialFormState> {
        const schema = await getSchema();
        const { method, searchParams, requestBody } = useHttpContext();
        const paramsSource = method === "GET" ? searchParams : requestBody;

        const { $form } = parseUrlSearchParams(
            z.object({ $form: toPartialSchema(schema) }),
            paramsSource,
        )!;

        return $form!;
    }

    Form.update = (
        updateState: (state: PartialFormState) => PartialFormState | Promise<PartialFormState>,
    ): FormElement<InputFormState> => {
        return (<Update />) as any;

        async function Update() {
            const updatedState = await updateState(await getPartialFormState());
            const isValid = (await getSchema()).safeParse(updatedState).success;

            return (
                <HttpStatusCode code={isValid ? 200 : 422}>
                    <Form formState={updatedState} />
                </HttpStatusCode>
            );
        }
    };

    Form.submit = (
        /**
         * The action that is carried out if the form passed validation, like storing the data in
         * some database, sending an e-mail, etc.
         */
        action: JsxComponent<{ formState: z.output<FormStateSchema> }>,
    ): FormElement<InputFormState> => {
        return (<Submit />) as any;

        async function Submit() {
            const formState = await getPartialFormState();
            const result = (await getSchema()).safeParse(formState);

            if (result.success) {
                // The submit route is often used for validation-only purposes as well, because in
                // some (or probably most?) cases, a form validation is just a form submission without
                // the side effect after successful validation. This is purely a DX optimization, saving
                // the developer from registering two routes (validation and submission) per form when
                // one suffices in most cases.
                // The browser tells us whether this is a validation-only request via an HTTP header. So
                // if this header is sent, we don't execute the submit action the form.
                const validationOnly = !!useRequestHeader("x-hy-validate-form");
                return validationOnly ? (
                    <Form formState={formState} />
                ) : (
                    action({ formState: result.data })
                );
            } else {
                return (
                    <HttpStatusCode code={422}>
                        <Form formState={formState} />
                    </HttpStatusCode>
                );
            }
        }
    };

    return Form;
}

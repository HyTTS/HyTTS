import get from "lodash/get";
import { z, type ZodType, type ZodTypeDef } from "zod";
import { createFrame, type FrameMetadata } from "@/dom/frame";
import { collectPath, type PropertySelector } from "@/form/property-path";
import { useHttpContext, useHttpStatusCode, useRequestHeader } from "@/http/http-context";
import { createContext, useContext } from "@/jsx/context";
import type { JSX, JsxComponent } from "@/jsx/jsx-types";
import type { FormValues, Href } from "@/routing/href";
import type { FormElement } from "@/routing/router";
import { toPartialSchema, type ToPartialSchema } from "@/serialization/to-partial-schema";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type SomeFormSchema = ZodType<Record<string, unknown>, ZodTypeDef, any>;

export type FormProps<FormState extends Record<string, unknown>> = Omit<
    JSX.FormHTMLAttributes<HTMLFormElement>,
    "id" | "method" | "action"
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

export function Form<FormStateSchema extends SomeFormSchema>({
    target,
    onSubmit,
    onValidate,
    ...props
}: FormProps<z.input<FormStateSchema>>) {
    const { formId } = useContext(formContext);

    return (
        <form
            {...props}
            id={formId}
            method="post"
            action={onSubmit.url}
            data-hy-validate={onValidate?.url ?? onSubmit.url}
            data-hy-frame={target?.frameId}
        />
    );
}

export type FormContentProps<FormState extends Record<string, unknown>> = {
    readonly formState: FormState;
};

export function createForm<FormStateSchema extends SomeFormSchema>(
    formId: string,
    formStateSchema: FormStateSchema | (() => FormStateSchema | Promise<FormStateSchema>),
    FormContent: JsxComponent,
) {
    type InputFormState = z.input<FormStateSchema>;
    type PartialFormState = z.output<ToPartialSchema<FormStateSchema>>;

    if (formId.includes("@")) {
        throw new Error("You cannot use '@' as part of an id.");
    }

    const formFrameId = `${formId}@frame`;
    const Frame = createFrame(formFrameId);
    const getSchema = async () =>
        typeof formStateSchema === "function" ? await formStateSchema() : formStateSchema;

    const FormContext = async ({ formState }: FormContentProps<PartialFormState>) => {
        // At this point, we can be sure that the given form state structurally matches the Zod schema.
        // So we can use the Zod schema to validate the user's input, subsequently showing all validation
        // errors when rerendering the form.
        const parseResult = (await getSchema()).safeParse(formState);
        const [state, errors] = parseResult.success
            ? [parseResult.data, {}]
            : [
                  formState,
                  Object.fromEntries(
                      parseResult.error.issues.map((issue) => [
                          issue.path.join("."),
                          issue.message,
                      ]),
                  ),
              ];

        return (
            <formContext.Provider
                value={{ formState: state, errors, formId, frameId: formFrameId }}
            >
                <Frame>
                    <FormContent />
                </Frame>
            </formContext.Provider>
        );
    };

    async function WithPartialFormState(props: {
        Content: JsxComponent<FormContentProps<PartialFormState>>;
    }) {
        const schema = await getSchema();
        const { method, searchParams, requestBody } = useHttpContext();
        const paramsSource = method === "GET" ? searchParams : requestBody;

        const { $form } = parseUrlSearchParams(
            z.object({ $form: toPartialSchema(schema) }),
            paramsSource,
        )!;

        return <props.Content formState={$form!} />;
    }

    FormContext.updateState = (
        updateState: (state: PartialFormState) => PartialFormState,
    ): FormElement<InputFormState> => {
        return (
            <WithPartialFormState
                Content={({ formState }) => <FormContext formState={updateState(formState)} />}
            />
        ) as any;
    };

    FormContext.submit = (
        /**
         * The action that is carried out if the form passed validation, like storing the data in
         * some database, sending an e-mail, etc.
         */
        action: JsxComponent<{ formState: z.output<FormStateSchema> }>,
    ): FormElement<InputFormState> => {
        return (
            <WithPartialFormState Content={({ formState }) => <Submit formState={formState} />} />
        ) as any;

        async function Submit(props: FormContentProps<InputFormState>) {
            const result = (await getSchema()).safeParse(props.formState);

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
                    <FormContext formState={props.formState} />
                ) : (
                    action({ formState: result.data })
                );
            } else {
                useHttpStatusCode(422);
                return <FormContext formState={props.formState} />;
            }
        }
    };

    return FormContext;
}

export function useFormProperty<FormState extends Record<string, unknown>, T>(
    property: PropertySelector<FormState, T>,
) {
    const { formState, errors } = useContext(formContext);
    const path = collectPath(property);

    return {
        value: get(formState, path) as T,
        error: get(errors, path) as string,
        name: path,
    } as const;
}

export type FormButtonProps<FormState extends Record<string, unknown>> = Omit<
    JSX.HTMLAttributes<HTMLButtonElement>,
    "type"
> & {
    /** The route the form data should be submitted to when this button is clicked. */
    readonly href: Href<"POST", FormValues<FormState>>;
    /** If `true`, marks all form fields as touched after the form submission is completed. */
    readonly markFieldsAsTouched?: boolean;
    /** If `true`, the form fields remain enabled while the form submission is in progress. */
    readonly keepFieldsEnabled?: boolean;
};

export function FormButton<FormState extends Record<string, unknown>>({
    href,
    markFieldsAsTouched,
    keepFieldsEnabled,
    ...props
}: FormButtonProps<FormState>) {
    const { formId, frameId } = useContext(formContext);

    return (
        <button
            {...props}
            type="button"
            data-hy-method={href.method}
            data-hy-frame={frameId}
            data-hy-url={href.url}
            data-hy-body={href.body}
            data-hy-form={formId}
        />
    );
}

const formContext = createContext<{
    readonly formState: Record<string, unknown>;
    readonly errors: Record<string, unknown>;
    readonly formId: string;
    readonly frameId: string;
}>({ name: "form context" });

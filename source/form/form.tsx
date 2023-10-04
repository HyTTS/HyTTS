import get from "lodash/get";
import type { z, ZodType, ZodTypeDef } from "zod";
import { createFrame, type FrameMetadata } from "@/dom/frame";
import { collectPath, type PropertySelector } from "@/form/property-path";
import { useHttpContext, useHttpStatusCode } from "@/http/http-context";
import { createEventHandler } from "@/jsx/browser-script";
import { createContext, useContext } from "@/jsx/context";
import type { JSX, JsxComponent } from "@/jsx/jsx-types";
import type { FormValues, Href } from "@/routing/href";
import type { FormElement } from "@/routing/router";
import { toPartialSchema, type ToPartialSchema } from "@/serialization/to-partial-schema";
import { parseUrlSearchParams } from "@/serialization/url-params";

export type SomeFormSchema = ZodType<Record<string, unknown>, ZodTypeDef, any>;

export type FormProps<FormState extends Record<string, unknown>> = Omit<
    JSX.FormHTMLAttributes<HTMLFormElement>,
    "id" | "browser:onsubmit" | "browser:onchange" | "method"
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
            browser:onsubmit={createEventHandler(
                (_formId, _url, _frameSelector) => (e) => {
                    e.preventDefault();
                    // TODO await HyTTS.submitForm(formId, url, frameId);
                },
                formId,
                onSubmit.url,
                target?.frameSelector,
            )}
            browser:onchange={createEventHandler(
                (_formId, _url, _params) => () => {
                    // TODO: SET VALIDATE ONLY HEADER IN CASE SUBMIT ROUTE IS USED!
                    //    return HyTTS.executeFormAction(formId, url, params);
                },
                formId,
                onValidate?.url ?? onSubmit.url,
                "", // TODO toUrlSearchParams(validationAction.bodyParams)
            )}
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

    const frameId = `f_${formId}`;
    const Frame = createFrame(frameId);
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
                value={{
                    formState: state,
                    errors,
                    formId,
                }}
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

        const formState = parseUrlSearchParams(toPartialSchema(schema), paramsSource)!;
        return <props.Content formState={formState} />;
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
        onSuccess: JsxComponent<{ formState: z.output<FormStateSchema> }>,
    ): FormElement<InputFormState> => {
        return (
            <WithPartialFormState Content={(formState) => <Submit formState={formState} />} />
        ) as any;

        async function Submit(props: FormContentProps<InputFormState>) {
            const result = (await getSchema()).safeParse(props.formState);

            if (result.success) {
                return onSuccess({ formState: result.data });
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
    "browser:onclick" | "type"
> & {
    /** The action that should be executed when the form is submitted using this button. */
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
    const { formId } = useContext(formContext);

    return (
        <button
            {...props}
            type="button"
            browser:onclick={createEventHandler(
                (_formId, _url, _params, _markFieldsAsTouched, _keepFieldsEnabled) => () => {},
                // TODO  HyTTS.executeFormAction(
                //     formId,
                //     url,
                //     params,
                //     !keepFieldsEnabled,
                //     markFieldsAsTouched,
                // ),
                formId,
                href.url,
                href.body,
                markFieldsAsTouched,
                keepFieldsEnabled,
            )}
        />
    );
}

const formContext = createContext<{
    readonly formState: Record<string, unknown>;
    readonly errors: Record<string, unknown>;
    readonly formId: string;
}>({ name: "form context" });

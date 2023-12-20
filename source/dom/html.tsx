import { renderToString } from "@/jsx/jsx-runtime";
import { type JSX, type JsxElement, toJsxExpression } from "@/jsx/jsx-types";

/** Renders the `<html>` element and prefixes the HTML output with a `DOCTYPE` declaration. */
export function Html(props: JSX.HTMLAttributes<HTMLHtmlElement>): JsxElement {
    return toJsxExpression(
        async () => "<!DOCTYPE html>" + (await renderToString(<html {...props} />)),
    );
}

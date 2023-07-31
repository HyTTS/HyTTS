import type { JSX, JsxElement} from "@/jsx/jsx-types";
import { toJsxExpression } from "@/jsx/jsx-types";
import { renderToString } from "@/jsx/jsx-runtime";

export function Html(props: JSX.HTMLAttributes<HTMLHtmlElement>): JsxElement {
    return toJsxExpression(
        async () => "<!DOCTYPE html>" + (await renderToString(<html {...props} />)),
    );
}

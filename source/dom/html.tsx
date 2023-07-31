import { renderToString } from "@/jsx/jsx-runtime";
import { toJsxExpression } from "@/jsx/jsx-types";
import type { JSX, JsxElement} from "@/jsx/jsx-types";

export function Html(props: JSX.HTMLAttributes<HTMLHtmlElement>): JsxElement {
    return toJsxExpression(
        async () => "<!DOCTYPE html>" + (await renderToString(<html {...props} />)),
    );
}

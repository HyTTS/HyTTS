import { frameContext, type FrameMetadata } from "@/dom/frame";
import { BrowserScriptRenderer } from "@/jsx/browser-script";
import type { JSX } from "@/jsx/jsx-types";
import { useUniqueName } from "@/jsx/unique-name";

export type BodyProps = JSX.HTMLAttributes<HTMLBodyElement>;

export function Body({ children, id, ...props }: BodyProps) {
    id ??= useUniqueName();
    return (
        <body {...props} id={id}>
            <frameContext.Provider value={BodyFrame}>
                <BrowserScriptRenderer>{children}</BrowserScriptRenderer>
            </frameContext.Provider>
        </body>
    );
}

export const BodyFrame: FrameMetadata = {
    frameSelector: "body",
};

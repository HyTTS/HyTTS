import { createFrame } from "@/dom/frame";
import type { JSX } from "@/jsx/jsx-types";

export type BodyProps = JSX.HTMLAttributes<HTMLBodyElement>;

export function Body({ children, ...props }: BodyProps) {
    return (
        <body {...props}>
            <BodyFrame>{children}</BodyFrame>
        </body>
    );
}

export const BodyFrame = createFrame("root");

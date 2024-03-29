import { BrowserScriptRenderer } from "@/jsx/browser-script";
import { createContext, useContext } from "@/jsx/context";
import type { JsxComponent, PropsWithChildren } from "@/jsx/jsx-types";
import { UniqueNameProvider } from "@/jsx/unique-name";

/**
 * A frame is a regular JSX component that can be rendered anywhere within the component tree and
 * also allows access to some additional metadata.
 */
export type Frame = JsxComponent<PropsWithChildren> & FrameMetadata;

/** Contains additional metadata about a frame. */
export type FrameMetadata = {
    /**
     * The frame's id that must be document-wide unique and stable across requests, server restarts,
     * and app updates.
     */
    readonly frameId: string;
};

export type FrameProps = PropsWithChildren<{
    readonly class?: string;
}>;

/**
 * Creates a new `Frame` instance with the given id. This function is typically invoked in a
 * top-level declaration of a module so that the frame can be used in a type-safe way within the
 * defining module itself but also across modules via exports/imports.
 *
 * @param frameId The frame's id, which is required to be unique within the entire HTML document.
 *   Additionally, this id must be stable across requests, server reloads, and ideally even app
 *   updates.
 */
export function createFrame(frameId: string): Frame {
    const frame = (props: FrameProps) => {
        return (
            <hy-frame id={frameId} class={props.class}>
                <FrameContext value={frame}>
                    <UniqueNameProvider namespace={frameId}>
                        <BrowserScriptRenderer>{props.children}</BrowserScriptRenderer>
                    </UniqueNameProvider>
                </FrameContext>
            </hy-frame>
        );
    };

    frame.frameId = frameId;
    return frame;
}

/** Provides access to the metadata of the caller's nearest ancestor frame. */
export function useFrameMetadata() {
    return useContext(FrameContext);
}

const FrameContext = createContext<FrameMetadata>({ name: "frame metadata" });

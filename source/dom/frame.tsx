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
     * The frame's selector, i.e., either `"body"` or a frame's id, which is required to be unique
     * within the entire HTML document.
     */
    readonly frameSelector: string;
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
 *   Additionally, this id must be stable across server reloads and app updates.
 */
export function createFrame(frameId: string): Frame {
    const frame = (props: FrameProps) => {
        return (
            <hy-frame id={frameId} class={props.class}>
                <frameContext.Provider value={frame}>
                    <UniqueNameProvider prefix={frameId}>
                        <BrowserScriptRenderer>{props.children}</BrowserScriptRenderer>
                    </UniqueNameProvider>
                </frameContext.Provider>
            </hy-frame>
        );
    };

    frame.frameSelector = `#${frameId}`;
    return frame;
}

/**
 * Provides access to the metadata of frame that contains the caller within the component tree. The
 * document's body is the top-most frame element.
 */
export function useFrameMetadata() {
    return useContext(frameContext);
}

export const frameContext = createContext<FrameMetadata>();

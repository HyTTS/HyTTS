// See also https://www.typescriptlang.org/docs/handbook/jsx.html

import type { BrowserFunc } from "./browser-script";

/** The types that are supported as children of a JSX expression. */
export type JsxNode = JsxElement | string | number | boolean | null | undefined | JsxNode[];

const jsxExpressionSymbol = Symbol();

/**
 * The runtime type of an JSX expression like `<div/>`, i.e., a function returning the rendered HTML string
 * in the simplest case. Since components can be `async`, however, a JSX expression can alternatively return
 * a `Promise<string>` of the HTML that will eventually be rendered. Moreover, an expression can return
 * either `null` or `Promise<null>` to not render anything at all.
 */
export type JsxExpression = {
    (): string | null | Promise<string | null>;
    [jsxExpressionSymbol]: null;
};

/**
 * The actual JSX element type required for TypeScript to successfully type-check asynchronous components.
 * The runtime type of a JSX expression is always `JsxExpression`. The `Promise<JsxExpression>` variant is
 * what additionally allows components to be `async`.
 */
export type JsxElement = null | JsxExpression | Promise<JsxExpression | null>;

/**
 * Denotes the name and type of the `children` prop that the TypeScript uses to determine whether JSX children
 * are allowed.
 */
export type JsxElementChildrenAttribute = {
    readonly children?: JsxNode;
};

// Undocumented behavior: It is necessary that this interface has some property so that TypeScript reports
// children as an error when the element does not support children, i.e., `<X>test</X>` should raise an
// error for `const X = () => null`.
export type JsxIntrinsicAttributes = { _unused_?: {} };

/** Represents a type-safe handler for a DOM event. */
export type EventHandler<TElement extends EventTarget, TEvent extends Event> = BrowserFunc<
    (e: EventArgs<TElement, TEvent>) => void
>;

/** Represents a default props type that provides child elements to a component. */
export type PropsWithChildren<TProps = unknown> = TProps & {
    children?: JsxNode;
};

/** Represents a potentially asynchronous function component. */
export type JsxComponent<TProps = {}> = keyof TProps extends never
    ? () => JsxElement
    : (props: TProps) => JsxElement;

/** Represents the arguments of an HTML event. */
export type EventArgs<TElement = HTMLElement, TEvent extends Event = Event> = TEvent & {
    readonly currentTarget: TElement;
};

/**
 * Converts a function into a JSX expression. Ensures that we don't accidentally try to render some
 * arbitrary function as a JSX child.
 */
export function toJsxExpression(action: () => ReturnType<JsxExpression>): JsxExpression {
    (action as any)[jsxExpressionSymbol] = null;
    return action as JsxExpression;
}

/**
 * Checks whether the given value is a JSX expression and can thus safely be rendered as a JSX child.
 */
export function isJsxExpression(value: unknown): value is JsxExpression {
    return !!value && typeof value === "function" && jsxExpressionSymbol in value;
}

// ================================================================================================================
// The remainder of this file is taken and adapted from https://github.dev/ryansolid/dom-expressions (MIT license).
// ================================================================================================================

// This must be a namespace for type checking to work.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
    export type Node = JsxNode;
    export type Expression = JsxExpression;
    export type Element = JsxElement;
    export type ElementChildrenAttribute = JsxElementChildrenAttribute;
    export type IntrinsicAttributes = JsxIntrinsicAttributes;

    export interface DOMAttributes<T extends EventTarget> {
        children?: Node;
        "browser:oncopy"?: EventHandler<T, ClipboardEvent>;
        "browser:oncut"?: EventHandler<T, ClipboardEvent>;
        "browser:onpaste"?: EventHandler<T, ClipboardEvent>;
        "browser:oncompositionend"?: EventHandler<T, CompositionEvent>;
        "browser:oncompositionstart"?: EventHandler<T, CompositionEvent>;
        "browser:oncompositionupdate"?: EventHandler<T, CompositionEvent>;
        "browser:onfocus"?: EventHandler<T, FocusEvent>;
        "browser:onfocusout"?: EventHandler<T, FocusEvent>;
        "browser:onfocusin"?: EventHandler<T, FocusEvent>;
        "browser:onblur"?: EventHandler<T, FocusEvent>;
        "browser:onchange"?: EventHandler<T, Event>;
        "browser:oninvalid"?: EventHandler<T, Event>;
        "browser:oninput"?: EventHandler<T, InputEvent>;
        "browser:onbeforeinput"?: EventHandler<T, InputEvent>;
        "browser:onreset"?: EventHandler<T, Event>;
        "browser:onsubmit"?: EventHandler<T, SubmitEvent>;
        "browser:onload"?: EventHandler<T, Event>;
        "browser:onerror"?: EventHandler<T, Event>;
        "browser:onkeydown"?: EventHandler<T, KeyboardEvent>;
        "browser:onkeypress"?: EventHandler<T, KeyboardEvent>;
        "browser:onkeyup"?: EventHandler<T, KeyboardEvent>;
        "browser:ongotpointercapture"?: EventHandler<T, PointerEvent>;
        "browser:onlostpointercapture"?: EventHandler<T, PointerEvent>;
        "browser:onpointercancel"?: EventHandler<T, PointerEvent>;
        "browser:onpointerdown"?: EventHandler<T, PointerEvent>;
        "browser:onpointerenter"?: EventHandler<T, PointerEvent>;
        "browser:onpointerleave"?: EventHandler<T, PointerEvent>;
        "browser:onpointermove"?: EventHandler<T, PointerEvent>;
        "browser:onpointerover"?: EventHandler<T, PointerEvent>;
        "browser:onpointerout"?: EventHandler<T, PointerEvent>;
        "browser:onpointerup"?: EventHandler<T, PointerEvent>;
        "browser:onabort"?: EventHandler<T, Event>;
        "browser:oncanplay"?: EventHandler<T, Event>;
        "browser:oncanplaythrough"?: EventHandler<T, Event>;
        "browser:ondurationchange"?: EventHandler<T, Event>;
        "browser:onemptied"?: EventHandler<T, Event>;
        "browser:onencrypted"?: EventHandler<T, Event>;
        "browser:onended"?: EventHandler<T, Event>;
        "browser:onloadeddata"?: EventHandler<T, Event>;
        "browser:onloadedmetadata"?: EventHandler<T, Event>;
        "browser:onloadstart"?: EventHandler<T, Event>;
        "browser:onpause"?: EventHandler<T, Event>;
        "browser:onplay"?: EventHandler<T, Event>;
        "browser:onplaying"?: EventHandler<T, Event>;
        "browser:onprogress"?: EventHandler<T, Event>;
        "browser:onratechange"?: EventHandler<T, Event>;
        "browser:onseeked"?: EventHandler<T, Event>;
        "browser:onseeking"?: EventHandler<T, Event>;
        "browser:onstalled"?: EventHandler<T, Event>;
        "browser:onsuspend"?: EventHandler<T, Event>;
        "browser:ontimeupdate"?: EventHandler<T, Event>;
        "browser:onvolumechange"?: EventHandler<T, Event>;
        "browser:onwaiting"?: EventHandler<T, Event>;
        "browser:onclick"?: EventHandler<T, MouseEvent>;
        "browser:onauxclick"?: EventHandler<T, MouseEvent>;
        "browser:oncontextmenu"?: EventHandler<T, MouseEvent>;
        "browser:ondblclick"?: EventHandler<T, MouseEvent>;
        "browser:ondrag"?: EventHandler<T, DragEvent>;
        "browser:ondragend"?: EventHandler<T, DragEvent>;
        "browser:ondragenter"?: EventHandler<T, DragEvent>;
        "browser:ondragexit"?: EventHandler<T, DragEvent>;
        "browser:ondragleave"?: EventHandler<T, DragEvent>;
        "browser:ondragover"?: EventHandler<T, DragEvent>;
        "browser:ondragstart"?: EventHandler<T, DragEvent>;
        "browser:ondrop"?: EventHandler<T, DragEvent>;
        "browser:onmousedown"?: EventHandler<T, MouseEvent>;
        "browser:onmouseenter"?: EventHandler<T, MouseEvent>;
        "browser:onmouseleave"?: EventHandler<T, MouseEvent>;
        "browser:onmousemove"?: EventHandler<T, MouseEvent>;
        "browser:onmouseout"?: EventHandler<T, MouseEvent>;
        "browser:onmouseover"?: EventHandler<T, MouseEvent>;
        "browser:onmouseup"?: EventHandler<T, MouseEvent>;
        "browser:onselect"?: EventHandler<T, UIEvent>;
        "browser:ontouchcancel"?: EventHandler<T, TouchEvent>;
        "browser:ontouchend"?: EventHandler<T, TouchEvent>;
        "browser:ontouchmove"?: EventHandler<T, TouchEvent>;
        "browser:ontouchstart"?: EventHandler<T, TouchEvent>;
        "browser:onscroll"?: EventHandler<T, UIEvent>;
        "browser:onwheel"?: EventHandler<T, WheelEvent>;
        "browser:onanimationstart"?: EventHandler<T, AnimationEvent>;
        "browser:onanimationend"?: EventHandler<T, AnimationEvent>;
        "browser:onanimationiteration"?: EventHandler<T, AnimationEvent>;
        "browser:ontransitionend"?: EventHandler<T, TransitionEvent>;
    }

    export type HTMLAutocapitalize = "off" | "none" | "on" | "sentences" | "words" | "characters";

    export type HTMLDir = "ltr" | "rtl" | "auto";

    export type HTMLFormEncType =
        | "application/x-www-form-urlencoded"
        | "multipart/form-data"
        | "text/plain";

    export type HTMLFormMethod = "post" | "get" | "dialog";

    export type HTMLCrossorigin = "anonymous" | "use-credentials" | "";

    export type HTMLReferrerPolicy =
        | "no-referrer"
        | "no-referrer-when-downgrade"
        | "origin"
        | "origin-when-cross-origin"
        | "same-origin"
        | "strict-origin"
        | "strict-origin-when-cross-origin"
        | "unsafe-url";

    export type HTMLIframeSandbox =
        | "allow-downloads-without-user-activation"
        | "allow-downloads"
        | "allow-forms"
        | "allow-modals"
        | "allow-orientation-lock"
        | "allow-pointer-lock"
        | "allow-popups"
        | "allow-popups-to-escape-sandbox"
        | "allow-presentation"
        | "allow-same-origin"
        | "allow-scripts"
        | "allow-storage-access-by-user-activation"
        | "allow-top-navigation"
        | "allow-top-navigation-by-user-activation";

    export type HTMLLinkAs =
        | "audio"
        | "document"
        | "embed"
        | "fetch"
        | "font"
        | "image"
        | "object"
        | "script"
        | "style"
        | "track"
        | "video"
        | "worker";

    // All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/

    export interface AriaAttributes {
        /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
        "aria-activedescendant"?: string;
        /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
        "aria-atomic"?: boolean | "false" | "true";
        /**
         * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
         * presented if they are made.
         */
        "aria-autocomplete"?: "none" | "inline" | "list" | "both";
        /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
        "aria-busy"?: boolean | "false" | "true";
        /**
         * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
         * @see aria-pressed @see aria-selected.
         */
        "aria-checked"?: boolean | "false" | "mixed" | "true";
        /**
         * Defines the total number of columns in a table, grid, or treegrid.
         * @see aria-colindex.
         */
        "aria-colcount"?: number | string;
        /**
         * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
         * @see aria-colcount @see aria-colspan.
         */
        "aria-colindex"?: number | string;
        /**
         * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
         * @see aria-colindex @see aria-rowspan.
         */
        "aria-colspan"?: number | string;
        /**
         * Identifies the element (or elements) whose contents or presence are controlled by the current element.
         * @see aria-owns.
         */
        "aria-controls"?: string;
        /** Indicates the element that represents the current item within a container or set of related elements. */
        "aria-current"?:
            | boolean
            | "false"
            | "true"
            | "page"
            | "step"
            | "location"
            | "date"
            | "time";
        /**
         * Identifies the element (or elements) that describes the object.
         * @see aria-labelledby
         */
        "aria-describedby"?: string;
        /**
         * Identifies the element that provides a detailed, extended description for the object.
         * @see aria-describedby.
         */
        "aria-details"?: string;
        /**
         * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
         * @see aria-hidden @see aria-readonly.
         */
        "aria-disabled"?: boolean | "false" | "true";
        /**
         * Indicates what functions can be performed when a dragged object is released on the drop target.
         * @deprecated in ARIA 1.1
         */
        "aria-dropeffect"?: "none" | "copy" | "execute" | "link" | "move" | "popup";
        /**
         * Identifies the element that provides an error message for the object.
         * @see aria-invalid @see aria-describedby.
         */
        "aria-errormessage"?: string;
        /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
        "aria-expanded"?: boolean | "false" | "true";
        /**
         * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
         * allows assistive technology to override the general default of reading in document source order.
         */
        "aria-flowto"?: string;
        /**
         * Indicates an element's "grabbed" state in a drag-and-drop operation.
         * @deprecated in ARIA 1.1
         */
        "aria-grabbed"?: boolean | "false" | "true";
        /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
        "aria-haspopup"?:
            | boolean
            | "false"
            | "true"
            | "menu"
            | "listbox"
            | "tree"
            | "grid"
            | "dialog";
        /**
         * Indicates whether the element is exposed to an accessibility API.
         * @see aria-disabled.
         */
        "aria-hidden"?: boolean | "false" | "true";
        /**
         * Indicates the entered value does not conform to the format expected by the application.
         * @see aria-errormessage.
         */
        "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
        /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
        "aria-keyshortcuts"?: string;
        /**
         * Defines a string value that labels the current element.
         * @see aria-labelledby.
         */
        "aria-label"?: string;
        /**
         * Identifies the element (or elements) that labels the current element.
         * @see aria-describedby.
         */
        "aria-labelledby"?: string;
        /** Defines the hierarchical level of an element within a structure. */
        "aria-level"?: number | string;
        /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
        "aria-live"?: "off" | "assertive" | "polite";
        /** Indicates whether an element is modal when displayed. */
        "aria-modal"?: boolean | "false" | "true";
        /** Indicates whether a text box accepts multiple lines of input or only a single line. */
        "aria-multiline"?: boolean | "false" | "true";
        /** Indicates that the user may select more than one item from the current selectable descendants. */
        "aria-multiselectable"?: boolean | "false" | "true";
        /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
        "aria-orientation"?: "horizontal" | "vertical";
        /**
         * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
         * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
         * @see aria-controls.
         */
        "aria-owns"?: string;
        /**
         * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
         * A hint could be a sample value or a brief description of the expected format.
         */
        "aria-placeholder"?: string;
        /**
         * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
         * @see aria-setsize.
         */
        "aria-posinset"?: number | string;
        /**
         * Indicates the current "pressed" state of toggle buttons.
         * @see aria-checked @see aria-selected.
         */
        "aria-pressed"?: boolean | "false" | "mixed" | "true";
        /**
         * Indicates that the element is not editable, but is otherwise operable.
         * @see aria-disabled.
         */
        "aria-readonly"?: boolean | "false" | "true";
        /**
         * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
         * @see aria-atomic.
         */
        "aria-relevant"?:
            | "additions"
            | "additions removals"
            | "additions text"
            | "all"
            | "removals"
            | "removals additions"
            | "removals text"
            | "text"
            | "text additions"
            | "text removals";
        /** Indicates that user input is required on the element before a form may be submitted. */
        "aria-required"?: boolean | "false" | "true";
        /** Defines a human-readable, author-localized description for the role of an element. */
        "aria-roledescription"?: string;
        /**
         * Defines the total number of rows in a table, grid, or treegrid.
         * @see aria-rowindex.
         */
        "aria-rowcount"?: number | string;
        /**
         * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
         * @see aria-rowcount @see aria-rowspan.
         */
        "aria-rowindex"?: number | string;
        /**
         * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
         * @see aria-rowindex @see aria-colspan.
         */
        "aria-rowspan"?: number | string;
        /**
         * Indicates the current "selected" state of various widgets.
         * @see aria-checked @see aria-pressed.
         */
        "aria-selected"?: boolean | "false" | "true";
        /**
         * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
         * @see aria-posinset.
         */
        "aria-setsize"?: number | string;
        /** Indicates if items in a table or grid are sorted in ascending or descending order. */
        "aria-sort"?: "none" | "ascending" | "descending" | "other";
        /** Defines the maximum allowed value for a range widget. */
        "aria-valuemax"?: number | string;
        /** Defines the minimum allowed value for a range widget. */
        "aria-valuemin"?: number | string;
        /**
         * Defines the current value for a range widget.
         * @see aria-valuetext.
         */
        "aria-valuenow"?: number | string;
        /** Defines the human readable text alternative of aria-valuenow for a range widget. */
        "aria-valuetext"?: string;
        role?:
            | "alert"
            | "alertdialog"
            | "application"
            | "article"
            | "banner"
            | "button"
            | "cell"
            | "checkbox"
            | "columnheader"
            | "combobox"
            | "complementary"
            | "contentinfo"
            | "definition"
            | "dialog"
            | "directory"
            | "document"
            | "feed"
            | "figure"
            | "form"
            | "grid"
            | "gridcell"
            | "group"
            | "heading"
            | "img"
            | "link"
            | "list"
            | "listbox"
            | "listitem"
            | "log"
            | "main"
            | "marquee"
            | "math"
            | "menu"
            | "menubar"
            | "menuitem"
            | "menuitemcheckbox"
            | "menuitemradio"
            | "meter"
            | "navigation"
            | "none"
            | "note"
            | "option"
            | "presentation"
            | "progressbar"
            | "radio"
            | "radiogroup"
            | "region"
            | "row"
            | "rowgroup"
            | "rowheader"
            | "scrollbar"
            | "search"
            | "searchbox"
            | "separator"
            | "slider"
            | "spinbutton"
            | "status"
            | "switch"
            | "tab"
            | "table"
            | "tablist"
            | "tabpanel"
            | "term"
            | "textbox"
            | "timer"
            | "toolbar"
            | "tooltip"
            | "tree"
            | "treegrid"
            | "treeitem";
    }

    export interface HTMLAttributes<T extends EventTarget>
        extends AriaAttributes,
            DOMAttributes<T> {
        accessKey?: string;
        class?: string;
        contenteditable?: boolean | "inherit";
        contextmenu?: string;
        dir?: HTMLDir;
        draggable?: boolean;
        hidden?: boolean;
        id?: string;
        lang?: string;
        spellcheck?: boolean;
        style?: string;
        tabindex?: number | string;
        title?: string;
        translate?: "yes" | "no";
        about?: string;
        datatype?: string;
        inlist?: any;
        prefix?: string;
        property?: string;
        resource?: string;
        typeof?: string;
        vocab?: string;
        autocapitalize?: HTMLAutocapitalize;
        slot?: string;
        color?: string;
        itemprop?: string;
        itemscope?: boolean;
        itemtype?: string;
        itemid?: string;
        itemref?: string;
        part?: string;
        exportparts?: string;
        inputmode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
    }

    export interface AnchorHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        download?: any;
        href?: string;
        hreflang?: string;
        media?: string;
        ping?: string;
        referrerpolicy?: HTMLReferrerPolicy;
        rel?: string;
        target?: string;
        type?: string;
    }

    export interface AudioHTMLAttributes<T extends EventTarget> extends MediaHTMLAttributes<T> {}

    export interface AreaHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        alt?: string;
        coords?: string;
        download?: any;
        href?: string;
        hreflang?: string;
        ping?: string;
        referrerpolicy?: HTMLReferrerPolicy;
        rel?: string;
        shape?: "rect" | "circle" | "poly" | "default";
        target?: string;
    }

    export interface BaseHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        href?: string;
        target?: string;
    }

    export interface BlockquoteHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        cite?: string;
    }

    export interface ButtonHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        autofocus?: boolean;
        disabled?: boolean;
        form?: string;
        formaction?: string;
        formenctype?: HTMLFormEncType;
        formmethod?: HTMLFormMethod;
        formnovalidate?: boolean;
        formtarget?: string;
        name?: string;
        type?: "submit" | "reset" | "button";
        value?: string;
    }

    export interface CanvasHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        width?: number | string;
        height?: number | string;
    }

    export interface ColHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        span?: number | string;
        width?: number | string;
    }

    export interface ColgroupHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        span?: number | string;
    }

    export interface DataHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        value?: string | string[] | number;
    }

    export interface DetailsHtmlAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        open?: boolean;
        "browser:ontoggle"?: EventHandler<T, Event>;
    }

    export interface DialogHtmlAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        open?: boolean;
    }

    export interface EmbedHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        height?: number | string;
        src?: string;
        type?: string;
        width?: number | string;
    }

    export interface FieldsetHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        disabled?: boolean;
        form?: string;
        name?: string;
    }

    export interface FormHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        acceptcharset?: string;
        action?: string;
        autocomplete?: string;
        encoding?: HTMLFormEncType;
        enctype?: HTMLFormEncType;
        method?: HTMLFormMethod;
        name?: string;
        novalidate?: boolean;
        target?: string;
    }

    export interface IframeHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        allow?: string;
        allowfullscreen?: boolean;
        height?: number | string;
        name?: string;
        referrerpolicy?: HTMLReferrerPolicy;
        sandbox?: HTMLIframeSandbox | string;
        src?: string;
        srcdoc?: string;
        width?: number | string;
    }

    export interface ImgHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        alt?: string;
        crossorigin?: HTMLCrossorigin;
        decoding?: "sync" | "async" | "auto";
        height?: number | string;
        ismap?: boolean;
        isMap?: boolean;
        loading?: "eager" | "lazy";
        referrerpolicy?: HTMLReferrerPolicy;
        sizes?: string;
        src?: string;
        srcset?: string;
        usemap?: string;
        width?: number | string;
    }

    export interface InputHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        accept?: string;
        alt?: string;
        autocomplete?: string;
        autofocus?: boolean;
        capture?: boolean | string;
        checked?: boolean;
        crossorigin?: HTMLCrossorigin;
        disabled?: boolean;
        form?: string;
        formaction?: string;
        formenctype?: HTMLFormEncType;
        formmethod?: HTMLFormMethod;
        formnovalidate?: boolean;
        formtarget?: string;
        height?: number | string;
        list?: string;
        max?: number | string;
        maxlength?: number | string;
        min?: number | string;
        minlength?: number | string;
        multiple?: boolean;
        name?: string;
        pattern?: string;
        placeholder?: string;
        readonly?: boolean;
        required?: boolean;
        size?: number | string;
        src?: string;
        step?: number | string;
        type?: string;
        value?: string | string[] | number;
        width?: number | string;
    }

    export interface InsHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        cite?: string;
        dateTime?: string;
    }

    export interface KeygenHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        autofocus?: boolean;
        challenge?: string;
        disabled?: boolean;
        form?: string;
        keytype?: string;
        keyparams?: string;
        name?: string;
    }

    export interface LabelHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        for?: string;
        form?: string;
    }

    export interface LiHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        value?: number | string;
    }

    export interface LinkHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        as?: HTMLLinkAs;
        crossorigin?: HTMLCrossorigin;
        disabled?: boolean;
        href?: string;
        hreflang?: string;
        integrity?: string;
        media?: string;
        referrerpolicy?: HTMLReferrerPolicy;
        rel?: string;
        sizes?: string;
        type?: string;
    }

    export interface MapHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        name?: string;
    }

    export interface MediaHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        autoplay?: boolean;
        controls?: boolean;
        crossorigin?: HTMLCrossorigin;
        loop?: boolean;
        mediagroup?: string;
        muted?: boolean;
        preload?: "none" | "metadata" | "auto" | "";
        src?: string;
    }

    export interface MenuHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        label?: string;
        type?: "context" | "toolbar";
    }

    export interface MetaHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        charset?: string;
        content?: string;
        httpequiv?: string;
        name?: string;
        httpEquiv?: string;
    }

    export interface MeterHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        form?: string;
        high?: number | string;
        low?: number | string;
        max?: number | string;
        min?: number | string;
        optimum?: number | string;
        value?: string | string[] | number;
    }

    export interface QuoteHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        cite?: string;
    }

    export interface ObjectHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        data?: string;
        form?: string;
        height?: number | string;
        name?: string;
        type?: string;
        usemap?: string;
        width?: number | string;
        useMap?: string;
    }

    export interface OlHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        reversed?: boolean;
        start?: number | string;
        type?: "1" | "a" | "A" | "i" | "I";
    }

    export interface OptgroupHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        disabled?: boolean;
        label?: string;
    }

    export interface OptionHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        disabled?: boolean;
        label?: string;
        selected?: boolean;
        value?: string | string[] | number;
    }

    export interface OutputHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        form?: string;
        for?: string;
        name?: string;
    }

    export interface ParamHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        name?: string;
        value?: string | string[] | number;
    }

    export interface ProgressHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        max?: number | string;
        value?: string | string[] | number;
    }

    export interface ScriptHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        async?: boolean;
        charset?: string;
        crossorigin?: HTMLCrossorigin;
        defer?: boolean;
        integrity?: string;
        nomodule?: boolean;
        nonce?: string;
        referrerpolicy?: HTMLReferrerPolicy;
        src?: string;
        type?: string;
    }

    export interface SelectHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        autocomplete?: string;
        autofocus?: boolean;
        disabled?: boolean;
        form?: string;
        multiple?: boolean;
        name?: string;
        required?: boolean;
        size?: number | string;
        value?: string | string[] | number;
    }

    export interface HTMLSlotElementAttributes<T extends EventTarget = HTMLSlotElement>
        extends HTMLAttributes<T> {
        name?: string;
    }

    export interface SourceHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        media?: string;
        sizes?: string;
        src?: string;
        srcset?: string;
        type?: string;
    }

    export interface StyleHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        media?: string;
        nonce?: string;
        scoped?: boolean;
        type?: string;
    }

    export interface TdHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        colspan?: number | string;
        headers?: string;
        rowspan?: number | string;
        colSpan?: number | string;
        rowSpan?: number | string;
    }

    export interface TextareaHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        autocomplete?: string;
        autofocus?: boolean;
        cols?: number | string;
        dirname?: string;
        disabled?: boolean;
        form?: string;
        maxlength?: number | string;
        minlength?: number | string;
        name?: string;
        placeholder?: string;
        readonly?: boolean;
        required?: boolean;
        rows?: number | string;
        value?: string | string[] | number;
        wrap?: "hard" | "soft" | "off";
    }

    export interface ThHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        colspan?: number | string;
        headers?: string;
        rowspan?: number | string;
        scope?: "col" | "row" | "rowgroup" | "colgroup";
    }

    export interface TimeHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        datetime?: string;
    }

    export interface TrackHTMLAttributes<T extends EventTarget> extends HTMLAttributes<T> {
        default?: boolean;
        kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
        label?: string;
        src?: string;
        srclang?: string;
    }

    export interface VideoHTMLAttributes<T extends EventTarget> extends MediaHTMLAttributes<T> {
        height?: number | string;
        playsinline?: boolean;
        poster?: string;
        width?: number | string;
    }

    export type SVGPreserveAspectRatio =
        | "none"
        | "xMinYMin"
        | "xMidYMin"
        | "xMaxYMin"
        | "xMinYMid"
        | "xMidYMid"
        | "xMaxYMid"
        | "xMinYMax"
        | "xMidYMax"
        | "xMaxYMax"
        | "xMinYMin meet"
        | "xMidYMin meet"
        | "xMaxYMin meet"
        | "xMinYMid meet"
        | "xMidYMid meet"
        | "xMaxYMid meet"
        | "xMinYMax meet"
        | "xMidYMax meet"
        | "xMaxYMax meet"
        | "xMinYMin slice"
        | "xMidYMin slice"
        | "xMaxYMin slice"
        | "xMinYMid slice"
        | "xMidYMid slice"
        | "xMaxYMid slice"
        | "xMinYMax slice"
        | "xMidYMax slice"
        | "xMaxYMax slice";

    export type ImagePreserveAspectRatio =
        | SVGPreserveAspectRatio
        | "defer none"
        | "defer xMinYMin"
        | "defer xMidYMin"
        | "defer xMaxYMin"
        | "defer xMinYMid"
        | "defer xMidYMid"
        | "defer xMaxYMid"
        | "defer xMinYMax"
        | "defer xMidYMax"
        | "defer xMaxYMax"
        | "defer xMinYMin meet"
        | "defer xMidYMin meet"
        | "defer xMaxYMin meet"
        | "defer xMinYMid meet"
        | "defer xMidYMid meet"
        | "defer xMaxYMid meet"
        | "defer xMinYMax meet"
        | "defer xMidYMax meet"
        | "defer xMaxYMax meet"
        | "defer xMinYMin slice"
        | "defer xMidYMin slice"
        | "defer xMaxYMin slice"
        | "defer xMinYMid slice"
        | "defer xMidYMid slice"
        | "defer xMaxYMid slice"
        | "defer xMinYMax slice"
        | "defer xMidYMax slice"
        | "defer xMaxYMax slice";

    export type SVGUnits = "userSpaceOnUse" | "objectBoundingBox";

    export interface CoreSVGAttributes<T extends EventTarget>
        extends AriaAttributes,
            DOMAttributes<T> {
        id?: string;
        lang?: string;
        tabindex?: number | string;
    }

    export interface StylableSVGAttributes {
        class?: string;
        style?: string;
    }

    export interface TransformableSVGAttributes {
        transform?: string;
    }

    export interface ConditionalProcessingSVGAttributes {
        requiredExtensions?: string;
        requiredFeatures?: string;
        systemLanguage?: string;
    }

    export interface ExternalResourceSVGAttributes {
        externalResourcesRequired?: "true" | "false";
    }

    export interface AnimationTimingSVGAttributes {
        begin?: string;
        dur?: string;
        end?: string;
        min?: string;
        max?: string;
        restart?: "always" | "whenNotActive" | "never";
        repeatCount?: number | "indefinite";
        repeatDur?: string;
        fill?: "freeze" | "remove";
    }

    export interface AnimationValueSVGAttributes {
        calcMode?: "discrete" | "linear" | "paced" | "spline";
        values?: string;
        keyTimes?: string;
        keySplines?: string;
        from?: number | string;
        to?: number | string;
        by?: number | string;
    }

    export interface AnimationAdditionSVGAttributes {
        attributeName?: string;
        additive?: "replace" | "sum";
        accumulate?: "none" | "sum";
    }

    export interface AnimationAttributeTargetSVGAttributes {
        attributeName?: string;
        attributeType?: "CSS" | "XML" | "auto";
    }

    export interface PresentationSVGAttributes {
        "alignment-baseline"?:
            | "auto"
            | "baseline"
            | "before-edge"
            | "text-before-edge"
            | "middle"
            | "central"
            | "after-edge"
            | "text-after-edge"
            | "ideographic"
            | "alphabetic"
            | "hanging"
            | "mathematical"
            | "inherit";
        "baseline-shift"?: number | string;
        clip?: string;
        "clip-path"?: string;
        "clip-rule"?: "nonzero" | "evenodd" | "inherit";
        color?: string;
        "color-interpolation"?: "auto" | "sRGB" | "linearRGB" | "inherit";
        "color-interpolation-filters"?: "auto" | "sRGB" | "linearRGB" | "inherit";
        "color-profile"?: string;
        "color-rendering"?: "auto" | "optimizeSpeed" | "optimizeQuality" | "inherit";
        cursor?: string;
        direction?: "ltr" | "rtl" | "inherit";
        display?: string;
        "dominant-baseline"?:
            | "auto"
            | "text-bottom"
            | "alphabetic"
            | "ideographic"
            | "middle"
            | "central"
            | "mathematical"
            | "hanging"
            | "text-top"
            | "inherit";
        "enable-background"?: string;
        fill?: string;
        "fill-opacity"?: number | string | "inherit";
        "fill-rule"?: "nonzero" | "evenodd" | "inherit";
        filter?: string;
        "flood-color"?: string;
        "flood-opacity"?: number | string | "inherit";
        "font-family"?: string;
        "font-size"?: string;
        "font-size-adjust"?: number | string;
        "font-stretch"?: string;
        "font-style"?: "normal" | "italic" | "oblique" | "inherit";
        "font-variant"?: string;
        "font-weight"?: number | string;
        "glyph-orientation-horizontal"?: string;
        "glyph-orientation-vertical"?: string;
        "image-rendering"?: "auto" | "optimizeQuality" | "optimizeSpeed" | "inherit";
        kerning?: string;
        "letter-spacing"?: number | string;
        "lighting-color"?: string;
        "marker-end"?: string;
        "marker-mid"?: string;
        "marker-start"?: string;
        mask?: string;
        opacity?: number | string | "inherit";
        overflow?: "visible" | "hidden" | "scroll" | "auto" | "inherit";
        "pointer-events"?:
            | "bounding-box"
            | "visiblePainted"
            | "visibleFill"
            | "visibleStroke"
            | "visible"
            | "painted"
            | "color"
            | "fill"
            | "stroke"
            | "all"
            | "none"
            | "inherit";
        "shape-rendering"?:
            | "auto"
            | "optimizeSpeed"
            | "crispEdges"
            | "geometricPrecision"
            | "inherit";
        "stop-color"?: string;
        "stop-opacity"?: number | string | "inherit";
        stroke?: string;
        "stroke-dasharray"?: string;
        "stroke-dashoffset"?: number | string;
        "stroke-linecap"?: "butt" | "round" | "square" | "inherit";
        "stroke-linejoin"?: "arcs" | "bevel" | "miter" | "miter-clip" | "round" | "inherit";
        "stroke-miterlimit"?: number | string | "inherit";
        "stroke-opacity"?: number | string | "inherit";
        "stroke-width"?: number | string;
        "text-anchor"?: "start" | "middle" | "end" | "inherit";
        "text-decoration"?:
            | "none"
            | "underline"
            | "overline"
            | "line-through"
            | "blink"
            | "inherit";
        "text-rendering"?:
            | "auto"
            | "optimizeSpeed"
            | "optimizeLegibility"
            | "geometricPrecision"
            | "inherit";
        "unicode-bidi"?: string;
        visibility?: "visible" | "hidden" | "collapse" | "inherit";
        "word-spacing"?: number | string;
        "writing-mode"?: "lr-tb" | "rl-tb" | "tb-rl" | "lr" | "rl" | "tb" | "inherit";
    }

    export interface AnimationElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            ConditionalProcessingSVGAttributes {}

    export interface ContainerElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            Pick<
                PresentationSVGAttributes,
                | "clip-path"
                | "mask"
                | "cursor"
                | "opacity"
                | "filter"
                | "enable-background"
                | "color-interpolation"
                | "color-rendering"
            > {}

    export interface FilterPrimitiveElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            Pick<PresentationSVGAttributes, "color-interpolation-filters"> {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        result?: string;
    }

    export interface SingleInputFilterSVGAttributes {
        in?: string;
    }

    export interface DoubleInputFilterSVGAttributes {
        in?: string;
        in2?: string;
    }

    export interface FitToViewBoxSVGAttributes {
        viewBox?: string;
        preserveAspectRatio?: SVGPreserveAspectRatio;
    }

    export interface GradientElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes {
        gradientUnits?: SVGUnits;
        gradientTransform?: string;
        spreadMethod?: "pad" | "reflect" | "repeat";
    }

    export interface GraphicsElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            Pick<
                PresentationSVGAttributes,
                | "clip-rule"
                | "mask"
                | "pointer-events"
                | "cursor"
                | "opacity"
                | "filter"
                | "display"
                | "visibility"
                | "color-interpolation"
                | "color-rendering"
            > {}

    export interface LightSourceElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T> {}

    export interface NewViewportSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            Pick<PresentationSVGAttributes, "overflow" | "clip"> {
        viewBox?: string;
    }

    export interface ShapeElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            Pick<
                PresentationSVGAttributes,
                | "color"
                | "fill"
                | "fill-rule"
                | "fill-opacity"
                | "stroke"
                | "stroke-width"
                | "stroke-linecap"
                | "stroke-linejoin"
                | "stroke-miterlimit"
                | "stroke-dasharray"
                | "stroke-dashoffset"
                | "stroke-opacity"
                | "shape-rendering"
            > {}

    export interface TextContentElementSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            Pick<
                PresentationSVGAttributes,
                | "font-family"
                | "font-style"
                | "font-variant"
                | "font-weight"
                | "font-stretch"
                | "font-size"
                | "font-size-adjust"
                | "kerning"
                | "letter-spacing"
                | "word-spacing"
                | "text-decoration"
                | "glyph-orientation-horizontal"
                | "glyph-orientation-vertical"
                | "direction"
                | "unicode-bidi"
                | "text-anchor"
                | "dominant-baseline"
                | "color"
                | "fill"
                | "fill-rule"
                | "fill-opacity"
                | "stroke"
                | "stroke-width"
                | "stroke-linecap"
                | "stroke-linejoin"
                | "stroke-miterlimit"
                | "stroke-dasharray"
                | "stroke-dashoffset"
                | "stroke-opacity"
            > {}

    export interface ZoomAndPanSVGAttributes {
        zoomAndPan?: "disable" | "magnify";
    }

    export interface AnimateSVGAttributes<T extends EventTarget>
        extends AnimationElementSVGAttributes<T>,
            AnimationAttributeTargetSVGAttributes,
            AnimationTimingSVGAttributes,
            AnimationValueSVGAttributes,
            AnimationAdditionSVGAttributes,
            Pick<PresentationSVGAttributes, "color-interpolation" | "color-rendering"> {}

    export interface AnimateMotionSVGAttributes<T extends EventTarget>
        extends AnimationElementSVGAttributes<T>,
            AnimationTimingSVGAttributes,
            AnimationValueSVGAttributes,
            AnimationAdditionSVGAttributes {
        path?: string;
        keyPoints?: string;
        rotate?: number | string | "auto" | "auto-reverse";
        origin?: "default";
    }

    export interface AnimateTransformSVGAttributes<T extends EventTarget>
        extends AnimationElementSVGAttributes<T>,
            AnimationAttributeTargetSVGAttributes,
            AnimationTimingSVGAttributes,
            AnimationValueSVGAttributes,
            AnimationAdditionSVGAttributes {
        type?: "translate" | "scale" | "rotate" | "skewX" | "skewY";
    }

    export interface CircleSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes {
        cx?: number | string;
        cy?: number | string;
        r?: number | string;
    }

    export interface ClipPathSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "clip-path"> {
        clipPathUnits?: SVGUnits;
    }

    export interface DefsSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes {}

    export interface DescSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            StylableSVGAttributes {}

    export interface EllipseSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes {
        cx?: number | string;
        cy?: number | string;
        rx?: number | string;
        ry?: number | string;
    }

    export interface FeBlendSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            DoubleInputFilterSVGAttributes,
            StylableSVGAttributes {
        mode?: "normal" | "multiply" | "screen" | "darken" | "lighten";
    }

    export interface FeColorMatrixSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {
        type?: "matrix" | "saturate" | "hueRotate" | "luminanceToAlpha";
        values?: string;
    }

    export interface FeComponentTransferSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {}

    export interface FeCompositeSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            DoubleInputFilterSVGAttributes,
            StylableSVGAttributes {
        operator?: "over" | "in" | "out" | "atop" | "xor" | "arithmetic";
        k1?: number | string;
        k2?: number | string;
        k3?: number | string;
        k4?: number | string;
    }

    export interface FeConvolveMatrixSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {
        order?: number | string;
        kernelMatrix?: string;
        divisor?: number | string;
        bias?: number | string;
        targetX?: number | string;
        targetY?: number | string;
        edgeMode?: "duplicate" | "wrap" | "none";
        kernelUnitLength?: number | string;
        preserveAlpha?: "true" | "false";
    }

    export interface FeDiffuseLightingSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes,
            Pick<PresentationSVGAttributes, "color" | "lighting-color"> {
        surfaceScale?: number | string;
        diffuseConstant?: number | string;
        kernelUnitLength?: number | string;
    }

    export interface FeDisplacementMapSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            DoubleInputFilterSVGAttributes,
            StylableSVGAttributes {
        scale?: number | string;
        xChannelSelector?: "R" | "G" | "B" | "A";
        yChannelSelector?: "R" | "G" | "B" | "A";
    }

    export interface FeDistantLightSVGAttributes<T extends EventTarget>
        extends LightSourceElementSVGAttributes<T> {
        azimuth?: number | string;
        elevation?: number | string;
    }

    export interface FeFloodSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            StylableSVGAttributes,
            Pick<PresentationSVGAttributes, "color" | "flood-color" | "flood-opacity"> {}

    export interface FeFuncSVGAttributes<T extends EventTarget> extends CoreSVGAttributes<T> {
        type?: "identity" | "table" | "discrete" | "linear" | "gamma";
        tableValues?: string;
        slope?: number | string;
        intercept?: number | string;
        amplitude?: number | string;
        exponent?: number | string;
        offset?: number | string;
    }

    export interface FeGaussianBlurSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {
        stdDeviation?: number | string;
    }

    export interface FeImageSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes {
        preserveAspectRatio?: SVGPreserveAspectRatio;
        href?: string;
    }

    export interface FeMergeSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            StylableSVGAttributes {}

    export interface FeMergeNodeSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            SingleInputFilterSVGAttributes {}

    export interface FeMorphologySVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {
        operator?: "erode" | "dilate";
        radius?: number | string;
    }

    export interface FeOffsetSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {
        dx?: number | string;
        dy?: number | string;
    }

    export interface FePointLightSVGAttributes<T extends EventTarget>
        extends LightSourceElementSVGAttributes<T> {
        x?: number | string;
        y?: number | string;
        z?: number | string;
    }

    export interface FeSpecularLightingSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes,
            Pick<PresentationSVGAttributes, "color" | "lighting-color"> {
        surfaceScale?: string;
        specularConstant?: string;
        specularExponent?: string;
        kernelUnitLength?: number | string;
    }

    export interface FeSpotLightSVGAttributes<T extends EventTarget>
        extends LightSourceElementSVGAttributes<T> {
        x?: number | string;
        y?: number | string;
        z?: number | string;
        pointsAtX?: number | string;
        pointsAtY?: number | string;
        pointsAtZ?: number | string;
        specularExponent?: number | string;
        limitingConeAngle?: number | string;
    }

    export interface FeTileSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            SingleInputFilterSVGAttributes,
            StylableSVGAttributes {}

    export interface FeTurbulanceSVGAttributes<T extends EventTarget>
        extends FilterPrimitiveElementSVGAttributes<T>,
            StylableSVGAttributes {
        baseFrequency?: number | string;
        numOctaves?: number | string;
        seed?: number | string;
        stitchTiles?: "stitch" | "noStitch";
        type?: "fractalNoise" | "turbulence";
    }

    export interface FilterSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes {
        filterUnits?: SVGUnits;
        primitiveUnits?: SVGUnits;
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        filterRes?: number | string;
    }

    export interface ForeignObjectSVGAttributes<T extends EventTarget>
        extends NewViewportSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "display" | "visibility"> {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
    }

    export interface GSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "display" | "visibility"> {}

    export interface ImageSVGAttributes<T extends EventTarget>
        extends NewViewportSVGAttributes<T>,
            GraphicsElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "color-profile" | "image-rendering"> {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        preserveAspectRatio?: ImagePreserveAspectRatio;
        href?: string;
    }

    export interface LineSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "marker-start" | "marker-mid" | "marker-end"> {
        x1?: number | string;
        y1?: number | string;
        x2?: number | string;
        y2?: number | string;
    }

    export interface LinearGradientSVGAttributes<T extends EventTarget>
        extends GradientElementSVGAttributes<T> {
        x1?: number | string;
        x2?: number | string;
        y1?: number | string;
        y2?: number | string;
    }

    export interface MarkerSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            FitToViewBoxSVGAttributes,
            Pick<PresentationSVGAttributes, "overflow" | "clip"> {
        markerUnits?: "strokeWidth" | "userSpaceOnUse";
        refX?: number | string;
        refY?: number | string;
        markerWidth?: number | string;
        markerHeight?: number | string;
        orient?: string;
    }

    export interface MaskSVGAttributes<T extends EventTarget>
        extends Omit<ContainerElementSVGAttributes<T>, "opacity" | "filter">,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes {
        maskUnits?: SVGUnits;
        maskContentUnits?: SVGUnits;
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
    }

    export interface MetadataSVGAttributes<T extends EventTarget> extends CoreSVGAttributes<T> {}

    export interface PathSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "marker-start" | "marker-mid" | "marker-end"> {
        d?: string;
        pathLength?: number | string;
    }

    export interface PatternSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            FitToViewBoxSVGAttributes,
            Pick<PresentationSVGAttributes, "overflow" | "clip"> {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        patternUnits?: SVGUnits;
        patternContentUnits?: SVGUnits;
        patternTransform?: string;
    }

    export interface PolygonSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "marker-start" | "marker-mid" | "marker-end"> {
        points?: string;
    }

    export interface PolylineSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "marker-start" | "marker-mid" | "marker-end"> {
        points?: string;
    }

    export interface RadialGradientSVGAttributes<T extends EventTarget>
        extends GradientElementSVGAttributes<T> {
        cx?: number | string;
        cy?: number | string;
        r?: number | string;
        fx?: number | string;
        fy?: number | string;
    }

    export interface RectSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ShapeElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        rx?: number | string;
        ry?: number | string;
    }

    export interface StopSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            StylableSVGAttributes,
            Pick<PresentationSVGAttributes, "color" | "stop-color" | "stop-opacity"> {
        offset?: number | string;
    }

    export interface SvgSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            NewViewportSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            FitToViewBoxSVGAttributes,
            ZoomAndPanSVGAttributes,
            PresentationSVGAttributes {
        version?: string;
        baseProfile?: string;
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        contentScriptType?: string;
        contentStyleType?: string;
        xmlns?: string;
    }

    export interface SwitchSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "display" | "visibility"> {}

    export interface SymbolSVGAttributes<T extends EventTarget>
        extends ContainerElementSVGAttributes<T>,
            NewViewportSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            FitToViewBoxSVGAttributes {}

    export interface TextSVGAttributes<T extends EventTarget>
        extends TextContentElementSVGAttributes<T>,
            GraphicsElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes,
            Pick<PresentationSVGAttributes, "writing-mode" | "text-rendering"> {
        x?: number | string;
        y?: number | string;
        dx?: number | string;
        dy?: number | string;
        rotate?: number | string;
        textLength?: number | string;
        lengthAdjust?: "spacing" | "spacingAndGlyphs";
    }

    export interface TextPathSVGAttributes<T extends EventTarget>
        extends TextContentElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            Pick<
                PresentationSVGAttributes,
                "alignment-baseline" | "baseline-shift" | "display" | "visibility"
            > {
        startOffset?: number | string;
        method?: "align" | "stretch";
        spacing?: "auto" | "exact";
        href?: string;
    }

    export interface TSpanSVGAttributes<T extends EventTarget>
        extends TextContentElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            Pick<
                PresentationSVGAttributes,
                "alignment-baseline" | "baseline-shift" | "display" | "visibility"
            > {
        x?: number | string;
        y?: number | string;
        dx?: number | string;
        dy?: number | string;
        rotate?: number | string;
        textLength?: number | string;
        lengthAdjust?: "spacing" | "spacingAndGlyphs";
    }

    export interface UseSVGAttributes<T extends EventTarget>
        extends GraphicsElementSVGAttributes<T>,
            ConditionalProcessingSVGAttributes,
            ExternalResourceSVGAttributes,
            StylableSVGAttributes,
            TransformableSVGAttributes {
        x?: number | string;
        y?: number | string;
        width?: number | string;
        height?: number | string;
        href?: string;
    }

    export interface ViewSVGAttributes<T extends EventTarget>
        extends CoreSVGAttributes<T>,
            ExternalResourceSVGAttributes,
            FitToViewBoxSVGAttributes,
            ZoomAndPanSVGAttributes {
        viewTarget?: string;
    }

    export interface IntrinsicElements {
        a: AnchorHTMLAttributes<HTMLAnchorElement>;
        abbr: HTMLAttributes<HTMLElement>;
        address: HTMLAttributes<HTMLElement>;
        area: AreaHTMLAttributes<HTMLAreaElement>;
        article: HTMLAttributes<HTMLElement>;
        aside: HTMLAttributes<HTMLElement>;
        audio: AudioHTMLAttributes<HTMLAudioElement>;
        b: HTMLAttributes<HTMLElement>;
        base: BaseHTMLAttributes<HTMLBaseElement>;
        bdi: HTMLAttributes<HTMLElement>;
        bdo: HTMLAttributes<HTMLElement>;
        big: HTMLAttributes<HTMLElement>;
        blockquote: BlockquoteHTMLAttributes<HTMLElement>;
        body: HTMLAttributes<HTMLBodyElement>;
        br: HTMLAttributes<HTMLBRElement>;
        button: ButtonHTMLAttributes<HTMLButtonElement>;
        canvas: CanvasHTMLAttributes<HTMLCanvasElement>;
        caption: HTMLAttributes<HTMLElement>;
        cite: HTMLAttributes<HTMLElement>;
        code: HTMLAttributes<HTMLElement>;
        col: ColHTMLAttributes<HTMLTableColElement>;
        colgroup: ColgroupHTMLAttributes<HTMLTableColElement>;
        data: DataHTMLAttributes<HTMLElement>;
        datalist: HTMLAttributes<HTMLDataListElement>;
        dd: HTMLAttributes<HTMLElement>;
        del: HTMLAttributes<HTMLElement>;
        details: DetailsHtmlAttributes<HTMLDetailsElement>;
        dfn: HTMLAttributes<HTMLElement>;
        dialog: DialogHtmlAttributes<HTMLDialogElement>;
        div: HTMLAttributes<HTMLDivElement>;
        dl: HTMLAttributes<HTMLDListElement>;
        dt: HTMLAttributes<HTMLElement>;
        em: HTMLAttributes<HTMLElement>;
        embed: EmbedHTMLAttributes<HTMLEmbedElement>;
        fieldset: FieldsetHTMLAttributes<HTMLFieldSetElement>;
        figcaption: HTMLAttributes<HTMLElement>;
        figure: HTMLAttributes<HTMLElement>;
        footer: HTMLAttributes<HTMLElement>;
        form: FormHTMLAttributes<HTMLFormElement>;
        h1: HTMLAttributes<HTMLHeadingElement>;
        h2: HTMLAttributes<HTMLHeadingElement>;
        h3: HTMLAttributes<HTMLHeadingElement>;
        h4: HTMLAttributes<HTMLHeadingElement>;
        h5: HTMLAttributes<HTMLHeadingElement>;
        h6: HTMLAttributes<HTMLHeadingElement>;
        head: HTMLAttributes<HTMLHeadElement>;
        header: HTMLAttributes<HTMLElement>;
        hgroup: HTMLAttributes<HTMLElement>;
        hr: HTMLAttributes<HTMLHRElement>;
        html: HTMLAttributes<HTMLHtmlElement>;
        i: HTMLAttributes<HTMLElement>;
        iframe: IframeHTMLAttributes<HTMLIFrameElement>;
        img: ImgHTMLAttributes<HTMLImageElement>;
        input: InputHTMLAttributes<HTMLInputElement>;
        ins: InsHTMLAttributes<HTMLModElement>;
        kbd: HTMLAttributes<HTMLElement>;
        keygen: KeygenHTMLAttributes<HTMLElement>;
        label: LabelHTMLAttributes<HTMLLabelElement>;
        legend: HTMLAttributes<HTMLLegendElement>;
        "hytts-frame": HTMLAttributes<HTMLDivElement>;
        li: LiHTMLAttributes<HTMLLIElement>;
        link: LinkHTMLAttributes<HTMLLinkElement>;
        main: HTMLAttributes<HTMLElement>;
        map: MapHTMLAttributes<HTMLMapElement>;
        mark: HTMLAttributes<HTMLElement>;
        menu: MenuHTMLAttributes<HTMLElement>;
        menuitem: HTMLAttributes<HTMLElement>;
        meta: MetaHTMLAttributes<HTMLMetaElement>;
        meter: MeterHTMLAttributes<HTMLElement>;
        nav: HTMLAttributes<HTMLElement>;
        noindex: HTMLAttributes<HTMLElement>;
        noscript: HTMLAttributes<HTMLElement>;
        object: ObjectHTMLAttributes<HTMLObjectElement>;
        ol: OlHTMLAttributes<HTMLOListElement>;
        optgroup: OptgroupHTMLAttributes<HTMLOptGroupElement>;
        option: OptionHTMLAttributes<HTMLOptionElement>;
        output: OutputHTMLAttributes<HTMLElement>;
        p: HTMLAttributes<HTMLParagraphElement>;
        param: ParamHTMLAttributes<HTMLParamElement>;
        picture: HTMLAttributes<HTMLElement>;
        pre: HTMLAttributes<HTMLPreElement>;
        progress: ProgressHTMLAttributes<HTMLProgressElement>;
        q: QuoteHTMLAttributes<HTMLQuoteElement>;
        rp: HTMLAttributes<HTMLElement>;
        rt: HTMLAttributes<HTMLElement>;
        ruby: HTMLAttributes<HTMLElement>;
        s: HTMLAttributes<HTMLElement>;
        samp: HTMLAttributes<HTMLElement>;
        script: ScriptHTMLAttributes<HTMLElement>;
        section: HTMLAttributes<HTMLElement>;
        select: SelectHTMLAttributes<HTMLSelectElement>;
        slot: HTMLSlotElementAttributes;
        small: HTMLAttributes<HTMLElement>;
        source: SourceHTMLAttributes<HTMLSourceElement>;
        span: HTMLAttributes<HTMLSpanElement>;
        strong: HTMLAttributes<HTMLElement>;
        style: StyleHTMLAttributes<HTMLStyleElement>;
        sub: HTMLAttributes<HTMLElement>;
        summary: HTMLAttributes<HTMLElement>;
        sup: HTMLAttributes<HTMLElement>;
        table: HTMLAttributes<HTMLTableElement>;
        tbody: HTMLAttributes<HTMLTableSectionElement>;
        td: TdHTMLAttributes<HTMLTableDataCellElement>;
        textarea: TextareaHTMLAttributes<HTMLTextAreaElement>;
        tfoot: HTMLAttributes<HTMLTableSectionElement>;
        th: ThHTMLAttributes<HTMLTableHeaderCellElement>;
        thead: HTMLAttributes<HTMLTableSectionElement>;
        time: TimeHTMLAttributes<HTMLElement>;
        title: HTMLAttributes<HTMLTitleElement>;
        tr: HTMLAttributes<HTMLTableRowElement>;
        track: TrackHTMLAttributes<HTMLTrackElement>;
        u: HTMLAttributes<HTMLElement>;
        ul: HTMLAttributes<HTMLUListElement>;
        var: HTMLAttributes<HTMLElement>;
        video: VideoHTMLAttributes<HTMLVideoElement>;
        wbr: HTMLAttributes<HTMLElement>;
        svg: SvgSVGAttributes<SVGSVGElement>;
        animate: AnimateSVGAttributes<SVGAnimateElement>;
        animateMotion: AnimateMotionSVGAttributes<SVGAnimateMotionElement>;
        animateTransform: AnimateTransformSVGAttributes<SVGAnimateTransformElement>;
        circle: CircleSVGAttributes<SVGCircleElement>;
        clipPath: ClipPathSVGAttributes<SVGClipPathElement>;
        defs: DefsSVGAttributes<SVGDefsElement>;
        desc: DescSVGAttributes<SVGDescElement>;
        ellipse: EllipseSVGAttributes<SVGEllipseElement>;
        feBlend: FeBlendSVGAttributes<SVGFEBlendElement>;
        feColorMatrix: FeColorMatrixSVGAttributes<SVGFEColorMatrixElement>;
        feComponentTransfer: FeComponentTransferSVGAttributes<SVGFEComponentTransferElement>;
        feComposite: FeCompositeSVGAttributes<SVGFECompositeElement>;
        feConvolveMatrix: FeConvolveMatrixSVGAttributes<SVGFEConvolveMatrixElement>;
        feDiffuseLighting: FeDiffuseLightingSVGAttributes<SVGFEDiffuseLightingElement>;
        feDisplacementMap: FeDisplacementMapSVGAttributes<SVGFEDisplacementMapElement>;
        feDistantLight: FeDistantLightSVGAttributes<SVGFEDistantLightElement>;
        feFlood: FeFloodSVGAttributes<SVGFEFloodElement>;
        feFuncA: FeFuncSVGAttributes<SVGFEFuncAElement>;
        feFuncB: FeFuncSVGAttributes<SVGFEFuncBElement>;
        feFuncG: FeFuncSVGAttributes<SVGFEFuncGElement>;
        feFuncR: FeFuncSVGAttributes<SVGFEFuncRElement>;
        feGaussianBlur: FeGaussianBlurSVGAttributes<SVGFEGaussianBlurElement>;
        feImage: FeImageSVGAttributes<SVGFEImageElement>;
        feMerge: FeMergeSVGAttributes<SVGFEMergeElement>;
        feMergeNode: FeMergeNodeSVGAttributes<SVGFEMergeNodeElement>;
        feMorphology: FeMorphologySVGAttributes<SVGFEMorphologyElement>;
        feOffset: FeOffsetSVGAttributes<SVGFEOffsetElement>;
        fePointLight: FePointLightSVGAttributes<SVGFEPointLightElement>;
        feSpecularLighting: FeSpecularLightingSVGAttributes<SVGFESpecularLightingElement>;
        feSpotLight: FeSpotLightSVGAttributes<SVGFESpotLightElement>;
        feTile: FeTileSVGAttributes<SVGFETileElement>;
        feTurbulence: FeTurbulanceSVGAttributes<SVGFETurbulenceElement>;
        filter: FilterSVGAttributes<SVGFilterElement>;
        foreignObject: ForeignObjectSVGAttributes<SVGForeignObjectElement>;
        g: GSVGAttributes<SVGGElement>;
        image: ImageSVGAttributes<SVGImageElement>;
        line: LineSVGAttributes<SVGLineElement>;
        linearGradient: LinearGradientSVGAttributes<SVGLinearGradientElement>;
        marker: MarkerSVGAttributes<SVGMarkerElement>;
        mask: MaskSVGAttributes<SVGMaskElement>;
        metadata: MetadataSVGAttributes<SVGMetadataElement>;
        path: PathSVGAttributes<SVGPathElement>;
        pattern: PatternSVGAttributes<SVGPatternElement>;
        polygon: PolygonSVGAttributes<SVGPolygonElement>;
        polyline: PolylineSVGAttributes<SVGPolylineElement>;
        radialGradient: RadialGradientSVGAttributes<SVGRadialGradientElement>;
        rect: RectSVGAttributes<SVGRectElement>;
        stop: StopSVGAttributes<SVGStopElement>;
        switch: SwitchSVGAttributes<SVGSwitchElement>;
        symbol: SymbolSVGAttributes<SVGSymbolElement>;
        text: TextSVGAttributes<SVGTextElement>;
        textPath: TextPathSVGAttributes<SVGTextPathElement>;
        tspan: TSpanSVGAttributes<SVGTSpanElement>;
        use: UseSVGAttributes<SVGUseElement>;
        view: ViewSVGAttributes<SVGViewElement>;
    }
}

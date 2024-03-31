# HyperText TypeScript (HyTTS)

HyTTS (pronounced "heights") is a full-stack web framework for server-side rendered web apps written in TypeScript.
End-to-end type safety from server code to browser code and back is one of its major design principles.
While HyTTS is heavily inspired by [React](https://reactjs.org/) and its JSX-based, component-oriented and declarative nature, it exclusively uses server-side rendering instead, with SPA-like interactivity based on concepts found in [Hotwire Turbo](https://hotwired.dev/) and [htmx](https://htmx.org/).

HyTTS' goal is to reduce the complexity of modern-day web development while retaining the user and developer experience improvements achieved by the web development community in recent years.

## Project Status

HyTTS is currently under development in my spare time, after having completed a successful experimentation and prototyping phase.
Nevertheless, things will likely change considerably in an effort to enhance the feature set and to reduce the complexity of HyTTS' API and implementation.

Thus, HyTTS is not yet ready for production use and it is not yet extensively documented.
Prerelease versions are already [available on NPM](https://www.npmjs.com/package/@hytts/hytts).

## HyTTS Overview

HyTTS features a [hypermedia-driven application architecture](https://htmx.org/essays/hypermedia-driven-applications/). Its basic abstraction are (synchronous or asynchronous) JSX components, similar to [React Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components).
Just like with React, these components are only ever executed on the server and never reach the browser.
In contrast to React, however, the server always renders the components to HTML instead of serialized JSX.

HyTTS has no concept similar to client-side React components. There is no [hydration](https://react.dev/reference/react-dom/client/hydrateRoot), no [resumability](https://qwik.dev/docs/concepts/resumable/), no [islands](https://docs.astro.build/en/concepts/islands/); in fact, there is no JSX-related client-side interactivity whatsoever.
Interactivity is instead achieved through additional server roundtrips to update explicitly marked dynamic parts of the DOM, similar to [Turbo Frames](https://turbo.hotwired.dev/handbook/frames).
For more fine-grained control, explicitly defined browser scripts can be used, i.e., inline TypeScript code that gets serialized to the browser without requiring a bundling step.

### JSX Components

The following example of a HyTTS JSX component shows that superficially, HyTTS and React Server Components look mostly identical:

```typescript jsx
type GreetingProps = {
    readonly userId: number;
}

async function Greeting(props: GreetingProps): Promise<JsxElement> {
    const userName = await loadUserNameFromDatabase(props.userId);
    return <p>Hello, {userName}!</p>;
}
```

A component can be synchronous or asynchronous.
It can optionally take a single `props` argument, and it returns a value of type `JsxElement` or `Promise<JsxElement>`.
Similar to React, you can [pass data deeply with the Context API](https://react.dev/learn/passing-data-deeply-with-context):

```typescript jsx
const UserIdContext = createContext<number>();

function ParentComponent() {
    const userId = // get from request cookie, for instance
    return (
        <UserIdContext value={userId}>
            <ChildComponent />
        </UserIdContext>
    );
}

function ChildComponent() {
    const userId = useContext(UserIdContext);
    return <p>{userId}</p>;
}
```

The `useContext` function is similar to React's `useContext` hook, except that invocations of the function do not have to follow the [rules of hooks](https://react.dev/warnings/invalid-hook-call-warning) in HyTTS.
HyTTS users are expected to write their own abstractions around the `useContext` function, which, by convention, also start with the word `use` just like in React.
Contexts in HyTTS typically model request-specific data, and the `use` prefix thus signals that something happens that is specific to the currently executing request.

### Routing

HyTTS features a type-safe router that takes incoming HTTP requests, routes them to the correct JSX components, and returns the rendered HTML in the HTTP responses.
The router uses [Zod](https://github.com/colinhacks/zod) to validate all incoming path, search, or body parameters.

```typescript jsx
const docsRoutes = routes({
    "GET /": GreetingSelector,
    "GET /greet": route(z.object({ name: z.string().trim().min(1) }), Greeting),
});

const href = getHrefs(docsRoutes);

function GreetingSelector() {
    return (
        <>
            <A href={href("GET /greet", { name: "Axel" })}>Greet Axel</A>
            <A href={href("GET /greet", { name: "HyTTS" })}>Greet HyTTS</A>
        </>
    );
}

function Greeting(props: { name: string }) {
    return (
        <>
            <p>Hello, {props.name}!</p>
            <A href={href("GET /")}>Back To Overview</A>
        </p>
    );
}
```

There can also be `POST` routes, for instance if HTML forms are used.
The `href` function is fully type-safe, meaning that it ensures at the type-level that the referenced URLs for the given HTTP methods actually exist and that all necessary path, search, and body parameters are provided and typed correctly.

### Browser Scripts

It is sometimes necessary to execute client-side JavaScript, for instance when a page loads or when some button is clicked.
Browser scripts enable these scenarios in a type-safe way.
They also ensure that no potentially sensitive server data gets accidentally leaked to the browser by not allowing any closures.
If you want to pass data along, you have to do so explicitly using a "double lambda pattern", where the outer lambda provides the explicit closure over the server data.

```typescript jsx
function ClientSideScripting() {
    const nameOnServer = "Axel";

    return (
        <>
            {/*
                A function that is executed once this component's HTML is added to the DOM.
                Its "explicit closure" is empty, meaning it cannot reference any server data.
            */}
            <Script
                script={createBrowserScript(
                    () => console.log("component loaded")
                )}
            />
            <button
                {/*
                    When the button is clicked, the inner lambda is executed.
                    - `e` is of type `EventArgs<HTMLAnchorElement, MouseEvent>`
                    - `nameInBrowser` is automatically deduced to be of type `string`
                      and contains the value `"Axel"` at runtime.
                */}
                browser:onclick={createEventHandler((nameInBrowser) => (e) => {
                    e.preventDefault();
                    alert(`Hello, ${nameInBrowser}!`);
                }, nameOnServer)}
            >
                Patients
            </button>
        </>
    );
}
```

### Frames

A frame is a dynamic part of an HTML page whose contents can be replaced with HTML returned from `fetch` requests.
The frame's HTML nodes are not simply replaced, they are merged with the new HTML nodes returned by the server using a variant of [React's reconciliation algorithm](https://legacy.reactjs.org/docs/reconciliation.html).
This ensures that certain browser state, such as CSS animations, focused nodes, or scroll positions of `textarea`s don't get lost on frame updates.

```typescript jsx
const frameRoutes = routes({
    "GET /": RenderPage,
    "GET /my-frame": RenderFrame,
});

const href = getHrefs(frameRoutes);
const MyFrame = createFrame("myFrame");

function RenderPage() {
    return (
        <>
            <A href={href("GET /my-frame")} target={MyFrame}>
                Update frame
            </A>
            <RenderFrame />
        </>
    );
}

function RenderFrame() {
    return (
        <MyFrame>
            {Date.now()}
        </MyFrame>
    );
}
```

The frame gets rendered for the first time when `RenderPage` is executed on the original page load.
Once the user clicks on the link, HyTTS' runtime library issues a `fetch` request to the server, which returns the HTML produced by `RenderFrame`.
The frame's new contents get merged into the current DOM, in this case simply replacing the original request's date with the date the server rendered the response of the click event.

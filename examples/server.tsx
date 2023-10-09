import { createExpressMiddleware, ErrorBoundary, type PropsWithChildren } from "@hytts/hytts";

export type InitializeServer = typeof initializeServer;

export function initializeServer() {
    return createExpressMiddleware(
        <ErrorBoundary
            ErrorView={(error) => (
                <Document>
                    <pre>${`${error}`}</pre>
                </Document>
            )}
        >
            <Document>
                <div class="text-green-400">Hallo Welt!!!</div>
            </Document>
        </ErrorBoundary>,
        (error) => {
            return `
                <!DOCTYPE html>
                <html lang="en">
                    <head>
                        <meta charset="utf-8" />
                        <title>Error</title>
                        <script type="module" src="/hot-reloader.js"></script>
                    </head>
                    <body>
                        <pre>${`${error}`}</pre>
                    </body> 
                </html>
            `;
        },
    );
}

function Document({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <title>HyTTS</title>
                <link rel="stylesheet" href="/styles.g.css" />
                <script src="/main.g.js" />
                <script type="module" src="/hot-reloader.js"></script>
            </head>
            <body>{children}</body>
        </html>
    );
}

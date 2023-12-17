import { expect, test } from "@playwright/test";
import { createRouter } from "@/routing/router";
import { runE2eTestApp } from "@/test-helpers";

test("has title", async ({ page }) => {
    await runE2eTestApp(
        page,
        routes({
            "GET /": () => <div id="test">test</div>,
        }),
        async (goto, href) => {
            await goto(href("GET /"));
            await expect(page.locator("#test")).toHaveText("test");
        },
    );
});

const { routes } = createRouter<{}>({});

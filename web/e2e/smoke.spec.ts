import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// The core loops, end to end: edit→autosave→reload, mentions as
// ID-persistent chips, rename propagation, draft→canon, sidebar
// search, ⌘K palette, relation add/remove. A scratch world is built
// via the API and torn down after.

let worldId: string;
let types: Record<string, string> = {};
let hero: { id: string }; // Character
let town: { id: string }; // Place

async function api(req: APIRequestContext, method: string, path: string, data?: unknown) {
  const res = await req.fetch(`http://localhost:8080${path}`, {
    method,
    data,
  });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
  return res.json();
}

test.beforeAll(async ({ request }) => {
  const w = await api(request, "POST", "/api/worlds", { name: `e2e-${Date.now()}` });
  worldId = w.id;
  const world = await api(request, "GET", `/api/worlds/${worldId}`);
  for (const t of world.types) types[t.name] = t.id;
  hero = await api(request, "POST", `/api/worlds/${worldId}/entries`, {
    type_id: types["Character"],
    title: "Vex the Unready",
  });
  town = await api(request, "POST", `/api/worlds/${worldId}/entries`, {
    type_id: types["Place"],
    title: "Cinderford",
  });
});

test.afterAll(async ({ request }) => {
  if (worldId) await api(request, "DELETE", `/api/worlds/${worldId}`);
});

const bodyEditor = (page: Page) => page.locator(".tiptap").last();

test("edit body, autosave, reload persists", async ({ page }) => {
  await page.goto(`/e/${hero.id}`);
  const ed = bodyEditor(page);
  await ed.click();
  await page.keyboard.type("Vex never draws first.");
  await expect(page.getByText("saved", { exact: true })).toBeVisible({ timeout: 8000 });
  await page.reload();
  await expect(bodyEditor(page)).toContainText("Vex never draws first.");
});

test("[[ inserts an ID-carrying mention chip; rename follows", async ({ page, request }) => {
  await page.goto(`/e/${hero.id}`);
  const ed = bodyEditor(page);
  await ed.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Lives in [[Cinder");
  await page.getByRole("button", { name: /Cinderford/ }).first().click();
  const chip = ed.locator("span[data-mention-id]");
  await expect(chip).toHaveText("Cinderford");
  await expect(page.getByText("saved", { exact: true })).toBeVisible({ timeout: 8000 });

  // Rename the target via API — the chip label must follow (ID link).
  await api(request, "PATCH", `/api/entries/${town.id}`, { title: "Cinderford-upon-Ash" });
  await page.reload();
  await expect(bodyEditor(page).locator("span[data-mention-id]")).toHaveText(
    "Cinderford-upon-Ash",
  );
  await api(request, "PATCH", `/api/entries/${town.id}`, { title: "Cinderford" });
});

test("chip click navigates without a full reload", async ({ page }) => {
  await page.goto(`/e/${hero.id}`);
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__spa = true;
  });
  await bodyEditor(page).locator("span[data-mention-id]").click();
  await expect(page).toHaveURL(new RegExp(town.id));
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__spa),
  ).toBe(true);
});

test("draft content promotes to canon", async ({ page, request }) => {
  // AI-authored draft via the API's import of tenet 4: create as draft
  // by writing markdown through MCP is heavier; simulate by marking the
  // whole entry draft-authored: give hero a draft body via world policy.
  await api(request, "PATCH", `/api/worlds/${worldId}`, {
    humans_author_as: "draft",
  });
  const scratch = await api(request, "POST", `/api/worlds/${worldId}/entries`, {
    type_id: types["Character"],
    title: "Draft Dane",
  });
  await api(request, "PATCH", `/api/entries/${scratch.id}`, {
    fields: { occupation: "haunt" },
  });
  await page.goto(`/e/${scratch.id}`);
  await page.getByRole("button", { name: "Mark all canon" }).click();
  await expect(page.getByRole("button", { name: "Mark all canon" })).toBeHidden();
  const e = await api(request, "GET", `/api/entries/${scratch.id}`);
  expect(e.status).toBe("canon");
  await api(request, "PATCH", `/api/worlds/${worldId}`, {
    humans_author_as: "canon",
  });
});

test("sidebar search narrows the list", async ({ page }) => {
  await page.goto(`/e/${hero.id}`);
  await page.locator("nav input").fill("cinder");
  await expect(page.locator("nav ul a")).toHaveCount(1);
  await expect(page.locator("nav ul a").first()).toContainText("Cinderford");
});

test("cmd+K palette jumps to an entry and lists page actions", async ({ page }) => {
  await page.goto(`/e/${hero.id}`);
  // Commands register once the entry loads — wait for the title.
  await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue(
    "Vex the Unready",
  );
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  const palette = page.locator(".fixed.z-50");
  await expect(palette.getByRole("button", { name: /Delete entry/ })).toBeVisible();
  await palette.locator("input").fill("cinderford");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(town.id));
});

test("relations add and remove from the reverse side", async ({ page }) => {
  await page.goto(`/e/${town.id}`);
  // Place declares no 'hometown' — Character does; the People-from-here
  // reverse section doesn't exist until an edge does, so author forward
  // from the Character instead, then remove from the Place side.
  await page.goto(`/e/${hero.id}`);
  await page.getByTitle("Add hometown").click();
  await page.locator("select").selectOption({ label: "Cinderford (Place)" });
  await page.getByRole("button", { name: "add", exact: true }).click();
  const pill = page.locator("span.group.relative", { hasText: "Cinderford" });
  await expect(pill).toBeVisible();

  await page.goto(`/e/${town.id}`);
  // Scope to the reverse section — Vex also appears under Mentioned in.
  const section = page
    .locator("div.flex.gap-3", { hasText: /People From Here/i })
    .first();
  const revPill = section.locator("span.group.relative", {
    hasText: "Vex the Unready",
  });
  await expect(revPill).toBeVisible();
  await revPill.hover();
  await revPill.getByTitle("Remove relation").click();
  await expect(revPill).toBeHidden();
});

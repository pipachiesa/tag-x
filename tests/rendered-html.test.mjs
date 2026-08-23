import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Tag X workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tag X — Football video intelligence<\/title>/i);
  assert.match(html, /MATCH VIDEO/);
  assert.match(html, /EVENT LOCATION/);
  assert.match(html, /QUICK TAG/);
  assert.match(html, /Illustrator/);
  assert.match(html, /Match sessions/i);
});

test("keeps Supabase credentials on the server and protects database tables", async () => {
  const [page, route, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|process\.env\.SUPABASE/);
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /8_000_000/);
  assert.match(schema, /enable row level security/gi);
  assert.match(schema, /revoke all on public\.tagx_workspaces from anon, authenticated/i);
  assert.match(schema, /owner_id uuid not null unique references/i);
});

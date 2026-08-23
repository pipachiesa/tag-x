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

test("server-renders the direct Google authentication entry point", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tag X — Football video intelligence<\/title>/i);
  assert.match(html, /Continue with Google/);
  assert.match(html, /Google Workspace accounts/);
  assert.match(html, /Football video intelligence/);
});

test("uses Supabase Google OAuth without ChatGPT authentication and protects database tables", async () => {
  const [page, authGate, auth, route, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|process\.env\.SUPABASE/);
  assert.match(authGate, /signInWithOAuth/);
  assert.match(authGate, /provider:\s*"google"/);
  assert.doesNotMatch(authGate, /gmail\|googlemail|sign-in-with-chatgpt/i);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /getSupabaseUser/);
  assert.doesNotMatch(route, /ChatGPT|gmail\|googlemail/i);
  assert.match(route, /8_000_000/);
  assert.match(schema, /enable row level security/gi);
  assert.match(schema, /revoke all on public\.tagx_workspaces from anon, authenticated/i);
  assert.match(schema, /owner_id uuid not null unique references/i);
});

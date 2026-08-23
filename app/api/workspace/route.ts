import { NextResponse } from "next/server";
import { getChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

type CloudState = Record<string, unknown>;

function databaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

function databaseHeaders(key: string, extra: HeadersInit = {}): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function authenticatedUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (user && /@(gmail|googlemail)\.com$/i.test(user.email)) return user;
  if (user) return null;
  if (process.env.NODE_ENV !== "production") return { userId: "tagx-local-developer", email: "local@tagx.dev", displayName: "Local analyst", fullName: "Local analyst" };
  return null;
}

async function ensureProfile(user: ChatGPTUser, url: string, key: string) {
  const response = await fetch(`${url}/rest/v1/tagx_profiles?on_conflict=external_user_id`, {
    method: "POST",
    headers: databaseHeaders(key, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({ external_user_id: user.userId, email: user.email, display_name: user.displayName }),
  });
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
  const profiles = (await response.json()) as Array<{ id: string }>;
  if (!profiles[0]?.id) throw new Error("Profile was not returned");
  return profiles[0].id;
}

export async function GET() {
  const config = databaseConfig();
  if (!config) return NextResponse.json({ configured: false }, { status: 503 });
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const ownerId = await ensureProfile(user, config.url, config.key);
    const response = await fetch(`${config.url}/rest/v1/tagx_workspaces?owner_id=eq.${encodeURIComponent(ownerId)}&select=state&limit=1`, { headers: databaseHeaders(config.key), cache: "no-store" });
    if (!response.ok) throw new Error(`Workspace request failed (${response.status})`);
    const rows = (await response.json()) as Array<{ state: CloudState }>;
    return NextResponse.json({ configured: true, state: rows[0]?.state ?? null, user });
  } catch (error) {
    console.error("Tag X cloud load failed", error);
    return NextResponse.json({ error: "Cloud workspace could not be loaded" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const config = databaseConfig();
  if (!config) return NextResponse.json({ configured: false }, { status: 503 });
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const state = (await request.json()) as CloudState;
    const encodedSize = new TextEncoder().encode(JSON.stringify(state)).byteLength;
    if (!state || Array.isArray(state) || encodedSize > 8_000_000) return NextResponse.json({ error: "Invalid workspace state" }, { status: 400 });
    const ownerId = await ensureProfile(user, config.url, config.key);
    const response = await fetch(`${config.url}/rest/v1/tagx_workspaces?on_conflict=owner_id`, {
      method: "POST",
      headers: databaseHeaders(config.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ owner_id: ownerId, state }),
    });
    if (!response.ok) throw new Error(`Workspace save failed (${response.status})`);
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Tag X cloud save failed", error);
    return NextResponse.json({ error: "Cloud workspace could not be saved" }, { status: 502 });
  }
}

import webpush from "web-push";

export type UserId = "carlos" | "jorge" | "luis";
export type Item = { id: number; text: string; done: boolean; completedAt?: string };
export type Lists = Record<UserId, Item[]>;
export type HouseState = { id: string; lists: Lists; occupiedBy: UserId | null; updatedAt: string };
export type BrowserPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export const users = [
  { id: "carlos", name: "Carlos W", initials: "CW", color: "coral" },
  { id: "jorge", name: "Jorge A", initials: "JA", color: "blue" },
  { id: "luis", name: "Luis M", initials: "LM", color: "green" },
] as const;

export const initialState: HouseState = {
  id: "main-home",
  lists: {
    carlos: [{ id: 1, text: "Leche", done: false }, { id: 2, text: "Papel de cocina", done: true }],
    jorge: [{ id: 3, text: "Jabón para platos", done: false }],
    luis: [{ id: 4, text: "Café", done: false }, { id: 5, text: "Bombillas", done: false }],
  },
  occupiedBy: null,
  updatedAt: new Date(0).toISOString(),
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireConfig() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno de Vercel.");
  return { supabaseUrl, supabaseKey };
}

async function supabase<T>(path: string, init?: RequestInit): Promise<T> {
  const { supabaseUrl, supabaseKey } = requireConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function getState(): Promise<HouseState> {
  const rows = await supabase<HouseState[]>("house_state?id=eq.main-home&select=*");
  const state = rows[0] ?? initialState;
  const now = Date.now();
  let changed = false;
  const lists = Object.fromEntries(Object.entries(state.lists).map(([userId, items]) => {
    const nextItems = items.flatMap((item) => {
      if (!item.done) return [item];
      if (!item.completedAt) { changed = true; return [{ ...item, completedAt: new Date(now).toISOString() }]; }
      if (now - new Date(item.completedAt).getTime() >= 24 * 60 * 60 * 1000) { changed = true; return []; }
      return [item];
    });
    return [userId, nextItems];
  })) as Lists;
  const cleaned = { ...state, lists };
  return changed ? saveState({ ...cleaned, updatedAt: new Date(now).toISOString() }) : cleaned;
}

export async function saveState(state: HouseState): Promise<HouseState> {
  const rows = await supabase<HouseState[]>("house_state?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ ...state, updated_at: state.updatedAt, updatedAt: undefined }),
  });
  return rows[0] ?? state;
}

export async function saveSubscription(userId: UserId, subscription: BrowserPushSubscription) {
  return supabase("push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint, subscription }),
  });
}

export async function notifyOtherUsers(sender: UserId, payload: { title: string; body: string }) {
  const rows = await supabase<{ subscription: BrowserPushSubscription }[]>(`push_subscriptions?user_id=not.eq.${sender}&select=subscription`);
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", publicKey, privateKey);
  await Promise.all(rows.map(async ({ subscription }) => {
    try { await webpush.sendNotification(subscription, JSON.stringify(payload)); }
    catch (error: unknown) { if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) return; }
  }));
}

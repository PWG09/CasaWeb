import { NextResponse } from "next/server";
import { getState, notifyOtherUsers, saveState, type UserId } from "@/lib/house";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getState()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el estado." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { userId?: UserId; lists?: Record<UserId, { id: number; text: string; done: boolean; completedAt?: string }[]>; occupiedBy?: UserId | null; message?: { title: string; body: string } };
    if (!body.userId || !["carlos", "jorge", "luis"].includes(body.userId)) return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });
    const current = await getState();
    const state = await saveState({ id: "main-home", lists: body.lists ?? current.lists, occupiedBy: body.occupiedBy === undefined ? current.occupiedBy : body.occupiedBy, updatedAt: new Date().toISOString() });
    if (body.message) await notifyOtherUsers(body.userId, body.message);
    return NextResponse.json(state);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el estado." }, { status: 503 }); }
}

import { NextResponse } from "next/server";
import { saveSubscription, type BrowserPushSubscription, type UserId } from "@/lib/house";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { userId?: UserId; subscription?: PushSubscriptionJSON };
    const subscription = body.subscription as BrowserPushSubscription | undefined;
    if (!body.userId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
    await saveSubscription(body.userId, subscription);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el dispositivo." }, { status: 503 }); }
}

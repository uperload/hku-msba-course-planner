import { NextResponse } from "next/server";
import { getResendClient, storeReceivingEmail } from "@/lib/course-email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });

  const payload = await request.text();
  try {
    const event = getResendClient().webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret: secret,
    });
    if (event.type !== "email.received") return NextResponse.json({ received: true, ignored: true });
    const full = await getResendClient().emails.receiving.get(event.data.email_id, { html_format: "cid" });
    if (full.error || !full.data) throw new Error(full.error?.message || "Email not found");
    const stored = await storeReceivingEmail(full.data);
    return NextResponse.json({ received: true, stored });
  } catch (error) {
    console.error("Invalid Resend webhook", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}

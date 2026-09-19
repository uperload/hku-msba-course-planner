import { NextResponse } from "next/server";
import { hasCourseEmailAccess, listCourseEmails, syncResendInbox } from "@/lib/course-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!hasCourseEmailAccess(request)) {
    return NextResponse.json({ error: "Invalid course email access key" }, { status: 401 });
  }
  try {
    const sync = await syncResendInbox();
    const messages = await listCourseEmails();
    return NextResponse.json({
      source: "moodle@info.hku.hk",
      fetchedAt: new Date().toISOString(),
      sync,
      messages,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Course email sync failed", error);
    return NextResponse.json({ error: "Could not sync the course email inbox" }, { status: 502 });
  }
}

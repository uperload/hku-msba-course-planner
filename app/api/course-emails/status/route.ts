import { NextResponse } from "next/server";
import { courseEmailConfig } from "@/lib/course-email";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(courseEmailConfig(), {
    headers: { "cache-control": "no-store" },
  });
}

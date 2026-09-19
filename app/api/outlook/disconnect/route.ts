import { NextResponse } from "next/server";
import { outlookCookies } from "@/lib/outlook";

export async function POST() {
  const response = NextResponse.json({ disconnected: true });
  Object.values(outlookCookies).forEach((name) => {
    response.cookies.delete({ name, path: "/api/outlook" });
  });
  return response;
}

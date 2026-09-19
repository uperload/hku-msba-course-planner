import { cookies } from "next/headers";
import { isOutlookConfigured, outlookCookies, readProfile, unseal } from "@/lib/outlook";

export async function GET() {
  if (!isOutlookConfigured()) {
    return Response.json({ configured: false, connected: false });
  }

  const cookieStore = await cookies();
  const profile = readProfile(cookieStore.get(outlookCookies.profile)?.value);
  const refreshToken = unseal(cookieStore.get(outlookCookies.refresh)?.value);
  return Response.json({
    configured: true,
    connected: Boolean(profile && refreshToken),
    account: profile ? { name: profile.name, email: profile.email } : null,
  });
}

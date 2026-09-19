import { NextRequest, NextResponse } from "next/server";
import {
  outlookCookies,
  redeemAuthorizationCode,
  requestOrigin,
  safeEqual,
  seal,
  secureCookie,
  type OutlookProfile,
} from "@/lib/outlook";

type GraphProfile = {
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(outlookCookies.state)?.value;
  const verifier = request.cookies.get(outlookCookies.verifier)?.value;

  if (!code || !verifier || !safeEqual(state || undefined, storedState)) {
    return NextResponse.redirect(new URL("/?outlook=invalid-state", origin));
  }

  try {
    const tokens = await redeemAuthorizationCode(request, code, verifier);
    if (!tokens.refresh_token) throw new Error("Microsoft did not return a refresh token");
    const graphResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      },
    );
    if (!graphResponse.ok) throw new Error("Microsoft profile request failed");
    const graphProfile = await graphResponse.json() as GraphProfile;
    const profile: OutlookProfile = {
      name: graphProfile.displayName || "Outlook user",
      email: graphProfile.mail || graphProfile.userPrincipalName || "Connected Outlook account",
      expiresAt: Date.now() + Math.max(60, tokens.expires_in - 60) * 1000,
    };

    const response = NextResponse.redirect(new URL("/?outlook=connected", origin));
    response.cookies.set(outlookCookies.access, seal(tokens.access_token), secureCookie(tokens.expires_in));
    response.cookies.set(outlookCookies.refresh, seal(tokens.refresh_token), secureCookie(30 * 24 * 60 * 60));
    response.cookies.set(outlookCookies.profile, seal(JSON.stringify(profile)), secureCookie(30 * 24 * 60 * 60));
    response.cookies.delete({ name: outlookCookies.state, path: "/api/outlook" });
    response.cookies.delete({ name: outlookCookies.verifier, path: "/api/outlook" });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?outlook=failed", origin));
  }
}

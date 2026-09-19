import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  callbackUrl,
  codeChallenge,
  isOutlookConfigured,
  microsoftConfig,
  OUTLOOK_SCOPES,
  outlookCookies,
  requestOrigin,
  secureCookie,
} from "@/lib/outlook";

export async function GET(request: Request) {
  if (!isOutlookConfigured()) {
    return NextResponse.redirect(new URL("/?outlook=not-configured", requestOrigin(request)));
  }

  const config = microsoftConfig();
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const authorizeUrl = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`,
  );
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl(request));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(outlookCookies.state, state, secureCookie(10 * 60));
  response.cookies.set(outlookCookies.verifier, verifier, secureCookie(10 * 60));
  return response;
}

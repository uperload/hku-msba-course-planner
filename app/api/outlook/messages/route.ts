import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isOutlookConfigured,
  MOODLE_SENDER,
  outlookCookies,
  readProfile,
  refreshMicrosoftToken,
  seal,
  secureCookie,
  unseal,
  type MicrosoftTokenResponse,
  type OutlookProfile,
} from "@/lib/outlook";

type GraphMessage = {
  id: string;
  subject?: string;
  receivedDateTime: string;
  bodyPreview?: string;
  webLink?: string;
  isRead?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
};

type GraphMessages = { value?: GraphMessage[] };

export async function GET() {
  if (!isOutlookConfigured()) {
    return Response.json({ error: "Outlook integration is not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const profile = readProfile(cookieStore.get(outlookCookies.profile)?.value);
  const refreshToken = unseal(cookieStore.get(outlookCookies.refresh)?.value);
  let accessToken = unseal(cookieStore.get(outlookCookies.access)?.value);
  let refreshedTokens: MicrosoftTokenResponse | null = null;

  if (!profile || !refreshToken) {
    return Response.json({ error: "Outlook account is not connected", reconnect: true }, { status: 401 });
  }
  let activeRefreshToken = refreshToken;

  try {
    if (!accessToken || profile.expiresAt <= Date.now()) {
      refreshedTokens = await refreshMicrosoftToken(refreshToken);
      accessToken = refreshedTokens.access_token;
      activeRefreshToken = refreshedTokens.refresh_token || refreshToken;
    }

    let graphResponse = await fetchMoodleMessages(accessToken);
    if (graphResponse.status === 401) {
      refreshedTokens = await refreshMicrosoftToken(activeRefreshToken);
      accessToken = refreshedTokens.access_token;
      activeRefreshToken = refreshedTokens.refresh_token || activeRefreshToken;
      graphResponse = await fetchMoodleMessages(accessToken);
    }
    if (!graphResponse.ok) {
      throw new Error(`Microsoft Graph request failed (${graphResponse.status})`);
    }

    const graphData = await graphResponse.json() as GraphMessages;
    const messages = (graphData.value || [])
      .sort((left, right) => right.receivedDateTime.localeCompare(left.receivedDateTime))
      .filter((message) => message.from?.emailAddress?.address?.toLowerCase() === MOODLE_SENDER)
      .map((message) => ({
        id: message.id,
        subject: message.subject || "(No subject)",
        receivedAt: message.receivedDateTime,
        preview: message.bodyPreview || "",
        webLink: safeOutlookLink(message.webLink),
        isRead: Boolean(message.isRead),
        courseCodes: extractCourseCodes(`${message.subject || ""} ${message.bodyPreview || ""}`),
      }));

    const response = NextResponse.json({
      account: { name: profile.name, email: profile.email },
      source: MOODLE_SENDER,
      fetchedAt: new Date().toISOString(),
      messages,
    });
    if (refreshedTokens) applyRefreshedCookies(response, refreshedTokens, profile, activeRefreshToken);
    return response;
  } catch {
    return Response.json(
      { error: "Could not read course emails. Please reconnect Outlook.", reconnect: true },
      { status: 502 },
    );
  }
}

function fetchMoodleMessages(accessToken: string) {
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$search", `\"from:${MOODLE_SENDER}\"`);
  url.searchParams.set("$select", "id,subject,receivedDateTime,from,bodyPreview,webLink,isRead");
  url.searchParams.set("$top", "50");
  return fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      consistencyLevel: "eventual",
      prefer: 'outlook.body-content-type="text"',
    },
    cache: "no-store",
  });
}

function extractCourseCodes(value: string) {
  return Array.from(new Set((value.match(/\bMSBA\s*\d{4}\b/gi) || []).map((code) => code.replace(/\s+/g, "").toUpperCase())));
}

function safeOutlookLink(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowedHosts = new Set(["outlook.office.com", "outlook.office365.com"]);
    return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function applyRefreshedCookies(
  response: NextResponse,
  tokens: MicrosoftTokenResponse,
  profile: OutlookProfile,
  previousRefreshToken: string,
) {
  const updatedProfile = {
    ...profile,
    expiresAt: Date.now() + Math.max(60, tokens.expires_in - 60) * 1000,
  };
  response.cookies.set(outlookCookies.access, seal(tokens.access_token), secureCookie(tokens.expires_in));
  response.cookies.set(
    outlookCookies.refresh,
    seal(tokens.refresh_token || previousRefreshToken),
    secureCookie(30 * 24 * 60 * 60),
  );
  response.cookies.set(outlookCookies.profile, seal(JSON.stringify(updatedProfile)), secureCookie(30 * 24 * 60 * 60));
}

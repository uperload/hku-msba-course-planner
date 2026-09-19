import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const MOODLE_SENDER = "moodle@info.hku.hk";
export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Read",
];

export const outlookCookies = {
  access: "hku_outlook_access",
  refresh: "hku_outlook_refresh",
  profile: "hku_outlook_profile",
  state: "hku_outlook_state",
  verifier: "hku_outlook_verifier",
} as const;

export type OutlookProfile = {
  name: string;
  email: string;
  expiresAt: number;
};

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export function isOutlookConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID
      && process.env.MICROSOFT_CLIENT_SECRET
      && process.env.OUTLOOK_SESSION_SECRET
      && process.env.OUTLOOK_SESSION_SECRET.length >= 32,
  );
}

export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const sessionSecret = process.env.OUTLOOK_SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret || sessionSecret.length < 32) {
    throw new Error("Outlook integration is not configured");
  }

  return {
    clientId,
    clientSecret,
    sessionSecret,
    tenantId: process.env.MICROSOFT_TENANT_ID || "organizations",
  };
}

export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProtocol || "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function callbackUrl(request: Request) {
  return `${requestOrigin(request)}/api/outlook/callback`;
}

function encryptionKey() {
  return createHash("sha256").update(microsoftConfig().sessionSecret).digest();
}

export function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function unseal(value?: string) {
  if (!value) return null;
  try {
    const payload = Buffer.from(value, "base64url");
    if (payload.length <= 28) return null;
    const iv = payload.subarray(0, 12);
    const authTag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function readProfile(value?: string): OutlookProfile | null {
  const decrypted = unseal(value);
  if (!decrypted) return null;
  try {
    const profile = JSON.parse(decrypted) as Partial<OutlookProfile>;
    if (
      typeof profile.name !== "string"
      || typeof profile.email !== "string"
      || typeof profile.expiresAt !== "number"
    ) return null;
    return profile as OutlookProfile;
  } catch {
    return null;
  }
}

export function safeEqual(left?: string, right?: string) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function secureCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/outlook",
    maxAge,
  };
}

export async function redeemAuthorizationCode(
  request: Request,
  code: string,
  verifier: string,
) {
  const config = microsoftConfig();
  return tokenRequest(config.tenantId, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(request),
    scope: OUTLOOK_SCOPES.join(" "),
  });
}

export async function refreshMicrosoftToken(refreshToken: string) {
  const config = microsoftConfig();
  return tokenRequest(config.tenantId, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: OUTLOOK_SCOPES.join(" "),
  });
}

async function tokenRequest(tenantId: string, values: Record<string, string>) {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed (${response.status})`);
  }
  return response.json() as Promise<MicrosoftTokenResponse>;
}

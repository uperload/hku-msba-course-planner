import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { Resend, type GetReceivingEmailResponseSuccess } from "resend";

export const MOODLE_SENDER = "moodle@info.hku.hk";

export type StoredCourseEmail = {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  preview: string;
  content: string;
  courseCodes: string[];
};

let schemaPromise: Promise<void> | null = null;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Course email database is not configured");
  return neon(url);
}

function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend is not configured");
  return new Resend(key);
}

export function courseEmailConfig() {
  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.DATABASE_URL),
    protected: Boolean(process.env.COURSE_EMAIL_ACCESS_KEY),
    inboxAddress: process.env.RESEND_INBOUND_ADDRESS || null,
    webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  };
}

export function hasCourseEmailAccess(request: Request) {
  const expected = process.env.COURSE_EMAIL_ACCESS_KEY;
  if (!expected) return false;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : request.headers.get("x-course-email-key") || "";
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = database();
      await sql`CREATE TABLE IF NOT EXISTS course_emails (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        sender TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        preview TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        course_codes TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS course_email_processed (
        id TEXT PRIMARY KEY,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS course_emails_received_at_idx ON course_emails (received_at DESC)`;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function plainText(email: GetReceivingEmailResponseSuccess) {
  if (email.text) return email.text.replace(/\r\n/g, "\n").trim();
  if (!email.html) return "";
  return decodeEntities(
    email.html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractAddress(value: string) {
  const bracketed = value.match(/<([^>]+)>/);
  return (bracketed?.[1] || value).trim().toLowerCase();
}

function isMoodleEmail(email: GetReceivingEmailResponseSuccess, content: string) {
  if (extractAddress(email.from) === MOODLE_SENDER) return true;
  const evidence = `${email.subject}\n${content}`.toLowerCase();
  return evidence.includes(MOODLE_SENDER);
}

function courseCodes(value: string) {
  return Array.from(new Set(
    (value.toUpperCase().match(/\b(?:MSBA|BUSI|STAT|COMP|ECON|FINA)\s*\d{4}[A-Z]?\b/g) || [])
      .map((code) => code.replace(/\s+/g, "")),
  )).slice(0, 8);
}

function preview(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 360);
}

async function markProcessed(id: string) {
  const sql = database();
  await sql`INSERT INTO course_email_processed (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`;
}

export async function storeReceivingEmail(email: GetReceivingEmailResponseSuccess) {
  await ensureSchema();
  const content = plainText(email);
  if (!isMoodleEmail(email, content)) {
    await markProcessed(email.id);
    return false;
  }

  const codes = courseCodes(`${email.subject}\n${content}`);
  const sql = database();
  await sql`INSERT INTO course_emails (
    id, subject, sender, received_at, preview, content, course_codes
  ) VALUES (
    ${email.id}, ${email.subject || "Moodle course notice"}, ${email.from},
    ${email.created_at}, ${preview(content)}, ${content}, ${codes}
  ) ON CONFLICT (id) DO UPDATE SET
    subject = EXCLUDED.subject,
    sender = EXCLUDED.sender,
    received_at = EXCLUDED.received_at,
    preview = EXCLUDED.preview,
    content = EXCLUDED.content,
    course_codes = EXCLUDED.course_codes`;
  await markProcessed(email.id);
  return true;
}

export async function syncResendInbox() {
  await ensureSchema();
  const resend = resendClient();
  const listed = await resend.emails.receiving.list({ limit: 50 });
  if (listed.error || !listed.data) {
    throw new Error(listed.error?.message || "Could not read the Resend inbox");
  }

  const ids = listed.data.data.map((email) => email.id);
  if (ids.length === 0) return { checked: 0, imported: 0 };
  const sql = database();
  const processed = await sql`SELECT id FROM course_email_processed WHERE id = ANY(${ids})` as { id: string }[];
  const seen = new Set(processed.map((row) => row.id));
  let imported = 0;
  for (const listedEmail of listed.data.data) {
    if (seen.has(listedEmail.id)) continue;
    const full = await resend.emails.receiving.get(listedEmail.id, { html_format: "cid" });
    if (full.error || !full.data) continue;
    if (await storeReceivingEmail(full.data)) imported += 1;
  }
  return { checked: listed.data.data.length, imported };
}

export async function listCourseEmails(limit = 50): Promise<StoredCourseEmail[]> {
  await ensureSchema();
  const sql = database();
  const rows = await sql`SELECT id, subject, sender, received_at, preview, content, course_codes
    FROM course_emails ORDER BY received_at DESC LIMIT ${limit}` as Array<{
      id: string;
      subject: string;
      sender: string;
      received_at: string | Date;
      preview: string;
      content: string;
      course_codes: string[];
    }>;
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    sender: row.sender,
    receivedAt: new Date(row.received_at).toISOString(),
    preview: row.preview,
    content: row.content,
    courseCodes: row.course_codes,
  }));
}

export function getResendClient() {
  return resendClient();
}

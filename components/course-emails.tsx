"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Inbox, KeyRound, LoaderCircle, Lock, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCESS_KEY_STORAGE = "hku-course-email-access-v1";

type CourseEmailStatus = {
  configured: boolean;
  protected: boolean;
  inboxAddress: string | null;
  webhookConfigured: boolean;
};

export type CourseEmail = {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  preview: string;
  content: string;
  courseCodes: string[];
};

type MessagesResponse = {
  source: string;
  fetchedAt: string;
  messages: CourseEmail[];
};

export function CourseEmails() {
  const [status, setStatus] = useState<CourseEmailStatus | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [data, setData] = useState<MessagesResponse | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (key: string, signal?: AbortSignal) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch("/api/course-emails/messages", {
        cache: "no-store",
        signal,
        headers: { authorization: `Bearer ${key}` },
      });
      const payload = await response.json() as MessagesResponse & { error?: string };
      if (!response.ok) {
        if (response.status === 401) localStorage.removeItem(ACCESS_KEY_STORAGE);
        throw new Error(response.status === 401 ? "Access key is incorrect" : payload.error || "Could not load course emails");
      }
      localStorage.setItem(ACCESS_KEY_STORAGE, key);
      setAccessKey(key);
      setData(payload);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Could not load course emails");
    } finally {
      if (!signal?.aborted) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const savedKey = localStorage.getItem(ACCESS_KEY_STORAGE) || "";
    setAccessKey(savedKey);
    void fetch("/api/course-emails/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check course email setup");
        const nextStatus = await response.json() as CourseEmailStatus;
        setStatus(nextStatus);
        if (nextStatus.configured && savedKey) await loadMessages(savedKey, controller.signal);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Could not check course email setup");
      });
    return () => controller.abort();
  }, [loadMessages]);

  useEffect(() => {
    if (!accessKey || !data) return;
    const interval = window.setInterval(() => void loadMessages(accessKey), 60_000);
    return () => window.clearInterval(interval);
  }, [accessKey, data, loadMessages]);

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextKey = keyInput.trim();
    if (nextKey) void loadMessages(nextKey);
  };

  const lock = () => {
    localStorage.removeItem(ACCESS_KEY_STORAGE);
    setAccessKey("");
    setKeyInput("");
    setData(null);
    setError(null);
  };

  if (!status) {
    return <EmailPageHeading><div className="email-state"><LoaderCircle className="spin" /><span>Checking the course inbox…</span></div></EmailPageHeading>;
  }

  if (!status.configured || !status.protected) {
    return <EmailPageHeading>
      <div className="email-connect-card">
        <div className="email-connect-icon"><Mail size={28} /></div>
        <div><h2>Course inbox setup is incomplete</h2><p>The server still needs Resend, Neon, and a private access key. No mailbox credentials are stored in your browser.</p></div>
      </div>
    </EmailPageHeading>;
  }

  if (!accessKey || (!data && error?.includes("incorrect"))) {
    return <EmailPageHeading>
      <div className="email-connect-card">
        <div className="email-connect-icon"><KeyRound size={28} /></div>
        <div>
          <h2>Unlock your private course inbox</h2>
          <p>Enter the private access key once on this device. It stays in this browser and protects your forwarded email from other visitors.</p>
          <form className="email-unlock" onSubmit={unlock}>
            <Input type="password" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} autoComplete="current-password" placeholder="Course email access key" aria-label="Course email access key" />
            <Button type="submit" disabled={!keyInput.trim() || loadingMessages}>{loadingMessages ? <LoaderCircle className="spin" /> : <Lock />}Unlock</Button>
          </form>
          {error ? <p className="email-error" role="alert">{error}</p> : null}
        </div>
      </div>
    </EmailPageHeading>;
  }

  const messages = data?.messages || [];
  return <EmailPageHeading>
    <div className="email-account-bar">
      <div><span className="account-dot" /><div><strong>Private course inbox</strong><small>{status.inboxAddress || "Resend inbound address pending"}</small></div></div>
      <div className="email-account-actions">
        <Button variant="outline" onClick={() => void loadMessages(accessKey)} disabled={loadingMessages}><RefreshCw className={loadingMessages ? "spin" : ""} />Refresh</Button>
        <Button variant="ghost" onClick={lock}><Lock />Lock</Button>
      </div>
    </div>

    {!status.inboxAddress ? <div className="email-setup-note"><Mail size={17} /><span>Add your Resend inbound address to <strong>RESEND_INBOUND_ADDRESS</strong>, then create an Outlook rule forwarding messages from <strong>moodle@info.hku.hk</strong> to it.</span></div> : <div className="email-setup-note"><Mail size={17} /><span>Outlook rule: forward mail from <strong>moodle@info.hku.hk</strong> to <strong>{status.inboxAddress}</strong>.</span></div>}
    {error ? <p className="email-error" role="alert">{error}</p> : null}
    <div className="email-source-note"><ShieldCheck size={17} /><span>Only mail that contains verifiable sender evidence for <strong>moodle@info.hku.hk</strong> is stored and shown.</span></div>

    {loadingMessages && !data ? <div className="panel email-state"><LoaderCircle className="spin" /><span>Syncing the course inbox…</span></div> : null}
    {!loadingMessages && data && messages.length === 0 ? <div className="panel email-empty"><Inbox size={34} /><h2>No course emails yet</h2><p>Create the Outlook forwarding rule, then new Moodle messages will appear here automatically.</p></div> : null}
    {messages.length > 0 ? <div className="email-list" aria-live="polite">
      <div className="email-list-head"><span>{messages.length} course {messages.length === 1 ? "email" : "emails"}</span><small>Newest first</small></div>
      {messages.map((message) => <article className="email-row" key={message.id}>
        <div className="email-status-dot" aria-hidden="true" />
        <div className="email-content">
          <div className="email-meta"><span>MOODLE</span><time dateTime={message.receivedAt}>{formatEmailDate(message.receivedAt)}</time></div>
          <h2>{message.subject}</h2>
          {message.courseCodes.length > 0 ? <div className="email-course-tags">{message.courseCodes.map((code) => <span key={code}>{code}</span>)}</div> : null}
          <p>{message.preview || "No text preview available"}</p>
        </div>
      </article>)}
    </div> : null}
  </EmailPageHeading>;
}

function EmailPageHeading({ children }: { children: React.ReactNode }) {
  return <section>
    <div className="page-heading compact email-heading">
      <div><p className="eyebrow">RESEND · MOODLE NOTICES</p><h1>Course Emails</h1><p>Forward important Moodle messages here so the planner and assistant can use them.</p></div>
    </div>
    {children}
  </section>;
}

function formatEmailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

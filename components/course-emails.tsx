"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Inbox,
  LoaderCircle,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type OutlookStatus = {
  configured: boolean;
  connected: boolean;
  account?: { name: string; email: string } | null;
};

export type CourseEmail = {
  id: string;
  subject: string;
  receivedAt: string;
  preview: string;
  webLink: string | null;
  isRead: boolean;
  courseCodes: string[];
};

type MessagesResponse = {
  account: { name: string; email: string };
  source: string;
  fetchedAt: string;
  messages: CourseEmail[];
};

export function CourseEmails() {
  const [status, setStatus] = useState<OutlookStatus | null>(null);
  const [data, setData] = useState<MessagesResponse | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch("/api/outlook/messages", { cache: "no-store", signal });
      const payload = await response.json() as MessagesResponse & { error?: string; reconnect?: boolean };
      if (!response.ok) {
        if (payload.reconnect) {
          setStatus((current) => ({ configured: current?.configured ?? true, connected: false }));
        }
        throw new Error(payload.error || "Could not load course emails");
      }
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
    void fetch("/api/outlook/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check Outlook connection");
        const nextStatus = await response.json() as OutlookStatus;
        setStatus(nextStatus);
        if (nextStatus.connected) await loadMessages(controller.signal);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Could not check Outlook connection");
        setStatus({ configured: true, connected: false });
      });
    return () => controller.abort();
  }, [loadMessages]);

  useEffect(() => {
    if (!status?.connected) return;
    const interval = window.setInterval(() => void loadMessages(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadMessages, status?.connected]);

  const disconnect = async () => {
    setError(null);
    try {
      const response = await fetch("/api/outlook/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Could not disconnect Outlook");
      setData(null);
      setStatus((current) => ({ configured: current?.configured ?? true, connected: false }));
    } catch {
      setError("Could not disconnect Outlook");
    }
  };

  if (!status) {
    return <EmailPageHeading><div className="email-state"><LoaderCircle className="spin" /><span>Checking Outlook connection…</span></div></EmailPageHeading>;
  }

  if (!status.configured) {
    return <EmailPageHeading>
      <div className="email-connect-card">
        <div className="email-connect-icon"><Mail size={28} /></div>
        <div><h2>Outlook setup is required</h2><p>Add the Microsoft Entra credentials described in the project README, then redeploy the app.</p></div>
      </div>
    </EmailPageHeading>;
  }

  if (!status.connected) {
    return <EmailPageHeading>
      <div className="email-connect-card">
        <div className="email-connect-icon"><Mail size={28} /></div>
        <div>
          <h2>Connect your Outlook inbox</h2>
          <p>Sign in with your Outlook account to collect course notices sent by <strong>moodle@info.hku.hk</strong>.</p>
          <div className="email-permission"><ShieldCheck size={16} /><span>Read-only access. The planner cannot send, edit, or delete your mail.</span></div>
          <Button asChild className="outlook-connect"><a href="/api/outlook/connect">Connect Outlook</a></Button>
        </div>
      </div>
      {error ? <p className="email-error" role="alert">{error}</p> : null}
    </EmailPageHeading>;
  }

  const messages = data?.messages || [];
  return <EmailPageHeading>
    <div className="email-account-bar">
      <div><span className="account-dot" /><div><strong>{status.account?.name || data?.account.name}</strong><small>{status.account?.email || data?.account.email}</small></div></div>
      <div className="email-account-actions">
        <Button variant="outline" onClick={() => void loadMessages()} disabled={loadingMessages}><RefreshCw className={loadingMessages ? "spin" : ""} />Refresh</Button>
        <Button variant="ghost" onClick={() => void disconnect()}><LogOut />Disconnect</Button>
      </div>
    </div>

    {error ? <p className="email-error" role="alert">{error}</p> : null}
    <div className="email-source-note"><ShieldCheck size={17} /><span>Only messages whose sender exactly matches <strong>moodle@info.hku.hk</strong> are shown here.</span></div>

    {loadingMessages && !data ? <div className="panel email-state"><LoaderCircle className="spin" /><span>Looking for course emails…</span></div> : null}
    {!loadingMessages && data && messages.length === 0 ? <div className="panel email-empty"><Inbox size={34} /><h2>No course emails found</h2><p>Messages from Moodle will appear here automatically when you refresh.</p></div> : null}
    {messages.length > 0 ? <div className="email-list" aria-live="polite">
      <div className="email-list-head"><span>{messages.length} course {messages.length === 1 ? "email" : "emails"}</span><small>Newest first</small></div>
      {messages.map((message) => <article className={message.isRead ? "email-row" : "email-row unread"} key={message.id}>
        <div className="email-status-dot" role="img" aria-label={message.isRead ? "Read" : "Unread"} />
        <div className="email-content">
          <div className="email-meta"><span>MOODLE</span><time dateTime={message.receivedAt}>{formatEmailDate(message.receivedAt)}</time></div>
          <h2>{message.subject}</h2>
          {message.courseCodes.length > 0 ? <div className="email-course-tags">{message.courseCodes.map((code) => <span key={code}>{code}</span>)}</div> : null}
          <p>{message.preview}</p>
        </div>
        {message.webLink ? <a className="email-open" href={message.webLink} target="_blank" rel="noreferrer" aria-label={`Open ${message.subject} in Outlook`}><ExternalLink size={17} /></a> : null}
      </article>)}
    </div> : null}
  </EmailPageHeading>;
}

function EmailPageHeading({ children }: { children: React.ReactNode }) {
  return <section>
    <div className="page-heading compact email-heading">
      <div><p className="eyebrow">OUTLOOK · MOODLE NOTICES</p><h1>Course Emails</h1><p>Important Moodle messages, separated from the noise and ready for the assistant to use.</p></div>
    </div>
    {children}
  </section>;
}

function formatEmailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

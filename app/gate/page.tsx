"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { parseGatePayloadFromSearchParams, parseGatePayloadFromString } from "@/src/lib/gatePayload";
import { resolveGateStatus, type GateResponseSummary } from "@/app/gate/gateStatus";

type LastRequest = {
  payload: { eventId: string; tokenId: string; code: string };
  timestamp: string;
};

const STORAGE_KEYS = {
  remember: "gateOperatorRemember",
  operatorKey: "gateOperatorKey",
  eventId: "gateEventId",
} as const;

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export default function GatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] text-white" />}>
      <GatePageContent />
    </Suspense>
  );
}

function GatePageContent() {
  const [operatorKey, setOperatorKey] = useState("");
  const [eventId, setEventId] = useState("2");
  const [tokenId, setTokenId] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [responseSummary, setResponseSummary] = useState<GateResponseSummary | null>(null);
  const [clientError, setClientError] = useState<"missing_operator_key" | "missing_code" | "missing_fields" | null>(null);
  const [responseText, setResponseText] = useState("");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [loadedFromUrl, setLoadedFromUrl] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const tokenIdRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rememberStored = window.localStorage.getItem(STORAGE_KEYS.remember);
    const shouldRemember = rememberStored === "true";
    setRemember(shouldRemember);
    if (shouldRemember) {
      const storedKey = window.localStorage.getItem(STORAGE_KEYS.operatorKey);
      const storedEventId = window.localStorage.getItem(STORAGE_KEYS.eventId);
      if (storedKey) setOperatorKey(storedKey);
      if (storedEventId) setEventId(storedEventId);
    }
  }, []);

  useEffect(() => {
    tokenIdRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const parsed = parseGatePayloadFromSearchParams(searchParams);
    if (parsed.eventId || parsed.tokenId || parsed.code) {
      applyParsedPayload(parsed);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (remember) {
      window.localStorage.setItem(STORAGE_KEYS.remember, "true");
      window.localStorage.setItem(STORAGE_KEYS.operatorKey, operatorKey);
      window.localStorage.setItem(STORAGE_KEYS.eventId, eventId);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.remember);
      window.localStorage.removeItem(STORAGE_KEYS.operatorKey);
      window.localStorage.removeItem(STORAGE_KEYS.eventId);
    }
  }, [remember, operatorKey, eventId]);

  const statusInfo = useMemo(
    () => resolveGateStatus({ response: responseSummary, clientError }),
    [responseSummary, clientError]
  );

  function applyParsedPayload(parsed: { eventId?: string; tokenId?: string; code?: string }) {
    if (parsed.eventId) setEventId(parsed.eventId);
    if (parsed.tokenId) setTokenId(parsed.tokenId);
    if (parsed.code) setCode(parsed.code);
    setLoadedFromUrl(true);
  }

  function handlePastePayload(value: string): boolean {
    const parsed = parseGatePayloadFromString(value);
    if (!parsed) return false;
    if (!parsed.eventId && !parsed.tokenId && !parsed.code) return false;
    applyParsedPayload(parsed);
    return true;
  }

  async function handleVerify() {
    setErrorMessage("");
    setResponseText("");
    setResponseSummary(null);
    setClientError(null);
    setCopyState("idle");

    if (!operatorKey.trim()) {
      setErrorMessage("Operator key is required.");
      setClientError("missing_operator_key");
      return;
    }
    if (!eventId.trim()) {
      setErrorMessage("Event ID is required.");
      setClientError("missing_fields");
      return;
    }
    if (!tokenId.trim()) {
      setErrorMessage("Token ID is required.");
      setClientError("missing_fields");
      return;
    }
    if (!code.trim()) {
      setErrorMessage("Claim code is required.");
      setClientError("missing_code");
      return;
    }

    const payload = { eventId: eventId.trim(), tokenId: tokenId.trim(), code: code.trim() };
    setLastRequest({ payload, timestamp: new Date().toISOString() });

    try {
      setIsVerifying(true);
      const response = await fetch("/api/gate/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-operator-key": operatorKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (parsed && typeof parsed === "object") {
        setResponseText(formatJson(parsed));
        setResponseSummary(parsed as GateResponseSummary);
      } else {
        setResponseText(text || "(empty response)");
        setResponseSummary({ ok: response.ok });
      }
    } catch (error) {
      setResponseSummary({ ok: false });
      setResponseText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsVerifying(false);
    }
  }

  function handleClear() {
    setTokenId("");
    setCode("");
    setResponseSummary(null);
    setClientError(null);
    setResponseText("");
    setLastRequest(null);
    setErrorMessage("");
    setCopyState("idle");
    tokenIdRef.current?.focus();
  }

  async function handleCopyResponse() {
    if (!responseText.trim()) return;
    try {
      await navigator.clipboard.writeText(responseText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Gate Verify</h1>
          <p className="text-sm text-white/60">Use claimCode returned by purchase API.</p>
        </header>

        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Operator Key</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="password"
              value={operatorKey}
              onChange={(event) => setOperatorKey(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Event ID</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="text"
              value={eventId}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setEventId(value);
              }}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Token ID</span>
            <input
              ref={tokenIdRef}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="text"
              value={tokenId}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setTokenId(value);
              }}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Claim Code</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="text"
              value={code}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setCode(value);
              }}
            />
          </label>

          {loadedFromUrl ? (
            <div className="text-xs text-white/50">Loaded from URL.</div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              className="h-4 w-4 rounded border border-white/20 bg-black/30"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember on this device
          </label>

          {errorMessage ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </button>
            <button
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              type="button"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white/60">Status</span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusInfo.badgeClassName}`}
            >
              <span className="text-[10px]">{statusInfo.icon}</span>
              {statusInfo.label}
            </span>
          </div>
          <div className="text-sm text-white/70">{statusInfo.message}</div>

          <div className="grid gap-2 text-sm text-white/70">
            <div>Last Request</div>
            {lastRequest ? (
              <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80">
                <div className="mb-2">Timestamp: {lastRequest.timestamp}</div>
                <pre className="whitespace-pre-wrap text-xs">
                  {formatJson(lastRequest.payload)}
                </pre>
              </div>
            ) : (
              <div className="text-xs text-white/40">No requests yet.</div>
            )}
          </div>

          <div className="grid gap-2 text-sm text-white/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>Response</div>
              <button
                className="rounded-md border border-white/10 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                onClick={handleCopyResponse}
                disabled={!responseText.trim()}
              >
                {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy JSON"}
              </button>
            </div>
            <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80">
              <pre className="whitespace-pre-wrap text-xs">
                {responseText || "No response yet."}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

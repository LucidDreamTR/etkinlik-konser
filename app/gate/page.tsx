"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { parseGatePayloadFromSearchParams, parseGatePayloadFromString } from "@/src/lib/gatePayload";
import { GATE_COPY } from "@/app/gate/gateCopy";
import {
  getGateStatusConfig,
  resolveGateStatus,
  type GateClientError,
  type GateResponseSummary,
} from "@/app/gate/gateStatus";

type LastRequest = {
  payload: { operatorKey: string; eventId: string; tokenId: string; code: string };
  timestamp: string;
};

type GateHistoryEntry = {
  id: string;
  payload: { operatorKey: string; eventId: string; tokenId: string; code: string };
  response: GateResponseSummary | null;
  clientError: GateClientError;
  timestamp: string;
};

const STORAGE_KEYS = {
  remember: "gateOperatorRemember",
  operatorKey: "gateOperatorKey",
  eventId: "gateEventId",
  history: "gateVerifyHistory",
} as const;

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHash(value: string): string {
  if (!value) return value;
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maskCode(value: string): string {
  if (!value) return value;
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.min(6, value.length - 4))}${value.slice(-4)}`;
}

function getLastUsedInfo(response: GateResponseSummary | null) {
  if (!response) return null;
  const timestamp = response.usedAt ?? response.gateValidatedAt ?? null;
  if (timestamp) {
    return { label: GATE_COPY.sections.lastUsedLabel, value: formatTimestamp(timestamp) };
  }
  const txHash = response.txHash ?? response.chainClaimTxHash ?? null;
  if (txHash) {
    return { label: GATE_COPY.sections.lastTxLabel, value: formatHash(txHash) };
  }
  return null;
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
  const [clientError, setClientError] = useState<GateClientError>(null);
  const [responseText, setResponseText] = useState("");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const [history, setHistory] = useState<GateHistoryEntry[]>([]);
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
    if (typeof window === "undefined") return;
    const storedHistory = window.localStorage.getItem(STORAGE_KEYS.history);
    if (!storedHistory) return;
    try {
      const parsed = JSON.parse(storedHistory);
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, 10));
      }
    } catch {
      // ignore malformed storage
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, 10)));
  }, [history]);

  const statusInfo = useMemo(
    () => resolveGateStatus({ response: responseSummary, clientError, isVerifying }),
    [responseSummary, clientError, isVerifying]
  );
  const lastUsedInfo = useMemo(
    () => (statusInfo.key === "ALREADY_USED" ? getLastUsedInfo(responseSummary) : null),
    [responseSummary, statusInfo.key]
  );
  const todaySummary = useMemo(() => {
    const today = new Date();
    const todaysEntries = history.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      if (Number.isNaN(entryDate.getTime())) return false;
      return isSameLocalDay(entryDate, today);
    });

    const total = todaysEntries.length;
    const valid = todaysEntries.filter((entry) => entry.response?.valid === true).length;
    const invalid = todaysEntries.filter((entry) =>
      entry.response?.reason === "invalid_code" || entry.response?.reason === "payment_mismatch"
    ).length;
    const used = todaysEntries.filter((entry) => entry.response?.reason === "already_used").length;
    const rateLimited = todaysEntries.filter((entry) => entry.response?.reason === "rate_limited").length;
    const networkError = todaysEntries.filter((entry) => entry.response?.reason === "network_error").length;

    return { total, valid, invalid, used, rateLimited, networkError };
  }, [history]);

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
      setErrorMessage(GATE_COPY.errors.missingOperatorKey);
      setClientError("missing_operator_key");
      return;
    }
    if (!eventId.trim()) {
      setErrorMessage(GATE_COPY.errors.missingFields);
      setClientError("missing_fields");
      return;
    }
    if (!tokenId.trim()) {
      setErrorMessage(GATE_COPY.errors.missingFields);
      setClientError("missing_fields");
      return;
    }
    if (!code.trim()) {
      setErrorMessage(GATE_COPY.errors.missingCode);
      setClientError("missing_code");
      return;
    }

    const payload = {
      operatorKey: operatorKey.trim(),
      eventId: eventId.trim(),
      tokenId: tokenId.trim(),
      code: code.trim(),
    };
    setLastRequest({ payload, timestamp: new Date().toISOString() });

    let timeoutId: number | null = null;
    const controller = new AbortController();
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("OFFLINE");
      }
      setIsVerifying(true);
      timeoutId = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch("/api/gate/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const parsed = (await response.json()) as GateResponseSummary;
      const summary = parsed ?? { ok: response.ok };
      setResponseText(formatJson(parsed));
      setResponseSummary(summary);
      setHistory((prev) => [
        {
          id: `${Date.now()}-${payload.tokenId}`,
          payload,
          response: summary,
          clientError: null,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 10));
    } catch (error) {
      const err = error instanceof Error ? error : null;
      const isOffline = err?.message === "OFFLINE";
      const isFetchError = err?.name === "TypeError";
      const isAbortError = err?.name === "AbortError";
      const isParseError = err?.name === "SyntaxError";
      const isNetworkIssue = Boolean(isOffline || isFetchError || isAbortError || isParseError);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      const summary: GateResponseSummary = {
        ok: false,
        reason: isNetworkIssue ? "network_error" : "network_error",
        retryAfterSec: null,
      };
      setClientError(null);
      setResponseSummary(summary);
      setResponseText(GATE_COPY.statuses.NETWORK_ERROR.description);
      setHistory((prev) => [
        {
          id: `${Date.now()}-${payload.tokenId}`,
          payload,
          response: summary,
          clientError: null,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 10));
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
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
          <h1 className="text-2xl font-semibold">{GATE_COPY.heading}</h1>
          <p className="text-sm text-white/60">{GATE_COPY.subheading}</p>
        </header>

        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">{GATE_COPY.form.operatorKeyLabel}</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              type="password"
              value={operatorKey}
              onChange={(event) => setOperatorKey(event.target.value)}
              autoComplete="current-password"
              disabled={isVerifying}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">{GATE_COPY.form.eventIdLabel}</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              type="text"
              value={eventId}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setEventId(value);
              }}
              disabled={isVerifying}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">{GATE_COPY.form.tokenIdLabel}</span>
            <input
              ref={tokenIdRef}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              type="text"
              value={tokenId}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setTokenId(value);
              }}
              disabled={isVerifying}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">{GATE_COPY.form.codeLabel}</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              type="text"
              value={code}
              onChange={(event) => {
                const value = event.target.value;
                if (handlePastePayload(value)) return;
                setCode(value);
              }}
              disabled={isVerifying}
            />
          </label>

          {loadedFromUrl ? (
            <div className="text-xs text-white/50">{GATE_COPY.form.loadedFromUrl}</div>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              className="h-4 w-4 rounded border border-white/20 bg-black/30"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isVerifying}
            />
            {GATE_COPY.form.rememberLabel}
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
              {isVerifying ? GATE_COPY.form.verifyingButton : GATE_COPY.form.verifyButton}
            </button>
            <button
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              type="button"
              onClick={handleClear}
              disabled={isVerifying}
            >
              {GATE_COPY.form.clearButton}
            </button>
          </div>
        </div>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-white/60">{GATE_COPY.sections.statusLabel}</span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusInfo.badgeClassName}`}
            >
              <span className="text-[10px]">{statusInfo.icon}</span>
              {statusInfo.badgeLabel}
            </span>
          </div>
          <div className="grid gap-2">
            <div className={`text-2xl font-semibold ${statusInfo.titleClassName}`}>{statusInfo.title}</div>
            <div className="text-sm text-white/70">{statusInfo.description}</div>
            {lastUsedInfo ? (
              <div className="text-xs text-white/60">
                {lastUsedInfo.label}: {lastUsedInfo.value}
              </div>
            ) : null}
          </div>
          {(statusInfo.key === "NOT_CLAIMED" || statusInfo.key === "INVALID_CODE" || statusInfo.key === "NETWORK_ERROR") &&
          lastRequest ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
              >
                {GATE_COPY.actions.retry}
              </button>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">{GATE_COPY.sections.historyLabel}</div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("UNKNOWN").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("UNKNOWN").icon}</span>
              {GATE_COPY.summary.total} {todaySummary.total}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("VALID").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("VALID").icon}</span>
              {getGateStatusConfig("VALID").badgeLabel} {todaySummary.valid}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("INVALID_CODE").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("INVALID_CODE").icon}</span>
              {getGateStatusConfig("INVALID_CODE").badgeLabel} {todaySummary.invalid}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("ALREADY_USED").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("ALREADY_USED").icon}</span>
              {getGateStatusConfig("ALREADY_USED").badgeLabel} {todaySummary.used}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("RATE_LIMITED").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("RATE_LIMITED").icon}</span>
              {getGateStatusConfig("RATE_LIMITED").badgeLabel} {todaySummary.rateLimited}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${getGateStatusConfig("NETWORK_ERROR").badgeClassName}`}
            >
              <span className="text-[10px]">{getGateStatusConfig("NETWORK_ERROR").icon}</span>
              {getGateStatusConfig("NETWORK_ERROR").badgeLabel} {todaySummary.networkError}
            </span>
          </div>
          {isVerifying && history.length === 0 ? (
            <div className="grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-12 animate-pulse rounded-md border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-xs text-white/40">{GATE_COPY.sections.historyEmpty}</div>
          ) : (
            <div className="grid gap-2">
              {history.map((entry) => {
                const rowStatus = resolveGateStatus({ response: entry.response, clientError: entry.clientError });
                return (
                  <div
                    key={entry.id}
                    className="grid gap-2 rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80 md:grid-cols-[1.2fr_1fr_1fr]"
                  >
                    <div className="grid gap-1">
                      <div className="text-white/60">{GATE_COPY.history.tokenLabel}</div>
                      <div className="text-white/90">{entry.payload.tokenId}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-white/60">{GATE_COPY.history.codeLabel}</div>
                      <div className="text-white/90">{maskCode(entry.payload.code)}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-white/60">{GATE_COPY.history.statusLabel}</div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${rowStatus.badgeClassName}`}
                        >
                          <span className="text-[10px]">{rowStatus.icon}</span>
                          {rowStatus.badgeLabel}
                        </span>
                        <span className="text-white/60">{formatTimestamp(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-2 text-sm text-white/70">
            <div>{GATE_COPY.sections.lastRequestLabel}</div>
            {lastRequest ? (
              <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80">
                <div className="mb-2">
                  {GATE_COPY.sections.timestampLabel}: {formatTimestamp(lastRequest.timestamp)}
                </div>
                <pre className="whitespace-pre-wrap text-xs">
                  {formatJson(lastRequest.payload)}
                </pre>
              </div>
            ) : (
              <div className="text-xs text-white/40">{GATE_COPY.sections.lastRequestEmpty}</div>
            )}
          </div>

          <div className="grid gap-2 text-sm text-white/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>{GATE_COPY.sections.responseLabel}</div>
              <button
                className="rounded-md border border-white/10 bg-transparent px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                onClick={handleCopyResponse}
                disabled={!responseText.trim()}
              >
                {copyState === "copied"
                  ? GATE_COPY.actions.copied
                  : copyState === "error"
                  ? GATE_COPY.actions.copyFailed
                  : GATE_COPY.actions.copyJson}
              </button>
            </div>
            <div className="rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80">
              <pre className="whitespace-pre-wrap text-xs">
                {responseText || GATE_COPY.sections.responseEmpty}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

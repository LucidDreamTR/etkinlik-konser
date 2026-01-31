"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status =
  | "IDLE"
  | "VALID"
  | "ALREADY_USED"
  | "NOT_CLAIMED"
  | "INVALID_CODE"
  | "UNAUTHORIZED"
  | "ERROR";

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

function deriveStatus(response: { ok?: boolean; valid?: boolean; reason?: string } | null): Status {
  if (!response) return "IDLE";
  if (response.ok && response.valid) return "VALID";
  switch (response.reason) {
    case "already_used":
      return "ALREADY_USED";
    case "not_claimed":
      return "NOT_CLAIMED";
    case "invalid_code":
      return "INVALID_CODE";
    case "unauthorized":
      return "UNAUTHORIZED";
    default:
      return "ERROR";
  }
}

function statusClasses(status: Status): string {
  switch (status) {
    case "VALID":
      return "bg-green-500/20 text-green-300 border-green-500/40";
    case "ALREADY_USED":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "NOT_CLAIMED":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "INVALID_CODE":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "UNAUTHORIZED":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "ERROR":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    default:
      return "bg-white/5 text-white/60 border-white/10";
  }
}

export default function GatePage() {
  const [operatorKey, setOperatorKey] = useState("");
  const [eventId, setEventId] = useState("2");
  const [tokenId, setTokenId] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<Status>("IDLE");
  const [responseText, setResponseText] = useState("");
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const tokenIdRef = useRef<HTMLInputElement | null>(null);

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

  const statusLabel = useMemo(() => (status === "IDLE" ? "—" : status), [status]);

  async function handleVerify() {
    setErrorMessage("");
    setResponseText("");

    if (!operatorKey.trim()) {
      setErrorMessage("Operator key is required.");
      return;
    }
    if (!eventId.trim()) {
      setErrorMessage("Event ID is required.");
      return;
    }
    if (!tokenId.trim()) {
      setErrorMessage("Token ID is required.");
      return;
    }
    if (!code.trim()) {
      setErrorMessage("Claim code is required.");
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
        setStatus(deriveStatus(parsed as { ok?: boolean; valid?: boolean; reason?: string }));
      } else {
        setResponseText(text || "(empty response)");
        setStatus(response.ok ? "ERROR" : "ERROR");
      }
    } catch (error) {
      setStatus("ERROR");
      setResponseText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsVerifying(false);
    }
  }

  function handleClear() {
    setTokenId("");
    setCode("");
    setStatus("IDLE");
    setResponseText("");
    setLastRequest(null);
    setErrorMessage("");
    tokenIdRef.current?.focus();
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
              onChange={(event) => setEventId(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Token ID</span>
            <input
              ref={tokenIdRef}
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="text"
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Claim Code</span>
            <input
              className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>

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
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}>
              {statusLabel}
            </span>
          </div>

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
            <div>Response</div>
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

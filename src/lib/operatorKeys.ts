import "server-only";

import crypto from "crypto";

import { getServerEnv } from "@/src/lib/env";

export type OperatorKeyState = "active" | "revoked";

export type OperatorKey = {
  key: string;
  state: OperatorKeyState;
  source: "env" | "default" | "memory";
  revokedAt?: string;
  revokedReason?: string;
};

export type OperatorKeyAttempt = {
  timestamp: string;
  ipHash: string;
  keyHash: string;
  state: OperatorKeyState | "missing" | "invalid";
  reason: "invalid_operator_key";
};

const DEFAULT_TEST_KEY = "gate_test_123456789";
const ATTEMPT_LOG_LIMIT = 200;

const memoryActiveKeys = new Map<string, OperatorKey>();
const memoryRevokedKeys = new Map<string, OperatorKey>();
const attemptLog: OperatorKeyAttempt[] = [];

function hashKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildEnvKeys(): { active: OperatorKey[]; revoked: OperatorKey[] } {
  const env = getServerEnv();
  const activeKeys = new Map<string, OperatorKey>();
  const revokedKeys = new Map<string, OperatorKey>();

  const legacy = env.GATE_OPERATOR_KEY ? [env.GATE_OPERATOR_KEY] : [];
  const fromEnv = parseEnvList(process.env.GATE_OPERATOR_KEYS);
  const revokedEnv = parseEnvList(process.env.GATE_OPERATOR_REVOKED_KEYS);

  for (const key of [...legacy, ...fromEnv, DEFAULT_TEST_KEY]) {
    activeKeys.set(key, { key, state: "active", source: key === DEFAULT_TEST_KEY ? "default" : "env" });
  }

  for (const key of revokedEnv) {
    revokedKeys.set(key, {
      key,
      state: "revoked",
      source: "env",
      revokedAt: new Date().toISOString(),
      revokedReason: "env",
    });
  }

  return { active: [...activeKeys.values()], revoked: [...revokedKeys.values()] };
}

function recordAttempt(entry: OperatorKeyAttempt) {
  attemptLog.push(entry);
  if (attemptLog.length > ATTEMPT_LOG_LIMIT) {
    attemptLog.shift();
  }
  console.warn("operator_key_invalid", entry);
}

export function getActiveKeys(): OperatorKey[] {
  const { active, revoked } = buildEnvKeys();
  const revokedSet = new Set(revoked.map((item) => item.key));
  const combined = new Map<string, OperatorKey>();

  for (const key of active) {
    if (!revokedSet.has(key.key)) {
      combined.set(key.key, key);
    }
  }

  for (const key of memoryActiveKeys.values()) {
    if (!revokedSet.has(key.key) && !memoryRevokedKeys.has(key.key)) {
      combined.set(key.key, key);
    }
  }

  return [...combined.values()];
}

export function revokeOperatorKey(key: string, reason = "manual"): void {
  const now = new Date().toISOString();
  memoryRevokedKeys.set(key, {
    key,
    state: "revoked",
    source: "memory",
    revokedAt: now,
    revokedReason: reason,
  });
  memoryActiveKeys.delete(key);
}

export function activateOperatorKey(key: string): void {
  memoryActiveKeys.set(key, { key, state: "active", source: "memory" });
  memoryRevokedKeys.delete(key);
}

export function getOperatorKeyAttempts(): OperatorKeyAttempt[] {
  return [...attemptLog];
}

export function verifyOperatorKey(
  inputKey: string | null | undefined,
  context?: { ipHash?: string }
): { ok: true; key: OperatorKey } | { ok: false; reason: "invalid_operator_key" } {
  const ipHash = context?.ipHash ?? "unknown";
  const normalized = inputKey?.trim() ?? "";
  if (!normalized) {
    recordAttempt({
      timestamp: new Date().toISOString(),
      ipHash,
      keyHash: hashKey(""),
      state: "missing",
      reason: "invalid_operator_key",
    });
    return { ok: false, reason: "invalid_operator_key" };
  }

  const { active, revoked } = buildEnvKeys();
  const revokedMap = new Map(revoked.map((item) => [item.key, item]));

  if (revokedMap.has(normalized) || memoryRevokedKeys.has(normalized)) {
    recordAttempt({
      timestamp: new Date().toISOString(),
      ipHash,
      keyHash: hashKey(normalized),
      state: "revoked",
      reason: "invalid_operator_key",
    });
    return { ok: false, reason: "invalid_operator_key" };
  }

  for (const entry of [...active, ...memoryActiveKeys.values()]) {
    if (entry.key === normalized) {
      return { ok: true, key: entry };
    }
  }

  recordAttempt({
    timestamp: new Date().toISOString(),
    ipHash,
    keyHash: hashKey(normalized),
    state: "invalid",
    reason: "invalid_operator_key",
  });
  return { ok: false, reason: "invalid_operator_key" };
}

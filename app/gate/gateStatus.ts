import { GATE_COPY, getGateStatusDescription } from "@/app/gate/gateCopy";

export type GateResponseSummary = {
  ok?: boolean;
  valid?: boolean;
  reason?: string;
  usedAt?: string;
  gateValidatedAt?: string;
  txHash?: string;
  chainClaimTxHash?: string;
  retryAfterSec?: number | null;
};

export type GateClientError =
  | "missing_operator_key"
  | "missing_code"
  | "missing_fields"
  | "network_error"
  | null;

export type GateStatusKey =
  | "VALID"
  | "ALREADY_USED"
  | "INVALID_CODE"
  | "EVENT_MISMATCH"
  | "TEMPORARILY_LOCKED"
  | "NOT_CLAIMED"
  | "MISSING_CODE"
  | "MISSING_OPERATOR_KEY"
  | "INVALID_OPERATOR_KEY"
  | "MISSING_FIELDS"
  | "UNAUTHORIZED"
  | "NETWORK_ERROR"
  | "ERROR"
  | "LOADING"
  | "UNKNOWN"
  | "RATE_LIMITED";

type GateTone = "success" | "warning" | "danger" | "neutral";

export type GateStatusConfig = {
  key: GateStatusKey;
  title: string;
  description: string;
  badgeLabel: string;
  icon: string;
  badgeClassName: string;
  titleClassName: string;
  tone: GateTone;
};

const TONE_STYLES: Record<GateTone, { badge: string; title: string }> = {
  success: {
    badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    title: "text-emerald-100",
  },
  warning: {
    badge: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    title: "text-amber-100",
  },
  danger: {
    badge: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    title: "text-rose-100",
  },
  neutral: {
    badge: "border-white/15 bg-white/5 text-white/70",
    title: "text-white",
  },
};

const STATUS_CONFIG: Record<GateStatusKey, GateStatusConfig> = {
  VALID: {
    key: "VALID",
    tone: "success",
    icon: "✓",
    title: GATE_COPY.statuses.VALID.title,
    description: GATE_COPY.statuses.VALID.description,
    badgeLabel: GATE_COPY.statuses.VALID.badgeLabel,
    badgeClassName: TONE_STYLES.success.badge,
    titleClassName: TONE_STYLES.success.title,
  },
  ALREADY_USED: {
    key: "ALREADY_USED",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.ALREADY_USED.title,
    description: GATE_COPY.statuses.ALREADY_USED.description,
    badgeLabel: GATE_COPY.statuses.ALREADY_USED.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  INVALID_CODE: {
    key: "INVALID_CODE",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.INVALID_CODE.title,
    description: GATE_COPY.statuses.INVALID_CODE.description,
    badgeLabel: GATE_COPY.statuses.INVALID_CODE.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  TEMPORARILY_LOCKED: {
    key: "TEMPORARILY_LOCKED",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.TEMPORARILY_LOCKED.title,
    description: GATE_COPY.statuses.TEMPORARILY_LOCKED.description,
    badgeLabel: GATE_COPY.statuses.TEMPORARILY_LOCKED.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  EVENT_MISMATCH: {
    key: "EVENT_MISMATCH",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.EVENT_MISMATCH.title,
    description: GATE_COPY.statuses.EVENT_MISMATCH.description,
    badgeLabel: GATE_COPY.statuses.EVENT_MISMATCH.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  NOT_CLAIMED: {
    key: "NOT_CLAIMED",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.NOT_CLAIMED.title,
    description: GATE_COPY.statuses.NOT_CLAIMED.description,
    badgeLabel: GATE_COPY.statuses.NOT_CLAIMED.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  MISSING_CODE: {
    key: "MISSING_CODE",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.MISSING_CODE.title,
    description: GATE_COPY.statuses.MISSING_CODE.description,
    badgeLabel: GATE_COPY.statuses.MISSING_CODE.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  MISSING_OPERATOR_KEY: {
    key: "MISSING_OPERATOR_KEY",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.MISSING_OPERATOR_KEY.title,
    description: GATE_COPY.statuses.MISSING_OPERATOR_KEY.description,
    badgeLabel: GATE_COPY.statuses.MISSING_OPERATOR_KEY.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  INVALID_OPERATOR_KEY: {
    key: "INVALID_OPERATOR_KEY",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.INVALID_OPERATOR_KEY.title,
    description: GATE_COPY.statuses.INVALID_OPERATOR_KEY.description,
    badgeLabel: GATE_COPY.statuses.INVALID_OPERATOR_KEY.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  MISSING_FIELDS: {
    key: "MISSING_FIELDS",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.MISSING_FIELDS.title,
    description: GATE_COPY.statuses.MISSING_FIELDS.description,
    badgeLabel: GATE_COPY.statuses.MISSING_FIELDS.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
  UNAUTHORIZED: {
    key: "UNAUTHORIZED",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.UNAUTHORIZED.title,
    description: GATE_COPY.statuses.UNAUTHORIZED.description,
    badgeLabel: GATE_COPY.statuses.UNAUTHORIZED.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  NETWORK_ERROR: {
    key: "NETWORK_ERROR",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.NETWORK_ERROR.title,
    description: GATE_COPY.statuses.NETWORK_ERROR.description,
    badgeLabel: GATE_COPY.statuses.NETWORK_ERROR.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  ERROR: {
    key: "ERROR",
    tone: "danger",
    icon: "×",
    title: GATE_COPY.statuses.ERROR.title,
    description: GATE_COPY.statuses.ERROR.description,
    badgeLabel: GATE_COPY.statuses.ERROR.badgeLabel,
    badgeClassName: TONE_STYLES.danger.badge,
    titleClassName: TONE_STYLES.danger.title,
  },
  LOADING: {
    key: "LOADING",
    tone: "neutral",
    icon: "•",
    title: GATE_COPY.statuses.LOADING.title,
    description: GATE_COPY.statuses.LOADING.description,
    badgeLabel: GATE_COPY.statuses.LOADING.badgeLabel,
    badgeClassName: TONE_STYLES.neutral.badge,
    titleClassName: TONE_STYLES.neutral.title,
  },
  UNKNOWN: {
    key: "UNKNOWN",
    tone: "neutral",
    icon: "•",
    title: GATE_COPY.statuses.UNKNOWN.title,
    description: GATE_COPY.statuses.UNKNOWN.description,
    badgeLabel: GATE_COPY.statuses.UNKNOWN.badgeLabel,
    badgeClassName: TONE_STYLES.neutral.badge,
    titleClassName: TONE_STYLES.neutral.title,
  },
  RATE_LIMITED: {
    key: "RATE_LIMITED",
    tone: "warning",
    icon: "!",
    title: GATE_COPY.statuses.RATE_LIMITED.title,
    description: getGateStatusDescription("RATE_LIMITED"),
    badgeLabel: GATE_COPY.statuses.RATE_LIMITED.badgeLabel,
    badgeClassName: TONE_STYLES.warning.badge,
    titleClassName: TONE_STYLES.warning.title,
  },
};

export function getGateStatusConfig(key: GateStatusKey): GateStatusConfig {
  return STATUS_CONFIG[key];
}

export function resolveGateStatus({
  response,
  clientError,
  isVerifying,
}: {
  response?: GateResponseSummary | null;
  clientError?: GateClientError;
  isVerifying?: boolean;
}): GateStatusConfig {
  if (isVerifying) return STATUS_CONFIG.LOADING;
  if (clientError === "missing_operator_key") return STATUS_CONFIG.MISSING_OPERATOR_KEY;
  if (clientError === "missing_code") return STATUS_CONFIG.MISSING_CODE;
  if (clientError === "missing_fields") return STATUS_CONFIG.MISSING_FIELDS;
  if (clientError === "network_error") return STATUS_CONFIG.NETWORK_ERROR;

  if (!response) return STATUS_CONFIG.UNKNOWN;
  if (response.valid === true) return STATUS_CONFIG.VALID;

  switch (response.reason) {
    case "already_used":
      return STATUS_CONFIG.ALREADY_USED;
    case "invalid_code":
      return STATUS_CONFIG.INVALID_CODE;
    case "temporarily_locked":
      return STATUS_CONFIG.TEMPORARILY_LOCKED;
    case "event_mismatch":
      return STATUS_CONFIG.EVENT_MISMATCH;
    case "not_claimed":
      return STATUS_CONFIG.NOT_CLAIMED;
    case "missing_code":
      return STATUS_CONFIG.MISSING_CODE;
    case "missing_operator_key":
      return STATUS_CONFIG.MISSING_OPERATOR_KEY;
    case "invalid_operator_key":
      return STATUS_CONFIG.INVALID_OPERATOR_KEY;
    case "unauthorized":
      return STATUS_CONFIG.UNAUTHORIZED;
    case "network_error":
      return STATUS_CONFIG.NETWORK_ERROR;
    case "rate_limited":
      return {
        ...STATUS_CONFIG.RATE_LIMITED,
        description: getGateStatusDescription("RATE_LIMITED", { retryAfterSec: response.retryAfterSec ?? undefined }),
      };
    default:
      return response.ok === false ? STATUS_CONFIG.ERROR : STATUS_CONFIG.UNKNOWN;
  }
}

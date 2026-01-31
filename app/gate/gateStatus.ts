export type GateResponseSummary = {
  ok?: boolean;
  valid?: boolean;
  reason?: string;
};

export type GateStatusKey =
  | "VALID"
  | "ALREADY_USED"
  | "INVALID_CODE"
  | "NOT_CLAIMED"
  | "MISSING_CODE"
  | "UNAUTHORIZED"
  | "ERROR"
  | "UNKNOWN";

type GateStatusConfig = {
  key: GateStatusKey;
  label: string;
  message: string;
  icon: string;
  badgeClassName: string;
};

const STATUS_CONFIG: Record<GateStatusKey, GateStatusConfig> = {
  VALID: {
    key: "VALID",
    label: "VALID",
    message: "Bilet doğrulandı.",
    icon: "✓",
    badgeClassName: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  ALREADY_USED: {
    key: "ALREADY_USED",
    label: "ALREADY USED",
    message: "Bu bilet daha önce kullanıldı.",
    icon: "!",
    badgeClassName: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  INVALID_CODE: {
    key: "INVALID_CODE",
    label: "INVALID CODE",
    message: "Kod geçersiz.",
    icon: "×",
    badgeClassName: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  },
  NOT_CLAIMED: {
    key: "NOT_CLAIMED",
    label: "NOT CLAIMED",
    message: "Bilet henüz claim edilmemiş.",
    icon: "!",
    badgeClassName: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  },
  MISSING_CODE: {
    key: "MISSING_CODE",
    label: "MISSING CODE",
    message: "Claim code zorunlu.",
    icon: "!",
    badgeClassName: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  UNAUTHORIZED: {
    key: "UNAUTHORIZED",
    label: "UNAUTHORIZED",
    message: "Operatör anahtarı geçersiz.",
    icon: "×",
    badgeClassName: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  },
  ERROR: {
    key: "ERROR",
    label: "ERROR",
    message: "Bir hata oluştu.",
    icon: "×",
    badgeClassName: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  },
  UNKNOWN: {
    key: "UNKNOWN",
    label: "UNKNOWN",
    message: "Henüz doğrulama yok.",
    icon: "•",
    badgeClassName: "border-white/15 bg-white/5 text-white/70",
  },
};

export function resolveGateStatus({
  response,
  clientError,
}: {
  response?: GateResponseSummary | null;
  clientError?: "missing_operator_key" | "missing_code" | "missing_fields" | null;
}): GateStatusConfig {
  if (clientError === "missing_operator_key") return STATUS_CONFIG.UNAUTHORIZED;
  if (clientError === "missing_code") return STATUS_CONFIG.MISSING_CODE;
  if (clientError === "missing_fields") return STATUS_CONFIG.ERROR;

  if (!response) return STATUS_CONFIG.UNKNOWN;
  if (response.valid === true) return STATUS_CONFIG.VALID;

  switch (response.reason) {
    case "already_used":
      return STATUS_CONFIG.ALREADY_USED;
    case "invalid_code":
      return STATUS_CONFIG.INVALID_CODE;
    case "not_claimed":
      return STATUS_CONFIG.NOT_CLAIMED;
    case "missing_code":
      return STATUS_CONFIG.MISSING_CODE;
    case "unauthorized":
      return STATUS_CONFIG.UNAUTHORIZED;
    default:
      return response.ok === false ? STATUS_CONFIG.ERROR : STATUS_CONFIG.UNKNOWN;
  }
}

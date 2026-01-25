import { isProdDebugEnabled } from "@/src/lib/debug";

const gateVerifyDebug = process.env.GATE_VERIFY_DEBUG === "true";

export function requireDebugAccess() {
  return process.env.VERCEL_ENV !== "production";
}

export function shouldIncludeGateDebug() {
  return gateVerifyDebug && isProdDebugEnabled();
}

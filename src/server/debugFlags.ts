const isProd = process.env.NODE_ENV === "production";
const enableProdDebug = process.env.ENABLE_PROD_DEBUG === "true";
const gateVerifyDebug = process.env.GATE_VERIFY_DEBUG === "true";

export function requireDebugAccess() {
  return !isProd || enableProdDebug;
}

export function shouldIncludeGateDebug() {
  return gateVerifyDebug;
}

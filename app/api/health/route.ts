import { kv } from "@vercel/kv";

import { getServerEnv } from "@/src/lib/env";
import { getChainConfig } from "@/src/lib/chain";
import { jsonNoStore } from "@/src/lib/http";
import { logger } from "@/src/lib/logger";

export async function GET() {
  const env = getServerEnv();
  const chain = getChainConfig();
  let kvOk = false;

  try {
    if (env.VERCEL_ENV === "production") {
      await kv.get("health:ping");
      kvOk = true;
    } else {
      const key = `health:ping:${Date.now()}`;
      await kv.set(key, "1", { ex: 60 });
      const value = await kv.get(key);
      kvOk = Boolean(value);
      await kv.del(key).catch(() => {});
    }
  } catch (error) {
    logger.warn("health.kv_failed", { error });
    kvOk = false;
  }

  return jsonNoStore({
    ok: true,
    commit: env.VERCEL_GIT_COMMIT_SHA ?? null,
    chainId: chain.chainId,
    kvOk,
  });
}

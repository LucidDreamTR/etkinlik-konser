import { createPublicClient, http } from "viem";
import { kv } from "@vercel/kv";

import { getServerEnv } from "@/src/lib/env";
import { getChainConfig } from "@/src/lib/chain";
import { jsonNoStore } from "@/src/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const env = getServerEnv();
  const chain = getChainConfig();

  let kvOk = false;
  let rpcOk = false;
  let kvError: string | null = null;
  let rpcError: string | null = null;

  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    try {
      await kv.get("ready:ping");
      kvOk = true;
    } catch (error) {
      kvError = error instanceof Error ? error.message : "KV error";
      kvOk = false;
    }
  }

  try {
    const client = createPublicClient({ transport: http(chain.rpcUrl) });
    await client.getBlockNumber();
    rpcOk = true;
  } catch (error) {
    rpcError = error instanceof Error ? error.message : "RPC error";
    rpcOk = false;
  }

  const ok = kvOk && rpcOk;
  return jsonNoStore(
    {
      ok,
      chainId: chain.chainId,
      kvOk,
      rpcOk,
      kvError,
      rpcError,
      latency_ms: Date.now() - startedAt,
    },
    { status: ok ? 200 : 503 }
  );
}

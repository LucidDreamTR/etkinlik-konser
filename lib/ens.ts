import 'server-only';

import { unstable_cache } from 'next/cache';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const rpcUrl = process.env.ETHEREUM_RPC_URL;

if (!rpcUrl) {
  throw new Error('ETHEREUM_RPC_URL is not set');
}

const client = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl),
});

export async function resolveEnsAddress(name: string) {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    throw new Error('ENS name is required');
  }

  return client.getEnsAddress({ name: normalizedName });
}

export const resolveEnsAddressCached = unstable_cache(
  async (name: string) => resolveEnsAddress(name),
  (name: string) => ['ens-resolve', name],
  { revalidate: 60 },
);

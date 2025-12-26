import 'server-only';

import { getAddress, type Address } from 'viem';

import { resolveRecipient } from './address';
import type { EventRecord, PayoutSplit } from './events';

export type BuiltPayoutParams = {
  recipients: Address[];
  sharesBps: bigint[];
  totalBps: number;
};

export async function buildPayoutParams(payouts: PayoutSplit[]): Promise<BuiltPayoutParams> {
  if (!payouts?.length) throw new Error('No payouts defined');

  const resolved = await Promise.all(
    payouts.map(async (p) => {
      const addr = await resolveRecipient(p.recipient);
      return { ...p, address: getAddress(addr) as Address };
    }),
  );

  const totalBps = resolved.reduce((s, p) => s + p.shareBps, 0);
  if (totalBps !== 10000) throw new Error(`Total bps must be 10000, got ${totalBps}`);

  return {
    recipients: resolved.map((p) => p.address),
    sharesBps: resolved.map((p) => BigInt(p.shareBps)),
    totalBps,
  };
}

import 'server-only';

import { getAddress, type Address } from 'viem';

import { resolveRecipient } from './address';
import type { PayoutSplit } from './events';

export type BuiltPayoutParams = {
  recipients: Address[];
  sharesBps: bigint[];
  totalBps: number;
  mergedFrom?: number;
  mergedTo?: number;
};

export async function buildPayoutParams(payouts: PayoutSplit[]): Promise<BuiltPayoutParams> {
  if (!payouts?.length) throw new Error('No payouts defined');

  const resolved = await Promise.all(
    payouts.map(async (p) => {
      const addr = await resolveRecipient(p.recipient);
      return { ...p, address: getAddress(addr) as Address };
    }),
  );

  const merged = resolved.reduce<Record<string, number>>((acc, p) => {
    const checksum = p.address;
    acc[checksum] = (acc[checksum] ?? 0) + p.shareBps;
    return acc;
  }, {});

  const recipients = Object.keys(merged) as Address[];
  const sharesBps = recipients.map((r) => BigInt(merged[r]));
  const totalBps = sharesBps.reduce((s, b) => s + b, 0n);

  if (totalBps !== 10000n) throw new Error(`Total bps must be 10000, got ${totalBps}`);

  return {
    recipients,
    sharesBps,
    totalBps: Number(totalBps),
    mergedFrom: resolved.length,
    mergedTo: recipients.length,
  };
}

export type BuiltAmounts = {
  recipients: Address[];
  sharesBps: bigint[];
  amountsWei: bigint[];
  totalBps: number;
  totalAmountWei: bigint;
  distributedWei: bigint;
  remainderWei: bigint; // total - distributed
  rawRemainderWei: bigint;
  remainderAppliedTo: Address;
};

export function computeAmountsWei(
  params: BuiltPayoutParams,
  totalAmountWei: bigint,
  remainderToIndex?: number,
): BuiltAmounts {
  const amountsWei = params.sharesBps.map((bps) => (totalAmountWei * bps) / 10000n);
  const distributedWei = amountsWei.reduce((a, b) => a + b, 0n);
  const rawRemainderWei = totalAmountWei - distributedWei;

  if (rawRemainderWei > 0n) {
    const targetIndex = remainderToIndex ?? 0;
    amountsWei[targetIndex] = amountsWei[targetIndex] + rawRemainderWei;
  }

  const redistributed = amountsWei.reduce((a, b) => a + b, 0n);
  const remainderWei = totalAmountWei - redistributed;

  return {
    recipients: params.recipients,
    sharesBps: params.sharesBps,
    amountsWei,
    totalBps: params.totalBps ?? Number(params.sharesBps.reduce((s, b) => s + b, 0n)),
    totalAmountWei,
    distributedWei: redistributed,
    remainderWei,
    rawRemainderWei,
    remainderAppliedTo: params.recipients[remainderToIndex ?? 0],
  };
}

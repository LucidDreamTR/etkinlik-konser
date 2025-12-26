import 'server-only';

import { getAddress, isAddress, type Address } from 'viem';

import { resolveEnsAddressCached } from './ens';

export async function resolveRecipient(input: string): Promise<Address> {
  const v = input.trim();

  if (!v) {
    throw new Error('Empty recipient');
  }

  if (isAddress(v)) {
    return getAddress(v);
  }

  if (v.includes('.')) {
    const resolved = await resolveEnsAddressCached(v.toLowerCase());
    if (!resolved) {
      throw new Error('ENS not found');
    }
    return getAddress(resolved);
  }

  throw new Error('Invalid address or ENS');
}

import 'server-only';

import { encodeFunctionData, type Address } from 'viem';

export const payoutAbi = [
  {
    type: 'function',
    name: 'distribute',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const;

export function encodeDistributeCalldata(args: { recipients: Address[]; amountsWei: bigint[] }) {
  return encodeFunctionData({
    abi: payoutAbi,
    functionName: 'distribute',
    args: [args.recipients, args.amountsWei],
  });
}

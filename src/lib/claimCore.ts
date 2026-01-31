import { getAddress } from "viem";

import type { MintMode } from "./mintModeCore";

export type ClaimRequirement = {
  status: "not_required" | "needs_transfer" | "invalid_owner";
  needsCustodySigner: boolean;
};

export function resolveClaimRequirement(args: {
  mintMode: MintMode;
  onchainOwner: string;
  buyerAddress: string;
  custodyAddress?: string | null;
}): ClaimRequirement {
  const buyer = getAddress(args.buyerAddress);
  const owner = getAddress(args.onchainOwner);

  if (owner === buyer) {
    return { status: "not_required", needsCustodySigner: false };
  }

  if (args.mintMode === "direct") {
    return { status: "invalid_owner", needsCustodySigner: false };
  }

  const custody = args.custodyAddress ? getAddress(args.custodyAddress) : null;
  if (!custody || owner !== custody) {
    return { status: "invalid_owner", needsCustodySigner: false };
  }

  return { status: "needs_transfer", needsCustodySigner: true };
}

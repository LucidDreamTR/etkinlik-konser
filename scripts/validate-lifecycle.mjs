import assert from "node:assert/strict";

import { createRequire } from "node:module";

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "node",
  esModuleInterop: true,
});
await import("ts-node/register");

const require = createRequire(import.meta.url);
const ticketLifecycleModule = require("../src/lib/ticketLifecycle.ts");
const claimCodeModule = require("../src/lib/claimCode.ts");
const claimCoreModule = require("../src/lib/claimCore.ts");
const mintModeCoreModulePath = require.resolve("../src/lib/mintModeCore.ts");

const { applyAtLeastTransition, applyTransition, canTransition } = ticketLifecycleModule;
const { generateClaimCode, isFormattedClaimCode } = claimCodeModule;
const { resolveClaimRequirement } = claimCoreModule;

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, message);
}

// cannot go from intent_created -> claimed directly
assert.equal(canTransition("intent_created", "claimed"), false, "intent_created -> claimed should be invalid");
assertThrows(
  () => applyTransition({ ticketState: "intent_created" }, "claimed"),
  "applyTransition should throw on invalid transition"
);

// gate_validated is terminal
assert.equal(canTransition("gate_validated", "claimed"), false, "gate_validated should be terminal");
assertThrows(
  () => applyTransition({ ticketState: "gate_validated" }, "claimed"),
  "terminal transition should throw"
);

// duplicate purchase does not change state
const before = { ticketState: "minted", purchaseStatus: "processed" };
const after = applyAtLeastTransition(before, "minted", { purchaseStatus: "duplicate" });
assert.equal(after.ticketState, "minted", "duplicate purchase should not change state");

console.log("ticket lifecycle validation passed");

// claimCode generator smoke test (local-only)
const seen = new Set();
for (let i = 0; i < 10_000; i += 1) {
  const code = generateClaimCode();
  assert.equal(isFormattedClaimCode(code), true, "claimCode format invalid");
  assert.equal(seen.has(code), false, "claimCode collision detected");
  seen.add(code);
}

console.log("claimCode generator validation passed");

// direct mint to buyer should be treated as claimed (idempotent)
const directMint = applyTransition({ ticketState: "intent_created" }, "minted");
const autoClaimed = applyAtLeastTransition(directMint, "claimed", { claimStatus: "claimed" });
assert.equal(autoClaimed.ticketState, "claimed", "minted -> claimed should be allowed for direct mint");
assert.equal(autoClaimed.claimStatus, "claimed", "auto-claim should set claimStatus");
const autoClaimedAgain = applyAtLeastTransition(autoClaimed, "claimed", { claimStatus: "claimed" });
assert.equal(autoClaimedAgain.ticketState, "claimed", "auto-claim should be idempotent");

const gateValidated = applyTransition(autoClaimed, "gate_validated", {
  gateValidatedAt: new Date().toISOString(),
  claimStatus: autoClaimed.claimStatus ?? "claimed",
});
assert.equal(gateValidated.ticketState, "gate_validated", "gate verify should advance to gate_validated");
assert.equal(gateValidated.claimStatus, "claimed", "gate verify should keep claimStatus claimed");
const responseClaimed = gateValidated.claimStatus === "claimed" || gateValidated.ticketState === "gate_validated";
assert.equal(responseClaimed, true, "gate verify response should report claimed true");
const gateValidatedAgain = applyAtLeastTransition(gateValidated, "gate_validated", {
  gateValidatedAt: gateValidated.gateValidatedAt,
});
assert.equal(gateValidatedAgain.ticketState, "gate_validated", "gate verify should be idempotent");

function resetEnvCache() {
  delete require.cache[mintModeCoreModulePath];
}

delete process.env.MINT_MODE;
delete process.env.CUSTODY_WALLET_ADDRESS;
resetEnvCache();
const { resolveMintRecipient } = require("../src/lib/mintModeCore.ts");
const directResult = resolveMintRecipient("0x0000000000000000000000000000000000000003", {
  mintMode: process.env.MINT_MODE,
  custodyWalletAddress: process.env.CUSTODY_WALLET_ADDRESS ?? null,
});
assert.equal(directResult.mode, "direct", "MINT_MODE should default to direct when missing");

process.env.MINT_MODE = "custody";
delete process.env.CUSTODY_WALLET_ADDRESS;
resetEnvCache();
assertThrows(
  () =>
    resolveMintRecipient("0x0000000000000000000000000000000000000003", {
      mintMode: process.env.MINT_MODE,
      custodyWalletAddress: process.env.CUSTODY_WALLET_ADDRESS ?? null,
    }),
  "custody mode should throw without CUSTODY_WALLET_ADDRESS"
);

console.log("mint mode validation passed");

const buyer = "0x0000000000000000000000000000000000000001";
const custody = "0x0000000000000000000000000000000000000002";
const other = "0x0000000000000000000000000000000000000003";

const notRequired = resolveClaimRequirement({
  mintMode: "custody",
  onchainOwner: buyer,
  buyerAddress: buyer,
  custodyAddress: custody,
});
assert.equal(notRequired.status, "not_required", "owner == buyer should skip custody transfer");
assert.equal(notRequired.needsCustodySigner, false, "no custody signer needed when buyer already owns");

const needsTransfer = resolveClaimRequirement({
  mintMode: "custody",
  onchainOwner: custody,
  buyerAddress: buyer,
  custodyAddress: custody,
});
assert.equal(needsTransfer.status, "needs_transfer", "custody owner should require transfer");
assert.equal(needsTransfer.needsCustodySigner, true, "custody signer required when transfer needed");

const invalidOwner = resolveClaimRequirement({
  mintMode: "custody",
  onchainOwner: other,
  buyerAddress: buyer,
  custodyAddress: custody,
});
assert.equal(invalidOwner.status, "invalid_owner", "unexpected owner should be invalid");
assert.equal(invalidOwner.needsCustodySigner, false, "invalid owner should not require custody signer");

console.log("custody claim validation passed");

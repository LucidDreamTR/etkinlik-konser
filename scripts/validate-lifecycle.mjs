import assert from "node:assert/strict";

import "ts-node/register";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ticketLifecycleModule = require("../src/lib/ticketLifecycle.ts");
const claimCodeModule = require("../src/lib/claimCode.ts");

const { applyAtLeastTransition, applyTransition, canTransition } = ticketLifecycleModule;
const { generateClaimCode, isFormattedClaimCode } = claimCodeModule;

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
const gateValidatedAgain = applyAtLeastTransition(gateValidated, "gate_validated", {
  gateValidatedAt: gateValidated.gateValidatedAt,
});
assert.equal(gateValidatedAgain.ticketState, "gate_validated", "gate verify should be idempotent");

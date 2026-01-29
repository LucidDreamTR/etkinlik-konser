import assert from "node:assert/strict";

import { applyAtLeastTransition, applyTransition, canTransition } from "../src/lib/ticketLifecycle.ts";

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

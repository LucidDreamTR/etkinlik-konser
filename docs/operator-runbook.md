# Operator QR / Scan Runbook

## Purpose & Scope
- For: gate operators and on-site supervisors.
- Covers: QR scan → verify → admit/deny.
- Not covered: smart contract changes, refunds, payments, or engineering fixes.

## Pre-Event Checklist (10–15 items)
- Operator device charged; spare power bank ready.
- Camera permissions granted to scanning app.
- App logged in and showing **Production** environment.
- Network online and stable; backup hotspot available.
- Confirm `x-operator-key` is configured in production.
- Check `/api/health` returns **200** before doors open.
- Verify correct event and gate are selected in the operator app.
- Test-scan a known valid ticket before opening.
- Review the reason/action table with all operators.
- Remind staff: no manual edits to QR content.
- Expect brief delays if network is slow.
- Avoid rapid rescans (rate limiting).

## Scan Formats (Exact)
Accepted QR payloads:
- **bytes32**: `0x` + 64 hex chars (used directly).
- **merchantOrderId (UUID or string)**: hashed with `keccak256(preimage)` before compare.

Rules:
- Scan exactly what is shown.
- **Do not** edit or retype the QR content.

## Normal Flow (Step-by-Step)
1. Scan the QR code once.
2. System normalizes input (bytes32 or UUID → hash).
3. On-chain checks run (owner, claimed, paymentId match).
4. Result appears within seconds.
5. Admit or deny based on the reason table below.

## Response Reasons & Operator Actions
| reason | meaning | operator action | escalate? |
| --- | --- | --- | --- |
| valid | Ticket is valid | Admit entry | No |
| invalid_code | QR is malformed or unreadable | Ask for another copy; rescan once | Yes if repeats |
| payment_mismatch | QR hash does not match paymentId on-chain | Deny entry; ask for proof of purchase | Yes |
| not_owner | Ticket owner does not match expected wallet | Deny entry; refer to supervisor | Yes |
| already_claimed | Ticket already used/claimed | Deny entry; check identity and time | Yes |
| rate_limited | Too many scans in short time | Wait 30–60s, then scan once | No |
| lock_hit | Another scan is processing | Wait 10–15s, then scan once | No |
| temporarily_locked | Temporary lock after repeated failures | Wait 10–15 minutes; rescan once | Yes if urgent |

## Incident Playbooks
A) Same ticket scanned twice
- Say: “This ticket has already been used. I need a supervisor to review.”
- Do: deny entry; do not rescan repeatedly.
- Escalate: always.

B) Customer says “I bought it” but scan invalid
- Say: “I can’t validate this code right now; a supervisor will check your proof of purchase.”
- Do: deny entry; collect order confirmation + wallet info if available.
- Escalate: always.

C) Network slow or temporarily unavailable
- Say: “Our system is slow right now; please wait a moment.”
- Do: wait and retry once; avoid rapid rescans.
- Escalate: if delays exceed 3–5 minutes.

D) KV / API down (health check fails)
- Say: “Our verification service is offline; we’re switching to manual review.”
- Do: stop automated scans; use supervisor-approved fallback process.
- Escalate: immediately to supervisor/ops.

E) Suspected QR tampering / screenshot reuse
- Say: “This code isn’t validating; I need a supervisor.”
- Do: deny entry; do not disclose validation details.
- Escalate: immediately.

F) Operator mistake (wrong scan / wrong ticket)
- Say: “Let me rescan the correct code.”
- Do: rescan once with the correct ticket; avoid repeated attempts.
- Escalate: if the issue persists.

## Offline / Degraded Mode
- Full offline verification is **not** supported unless a preloaded allowlist exists.
- If offline: do not admit without supervisor approval.
- If a manual allowlist is provided by ops, use it exactly as instructed.
- When back online: re-verify any manually admitted entries and report exceptions.

## Do / Do Not (Quick List)
- DO: scan once and wait for a result.
- DO: follow the reason table and escalate when required.
- DO NOT: admit without supervisor approval.
- DO NOT: rescan rapidly (rate limiting).
- DO NOT: accept screenshots if policy forbids.

## Troubleshooting (Short)
- Camera not focusing: clean lens, improve lighting, try again.
- App stuck: reload the app and retry once.
- Lock or rate limit: wait for TTL (10–60s) before rescanning.

## Versioning & Contact
- Version: 2026-01-28
- Contact: On-site supervisor → Operations lead → Engineering on-call

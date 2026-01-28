# Ops Visibility & Alerts

## What We Emit (Log-Based Metrics)
Each metric is a single JSON log line with:
- `event` (string)
- `route` (string)
- `reason` (optional)
- `merchantOrderId_hash` (optional, sha256)
- `tokenId` (optional)
- `ip_hash` (optional, sha256)
- `latency_ms` (optional)
- `ts` (ISO8601)

Events:
- `purchase_processed`
- `purchase_pending`
- `purchase_duplicate`
- `rate_limit_hit`
- `lock_hit`
- `claim_ok`
- `claim_already`
- `gate_valid`
- `gate_invalid`

## Where to Watch
- Vercel Logs: filter by `event` value (JSON) per route.
- Optional: export logs to external tools (generic log pipeline).
- Readiness checks: `/api/health` (app up) and `/api/ready` (KV + RPC).

## Starter Alert Thresholds (per 5-minute window)
- `rate_limit_hit` > 20 on any route → investigate abuse or misbehaving clients.
- `lock_hit` spike (>10 for the same token/order) → investigate retries/UI loop.
- `gate_invalid` ratio > 5% of gate scans → possible QR issues or tampering.
- `purchase_duplicate` spike → client retry bug or idempotency failure.

## Ops Playbook (Short)
- Triage spikes:
  - Verify `route`, `reason`, and `ip_hash` patterns.
  - Check RPC and KV health; confirm `/api/health` is 200.
  - Inspect recent deploys and configuration changes.
- Adjust temporarily:
  - Increase lock TTLs if duplicate processing occurs.
  - Tighten or relax rate limits if legitimate traffic is blocked.
- Pause ticketing:
  - Set `FEATURE_TICKETING_ENABLED=false` to stop purchase/claim/gate flows.
- Circuit breaker (manual):
  - If `onchain_error` spikes, disable ticketing via `FEATURE_TICKETING_ENABLED=false` and re-enable after RPC stabilizes.
- Post-incident checklist:
  - Confirm rates return to baseline.
  - Document root cause and remediation.
  - Review operator guidance if outcomes were unclear.

## Mainnet Day Checklist
- MAINNET_ENABLED=true and NEXT_PUBLIC_CHAIN_ID=1.
- Verify mainnet contract addresses are final and deployed.
- FEATURE_TICKETING_ENABLED=true.
- METRICS_ENABLED=true and logging filters in place.
- Run `/api/health` (must be 200) and `/api/ready` (must be 200).
- Confirm rate-limit and lock metrics are stable pre-open.

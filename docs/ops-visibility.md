# Ops Visibility & Alerts

## Metric Events (Log-Based)
- `rate_limit_hit`
- `lock_hit`
- `purchase_processed`
- `purchase_pending`
- `purchase_duplicate`
- `claim_ok`
- `claim_already`
- `gate_valid`
- `gate_invalid`

All metrics include tags: `route`, hashed `merchantOrderId`, `tokenId`, hashed `ip`, `reason`, and `latency_ms`.

## What to Monitor
- Spikes in `rate_limit_hit` or `lock_hit`.
- Increases in `gate_invalid` with `payment_mismatch`.
- RPC errors in logs (`onchain_error`, `rpcErrorCode`).
- Increased `claim_already` or `invalid_code` patterns.

## Suggested Thresholds (Starter)
- `rate_limit_hit` > 50/min per route.
- `lock_hit` > 20/min on purchase or gate.
- `gate_invalid` > 10% of total gate scans in a 5-minute window.

## Where to Monitor
- Vercel Logs for JSON metrics lines.
- Optional external log ingestion (Sentry/Logtail/Datadog/etc.).

## Response Actions
- Verify RPC health and KV availability.
- Temporarily disable ticketing with `FEATURE_TICKETING_ENABLED=false` if abuse detected.

#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
MERCHANT_ORDER_ID="${MERCHANT_ORDER_ID:-gate-test-emir}"
SPLIT_SLUG="${SPLIT_SLUG:-test-split}"
EVENT_ID="${EVENT_ID:-1}"
AMOUNT_WEI="${AMOUNT_WEI:-1}"
DEADLINE="${DEADLINE:-9999999999}"
CHAIN_ID="${CHAIN_ID:-11155111}"
VERIFYING_CONTRACT="${VERIFYING_CONTRACT:-0x94b0a77e901F3C0DCB3c4424C06A8bA4180bdD57}"
NETWORK="${NETWORK:-sepolia}"
SKIP_CLAIM="${SKIP_CLAIM:-false}"

SIGN_OUTPUT=$(SPLIT_SLUG="$SPLIT_SLUG" \
  MERCHANT_ORDER_ID="$MERCHANT_ORDER_ID" \
  EVENT_ID="$EVENT_ID" \
  AMOUNT_WEI="$AMOUNT_WEI" \
  DEADLINE="$DEADLINE" \
  CHAIN_ID="$CHAIN_ID" \
  VERIFYING_CONTRACT="$VERIFYING_CONTRACT" \
  npx hardhat run scripts/sign-ticket-intent-buyer.ts --network "$NETWORK")

BUYER=$(echo "$SIGN_OUTPUT" | node -e "const fs=require('fs');const input=fs.readFileSync(0,'utf8');const match=input.match(/buyer:\s*(0x[a-fA-F0-9]{40})/);if(!match){process.exit(2)}console.log(match[1]);")
SIGNATURE=$(echo "$SIGN_OUTPUT" | node -e "const fs=require('fs');const input=fs.readFileSync(0,'utf8');const match=input.match(/signature:\s*(0x[a-fA-F0-9]+)/);if(!match){process.exit(3)}console.log(match[1]);")

INTENT_PAYLOAD=$(cat <<JSON
{"intent":{"buyer":"$BUYER","splitSlug":"$SPLIT_SLUG","merchantOrderId":"$MERCHANT_ORDER_ID","eventId":"$EVENT_ID","amountWei":"$AMOUNT_WEI","deadline":"$DEADLINE"}}
JSON
)

INTENT_RES=$(curl -sS -X POST "$API_BASE_URL/api/tickets/intent" \
  -H "content-type: application/json" \
  -d "$INTENT_PAYLOAD")

node -e "const res=JSON.parse(process.argv[1]);if(!res.ok){console.error('intent failed:', res.reason || 'unknown', res.error || '');process.exit(1)}" "$INTENT_RES"

PURCHASE_PAYLOAD=$(cat <<JSON
{"intent":{"buyer":"$BUYER","splitSlug":"$SPLIT_SLUG","merchantOrderId":"$MERCHANT_ORDER_ID","eventId":"$EVENT_ID","amountWei":"$AMOUNT_WEI","deadline":"$DEADLINE"},"signature":"$SIGNATURE","skipClaim":$SKIP_CLAIM}
JSON
)

PURCHASE_RES=$(curl -sS -X POST "$API_BASE_URL/api/tickets/purchase" \
  -H "content-type: application/json" \
  -d "$PURCHASE_PAYLOAD")

node -e "const res=JSON.parse(process.argv[1]);if(!res.ok){console.error('purchase failed:', res.reason || 'unknown', res.error || '');process.exit(1)}console.log('txHash:', res.txHash || '');console.log('claimCode:', res.claimCode || '');console.log('tokenId:', res.tokenId ?? '');console.log('claimed:', res.claimed ?? false);if(res.tokenIdWarning){console.log('tokenIdWarning:', res.tokenIdWarning)}" "$PURCHASE_RES"

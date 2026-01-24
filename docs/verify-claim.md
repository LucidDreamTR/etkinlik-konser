# Verify intent -> fake-pay -> claim (prod)

Requirements:
- `ALLOW_UNSIGNED_INTENT=true` in the target environment (for unsigned intent testing only).
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` set in production.

## 1) Create intent (unsigned)
```bash
curl -s -X POST "https://etkinlik-konser.vercel.app/api/tickets/intent" \
  -H "content-type: application/json" \
  -d '{
    "intent": {
      "buyer": "0xYOUR_BUYER_ADDRESS",
      "splitSlug": "rock-gecesi-istanbul",
      "merchantOrderId": "YOUR_ORDER_ID",
      "eventId": 1,
      "amountWei": "1",
      "deadline": "9999999999"
    }
  }' | jq
```
Expected keys: `ok`, `status`, `paymentIntentId`, `orderId`

## 2) Debug order
```bash
curl -s "https://etkinlik-konser.vercel.app/api/debug/order?merchantOrderId=YOUR_ORDER_ID" | jq
```
Expected keys: `ok`, `payment_status`, `claimStatus`

## 3) Fake pay (mint + mark paid)
```bash
curl -s -X POST "https://etkinlik-konser.vercel.app/api/payments/fake-pay" \
  -H "content-type: application/json" \
  -d '{
    "merchantOrderId": "YOUR_ORDER_ID",
    "eventId": 1,
    "splitSlug": "rock-gecesi-istanbul",
    "amountTry": "1"
  }' | jq
```
Expected keys: `ok`, `status`, `txHash`, `claimCode` (only when custody flow is used)

## 4) Debug order (post-payment)
```bash
curl -s "https://etkinlik-konser.vercel.app/api/debug/order?merchantOrderId=YOUR_ORDER_ID" | jq
```
Expected keys: `payment_status: "paid"`, `tokenId`, `nftAddress`, `custodyAddress`

## 5) Claim
```bash
curl -m 30 -s -X POST "https://etkinlik-konser.vercel.app/api/tickets/claim" \
  -H "content-type: application/json" \
  -d '{
    "merchantOrderId": "YOUR_ORDER_ID",
    "claimCode": "<claimCode from step 3>",
    "walletAddress": "0xYOUR_RECEIVER_ADDRESS"
  }' | jq
```
Expected keys: `ok`, `status`, `transferTxHash`, `chainClaimed`

## 6) Debug order (post-claim)
```bash
curl -s "https://etkinlik-konser.vercel.app/api/debug/order?merchantOrderId=YOUR_ORDER_ID" | jq
```
Expected keys: `claimStatus: "claimed"`, `claimedTo`, `claimedAt`, `chainClaimed`

# Final Architecture

This document is the single-source description of the gate + claim + purchase architecture for the Next.js App Router app using Vercel KV and Sepolia.

## Purchase Flow (Intent -> Purchase -> Mint)
```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant API as Vercel API
  participant KV
  participant Sepolia as Sepolia RPC + Contracts

  Client->>API: POST /api/tickets/intent (intent payload)
  API->>KV: upsert order:<merchantOrderId> (pending)
  API-->>Client: ok + orderId (bytes32)

  Client->>API: POST /api/tickets/purchase (intent + sig)
  API->>KV: SET purchase:lock:<merchantOrderId> NX (TTL ~120s)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: safeMint(buyer, tokenUri, eventId, paymentId=orderId)
  Sepolia-->>API: txHash + tokenId
  API->>KV: record OrderStore (paid + txHash + tokenId)
  API-->>Client: status=processed|pending|duplicate
```

## Claim Flow (Custody -> Buyer Transfer)
```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant API as Vercel API
  participant KV
  participant Sepolia as Sepolia RPC + Contracts

  Client->>API: POST /api/tickets/claim (merchantOrderId + claimCode + wallet)
  API->>API: normalize + hash claimCode
  API->>KV: load order:<merchantOrderId>
  API->>KV: SET claim:lock:<tokenId|merchantOrderId> NX (TTL ~120s)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: paymentIdOf(tokenId)
  Sepolia-->>API: paymentId (bytes32)
  API->>API: compare paymentId == orderId
  API->>Sepolia: claim(tokenId) [best-effort]
  API->>Sepolia: safeTransferFrom(custody, buyer, tokenId)
  Sepolia-->>API: claim tx + transfer tx
  API->>KV: mark OrderStore claimed + claimedTo + timestamps
  API-->>Client: status=claimed|pending|error
```

## Gate Verify Flow (One-time Scan)
```mermaid
sequenceDiagram
  autonumber
  actor Operator as Operator Device
  participant API as Vercel API
  participant KV
  participant Sepolia as Sepolia RPC + Contracts

  Operator->>API: POST /api/gate/verify (tokenId + code)
  API->>API: normalize input (bytes32 or uuid->keccak)
  API->>KV: SET gate:lock:<tokenId> NX (TTL ~10s)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: ownerOf(tokenId)
  API->>Sepolia: tickets(tokenId) -> claimed
  API->>Sepolia: paymentIdOf(tokenId)
  Sepolia-->>API: owner + claimed + paymentId
  API->>API: compare paymentId == expected hash
  API->>KV: mark used:token:<tokenId> (NX)
  API-->>Operator: valid | invalid_code | not_owner | already_claimed | rate_limited | lock_hit
```

## Components & Trust Boundaries
```mermaid
flowchart LR
  subgraph Untrusted_Clients[Untrusted Boundary]
    Client[Client Browser]
    Operator[Operator Device]
  end

  subgraph Vercel[Trusted App Boundary (Vercel)]
    API[Vercel API Routes]
    KV[(Vercel KV / Redis)]
  end

  subgraph Chain[External Trust Boundary (Sepolia)]
    RPC[Sepolia RPC]
    Contracts[EventTicket + TicketSale]
  end

  Client -->|/api/tickets/intent| API
  Client -->|/api/tickets/purchase| API
  Client -->|/api/tickets/claim| API
  Operator -->|/api/gate/verify| API

  API <--> KV
  API --> RPC --> Contracts
```

## Locks & Idempotency
- `purchase:lock:<merchantOrderId>` (in `/api/tickets/purchase`): prevents duplicate minting for the same merchant order. Lock hit returns `status=pending` and should be retried after TTL (~120s).
- `claim:lock:<tokenId|merchantOrderId>` (in `/api/tickets/claim`): ensures claim/transfer is processed once. Lock hit returns HTTP 202 with `status=pending`; client should retry after TTL (~120s).
- `gate:lock:<tokenId>` (in `/api/gate/verify`): short-lived anti-spam lock for gate scans. Lock hit returns `reason=temporarily_locked` and should be retried after TTL (~10s).
- Additional gate anti-abuse lock: `gate:verify:lock:<tokenId>` is set after repeated invalid codes to rate-limit brute force (see `docs/gate-scan-protocol.md`).

## Data Model & Keys
- OrdersStore fields (primary): `merchantOrderId`, `orderId` (bytes32), `paymentId` (bytes32, equals `orderId`), `txHash`, `tokenId`, `claimed` (stored as `claimStatus` + timestamps), `createdAt`, `updatedAt`, plus claim metadata.
- KV keys:
  - `order:<merchantOrderId>` -> Order record
  - `order:token:<tokenId>` -> `merchantOrderId`
- On-chain mapping:
  - `paymentIdOf(tokenId) == orderId (bytes32)`

## Security Controls
- Gate operator auth via `x-operator-key` in production.
- Sensitive endpoints return `Cache-Control: no-store` via `jsonNoStore`.
- Debug fields disabled in production unless `ENABLE_PROD_DEBUG` / `GATE_VERIFY_DEBUG` are explicitly enabled.
- Server env validation enforced for custody and RPC configuration.

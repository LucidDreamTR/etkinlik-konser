# Architecture

## Purchase Flow
```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant API as Vercel API
  participant KV
  participant Sepolia

  rect rgba(230, 240, 255, 0.4)
    note over Client: Client boundary
  end
  rect rgba(245, 245, 245, 0.6)
    note over API,KV: Vercel boundary
  end
  rect rgba(240, 230, 255, 0.4)
    note over Sepolia: Chain boundary
  end

  Client->>API: POST /api/tickets/purchase (intent + sig)
  API->>KV: SET purchase:lock:<merchantOrderId> (NX)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: safeMint(buyer, tokenUri, eventId, paymentId)
  Sepolia-->>API: txHash + tokenId
  API->>KV: record OrderStore (paid + tokenId)
  API-->>Client: status=processed|pending|duplicate
```

## Claim Flow
```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant API as Vercel API
  participant KV
  participant Sepolia

  Client->>API: POST /api/tickets/claim (claimCode + wallet)
  API->>KV: SET claim:lock:<tokenId|merchantOrderId> (NX)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: paymentIdOf(tokenId)
  Sepolia-->>API: paymentId
  API->>Sepolia: claim(tokenId)
  Sepolia-->>API: claim tx
  API->>Sepolia: safeTransferFrom(custody, buyer, tokenId)
  Sepolia-->>API: transfer tx
  API->>KV: markOrderClaimed()
  API-->>Client: status=claimed
```

## Gate Verify Flow
```mermaid
sequenceDiagram
  autonumber
  actor Operator as Operator Device
  participant API as Vercel API
  participant KV
  participant Sepolia

  Operator->>API: POST /api/gate/verify (tokenId + code)
  API->>KV: SET gate:lock:<tokenId> (NX)
  KV-->>API: lock acquired / lock hit
  API->>Sepolia: ownerOf(tokenId)
  API->>Sepolia: tickets(tokenId)
  API->>Sepolia: paymentIdOf(tokenId)
  Sepolia-->>API: owner + claimed + paymentId
  API->>API: normalize code (bytes32 or keccak(uuid))
  API->>KV: markTokenUsedOnce()
  API-->>Operator: valid|invalid|already_used
```

### Notes
- Trust boundaries: Client/Operator devices, Vercel API, KV storage, Sepolia chain.
- Idempotency locks: `purchase:lock`, `claim:lock`, `gate:lock`.
- Gate invalid attempts tracked with `gate:verify:invalid` + temporary lock.

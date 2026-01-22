import dotenv from 'dotenv'
// Node dotenv/config defaults to loading only ".env".
// Our secrets live in ".env.local", so load it explicitly.
dotenv.config({ path: '.env.local', quiet: true })

import { createWalletClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const {
  RELAYER_PRIVATE_KEY,
  NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS,
  TICKET_SALE_ADDRESS,
  NEXT_PUBLIC_TICKET_SALE_ADDRESS,
  BUYER,
  SPLIT_SLUG,
  PAYMENT_INTENT_ID,
  EVENT_ID,
  AMOUNT_WEI,
  DEADLINE,
} = process.env

if (!RELAYER_PRIVATE_KEY) throw new Error('Missing RELAYER_PRIVATE_KEY in env')
if (!NEXT_PUBLIC_RPC_URL) throw new Error('Missing NEXT_PUBLIC_RPC_URL in env')
if (!NEXT_PUBLIC_CHAIN_ID) throw new Error('Missing NEXT_PUBLIC_CHAIN_ID in env')
if (!BUYER || !SPLIT_SLUG || !PAYMENT_INTENT_ID || !EVENT_ID || !AMOUNT_WEI || !DEADLINE) {
  throw new Error('Missing required envs (BUYER/SPLIT_SLUG/PAYMENT_INTENT_ID/EVENT_ID/AMOUNT_WEI/DEADLINE)')
}

const verifyingContractRaw =
  NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS || TICKET_SALE_ADDRESS || NEXT_PUBLIC_TICKET_SALE_ADDRESS
if (!verifyingContractRaw) {
  throw new Error('Missing NEXT_PUBLIC_TICKET_CONTRACT_ADDRESS (or legacy TICKET_SALE_ADDRESS) in env')
}

const verifyingContract = getAddress(verifyingContractRaw)
const chainId = Number(NEXT_PUBLIC_CHAIN_ID)

const account = privateKeyToAccount(RELAYER_PRIVATE_KEY)

const client = createWalletClient({
  account,
  transport: http(NEXT_PUBLIC_RPC_URL),
})

const domain = {
  name: 'EtkinlikKonser',
  version: '1',
  chainId,
  verifyingContract,
}

const types = {
  TicketIntent: [
    { name: 'buyer', type: 'address' },
    { name: 'splitSlug', type: 'string' },
    { name: 'merchantOrderId', type: 'string' },
    { name: 'eventId', type: 'uint256' },
    { name: 'amountWei', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
}

const message = {
  buyer: getAddress(BUYER),
  splitSlug: SPLIT_SLUG,
  merchantOrderId: PAYMENT_INTENT_ID,
  eventId: BigInt(EVENT_ID),
  amountWei: BigInt(AMOUNT_WEI),
  deadline: BigInt(DEADLINE),
}

const signature = await client.signTypedData({
  domain,
  types,
  primaryType: 'TicketIntent',
  message,
})

process.stdout.write(signature)

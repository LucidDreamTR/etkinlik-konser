import { defineChain } from "viem";

const LOCAL_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL_LOCAL ?? "http://127.0.0.1:8545";

export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [LOCAL_RPC_URL],
    },
    public: {
      http: [LOCAL_RPC_URL],
    },
  },
});

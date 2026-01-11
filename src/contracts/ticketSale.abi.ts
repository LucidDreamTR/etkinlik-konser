export const ticketSaleAbi = [
  {
    type: "error",
    name: "SalesPaused",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidPayment",
    inputs: [],
  },
  {
    type: "error",
    name: "OrderUsed",
    inputs: [],
  },
  {
    type: "error",
    name: "OnlyRelayer",
    inputs: [],
  },
  {
    type: "error",
    name: "MissingEventConfig",
    inputs: [],
  },
  {
    type: "error",
    name: "SoldOut",
    inputs: [],
  },
  {
    type: "error",
    name: "ERC721InvalidReceiver",
    inputs: [{ name: "receiver", type: "address" }],
  },
  {
    type: "function",
    name: "purchase",
    stateMutability: "payable",
    inputs: [
      { name: "splitId", type: "bytes32", internalType: "bytes32" },
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "eventId", type: "uint256", internalType: "uint256" },
      { name: "uri", type: "string", internalType: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "purchaseFor",
    stateMutability: "payable",
    inputs: [
      { name: "buyer", type: "address", internalType: "address" },
      { name: "splitId", type: "bytes32", internalType: "bytes32" },
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "eventId", type: "uint256", internalType: "uint256" },
      { name: "uri", type: "string", internalType: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "eventConfigs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "priceWei", type: "uint256", internalType: "uint256" },
      { name: "maxSupply", type: "uint256", internalType: "uint256" },
      { name: "paused", type: "bool", internalType: "bool" },
      { name: "minted", type: "uint256", internalType: "uint256" },
      { name: "exists", type: "bool", internalType: "bool" },
    ],
  },
  {
    type: "function",
    name: "relayer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
  },
  {
    type: "function",
    name: "setRelayer",
    stateMutability: "nonpayable",
    inputs: [{ name: "newRelayer", type: "address", internalType: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "usedOrderIds",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
  },
] as const;

const hasEventConfigs = ticketSaleAbi.some((entry) => entry.type === "function" && entry.name === "eventConfigs");
if (!hasEventConfigs) {
  throw new Error("ticketSaleAbi missing eventConfigs");
}

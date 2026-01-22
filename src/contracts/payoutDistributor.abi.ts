export const payoutDistributorAbi = [
  {
    type: "error",
    name: "ClaimTransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidRecipientAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidRecipientBps",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidRecipients",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidTotalBps",
    inputs: [],
  },
  {
    type: "error",
    name: "NothingToClaim",
    inputs: [],
  },
  {
    type: "error",
    name: "SplitNotFound",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroPayment",
    inputs: [],
  },
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "distribute",
    inputs: [
      {
        name: "splitId",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "orderId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getSplit",
    inputs: [
      {
        name: "splitId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct PayoutDistributor.Recipient[]",
        components: [
          {
            name: "account",
            type: "address",
            internalType: "address payable",
          },
          {
            name: "bps",
            type: "uint16",
            internalType: "uint16",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setSplit",
    inputs: [
      {
        name: "splitId",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "recipients",
        type: "tuple[]",
        internalType: "struct PayoutDistributor.Recipient[]",
        components: [
          {
            name: "account",
            type: "address",
            internalType: "address payable",
          },
          {
            name: "bps",
            type: "uint16",
            internalType: "uint16",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

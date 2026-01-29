import { keccak256, pad, toHex } from "viem";

import { extractMintedTokenIdFromReceipt } from "../src/lib/txLogs.ts";

const eventTicketAddress = "0x1111111111111111111111111111111111111111";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const toAddress = "0x2222222222222222222222222222222222222222";
const tokenId = 123n;

const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"));
const topics = [
  transferTopic,
  pad(toHex(zeroAddress), { size: 32 }),
  pad(toHex(toAddress), { size: 32 }),
  pad(toHex(tokenId), { size: 32 }),
];

const receipt = {
  logs: [
    {
      address: eventTicketAddress,
      topics,
      data: "0x",
    },
  ],
};

const extracted = extractMintedTokenIdFromReceipt({
  receipt,
  eventTicketAddress,
});

if (extracted !== tokenId.toString()) {
  throw new Error(`Expected ${tokenId.toString()}, got ${extracted}`);
}

console.log("tx log extraction ok");

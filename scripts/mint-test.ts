import { ethers } from "hardhat";

async function main() {
  const TICKET_CONTRACT_ADDRESS =
    "0x94b0a77e901F3C0DCB3c4424C06A8bA4180bdD57";

  const [deployer] = await ethers.getSigners();
  console.log("Minting with:", deployer.address);

  const Ticket = await ethers.getContractAt(
    "EventTicket",
    TICKET_CONTRACT_ADDRESS
  );

  const tx = await (await Ticket.hasRole(await Ticket.MINTER_ROLE(), deployer.address)
    ? Ticket["safeMint(address,string,uint256,bytes32)"](
        deployer.address,
        "ipfs://mint-test",
        1,
        ethers.id(`mint-test-${Date.now()}`)
      )
    : (() => {
        throw new Error("Deployer missing MINTER_ROLE; grant role before minting.");
      })());
  const receipt = await tx.wait();

  console.log("Mint tx:", receipt?.hash);
  console.log("Mint completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

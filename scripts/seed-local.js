const hre = require("hardhat");

async function main() {
  const [deployer, artist, organizer, platform, relayer] = await hre.ethers.getSigners();

  const Distributor = await hre.ethers.getContractFactory("PayoutDistributor");
  const distributor = await Distributor.deploy(deployer.address);
  await distributor.waitForDeployment();

  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const ticket = await TicketNFT.deploy();
  await ticket.waitForDeployment();

  const TicketSale = await hre.ethers.getContractFactory("TicketSale");
  const sale = await TicketSale.deploy(await distributor.getAddress(), await ticket.getAddress(), relayer.address);
  await sale.waitForDeployment();

  await ticket.setMinter(await sale.getAddress());

  const splitSlug = "rock-gecesi";
  const splitId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(splitSlug));
  await distributor.setSplit(splitId, [
    { account: artist.address, bps: 7000 },
    { account: organizer.address, bps: 2000 },
    { account: platform.address, bps: 1000 },
  ]);

  await sale.setEventConfig(1, hre.ethers.parseEther("0.01"), 1000, false);

  console.log(`NEXT_PUBLIC_PAYOUT_DISTRIBUTOR_ADDRESS=${await distributor.getAddress()}`);
  console.log(`NEXT_PUBLIC_TICKET_NFT_ADDRESS=${await ticket.getAddress()}`);
  console.log(`NEXT_PUBLIC_TICKET_SALE_ADDRESS=${await sale.getAddress()}`);
  console.log(`TICKET_SALE_ADDRESS=${await sale.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

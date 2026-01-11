import hre from "hardhat";

async function main() {
  const [deployer, relayer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying with:", deployer.address);
  console.log("ChainId:", Number(network.chainId));

  const Distributor = await hre.ethers.getContractFactory("PayoutDistributor");
  const distributor = await Distributor.deploy(deployer.address);
  await distributor.waitForDeployment();
  const distributorTx = distributor.deploymentTransaction();

  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const ticketNft = await TicketNFT.deploy();
  await ticketNft.waitForDeployment();
  const ticketTx = ticketNft.deploymentTransaction();

  const TicketSale = await hre.ethers.getContractFactory("TicketSale");
  const sale = await TicketSale.deploy(await distributor.getAddress(), await ticketNft.getAddress(), relayer.address);
  await sale.waitForDeployment();
  const saleTx = sale.deploymentTransaction();

  console.log("PayoutDistributor:", await distributor.getAddress());
  console.log("PayoutDistributor tx:", distributorTx?.hash ?? "unknown");
  console.log("TicketNFT:", await ticketNft.getAddress());
  console.log("TicketNFT tx:", ticketTx?.hash ?? "unknown");
  console.log("TicketSale:", await sale.getAddress());
  console.log("TicketSale tx:", saleTx?.hash ?? "unknown");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

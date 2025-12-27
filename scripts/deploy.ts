import hre from "hardhat";

async function main() {
  const Factory = await hre.ethers.getContractFactory("PayoutSplitter");
  const contract = await Factory.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("PayoutSplitter deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const hre = require("hardhat");

function normalizeHexPrivateKey(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("BACKEND_WALLET_PRIVATE_KEY is empty");
  }
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function resolveBackendAddress() {
  const addressRaw = process.env.BACKEND_WALLET_ADDRESS;
  if (addressRaw && addressRaw.trim()) {
    return hre.ethers.getAddress(addressRaw.trim());
  }
  const pkRaw = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!pkRaw) return null;
  const privateKey = normalizeHexPrivateKey(pkRaw);
  return new hre.ethers.Wallet(privateKey).address;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying with:", deployer.address);
  console.log("ChainId:", Number(network.chainId));

  const EventTicket = await hre.ethers.getContractFactory("EventTicket");
  const eventTicket = await EventTicket.deploy("EventTicket", "EVT", deployer.address);
  await eventTicket.waitForDeployment();
  const deployTx = eventTicket.deploymentTransaction();

  console.log("EventTicket:", await eventTicket.getAddress());
  console.log("EventTicket tx:", deployTx?.hash ?? "unknown");

  const backendAddress = resolveBackendAddress();
  if (backendAddress) {
    const minterRole = await eventTicket.MINTER_ROLE();
    const grantTx = await eventTicket.grantRole(minterRole, backendAddress);
    await grantTx.wait();
    const hasRole = await eventTicket.hasRole(minterRole, backendAddress);
    console.log("MINTER_ROLE granted to backend:", backendAddress, "hasRole:", hasRole);
  } else {
    console.log("MINTER_ROLE not granted (missing BACKEND_WALLET_ADDRESS or BACKEND_WALLET_PRIVATE_KEY)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

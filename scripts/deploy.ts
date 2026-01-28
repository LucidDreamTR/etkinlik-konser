import hre from "hardhat";

function normalizeHexPrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("BACKEND_WALLET_PRIVATE_KEY is empty");
  }
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

function resolveBackendAddress(): string | null {
  const addressRaw = process.env.BACKEND_WALLET_ADDRESS;
  if (addressRaw && addressRaw.trim()) {
    return hre.ethers.getAddress(addressRaw.trim());
  }
  const pkRaw = process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!pkRaw) return null;
  const privateKey = normalizeHexPrivateKey(pkRaw);
  return new hre.ethers.Wallet(privateKey).address as `0x${string}`;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId === 1) {
    const mainnetEnabled = process.env.MAINNET_ENABLED === "true";
    const confirmed = process.env.CONFIRM_MAINNET_DEPLOY === "true";
    if (!mainnetEnabled || !confirmed) {
      console.warn("WARN: Mainnet deploy blocked. Set MAINNET_ENABLED=true and CONFIRM_MAINNET_DEPLOY=true to proceed.");
      return;
    }
  }

  console.log("Deploying with:", deployer.address);
  console.log("ChainId:", chainId);

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

  console.log("----- DEPLOY OUTPUT -----");
  console.log("CHAIN_ID=", chainId);
  console.log("EVENT_TICKET_ADDRESS=", await eventTicket.getAddress());
  console.log("DEPLOY_TX=", deployTx?.hash ?? "unknown");
  console.log("DEPLOYER_ADDRESS=", deployer.address);
  console.log("BACKEND_MINTER_ADDRESS=", backendAddress ?? "not_granted");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

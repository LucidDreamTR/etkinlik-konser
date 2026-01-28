import { type HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "ts-node/register/transpile-only";
import "dotenv/config";

process.env.TS_NODE_PROJECT = "./tsconfig.hardhat.json";

const pkRaw = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const pk = pkRaw ? (pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`) : "";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.ETHEREUM_TX_RPC_URL || "",
      chainId: 11155111,
      accounts: pk ? [pk] : [],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || process.env.ETHEREUM_TX_RPC_URL || "",
      chainId: 1,
      accounts: pk ? [pk] : [],
    },
  },
};

export default config;

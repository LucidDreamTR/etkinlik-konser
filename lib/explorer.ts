export function getExplorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 11155111) {
    return `https://sepolia.etherscan.io/tx/${hash}`;
  }
  return null;
}

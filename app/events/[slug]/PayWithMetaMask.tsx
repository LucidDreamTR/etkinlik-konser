'use client'

import * as React from 'react'
import { Hex } from 'viem'
import { sepolia } from 'wagmi/chains'
import { useChainId, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi'

type Props = {
  to: `0x${string}`
  value: bigint
  data: Hex
}

export default function PayWithMetaMask({ to, value, data }: Props) {
  const [hasMetaMask, setHasMetaMask] = React.useState<boolean>(false)
  const chainId = useChainId()
  const targetChainId = sepolia.id
  const isOnTargetChain = chainId === targetChainId

  const { data: hash, isPending, error, sendTransaction } = useSendTransaction()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  React.useEffect(() => {
    const isMetaMask =
      typeof window !== 'undefined' &&
      (window as { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask;
    setHasMetaMask(Boolean(isMetaMask));
  }, []);

  const onPay = React.useCallback(() => {
    if (!sendTransaction || !isOnTargetChain) return;
    sendTransaction({ to, value, data, chainId: targetChainId })
  }, [sendTransaction, isOnTargetChain, to, value, data, targetChainId])

  const onSwitch = React.useCallback(() => {
    if (!switchChain) return;
    switchChain({ chainId: targetChainId });
  }, [switchChain, targetChainId]);

  const isPayDisabled = !hasMetaMask || !sendTransaction || isPending || !isOnTargetChain
  const metaMaskStatus = hasMetaMask ? null : 'MetaMask gerekli'

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-4">
        <div className="text-sm opacity-70 mb-2">Transaction Payload (Preview)</div>
        <div className="text-sm break-all"><b>to:</b> {to}</div>
        <div className="text-sm break-all"><b>value (wei):</b> {value.toString()}</div>
        <div className="text-sm break-all"><b>data:</b> {data}</div>
      </div>

      <button
        onClick={onPay}
        disabled={isPayDisabled}
        className="rounded-xl border px-4 py-2"
      >
        {isPending ? 'MetaMask bekleniyor…' : 'Pay (MetaMask)'}
      </button>

      {!hasMetaMask && (
        <div className="text-sm text-amber-300">
          {metaMaskStatus}
        </div>
      )}

      {!isOnTargetChain && hasMetaMask ? (
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitch}
            disabled={!switchChain || isSwitching}
            className="rounded-xl border px-4 py-2 text-sm"
          >
            {isSwitching ? 'Sepolia\'ya geçiliyor…' : 'Switch to Sepolia'}
          </button>
          <div className="text-sm text-amber-300">Sepolia ağına geçmeden ödeme yapılamaz.</div>
        </div>
      ) : null}

      {hash && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="text-sm"><b>Tx hash:</b> <span className="break-all">{hash}</span></div>
          <a
            className="text-sm underline"
            target="_blank"
            rel="noreferrer"
            href={`https://sepolia.etherscan.io/tx/${hash}`}
          >
            Sepolia explorer linki
          </a>

          <div className="text-sm">
            {isConfirming && 'Payment pending (confirming…)'}
            {isConfirmed && 'Payment sent ✅'}
          </div>
        </div>
      )}

      {(error || receiptError) && (
        <div className="rounded-xl border p-4 text-sm break-all">
          <b>Hata:</b> {(error ?? receiptError)?.message}
        </div>
      )}
    </div>
  )
}

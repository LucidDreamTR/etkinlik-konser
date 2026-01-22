'use client'

import * as React from 'react'
import { BaseError, ContractFunctionRevertedError, Hex, decodeErrorResult, decodeFunctionData, encodeFunctionData, getAddress, parseEventLogs, zeroAddress, type Hash } from 'viem'
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWalletClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { payoutDistributorAbi } from '@/src/contracts/payoutDistributor.abi'
import { ticketSaleAbi } from '@/src/contracts/ticketSale.abi'
import { TICKET_SALE_CHAIN, TICKET_SALE_EXPLORER_BASE, TICKET_TX_ENABLED } from '@/src/contracts/ticketSale.config'
import { ticketNftAbi } from '@/src/contracts/ticketNft.abi'
import { TICKET_NFT_EXPLORER_BASE } from '@/src/contracts/ticketNft.config'
import { hashId } from '@/src/lib/payoutDistributor'

type Props = {
  to: `0x${string}` | null
  value: bigint
  data: Hex
  splitId: string
  orderId: string
  chainId: number
  ticketPriceWei: bigint
  payoutAddress: `0x${string}` | null
  ticketNftAddress: `0x${string}` | null
}

export default function PayWithMetaMask({ to, value, data, splitId, orderId, chainId, ticketPriceWei, payoutAddress, ticketNftAddress }: Props) {
  const [hasMetaMask, setHasMetaMask] = React.useState<boolean>(false)
  const connectedChainId = useChainId()
  const targetChainId = chainId ?? TICKET_SALE_CHAIN.id
  const isOnTargetChain = connectedChainId === targetChainId

  const { isConnected, address } = useAccount()
  const { connect, isPending: isConnecting, error: connectError } = useConnect()
  const { data: walletClient } = useWalletClient()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: targetChainId })
  const [hash, setHash] = React.useState<Hash | undefined>(undefined)
  const [txError, setTxError] = React.useState<string | null>(null)
  const [isSending, setIsSending] = React.useState(false)
  const [estimatedGas, setEstimatedGas] = React.useState<bigint | null>(null)
  const [estimatedMaxFee, setEstimatedMaxFee] = React.useState<bigint | null>(null)
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = React.useState<string | null>(null)
  const [serverOrderId, setServerOrderId] = React.useState<string>(orderId)
  const [splitPreview, setSplitPreview] = React.useState<{ account: string; bps: number }[] | null>(null)
  const [splitTotalBps, setSplitTotalBps] = React.useState<number | null>(null)
  const [splitError, setSplitError] = React.useState<string | null>(null)
const [txStatus, setTxStatus] = React.useState<'idle' | 'pending' | 'success' | 'failed'>('idle')
  const [simulationPreview, setSimulationPreview] = React.useState<Record<string, unknown> | null>(null)
  const [simulationError, setSimulationError] = React.useState<string | null>(null)
  const [simulationNotice, setSimulationNotice] = React.useState<string | null>(null)
  const [intentStatus, setIntentStatus] = React.useState<'idle' | 'signing' | 'sending' | 'success' | 'error'>('idle')
  const [intentTxHash, setIntentTxHash] = React.useState<string | null>(null)
  const [intentError, setIntentError] = React.useState<string | null>(null)
  const [feePerGas, setFeePerGas] = React.useState<{
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    gasPrice?: bigint
  } | null>(null)

  const {
    data: receipt,
    isLoading: isConfirming,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
    chainId: targetChainId,
  })

  const [mintResult, setMintResult] = React.useState<{
    mintedTo: string
    tokenId: string
    nftContract: `0x${string}`
    nftExplorerLink: string
    ownerVerified: boolean | null
    ownerOnChain: string | null
  } | null>(null)
  const [mintError, setMintError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const isMetaMask =
      typeof window !== 'undefined' && typeof (window as { ethereum?: unknown }).ethereum !== 'undefined';
    setHasMetaMask(Boolean(isMetaMask));
  }, []);

  const connectMetaMask = React.useCallback(() => {
    connect({ connector: injected(), chainId: targetChainId })
  }, [connect, targetChainId])

  React.useEffect(() => {
    const fetchSplit = async () => {
      if (!publicClient || !payoutAddress) return;
      try {
        const res = await publicClient.readContract({
          address: payoutAddress,
          abi: payoutDistributorAbi,
          functionName: 'getSplit',
          args: [hashId(splitId)],
        });
        const total = res.reduce((acc, r) => acc + r.bps, 0);
        setSplitPreview(res.map((r) => ({ account: r.account, bps: Number(r.bps) })));
        setSplitTotalBps(total);
        setSplitError(total === 10000 ? null : 'Toplam oran %100 değil');
      } catch (err) {
        setSplitError(err instanceof Error ? err.message : 'Dağıtım planı okunamadı');
      }
    };
    fetchSplit();
  }, [publicClient, splitId, payoutAddress]);

  const decodedCalldata = React.useMemo(() => {
    try {
      const decoded = decodeFunctionData({
        abi: ticketSaleAbi,
        data,
      });
      return decoded.functionName === 'purchase' ? decoded : null;
    } catch {
      return null;
    }
  }, [data]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log('[dev] payout tx', {
      to,
      value: value.toString(),
      data,
      decoded: decodedCalldata,
      splitId,
      orderId,
    });
  }, [data, decodedCalldata, orderId, splitId, to, value]);

  const bytes32Regex = React.useMemo(() => /^0x[0-9a-fA-F]{64}$/, []);

  const purchaseArgs = React.useMemo(() => {
    if (!decodedCalldata || decodedCalldata.functionName !== 'purchase' || !decodedCalldata.args || decodedCalldata.args.length < 4) {
      return null;
    }
    const [, , eventId, uri] = decodedCalldata.args;
    if (!bytes32Regex.test(serverOrderId)) {
      return null;
    }
    return [hashId(splitId), serverOrderId as `0x${string}`, eventId, uri] as const;
  }, [bytes32Regex, decodedCalldata, serverOrderId, splitId]);

  const intentEventId = React.useMemo(() => {
    if (!decodedCalldata || !decodedCalldata.args || decodedCalldata.args.length < 3) return null;
    const [, , eventId] = decodedCalldata.args;
    return eventId;
  }, [decodedCalldata]);

  const formatDevError = (message: string, err?: unknown) => {
    if (process.env.NODE_ENV === 'production') return message;
    const msg = err instanceof Error ? err.message : String(err);
    return `${message} (geliştirme: ${msg})`;
  };

  const copyToClipboard = React.useCallback((value: string) => {
    if (!value) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => {});
  }, []);

  const classifyError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);

    const decoded = (() => {
      if (!(err instanceof BaseError)) return null;
      const revertError = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (!revertError || !(revertError instanceof ContractFunctionRevertedError)) return null;
      // viem narrows `data` on ContractFunctionRevertedError; walk() can widen it.
      const data = (revertError as unknown as { data?: `0x${string}` }).data;
      if (!data) return null;
      try {
        const decodedError = decodeErrorResult({
          abi: [...ticketSaleAbi, ...payoutDistributorAbi],
          data,
        });
        return decodedError.errorName;
      } catch {
        return null;
      }
    })();

    switch (decoded) {
      case 'OrderUsed':
        return { code: 'ORDER_USED', message: 'Bu işlem numarası daha önce kullanıldı.' };
      case 'SalesPaused':
        return { code: 'SALES_PAUSED', message: 'Satışlar geçici olarak durduruldu.' };
      case 'InvalidPayment':
        return { code: 'INVALID_PAYMENT', message: 'Ödeme tutarı hatalı.' };
      case 'SplitNotFound':
        return { code: 'SPLIT_NOT_FOUND', message: 'Bu etkinlik için ödeme dağıtım ayarı bulunamadı.' };
      case 'OwnableUnauthorizedAccount':
        return { code: 'OWNABLE_UNAUTHORIZED', message: 'Kontrat yetkisi hatalı (yapılandırma).' };
      default:
        break;
    }

    if (/orderused/i.test(message)) return { code: 'ORDER_USED', message: 'Bu işlem numarası daha önce kullanıldı.' };
    if (/user rejected|denied/i.test(message)) return { code: 'USER_REJECTED', message: 'İşlem reddedildi (MetaMask).' };
    if (/insufficient funds|insufficient balance/i.test(message)) return { code: 'INSUFFICIENT_FUNDS', message: 'Yetersiz bakiye.' };
    if (/chain/i.test(message)) return { code: 'WRONG_CHAIN', message: 'Yanlış ağdayız, önce ağı değiştir.' };
    return { code: 'REVERTED', message: 'İşlem başarısız ya da reddedildi.' };
  };

  const logGuard = (reason: string) => {
    const idsPresent = Boolean(splitId.trim() && serverOrderId.trim());
    console.warn('[pay guard]', { reason, chainId: targetChainId, to, value, hasIds: idsPresent, TX_ENABLED: TICKET_TX_ENABLED });
  };

  const setError = (message: string, err?: unknown) => {
    setTxError(formatDevError(message, err));
  };

  const createPaymentIntent = React.useCallback(async () => {
    if (!address) {
      throw new Error('Wallet not connected');
    }
    if (!intentEventId) {
      throw new Error('EventId missing');
    }
    if (!splitId.trim() || ticketPriceWei <= 0n) {
      throw new Error('Intent data missing');
    }
    const deadline = Math.floor(Date.now() / 1000) + 10 * 60;
    const eventIdValue =
      typeof intentEventId === 'bigint' ? intentEventId.toString() : String(intentEventId);
    const intent = {
      buyer: address,
      splitSlug: splitId,
      merchantOrderId: paymentIntentId ?? '',
      eventId: eventIdValue,
      amountWei: ticketPriceWei.toString(),
      deadline: deadline.toString(),
    } as const;

    const response = await fetch('/api/tickets/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent }),
    });
    const text = await response.text();
    let data: { ok?: boolean; error?: string; orderId?: string; paymentIntentId?: string };
    try {
      data = text ? JSON.parse(text) : { ok: false, error: 'Empty response body' };
    } catch {
      data = { ok: false, error: 'Invalid JSON response' };
    }
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? 'Intent oluşturulamadı');
    }
    if (!data.orderId || !bytes32Regex.test(data.orderId)) {
      throw new Error('Geçersiz orderId');
    }
    if (data.paymentIntentId) {
      setPaymentIntentId(data.paymentIntentId);
    }
    setServerOrderId(data.orderId);
    return { paymentIntentId: data.paymentIntentId ?? paymentIntentId ?? '', orderId: data.orderId };
  }, [address, bytes32Regex, intentEventId, paymentIntentId, splitId, ticketPriceWei]);

  const onPayOrConnect = React.useCallback(async () => {
    if (!hasMetaMask) {
      logGuard('no_metamask');
      return;
    }
    setTxError(null);
    setMintResult(null);
    setMintError(null);

    if (!isConnected) {
      logGuard('wallet_not_connected');
      connectMetaMask();
      return;
    }

    if (!walletClient) {
      logGuard('wallet_client_missing');
      setError('Cüzdan hazırlanıyor.');
      return;
    }
    if (!publicClient) {
      logGuard('public_client_missing');
      setError('Ağ istemcisi hazır değil.');
      return;
    }

    if (!isOnTargetChain) {
      logGuard('wrong_chain');
      if (switchChain) {
        switchChain({ chainId: targetChainId });
        setError('Ağ değiştiriliyor, lütfen MetaMask onayını verin.');
      } else {
        setError('Yanlış ağdasın, önce ağı değiştir.');
      }
      return;
    }
    if (value !== ticketPriceWei) {
      logGuard('amount_mismatch');
      setError('İşlem tutarı bilet fiyatıyla uyuşmuyor.');
      return;
    }
    if (value <= 0n) {
      logGuard('non_positive_amount');
      setError('Tutar 0’dan büyük olmalı.');
      return;
    }
    if (!splitId.trim()) {
      logGuard('missing_ids');
      setError('Dağıtım kimliği gerekli.');
      return;
    }
    if (!bytes32Regex.test(serverOrderId)) {
      try {
        await createPaymentIntent();
      } catch (err) {
        const { message } = classifyError(err);
        setError(message, err);
        return;
      }
    }
    if (!bytes32Regex.test(serverOrderId)) {
      logGuard('missing_ids');
      setError('İşlem numarası oluşturulamadı.');
      return;
    }
    if (activeOrderId === serverOrderId && (isSending || hash)) {
      logGuard('duplicate_order');
      setError('Bu sipariş için işlem zaten beklemede.');
      return;
    }

    if (!TICKET_TX_ENABLED) {
      logGuard('tx_disabled_env');
      setError('Ödemeler şu an kapalı (env).');
      return;
    }

    const account = address;
    if (!account) {
      logGuard('account_missing');
      setError('Cüzdan hesabı bulunamadı.');
      return;
    }

    let gasEstimate: bigint | undefined;
    let txFeeParams: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasPrice?: bigint } = {};

    try {
      if (!to) {
        logGuard('missing_contract_address');
        setError('Ödeme modülü yapılandırılmadı (kontrat adresi eksik).');
        return;
      }
      if (!purchaseArgs) {
        setError('Satın alma parametreleri hazırlanamadı.');
        return;
      }
      const callData = encodeFunctionData({
        abi: ticketSaleAbi,
        functionName: 'purchase',
        args: purchaseArgs,
      });
      gasEstimate = await publicClient.estimateGas({
        account,
        to,
        data: callData,
        value,
      });
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      let gasPrice: bigint | undefined;
      try {
        const fees = await publicClient.estimateFeesPerGas();
        maxFeePerGas = fees.maxFeePerGas;
        maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      } catch {
        gasPrice = await publicClient.getGasPrice();
      }
      txFeeParams = { maxFeePerGas, maxPriorityFeePerGas, gasPrice };

      setEstimatedGas(gasEstimate);
      const feePerUnit = maxFeePerGas ?? gasPrice ?? null;
      setEstimatedMaxFee(feePerUnit && gasEstimate ? feePerUnit * gasEstimate : null);
      setFeePerGas(txFeeParams);
    } catch (err) {
      const { message } = classifyError(err);
      console.error('[pay] failed', err);
      setError(message, err);
      return;
    }

    setIsSending(true);
    setActiveOrderId(serverOrderId);
    setTxStatus('pending');
    try {
      if (!to) {
        logGuard('missing_contract_address');
        setError('Ödeme modülü yapılandırılmadı (kontrat adresi eksik).');
        return;
      }
      // ---- fee param normalization (do not mix legacy + eip1559) ----
      type FeeParams =
        | { gasPrice: bigint }
        | { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
        | {};

      const feeParams: FeeParams = (() => {
        const t = txFeeParams ?? {};
        const hasEip1559 = t.maxFeePerGas != null || t.maxPriorityFeePerGas != null;
        const hasLegacy = t.gasPrice != null;

        if (hasEip1559) {
          const maxFeePerGas = t.maxFeePerGas ?? feePerGas?.maxFeePerGas;
          const maxPriorityFeePerGas = t.maxPriorityFeePerGas ?? feePerGas?.maxPriorityFeePerGas;
          if (maxFeePerGas && maxPriorityFeePerGas) return { maxFeePerGas, maxPriorityFeePerGas };
          return {};
        }

        if (hasLegacy) return { gasPrice: t.gasPrice };

        if (feePerGas?.maxFeePerGas && feePerGas?.maxPriorityFeePerGas) {
          return { maxFeePerGas: feePerGas.maxFeePerGas, maxPriorityFeePerGas: feePerGas.maxPriorityFeePerGas };
        }

        return {};
      })();
      const gasForSend = gasEstimate && gasEstimate < 200000n ? 500000n : undefined;
      const txHash = await walletClient.writeContract({
        account,
        address: to,
        abi: ticketSaleAbi,
        functionName: 'purchase',
        args: purchaseArgs ?? [],
        value,
        ...(gasForSend ? { gas: gasForSend } : {}),
        ...feeParams,
        chain: TICKET_SALE_CHAIN,
      });
      setHash(txHash);
    } catch (err) {
      const { message } = classifyError(err);
      console.error('[pay] failed', err);
      setError(message, err);
      setTxStatus('failed');
    } finally {
      setIsSending(false);
    }
  }, [
    activeOrderId,
    createPaymentIntent,
    connectMetaMask,
    data,
    decodedCalldata,
    hasMetaMask,
    hash,
    isConnected,
    isOnTargetChain,
    isSending,
    orderId,
    purchaseArgs,
    splitId,
    serverOrderId,
    ticketPriceWei,
    to,
    value,
    walletClient,
    publicClient,
    feePerGas,
    bytes32Regex,
  ])

  React.useEffect(() => {
    setSimulationPreview(null);
    setSimulationError(null);
    setSimulationNotice(null);

    if (!publicClient || !to || value <= 0n || !data) return;
    if (!decodedCalldata || decodedCalldata.functionName !== 'purchase') {
      setSimulationNotice('Simülasyon için satın alma verisi okunamadı.');
      return;
    }
    if (!isConnected) {
      setSimulationNotice('Simülasyon için cüzdan bağlayın');
      return;
    }
    const accountAddress = address;
    if (!accountAddress) {
      setSimulationNotice('Simülasyon için cüzdan bağlayın');
      return;
    }
    if (!isOnTargetChain) {
      setSimulationNotice(`${TICKET_SALE_CHAIN.name} ağına geçmeden simülasyon çalışmaz.`);
      return;
    }

    let cancelled = false;
    const runSimulation = async () => {
      try {
        if (!purchaseArgs) {
          setSimulationNotice('Simülasyon için işlem parametreleri hazırlanamadı.');
          return;
        }
        const simulation = await publicClient.simulateContract({
          account: accountAddress,
          address: to,
          abi: ticketSaleAbi,
          functionName: 'purchase',
          args: purchaseArgs,
          value,
        });
        if (cancelled) return;
        setSimulationPreview({
          request: simulation.request,
          result: simulation.result,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV === 'development') {
          console.error('[simulate] failed:', err);
        }
        setSimulationError(
          process.env.NODE_ENV === 'production'
            ? 'Simülasyon kullanılamıyor'
            : `Simülasyon kullanılamıyor (geliştirme): ${msg}`,
        );
      }
    };

    runSimulation();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    data,
    decodedCalldata,
    isConnected,
    isOnTargetChain,
    publicClient,
    purchaseArgs,
    to,
    value,
  ]);

  const onSwitch = React.useCallback(() => {
    if (!switchChain) return;
    switchChain({ chainId: targetChainId });
  }, [switchChain, targetChainId]);

  const intentDomain = React.useMemo(() => {
    const chainIdEnv = process.env.NEXT_PUBLIC_CHAIN_ID;
    const chainIdValue = chainIdEnv ? Number(chainIdEnv) : targetChainId;
    if (!to) return null;
    return {
      name: 'EtkinlikKonser',
      version: '1',
      chainId: chainIdValue,
      verifyingContract: getAddress(to),
    } as const;
  }, [targetChainId, to]);

  const onSignIntent = React.useCallback(async () => {
    if (!isConnected || !address) {
      connectMetaMask();
      return;
    }
    if (!walletClient) {
      setIntentError('MetaMask bağlantısı hazır değil.');
      return;
    }
    if (!intentDomain || !intentEventId) {
      setIntentError('İmza için gerekli veriler eksik.');
      return;
    }
    if (!splitId.trim() || ticketPriceWei <= 0n) {
      setIntentError('İmza için gerekli bilgiler eksik.');
      return;
    }

    setIntentError(null);
    setIntentTxHash(null);
    setIntentStatus('signing');

    try {
      const created = await createPaymentIntent();
      const intent = {
        buyer: address,
        splitSlug: splitId,
        merchantOrderId: created.paymentIntentId,
        eventId: typeof intentEventId === 'bigint' ? intentEventId.toString() : String(intentEventId),
        amountWei: ticketPriceWei.toString(),
        deadline: Math.floor(Date.now() / 1000) + 10 * 60,
      } as const;
      const typedMessage = {
        buyer: intent.buyer,
        splitSlug: intent.splitSlug,
        merchantOrderId: intent.merchantOrderId,
        eventId: BigInt(intent.eventId),
        amountWei: BigInt(intent.amountWei),
        deadline: BigInt(intent.deadline),
      } as const;

      if (!address) {
        throw new Error('Wallet not connected');
      }

      const signature = await walletClient.signTypedData({
        domain: intentDomain,
        types: {
          TicketIntent: [
            { name: 'buyer', type: 'address' },
            { name: 'splitSlug', type: 'string' },
            { name: 'merchantOrderId', type: 'string' },
            { name: 'eventId', type: 'uint256' },
            { name: 'amountWei', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'TicketIntent',
        message: typedMessage,
      });

      setIntentStatus('sending');
      const response = await fetch('/api/tickets/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, signature }),
      });
      const text = await response.text();
      let data: { ok?: boolean; error?: string; txHash?: string };
      try {
        data = text ? JSON.parse(text) : { ok: false, error: 'Empty response body' };
      } catch {
        data = { ok: false, error: 'Invalid JSON response' };
      }
      if (!response.ok || !data?.ok) {
        console.error('[intent] request failed', response.status);
        throw new Error(data?.error ?? 'İstek reddedildi');
      }

      setIntentTxHash(data.txHash ?? null);
      setIntentStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIntentError(msg);
      setIntentStatus('error');
    }
  }, [
    address,
    connectMetaMask,
    createPaymentIntent,
    intentDomain,
    intentEventId,
    isConnected,
    splitId,
    serverOrderId,
    ticketPriceWei,
    walletClient,
  ]);

  const requiresSwitch = isConnected && !isOnTargetChain
  const hasIds = Boolean(splitId.trim() && serverOrderId.trim() && bytes32Regex.test(serverOrderId))
  const isPayDisabled =
    !TICKET_TX_ENABLED ||
    !to ||
    !hasMetaMask ||
    isSending ||
    isConfirming ||
    isConnecting ||
    requiresSwitch ||
    value <= 0n ||
    !hasIds
  const isIntentDisabled =
    !TICKET_TX_ENABLED ||
    !to ||
    !hasMetaMask ||
    intentStatus === 'signing' ||
    intentStatus === 'sending' ||
    requiresSwitch ||
    ticketPriceWei <= 0n ||
    !hasIds
  const metaMaskStatus = hasMetaMask ? null : 'MetaMask gerekli'
  const buttonLabel = !isConnected
    ? isConnecting
      ? 'MetaMask\'e bağlanılıyor…'
      : 'MetaMask bağlan'
    : isSending
      ? 'MetaMask bekleniyor…'
      : 'Öde (MetaMask)'

  React.useEffect(() => {
    if (!receipt) return;
    if (receipt.status === 'success') {
      setTxStatus('success');
    } else {
      setTxStatus('failed');
      setTxError('İşlem reddedildi.');
    }
  }, [receipt]);

  React.useEffect(() => {
    if (!hash || txStatus !== 'success') return;
    if (!publicClient) return;
    if (!ticketNftAddress) {
      setMintError('NFT kontrat adresi yapılandırılmadı');
      setMintResult(null);
      return;
    }

    let cancelled = false;
    const verifyMint = async () => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (cancelled || receipt.status !== 'success') return;
        const targetAddress = ticketNftAddress.toLowerCase();
        const explorerBase = TICKET_NFT_EXPLORER_BASE.replace(/\/$/, '');
        const nftLogs = receipt.logs.filter((log) => (log.address ?? '').toLowerCase() === targetAddress);

        if (nftLogs.length === 0) {
          setMintResult(null);
          setMintError('NFT basım kaydı bulunamadı');
          return;
        }

        let transfers: { args?: { from?: `0x${string}`; to?: `0x${string}`; tokenId?: bigint | string | number } }[] = [];
        try {
          transfers = parseEventLogs({
            abi: ticketNftAbi,
            logs: nftLogs,
            eventName: 'Transfer',
          }) as typeof transfers;
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[verifyMint] parseEventLogs failed', err);
          }
          setMintResult(null);
          setMintError('NFT basım kaydı okunamadı');
          return;
        }

        const mintedTransfer =
          transfers.find((log) => {
            const args = log.args as { from?: `0x${string}`; to?: `0x${string}` };
            return args.from?.toLowerCase() === zeroAddress.toLowerCase();
          }) ?? transfers[0];

        if (!mintedTransfer || !mintedTransfer.args) {
          setMintResult(null);
          setMintError('NFT basım kaydı bulunamadı');
          return;
        }

        const args = mintedTransfer.args as { from: `0x${string}`; to: `0x${string}`; tokenId: bigint | string | number };
        const toAddress = args.to;
        const tokenIdValue = typeof args.tokenId === 'bigint' ? args.tokenId : BigInt(args.tokenId);
        const tokenId = tokenIdValue.toString();

        let ownerOnChain: string | null = null;
        let ownerVerified: boolean | null = null;
        try {
          ownerOnChain = await publicClient.readContract({
            address: ticketNftAddress,
            abi: ticketNftAbi,
            functionName: 'ownerOf',
            args: [tokenIdValue],
          });
          ownerVerified = ownerOnChain?.toLowerCase?.() === toAddress?.toLowerCase?.();
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[verifyMint] ownerOf failed', err);
          }
          ownerVerified = null;
        }

        setMintResult({
          mintedTo: toAddress,
          tokenId,
          nftContract: ticketNftAddress,
          nftExplorerLink: `${explorerBase}/token/${ticketNftAddress}?a=${tokenId}`,
          ownerVerified,
          ownerOnChain,
        });
        setMintError(null);
      } catch (err) {
        if (!cancelled) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[verifyMint] failed', err);
          }
          setMintResult(null);
          setMintError('NFT basım kaydı bulunamadı');
        }
      }
    };

    verifyMint();

    return () => {
      cancelled = true;
    };
  }, [address, hash, publicClient, ticketNftAddress, txStatus, walletClient]);

  React.useEffect(() => {
    if (txStatus === 'success' || txStatus === 'failed') {
      setActiveOrderId(null);
    }
  }, [txStatus]);

  const stringifyWithBigInt = React.useCallback((value: unknown) => {
    return JSON.stringify(
      value,
      (_key, val) => (typeof val === 'bigint' ? val.toString() : val),
      2,
    );
  }, []);

  const err = (txError ?? receiptError ?? connectError) as unknown;
  const errText =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? 'Unknown error')
        : String(err ?? 'Unknown error');

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-4">
        <div className="text-sm opacity-70 mb-2">İşlem verisi (önizleme)</div>
        <div className="text-sm break-all"><b>Hedef kontrat:</b> {to}</div>
        <div className="text-sm break-all"><b>İşlem numarası:</b> {serverOrderId || "—"}</div>
        <div className="text-sm break-all"><b>Tutar (wei):</b> {value.toString()}</div>
        <div className="text-sm break-all"><b>İşlem talimatı:</b> {data}</div>
        {estimatedMaxFee !== null ? (
          <div className="text-sm break-all text-emerald-300 mt-2">
            Tahmini toplam maliyet (wei): {(value + estimatedMaxFee).toString()}
          </div>
        ) : null}
        {estimatedGas !== null ? (
          <div className="text-xs text-[#A3A3A3]">Tahmini işlem ücreti limiti: {estimatedGas.toString()}</div>
        ) : null}
        <div className="text-xs text-white/60 mt-1">Kontrat doğrudan ETH transferini kabul etmez; satın alma çağrısı ile çalışır.</div>
        {splitTotalBps !== null ? (
          <div className="text-sm mt-2">
            Dağıtım planı toplam oran: {splitTotalBps} {splitError ? <span className="text-amber-300 ml-2">{splitError}</span> : null}
          </div>
        ) : null}
      </div>

      <button
        onClick={onPayOrConnect}
        disabled={isPayDisabled}
        className="rounded-xl border px-4 py-2"
      >
        {buttonLabel}
      </button>
      <button
        onClick={onSignIntent}
        disabled={isIntentDisabled}
        className="rounded-xl border px-4 py-2"
      >
      {intentStatus === 'signing'
        ? 'İmza bekleniyor…'
        : intentStatus === 'sending'
          ? 'İmza gönderiliyor…'
          : 'Gas’sız Satın Al (İmza ile)'}
      </button>
      {address ? (
        <div className="text-xs text-white/60">
          {`${address.slice(0, 6)}…${address.slice(-4)}`}
        </div>
      ) : null}
      {intentTxHash ? (
        <div className="text-sm break-all">
          <b>İmza işlem tx:</b> {intentTxHash}
        </div>
      ) : null}
      {intentError ? (
        <div className="text-sm text-amber-300">{intentError}</div>
      ) : null}
      {!to && (
        <div className="text-sm text-amber-300">Ödeme modülü yapılandırılmadı (kontrat adresi eksik).</div>
      )}
      {!TICKET_TX_ENABLED && (
        <div className="text-sm text-amber-300">Ödemeler devre dışı (NEXT_PUBLIC_TX_ENABLED=false)</div>
      )}

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
            {isSwitching ? `${TICKET_SALE_CHAIN.name} ağına geçiliyor…` : `${TICKET_SALE_CHAIN.name} ağına geç`}
          </button>
          <div className="text-sm text-amber-300">{TICKET_SALE_CHAIN.name} ağına geçmeden ödeme yapılamaz.</div>
        </div>
      ) : null}

      {hash && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="text-sm"><b>Tx hash:</b> <span className="break-all">{hash}</span></div>
          <a
            className="text-sm underline"
            target="_blank"
            rel="noreferrer"
            href={`${TICKET_SALE_EXPLORER_BASE.replace(/\/$/, '')}/tx/${hash}`}
          >
            Explorer linki
          </a>

          <div className="text-sm">
            {isConfirming && 'İşlem onay bekliyor'}
            {txStatus === 'success' && 'İşlem tamamlandı'}
            {txStatus === 'failed' && 'İşlem başarısız'}
          </div>
        </div>
      )}

      {txStatus === 'success' && (
        <div className="rounded-xl border p-4 space-y-2">
          <div className="font-semibold">NFT basıldı</div>
          {mintResult ? (
            <>
              <div className="text-sm break-all flex flex-wrap items-center gap-2">
                <b>Alıcı adresi:</b> {mintResult.mintedTo}
                <button
                  type="button"
                  onClick={() => copyToClipboard(mintResult.mintedTo)}
                  className="rounded border px-2 py-1 text-xs"
                >
                  Kopyala
                </button>
              </div>
              <div className="text-sm break-all"><b>Token numarası:</b> {mintResult.tokenId}</div>
              <div className="text-sm break-all"><b>Kontrat adresi:</b> {mintResult.nftContract}</div>
              {mintResult.ownerVerified !== null ? (
                <div className="text-sm break-all">
                  {mintResult.ownerVerified ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">
                      Doğrulandı (ownerOf = alıcı)
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      ownerOf sonucu farklı: {mintResult.ownerOnChain ?? 'bilinmiyor'}
                    </span>
                  )}
                </div>
              ) : null}
              <a
                className="text-sm underline"
                target="_blank"
                rel="noreferrer"
                href={mintResult.nftExplorerLink}
              >
                Explorer&apos;da görüntüle
              </a>
            </>
          ) : mintError ? (
            <div className="text-sm text-amber-300">{mintError}</div>
          ) : (
            <div className="text-sm text-white/60">NFT basımı doğrulanıyor…</div>
          )}
        </div>
      )}

      {(txError || receiptError || connectError) && (
        <div className="rounded-xl border p-4 text-sm break-all">
          <b>Hata:</b> {errText}
        </div>
      )}

      <div className="rounded-xl border p-4 text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Simülasyon (önizleme)</span>
          <span className="text-white/60">{TICKET_SALE_CHAIN.name} ağı</span>
        </div>
        {simulationNotice ? (
          <div className="text-amber-300">{simulationNotice}</div>
        ) : simulationError ? (
          <div className="text-amber-300">{simulationError}</div>
        ) : simulationPreview ? (
          <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/80">{stringifyWithBigInt(simulationPreview)}</pre>
        ) : (
          <div className="text-white/60">Simülasyon hazırlanıyor…</div>
        )}
      </div>

      {splitPreview ? (
        <div className="rounded-xl border p-4 text-sm space-y-2">
          <div className="font-semibold">Dağıtım planı detayları</div>
          <div className="space-y-1">
            {splitPreview.map((r, idx) => (
              <div key={`${r.account}-${idx}`} className="flex justify-between">
                <span className="break-all">{r.account}</span>
                <span>{r.bps} oran</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

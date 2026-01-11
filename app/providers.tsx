'use client'

import * as React from 'react'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { anvilLocal } from '@/src/chains/anvilLocal'

const config = createConfig({
  chains: [anvilLocal],
  connectors: [injected({ target: 'metaMask' })],
  transports: {
    [anvilLocal.id]: http(anvilLocal.rpcUrls.default.http[0]),
  },
})

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

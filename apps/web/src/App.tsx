import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import HomePage from '@/pages/HomePage'
import { createApiClient, TRPCProvider } from '@/lib/trpc'

export default function App() {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(createApiClient)

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <HomePage />
      </TRPCProvider>
    </QueryClientProvider>
  )
}

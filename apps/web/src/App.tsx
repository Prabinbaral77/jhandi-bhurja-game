import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import RequireAuth from '@/components/RequireAuth'
import { useBootstrapSession } from '@/hooks/useBootstrapSession'
import { createApiClient, TRPCProvider } from '@/lib/trpc'
import CreateRoomPage from '@/pages/CreateRoomPage'
import HomePage from '@/pages/HomePage'
import RoomPage from '@/pages/RoomPage'
import RoomsPage from '@/pages/RoomsPage'
import SignInPage from '@/pages/SignInPage'
import StatusPage from '@/pages/StatusPage'
import WalletPage from '@/pages/WalletPage'
import WelcomePage from '@/pages/WelcomePage'

export default function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } }),
  )
  const [trpcClient] = useState(createApiClient)
  useBootstrapSession()

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route
                path="/welcome"
                element={
                  <RequireAuth>
                    <WelcomePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/wallet"
                element={
                  <RequireAuth>
                    <WalletPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/rooms"
                element={
                  <RequireAuth>
                    <RoomsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/host/new"
                element={
                  <RequireAuth>
                    <CreateRoomPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/room/:roomId"
                element={
                  <RequireAuth>
                    <RoomPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TRPCProvider>
    </QueryClientProvider>
  )
}

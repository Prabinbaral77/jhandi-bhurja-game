import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import RequireAuth from '@/components/RequireAuth'
import { useBootstrapSession } from '@/hooks/useBootstrapSession'
import { createApiClient, TRPCProvider } from '@/lib/trpc'
import HomePage from '@/pages/HomePage'
import SignInPage from '@/pages/SignInPage'

// Route-level code splitting: the room (art, dice, Colyseus) only loads when entering a room.
const AdminPage = lazy(() => import('@/pages/AdminPage'))
const CreateRoomPage = lazy(() => import('@/pages/CreateRoomPage'))
const InvitePage = lazy(() => import('@/pages/InvitePage'))
const RoomPage = lazy(() => import('@/pages/RoomPage'))
const RoomsPage = lazy(() => import('@/pages/RoomsPage'))
const StatusPage = lazy(() => import('@/pages/StatusPage'))
const WalletPage = lazy(() => import('@/pages/WalletPage'))
const WelcomePage = lazy(() => import('@/pages/WelcomePage'))

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
            <Suspense fallback={<p className="text-cream/60">…</p>}>
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
                  path="/admin"
                  element={
                    <RequireAuth>
                      <AdminPage />
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
                  path="/r/:inviteToken"
                  element={
                    <RequireAuth>
                      <InvitePage />
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
            </Suspense>
          </Layout>
        </BrowserRouter>
      </TRPCProvider>
    </QueryClientProvider>
  )
}

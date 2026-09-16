import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './app/App'
import { AuthProvider } from './auth/AuthProvider'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 20_000 },
    mutations: { retry: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider><App /></AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

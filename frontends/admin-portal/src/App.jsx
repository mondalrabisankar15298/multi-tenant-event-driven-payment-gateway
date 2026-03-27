import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MerchantProvider } from './contexts/MerchantContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import MerchantsPage from './pages/MerchantsPage'
import CustomersPage from './pages/CustomersPage'
import PaymentsPage from './pages/PaymentsPage'
import RefundsPage from './pages/RefundsPage'
import EventsLogPage from './pages/EventsLogPage'

export default function App() {
  return (
    <MerchantProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/merchants" replace />} />
              <Route path="merchants" element={<MerchantsPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="refunds" element={<RefundsPage />} />
              <Route path="events" element={<EventsLogPage />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </MerchantProvider>
  )
}

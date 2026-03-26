import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MerchantProvider } from './contexts/MerchantContext'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import PaymentsPage from './pages/PaymentsPage'
import RefundsPage from './pages/RefundsPage'
import CustomersPage from './pages/CustomersPage'

export default function App() {
  return (
    <MerchantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="customers" element={<CustomersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MerchantProvider>
  )
}

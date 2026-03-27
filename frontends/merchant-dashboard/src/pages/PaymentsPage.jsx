import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'

export default function PaymentsPage() {
  const { selectedMerchant } = useMerchant()
  const [result, setResult] = useState({ data: [], total: 0, page: 1, pages: 0 })
  const [filters, setFilters] = useState({ status: '', method: '', page: 1 })
  
  const mid = selectedMerchant?.merchant_id

  useEffect(() => { if (mid) fetchPayments() }, [mid, filters])

  const fetchPayments = async () => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.method) params.set('method', filters.method)
    params.set('page', filters.page)
    params.set('limit', 25)
    const data = await api.getPayments(mid, `?${params}`)
    setResult(data)
  }

  if (!mid) return <div className="empty-state"><h3>Select a merchant to view payments</h3></div>

  return (
    <div>
      <h1 className="page-title">Payments</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 150 }} value={filters.status} onChange={e => setFilters({...filters, status: e.target.value, page: 1})}>
            <option value="">All Status</option>
            <option value="created">Created</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
          </select>
          <select className="form-input" style={{ width: 150 }} value={filters.method} onChange={e => setFilters({...filters, method: e.target.value, page: 1})}>
            <option value="">All Methods</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{result.total} results</span>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map(p => (
              <tr key={p.payment_id}>
                <td>{p.payment_id?.substring(0, 8)}...</td>
                <td>{p.customer_name || p.customer_id}</td>
                <td>₹{Number(p.amount).toLocaleString()}</td>
                <td><span className="badge badge-created">{p.method}</span></td>
                <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                <td>{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.pages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            {Array.from({ length: result.pages }, (_, i) => (
              <button key={i} className={`btn ${filters.page === i + 1 ? 'btn-primary' : 'btn-outline'} btn-sm`}
                onClick={() => setFilters({...filters, page: i + 1})}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import Pagination from '../components/Pagination'

export default function PaymentsPage() {
  const { selectedMerchant } = useMerchant()
  const [result, setResult] = useState({ data: [], total: 0, page: 1, pages: 0 })
  const [filters, setFilters] = useState({ status: '', method: '', page: 1, limit: 25 })
  const [loading, setLoading] = useState(false)

  const muid = selectedMerchant?.merchant_uuid

  useEffect(() => { if (muid) fetchPayments() }, [muid, filters])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.method) params.set('method', filters.method)
      params.set('page', filters.page)
      params.set('limit', filters.limit)
      const data = await api.getPayments(muid, `?${params}`)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }))
  const startIdx = (filters.page - 1) * filters.limit + 1
  const endIdx = Math.min(filters.page * filters.limit, result.total)

  if (!muid) return <div className="empty-state"><h3>Select a merchant to view payments</h3></div>

  return (
    <div>
      <h1 className="page-title">Payments</h1>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 150 }} value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option value="created">Created</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
          </select>
          <select className="form-input" style={{ width: 160 }} value={filters.method} onChange={e => setFilter('method', e.target.value)}>
            <option value="">All Methods</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' }}>
            {result.total.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : result.data.length === 0 ? (
          <div className="empty-state"><p>No payments found</p></div>
        ) : (
          <>
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
                    <td><code style={{ fontSize: 11, color: 'var(--accent-primary)' }}>{p.payment_id?.substring(0, 8)}…</code></td>
                    <td>{p.customer_name || p.customer_id}</td>
                    <td><strong>₹{Number(p.amount).toLocaleString()}</strong></td>
                    <td><span className="badge badge-created">{p.method}</span></td>
                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={filters.page}
              totalPages={result.pages || 1}
              onPageChange={p => setFilters(f => ({ ...f, page: p }))}
              totalItems={result.total}
              startIdx={startIdx}
              endIdx={endIdx}
              itemsPerPage={filters.limit}
              onPerPageChange={limit => setFilters(f => ({ ...f, limit, page: 1 }))}
            />
          </>
        )}
      </div>
    </div>
  )
}

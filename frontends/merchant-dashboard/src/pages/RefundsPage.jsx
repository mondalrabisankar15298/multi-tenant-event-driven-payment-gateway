import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import Pagination from '../components/Pagination'

export default function RefundsPage() {
  const { selectedMerchant } = useMerchant()
  const [result, setResult] = useState({ data: [], total: 0, page: 1, pages: 0 })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const muid = selectedMerchant?.merchant_uuid

  useEffect(() => { if (muid) fetchRefunds() }, [muid, page, limit, statusFilter])

  const fetchRefunds = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (statusFilter) params.set('status', statusFilter)
      const data = await api.getRefunds(muid, `?${params}`)
      setResult(data)
    } catch {
      // handle gracefully
    } finally {
      setLoading(false)
    }
  }

  const startIdx = (page - 1) * limit + 1
  const endIdx = Math.min(page * limit, result.total)

  if (!muid) return <div className="empty-state"><h3>Select a merchant to view refunds</h3></div>

  return (
    <div>
      <h1 className="page-title">Refunds</h1>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' }}>
            {result.total.toLocaleString()} results
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : result.data.length === 0 ? (
          <div className="empty-state"><p>No refunds found</p></div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Refund ID</th>
                  <th>Payment</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(r => (
                  <tr key={r.refund_id}>
                    <td><code style={{ fontSize: 11, color: 'var(--accent-primary)' }}>{r.refund_id?.substring(0, 8)}…</code></td>
                    <td><code style={{ fontSize: 11, color: 'var(--accent-secondary)' }}>{r.payment_id?.toString().substring(0, 8)}…</code></td>
                    <td>{r.customer_name || '—'}</td>
                    <td><strong style={{ color: 'var(--accent-red)' }}>₹{Number(r.amount).toLocaleString()}</strong></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={page}
              totalPages={result.pages || 1}
              onPageChange={setPage}
              totalItems={result.total}
              startIdx={startIdx}
              endIdx={endIdx}
              itemsPerPage={limit}
              onPerPageChange={n => { setLimit(n); setPage(1) }}
            />
          </>
        )}
      </div>
    </div>
  )
}

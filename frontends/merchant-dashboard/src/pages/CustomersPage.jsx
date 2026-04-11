import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import Pagination from '../components/Pagination'

export default function CustomersPage() {
  const { selectedMerchant } = useMerchant()
  const [result, setResult] = useState({ data: [], total: 0, page: 1, pages: 0 })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [loading, setLoading] = useState(false)

  const muid = selectedMerchant?.merchant_uuid

  useEffect(() => { if (muid) fetchCustomers() }, [muid, page, limit])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      const data = await api.getCustomers(muid, `?${params}`)
      setResult(data)
    } catch {
      // handle gracefully
    } finally {
      setLoading(false)
    }
  }

  const startIdx = (page - 1) * limit + 1
  const endIdx = Math.min(page * limit, result.total)

  if (!muid) return <div className="empty-state"><h3>Select a merchant to view customers</h3></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Customers</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {result.total.toLocaleString()} total customers
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : result.data.length === 0 ? (
          <div className="empty-state"><p>No customers yet</p></div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Total Payments</th>
                  <th>Total Spent</th>
                  <th>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map(c => (
                  <tr key={c.customer_id}>
                    <td><code style={{ fontSize: 11, color: 'var(--accent-primary)' }}>{String(c.customer_id).substring(0, 8)}…</code></td>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.email || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{c.total_payments}</td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>₹{Number(c.total_spent || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {c.last_payment_at ? new Date(c.last_payment_at).toLocaleDateString() : '—'}
                    </td>
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

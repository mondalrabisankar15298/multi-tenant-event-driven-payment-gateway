import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import StatCard from '../components/StatCard'

export default function DashboardPage() {
  const { selectedMerchant } = useMerchant()
  const [summary, setSummary] = useState(null)
  const [daily, setDaily] = useState([])
  const [methods, setMethods] = useState([])

  const mid = selectedMerchant?.merchant_id

  useEffect(() => {
    if (mid) {
      api.getSummary(mid).then(setSummary).catch(() => {})
      api.getDaily(mid).then(setDaily).catch(() => {})
      api.getMethods(mid).then(setMethods).catch(() => {})
    }
  }, [mid])

  if (!mid) return <div className="empty-state"><h3>Select a merchant to view analytics</h3></div>
  if (!summary) return <div className="empty-state"><h3>Loading...</h3></div>

  return (
    <div>
      <h1 className="page-title">Analytics Overview</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Revenue" value={`₹${Number(summary.total_revenue).toLocaleString()}`} color="var(--accent-green)" />
        <StatCard label="Net Revenue" value={`₹${Number(summary.net_revenue).toLocaleString()}`} color="var(--accent-blue)" />
        <StatCard label="Success Rate" value={`${summary.success_rate}%`} color="var(--accent-primary)" />
        <StatCard label="Payments" value={summary.total_payments} sub={`Avg ₹${Number(summary.avg_payment_amount).toFixed(0)}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>📅 Daily Revenue (Last 30 Days)</h3>
          {daily.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No data yet</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue</th>
                    <th>Count</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map(d => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>₹{Number(d.total_amount).toLocaleString()}</td>
                      <td>{d.payment_count}</td>
                      <td style={{ color: 'var(--accent-green)' }}>{d.success_count}</td>
                      <td style={{ color: 'var(--accent-red)' }}>{d.failed_count}</td>
                      <td>₹{Number(d.net_revenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>💳 Payment Method Distribution</h3>
          {methods.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No data yet</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Volume</th>
                    <th>Count</th>
                    <th>Success</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map(m => (
                    <tr key={m.method}>
                      <td><span className="badge badge-created">{m.method}</span></td>
                      <td>₹{Number(m.total_amount).toLocaleString()}</td>
                      <td>{m.count}</td>
                      <td>{m.success_count}</td>
                      <td>{m.success_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

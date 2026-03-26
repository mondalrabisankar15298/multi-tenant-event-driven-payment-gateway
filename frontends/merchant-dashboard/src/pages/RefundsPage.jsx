import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'

export default function RefundsPage() {
  const { selectedMerchant } = useMerchant()
  const [refunds, setRefunds] = useState([])
  const mid = selectedMerchant?.merchant_id

  useEffect(() => { if (mid) api.getRefunds(mid).then(setRefunds) }, [mid])

  if (!mid) return <div className="empty-state"><h3>Select a merchant to view refunds</h3></div>

  return (
    <div>
      <h1 className="page-title">Refunds</h1>
      <div className="card">
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
            {refunds.map(r => (
              <tr key={r.refund_id}>
                <td>{r.refund_id?.substring(0, 8)}...</td>
                <td>{r.payment_id?.substring(0, 8)}...</td>
                <td>{r.customer_name || '—'}</td>
                <td>₹{Number(r.amount).toLocaleString()}</td>
                <td>{r.reason || '—'}</td>
                <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

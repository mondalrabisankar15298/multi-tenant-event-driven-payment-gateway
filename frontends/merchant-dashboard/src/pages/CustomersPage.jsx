import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'

export default function CustomersPage() {
  const { selectedMerchant } = useMerchant()
  const [customers, setCustomers] = useState([])
  const muid = selectedMerchant?.merchant_uuid

  const fetchCustomers = () => { if (muid) api.getCustomers(muid).then(setCustomers) }
  useEffect(fetchCustomers, [muid])

  if (!muid) return <div className="empty-state"><h3>Select a merchant to view customers</h3></div>

  return (
    <div>
      <h1 className="page-title">Customers</h1>
      <div className="card">
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
            {customers.map(c => (
              <tr key={c.customer_id}>
                <td>{c.customer_id}</td>
                <td>{c.name}</td>
                <td>{c.email || '—'}</td>
                <td>{c.total_payments}</td>
                <td style={{ color: 'var(--accent-green)' }}>₹{Number(c.total_spent || 0).toLocaleString()}</td>
                <td>{c.last_payment_at ? new Date(c.last_payment_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

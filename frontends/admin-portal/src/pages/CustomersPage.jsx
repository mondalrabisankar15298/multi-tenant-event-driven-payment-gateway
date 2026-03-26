import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function CustomersPage() {
  const { selectedMerchant } = useMerchant()
  const [customers, setCustomers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const mid = selectedMerchant?.merchant_id

  useEffect(() => {
    if (mid) fetchCustomers()
  }, [mid])

  const fetchCustomers = async () => {
    const data = await api.getCustomers(mid)
    setCustomers(data)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    await api.createCustomer(mid, { name, email, phone })
    await fetchCustomers()
    setShowForm(false)
    setName(''); setEmail(''); setPhone('')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return
    await api.deleteCustomer(mid, id)
    await fetchCustomers()
  }

  if (!mid) return <div className="empty-state"><h3>Select a merchant to manage customers</h3></div>

  const columns = [
    { key: 'customer_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleDateString() },
  ]

  return (
    <div>
      <div className="action-bar">
        <h1 className="page-title" style={{ margin: 0 }}>Customers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Customer</button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={customers}
          actions={(row) => (
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.customer_id)}>Delete</button>
          )}
        />
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create Customer</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

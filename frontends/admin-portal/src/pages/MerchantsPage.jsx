import { useState } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function MerchantsPage() {
  const { merchants, refreshMerchants } = useMerchant()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createMerchant({ name, email })
      await refreshMerchants()
      setShowForm(false)
      setName('')
      setEmail('')
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const columns = [
    { key: 'merchant_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'schema_name', label: 'Schema' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v}`}>{v}</span> },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleDateString() },
  ]

  return (
    <div>
      <div className="action-bar">
        <h1 className="page-title" style={{ margin: 0 }}>Merchants</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Merchant</button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={merchants} />
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create Merchant</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Business Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" required />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@acme.com" required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Merchant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

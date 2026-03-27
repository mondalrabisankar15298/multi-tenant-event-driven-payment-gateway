import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function MerchantsPage() {
  const { merchants, refreshMerchants } = useMerchant()
  const [showForm, setShowForm] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('active')
  const [creating, setCreating] = useState(false)
  const [viewingMerchant, setViewingMerchant] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowForm(false)
        setEditingMerchant(null)
        setViewingMerchant(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openEdit = (merchant) => {
    setEditingMerchant(merchant)
    setName(merchant.name || '')
    setEmail(merchant.email || '')
    setStatus(merchant.status || 'active')
  }

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

  const handleUpdate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.updateMerchant(editingMerchant.merchant_id, { name, email, status })
      await refreshMerchants()
      setEditingMerchant(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const columns = [
    { 
      key: 'merchant_id', 
      label: 'ID',
      render: (v) => <span style={{ color: 'var(--accent-primary)' }}>{v}</span>
    },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'schema_name', label: 'Schema' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v}`}>{v}</span> },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
    ) },
  ]

  return (
    <div>
      <div className="action-bar">
        <h1 className="page-title" style={{ margin: 0 }}>Merchants</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Merchant</button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={merchants} onRowClick={setViewingMerchant} />
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

      {editingMerchant && (
        <div className="modal-overlay" onClick={() => setEditingMerchant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Edit Merchant</h2>
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Business Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Contact Email</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditingMerchant(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {viewingMerchant && (
        <div className="modal-overlay" onClick={() => setViewingMerchant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <h2 className="modal-title">Merchant Details</h2>
            <pre style={{ 
              background: '#f8fafc', 
              color: '#0f172a', 
              padding: 16, 
              borderRadius: 8, 
              overflowX: 'auto', 
              fontSize: 13,
              border: '1px solid #e2e8f0',
              lineHeight: '1.5'
            }}>
              {JSON.stringify(viewingMerchant, null, 2)}
            </pre>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setViewingMerchant(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

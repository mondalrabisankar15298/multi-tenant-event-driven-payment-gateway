import { useState, useEffect } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function EventsLogPage() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('')
  const [viewingEvent, setViewingEvent] = useState(null)
  const [merchants, setMerchants] = useState([])

  useEffect(() => { fetchEvents() }, [filter])

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') setViewingEvent(null) }
    window.addEventListener('keydown', handleKeyDown)
    fetchMerchants()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const fetchMerchants = async () => {
    const mData = await api.getMerchants()
    setMerchants(mData)
  }

  const fetchEvents = async () => {
    const data = await api.getEvents(filter)
    setEvents(data)
  }

  const columns = [
    { 
      key: 'event_id', 
      label: 'Event ID', 
      render: (v) => <span style={{ color: 'var(--accent-primary)' }}>{v?.substring(0, 8)}...</span> 
    },
    { key: 'event_type', label: 'Event Type', render: (v) => <code style={{ fontSize: 12, color: 'var(--accent-primary)' }}>{v}</code> },
    { key: 'entity_type', label: 'Entity' },
    { 
      key: 'merchant_id', 
      label: 'Merchant',
      render: (mid) => merchants.find(m => m.merchant_id === mid)?.name || mid
    },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v}`}>{v}</span> },
    { key: 'created_at', label: 'Time', render: (v) => new Date(v).toLocaleString() },
  ]

  return (
    <div>
      <div className="action-bar">
        <h1 className="page-title" style={{ margin: 0 }}>Events Log</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${filter === '' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('')}>All</button>
          <button className={`btn ${filter === 'pending' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setFilter('pending')}>Pending</button>
          <button className={`btn ${filter === 'published' ? 'btn-success' : 'btn-outline'}`} onClick={() => setFilter('published')}>Published</button>
        </div>
      </div>
      <div className="card">
        <DataTable 
          columns={columns} 
          data={events} 
          onRowClick={setViewingEvent}
        />
      </div>

      {viewingEvent && (
        <div className="modal-overlay" onClick={() => setViewingEvent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <h2 className="modal-title">Event Details</h2>
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
              {JSON.stringify((() => {
                let display = { ...viewingEvent }
                if (typeof display.payload === 'string') {
                  try { display.payload = JSON.parse(display.payload) } catch {}
                }
                return display
              })(), null, 2)}
            </pre>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setViewingEvent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

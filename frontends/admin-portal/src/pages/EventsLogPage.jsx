import { useState, useEffect } from 'react'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function EventsLogPage() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchEvents() }, [filter])

  const fetchEvents = async () => {
    const data = await api.getEvents(filter)
    setEvents(data)
  }

  const columns = [
    { key: 'event_id', label: 'Event ID', render: (v) => v?.substring(0, 8) + '...' },
    { key: 'event_type', label: 'Event Type', render: (v) => <code style={{ fontSize: 12, color: 'var(--accent-primary)' }}>{v}</code> },
    { key: 'entity_type', label: 'Entity' },
    { key: 'merchant_id', label: 'Merchant' },
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
        <DataTable columns={columns} data={events} />
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ─── Utility Components ───────────────────────────────────

function CopyIcon({ text }) {
  const [copied, setCopied] = React.useState(false)
  if (!text) return null
  return (
    <button
      type="button" title="Copy to clipboard"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : '#64748b', fontSize: '14px', padding: '0 4px', display: 'inline-flex', alignItems: 'center' }}
    >
      {copied ? '✓' : '📋'}
    </button>
  )
}

function CopyableText({ text }) {
  const [copied, setCopied] = React.useState(false)
  if (!text) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b', marginTop: '4px' }}>
      <code style={{ background: 'transparent', padding: 0, margin: 0, flex: 1, color: '#e2e8f0', wordBreak: 'break-all' }}>{text}</code>
      <button
        type="button" title="Copy to clipboard"
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? '#10b981' : '#64748b', fontSize: '16px', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  )
}

function StatusBadge({ code }) {
  const color = code >= 500 ? '#ef4444' : code >= 400 ? '#f59e0b' : '#10b981'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
      background: color + '20', color, fontWeight: 700, fontSize: 11, fontFamily: 'monospace'
    }}>
      {code}
    </span>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{subtitle}</p>}
    </div>
  )
}

// ─── Dark Pagination Bar ─────────────────────────────────

function DarkPaginationBar({ currentPage, totalPages, onPageChange, totalItems, startIdx, endIdx }) {
  const [goTo, setGoTo] = useState('')

  const go = (p) => {
    const clamped = Math.min(Math.max(p, 1), totalPages)
    if (clamped !== currentPage) onPageChange(clamped)
  }

  const handleGoTo = () => {
    const p = parseInt(goTo, 10)
    if (!isNaN(p)) go(p)
    setGoTo('')
  }

  // Smart page numbers with ellipsis
  const pages = []
  const delta = 2
  const left = currentPage - delta
  const right = currentPage + delta
  let last = 0
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      if (last && i - last > 1) pages.push('...')
      pages.push(i)
      last = i
    }
  }

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 32, height: 32, borderRadius: 7, fontSize: 13, fontWeight: 500,
    border: '1px solid #1e293b', cursor: 'pointer', transition: 'all 0.15s',
    userSelect: 'none', background: '#0f172a', color: '#94a3b8',
  }
  const active = { ...base, background: '#6366f1', color: '#fff', border: '1px solid #6366f1', fontWeight: 700, boxShadow: '0 2px 8px #6366f140' }
  const disabled = { ...base, background: '#0a0f1a', color: '#334155', cursor: 'not-allowed', border: '1px solid #0f172a' }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 4px', borderTop: '1px solid #1e293b', marginTop: 12,
      flexWrap: 'wrap', gap: 10,
    }}>
      {/* Info */}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{startIdx}–{endIdx}</strong> of{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{(totalItems || 0).toLocaleString()}</strong> calls
        <span style={{ marginLeft: 10, color: '#6366f1' }}>· Click any row for details</span>
      </span>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button style={currentPage === 1 ? disabled : base} disabled={currentPage === 1} onClick={() => go(1)} title="First">«</button>
        <button style={currentPage === 1 ? disabled : base} disabled={currentPage === 1} onClick={() => go(currentPage - 1)} title="Prev">‹</button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`el-${i}`} style={{ width: 26, textAlign: 'center', color: '#475569', fontSize: 13 }}>…</span>
            : <button key={p} style={p === currentPage ? active : base} onClick={() => go(p)}>{p}</button>
        )}

        <button style={currentPage >= totalPages ? disabled : base} disabled={currentPage >= totalPages} onClick={() => go(currentPage + 1)} title="Next">›</button>
        <button style={currentPage >= totalPages ? disabled : base} disabled={currentPage >= totalPages} onClick={() => go(totalPages)} title="Last">»</button>

        <div style={{ width: 1, height: 20, background: '#1e293b', margin: '0 6px' }} />

        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Go to</span>
        <input
          type="number"
          min={1} max={totalPages}
          value={goTo}
          onChange={e => setGoTo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGoTo() }}
          onBlur={handleGoTo}
          placeholder="—"
          style={{
            width: 48, height: 32, borderRadius: 7, border: '1px solid #1e293b',
            background: '#0f172a', color: 'var(--text-primary)',
            textAlign: 'center', fontSize: 13, outline: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ─── Rate Limit Widget ────────────────────────────────────

function RateLimitWidget({ rl, config }) {
  if (!rl) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No rate limit activity yet in this window
      </div>
    )
  }

  const usedPct = Math.min(100, Math.round((rl.calls_made / rl.limit) * 100))
  const barColor = usedPct >= 90 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#10b981'

  const fmt = (iso) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  const fmtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Usage this window</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{usedPct}%</span>
      </div>
      <div style={{ height: 10, background: '#1e293b', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          height: '100%', width: `${usedPct}%`, borderRadius: 99,
          background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
          transition: 'width 0.6s ease',
          boxShadow: `0 0 8px ${barColor}60`,
        }} />
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Calls Made', value: rl.calls_made, color: barColor },
          { label: 'Remaining', value: rl.calls_remaining, color: rl.calls_remaining === 0 ? '#ef4444' : '#10b981' },
          { label: 'Total Limit', value: rl.limit, color: '#6366f1' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', border: '1px solid #1e293b', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Window times */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>⏱ Window Start</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmtDate(rl.window_start)}</div>
        </div>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>🔁 Window Reset</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', fontFamily: 'monospace' }}>{fmtDate(rl.window_end)}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Sliding window: {rl.window_seconds}s · Config: {config?.rate_limit_requests} req / {config?.rate_limit_window_seconds}s
      </div>
    </div>
  )
}

// ─── Audit Summary Widget ─────────────────────────────────

function AuditSummary({ summary }) {
  if (!summary) return null
  const metrics = [
    { label: 'All Time', value: summary.total_all_time, color: '#a78bfa' },
    { label: 'Last 30 Days', value: summary.total_30d, color: '#6366f1' },
    { label: 'Last 7 Days', value: summary.total_7d, color: '#3b82f6' },
    { label: 'Last 24h', value: summary.total_24h, color: '#06b6d4' },
    { label: 'Errors (24h)', value: summary.errors_24h, color: '#ef4444' },
    { label: 'Success Rate (24h)', value: `${summary.success_rate_24h}%`, color: '#10b981' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {metrics.map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '16px 18px',
          borderLeft: `3px solid ${color}`,
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Endpoint Breakdown Table ─────────────────────────────

function EndpointBreakdown({ breakdown }) {
  if (!breakdown || breakdown.length === 0) {
    return <div className="empty-state"><p>No API calls recorded in the last 30 days</p></div>
  }
  const maxCalls = breakdown[0]?.total_calls || 1
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Method</th>
            <th>Total Calls</th>
            <th style={{ minWidth: 150 }}>Distribution</th>
            <th>Errors</th>
            <th>Avg Response</th>
            <th>Last Called</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((row, i) => (
            <tr key={i}>
              <td><code style={{ fontSize: 12, color: '#a78bfa' }}>{row.endpoint}</code></td>
              <td><span style={{ background: '#6366f120', color: '#6366f1', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{row.method}</span></td>
              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.total_calls.toLocaleString()}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.total_calls / maxCalls) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: 99 }} />
                  </div>
                </div>
              </td>
              <td>
                {row.error_calls > 0
                  ? <span style={{ color: '#ef4444', fontWeight: 600 }}>{row.error_calls}</span>
                  : <span style={{ color: '#10b981' }}>0</span>}
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.avg_response_ms}ms</td>
              <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {row.last_called_at ? new Date(row.last_called_at).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Log Detail Modal ─────────────────────────────────────

function LogDetailModal({ log, onClose }) {
  if (!log) return null

  const statusColor = log.status_code >= 500 ? '#ef4444' : log.status_code >= 400 ? '#f59e0b' : '#10b981'
  const hasParams = log.request_params && Object.keys(log.request_params).length > 0

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1000 }}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, width: '95%' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ background: '#6366f125', color: '#6366f1', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {log.method}
              </span>
              <StatusBadge code={log.status_code} />
            </div>
            <code style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600 }}>{log.endpoint}</code>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          >
            ✕
          </button>
        </div>

        {/* Detail grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: '🕐 Timestamp', value: new Date(log.called_at).toLocaleString() },
            { label: '⚡ Response Time', value: log.response_time_ms != null ? `${log.response_time_ms} ms` : '—' },
            { label: '📡 Status Code', value: log.status_code, color: statusColor },
            { label: '🔑 Log ID', value: log.id?.slice(0, 18) + '…' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Request Params */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            📦 Request Parameters
          </div>
          {hasParams ? (
            <pre style={{
              background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
              padding: '14px', margin: 0, fontSize: 12, color: '#e2e8f0',
              overflowX: 'auto', lineHeight: 1.6,
            }}>
              {JSON.stringify(log.request_params, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '12px 14px', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', color: 'var(--text-muted)', fontSize: 12 }}>
              No parameters
            </div>
          )}
        </div>

        {/* Error message */}
        {log.error_message && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              ⚠ Error Message
            </div>
            <div style={{
              background: '#1c0a0a', border: '1px solid #ef444440', borderRadius: 8,
              padding: '12px 14px', color: '#ef4444', fontSize: 13, fontFamily: 'monospace',
            }}>
              {log.error_message}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Raw Audit Log Table ──────────────────────────────────

function RawAuditLog({ consumerId }) {
  const [logData, setLogData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  const load = useCallback(async (p) => {
    setLoading(true)
    try {
      const res = await api.getAuditLog(consumerId, p, 50)
      setLogData(res.data)
    } catch { }
    setLoading(false)
  }, [consumerId])

  useEffect(() => { load(page) }, [page])

  return (
    <div>
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {loading && !logData ? (
        <div className="loading"><div className="spinner" /> Loading logs...</div>
      ) : logData ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Params</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logData.logs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#6366f110'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                    {new Date(log.called_at).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ background: '#6366f120', color: '#6366f1', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {log.method}
                    </span>
                  </td>
                  <td><code style={{ fontSize: 11, color: '#a78bfa' }}>{log.endpoint}</code></td>
                  <td><StatusBadge code={log.status_code} /></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.request_params && Object.keys(log.request_params).length > 0
                      ? JSON.stringify(log.request_params)
                      : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: '#ef4444', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DarkPaginationBar
          currentPage={page}
          totalPages={logData.total_pages}
          onPageChange={setPage}
          totalItems={logData.total}
          startIdx={((page - 1) * 50) + 1}
          endIdx={Math.min(page * 50, logData.total)}
        />
        {loading && (
          <div style={{ textAlign: 'center', padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>
            Refreshing...
          </div>
        )}
      </>) : null}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

export default function ConsumerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [consumer, setConsumer] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [auditSummary, setAuditSummary] = useState(null)
  const [breakdown, setBreakdown] = useState(null)

  const [showMerchantModal, setShowMerchantModal] = useState(false)
  const [allMerchants, setAllMerchants] = useState([])
  const [selectedMerchantUuids, setSelectedMerchantUuids] = useState([])

  const [showEditWebhookModal, setShowEditWebhookModal] = useState(false)
  const [editWebhookUrl, setEditWebhookUrl] = useState('')

  const [showEditScopeModal, setShowEditScopeModal] = useState(false)
  const [editScopes, setEditScopes] = useState([])

  const [rotatedSecret, setRotatedSecret] = useState(null)
  const [apiCallsChart, setApiCallsChart] = useState([])
  const [webhooksChart, setWebhooksChart] = useState([])

  const SCOPE_OPTIONS = [
    'payments:read', 'customers:read', 'refunds:read',
    'events:read', 'merchants:read', 'webhooks:manage',
  ]

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [consumerRes, statsRes, merchantsRes] = await Promise.allSettled([
        api.getConsumer(id),
        api.getConsumerStats(id),
        api.listAllMerchants(),
      ])

      if (consumerRes.status === 'fulfilled') setConsumer(consumerRes.value.data)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      if (merchantsRes.status === 'fulfilled') setAllMerchants(merchantsRes.value.data)

      // Load charts
      try { const r = await api.getConsumerApiCalls(id, '?granularity=hour'); setApiCallsChart(r.data || []) } catch { }
      try { const r = await api.getConsumerWebhooks(id, '?granularity=hour'); setWebhooksChart(r.data || []) } catch { }

      // Load audit data
      try { const r = await api.getAuditSummary(id); setAuditSummary(r.data) } catch { }
      try { const r = await api.getEndpointBreakdown(id); setBreakdown(r.data) } catch { }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRotateSecret() {
    if (!confirm('This will invalidate the current secret. Continue?')) return
    try {
      const res = await api.rotateSecret(id)
      setRotatedSecret(res.data)
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleAssignMerchants(e) {
    e.preventDefault()
    try {
      if (selectedMerchantUuids.length === 0) return alert('Select at least one merchant.')
      await api.assignMerchants(id, selectedMerchantUuids)
      setShowMerchantModal(false)
      setSelectedMerchantUuids([])
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleUpdateWebhook(e) {
    e.preventDefault()
    try {
      await api.updateConsumer(id, { webhook_url: editWebhookUrl })
      setShowEditWebhookModal(false)
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleUpdateScopes(e) {
    e.preventDefault()
    try {
      await api.updateConsumer(id, { scopes: editScopes })
      setShowEditScopeModal(false)
      await loadAll()
    } catch (err) { alert(err.message) }
  }

  async function handleRemoveMerchant(m) {
    if (!confirm(`Remove ${m.merchant_name} access?`)) return
    await api.removeMerchant(id, m.merchant_uuid)
    await loadAll()
  }

  async function handleSuspend() {
    if (!confirm('Suspend this consumer?')) return
    await api.suspendConsumer(id)
    await loadAll()
  }

  async function handleActivate() {
    await api.activateConsumer(id)
    await loadAll()
  }

  async function handleRevoke() {
    if (!confirm('PERMANENTLY revoke this consumer? This cannot be undone.')) return
    await api.deleteConsumer(id)
    navigate('/consumers')
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading...</div>
  if (!consumer) return <div className="empty-state"><h3>Consumer not found</h3></div>

  const statusBadge = { active: 'badge-active', suspended: 'badge-suspended', revoked: 'badge-revoked' }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/consumers')} style={{ marginBottom: 12 }}>
            ← Back
          </button>
          <h2>{consumer.name}</h2>
          <p>{consumer.description || 'No description'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRotateSecret}>🔄 Rotate Secret</button>
          {consumer.status === 'active' && <button className="btn btn-secondary btn-sm" onClick={handleSuspend}>⏸ Suspend</button>}
          {consumer.status === 'suspended' && <button className="btn btn-primary btn-sm" onClick={handleActivate}>▶ Activate</button>}
          <button className="btn btn-danger btn-sm" onClick={handleRevoke}>🗑 Revoke</button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">Status</div>
          <div><span className={`badge ${statusBadge[consumer.status]}`}>{consumer.status}</span></div>
        </div>
        <div className="stat-card">
          <div className="label">Client ID</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {consumer.client_id}
            <CopyIcon text={consumer.client_id} />
          </div>
        </div>
        <div className="stat-card">
          <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Scopes
            <button className="btn btn-sm" onClick={() => { setEditScopes(consumer.scopes || []); setShowEditScopeModal(true) }} style={{ padding: '0 4px', background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer' }}>Edit</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {(consumer.scopes || []).map(s => (
              <span key={s} className="badge badge-active" style={{ fontSize: 10 }}>{s}</span>
            ))}
          </div>
        </div>
        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Webhook URL
            <button className="btn btn-sm" onClick={() => { setEditWebhookUrl(consumer.webhook_url || ''); setShowEditWebhookModal(true) }} style={{ padding: '0 4px', background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer' }}>Edit</button>
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all', marginTop: 4 }}>
            {consumer.webhook_url || 'Not configured'}
          </div>
        </div>
      </div>

      {/* ─── Rate Limit Widget ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <SectionHeader
          title="🚦 Current Rate Limit Window"
          subtitle="Live sliding window state from Redis — refreshed on each page load"
        />
        <RateLimitWidget rl={consumer.rate_limit_status} config={consumer} />
      </div>

      {/* ─── Total API Calls Summary ──────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <SectionHeader
          title="📊 Total API Calls"
          subtitle="Aggregated call counts across all time windows"
        />
        <AuditSummary summary={auditSummary} />
      </div>

      {/* ─── Charts ──────────────────────────────────────── */}
      {stats && (
        <div className="stat-cards" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="label">API Calls (24h)</div>
            <div className="value">{stats.api_calls?.last_24h?.toLocaleString() || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Avg Response Time</div>
            <div className="value">{stats.response_time_ms?.avg || 0}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>ms</span></div>
          </div>
          <div className="stat-card">
            <div className="label">Webhook Success (7d)</div>
            <div className="value">{stats.webhooks?.success_rate || 100}%</div>
          </div>
          <div className="stat-card">
            <div className="label">DLQ Count</div>
            <div className="value" style={{ color: stats.dlq_count > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {stats.dlq_count || 0}
            </div>
          </div>
        </div>
      )}

      <div className="charts-grid" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <h3>API Calls (24h)</h3>
          {apiCallsChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={apiCallsChart}>
                <XAxis dataKey="timestamp" tickFormatter={t => new Date(t).getHours() + 'h'} tick={{ fill: '#8892b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid #2d3555', borderRadius: 8 }} />
                <Line type="monotone" dataKey="call_count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No data yet</p></div>}
        </div>
        <div className="chart-card">
          <h3>Webhook Deliveries (24h)</h3>
          {webhooksChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={webhooksChart}>
                <XAxis dataKey="timestamp" tickFormatter={t => new Date(t).getHours() + 'h'} tick={{ fill: '#8892b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1f35', border: '1px solid #2d3555', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No data yet</p></div>}
        </div>
      </div>

      {/* ─── Endpoint Breakdown ───────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <SectionHeader
          title="🗂 API Calls by Endpoint"
          subtitle="Grouped call counts and performance stats for the last 30 days"
        />
        <EndpointBreakdown breakdown={breakdown} />
      </div>

      {/* ─── Assigned Merchants ───────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Merchants</h3>
          <button className="btn btn-sm btn-primary" onClick={() => setShowMerchantModal(true)}>+ Assign</button>
        </div>
        {(consumer.merchants || []).length > 0 ? (
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {consumer.merchants.map(m => (
                <tr key={m.merchant_uuid}>
                  <td><code style={{ fontSize: 11 }}>{m.merchant_uuid?.slice(0, 8)}...</code></td>
                  <td style={{ color: 'var(--text-primary)' }}>{m.merchant_name}</td>
                  <td>{m.merchant_email}</td>
                  <td><span className={`badge badge-${m.merchant_status === 'active' ? 'active' : 'suspended'}`}>{m.merchant_status}</span></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleRemoveMerchant(m)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state"><p>No merchants assigned</p></div>}
      </div>

      {/* ─── Raw Audit Log ────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <SectionHeader
          title="📋 Raw API Call Log"
          subtitle="Complete paginated history of all API calls made by this consumer"
        />
        <RawAuditLog consumerId={id} />
      </div>

      {/* ─── Modals ───────────────────────────────────────── */}

      {showMerchantModal && (
        <div className="modal-overlay" onClick={() => setShowMerchantModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleAssignMerchants}>
              <h3>Assign Merchants</h3>
              <div className="form-group" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <label>Select Merchants</label>
                {allMerchants.filter(m => !(consumer.merchants || []).some(cm => cm.merchant_uuid === m.merchant_uuid)).length === 0 ? (
                  <div style={{ padding: '16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-muted)' }}>
                    All available merchants are already assigned.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '8px' }}>
                    {allMerchants
                      .filter(m => !(consumer.merchants || []).some(cm => cm.merchant_uuid === m.merchant_uuid))
                      .map(m => (
                        <label key={m.merchant_uuid} className="merchant-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--border)' }}>
                          <input
                            type="checkbox"
                            checked={selectedMerchantUuids.includes(m.merchant_uuid)}
                            onChange={e => {
                              setSelectedMerchantUuids(prev =>
                                e.target.checked ? [...prev, m.merchant_uuid] : prev.filter(uid => uid !== m.merchant_uuid)
                              )
                            }}
                            style={{ margin: 0, width: 'auto', accentColor: 'var(--accent)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{m.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{m.email}</span>
                          </div>
                        </label>
                      ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMerchantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Selected</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditWebhookModal && (
        <div className="modal-overlay" onClick={() => setShowEditWebhookModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateWebhook}>
              <h3>Webhook Configuration</h3>
              <div className="form-group">
                <label>Webhook URL (HTTPS)</label>
                <input type="url" value={editWebhookUrl} onChange={e => setEditWebhookUrl(e.target.value)} placeholder="https://api.example.com/webhooks" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditWebhookModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Webhook</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditScopeModal && (
        <div className="modal-overlay" onClick={() => setShowEditScopeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateScopes}>
              <h3>Update Scopes</h3>
              <div className="form-group">
                <label>Allowed Scopes</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  {SCOPE_OPTIONS.map(scope => (
                    <label key={scope} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--border)' }}>
                      <input
                        type="checkbox"
                        checked={editScopes.includes(scope)}
                        onChange={e => {
                          setEditScopes(prev =>
                            e.target.checked ? [...prev, scope] : prev.filter(s => s !== scope)
                          )
                        }}
                        style={{ margin: 0, width: 'auto', accentColor: 'var(--accent)' }}
                      />
                      <code style={{ fontSize: 12, color: 'var(--accent)', background: 'transparent', padding: 0 }}>{scope}</code>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditScopeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Scopes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rotatedSecret && (
        <div className="modal-overlay" onClick={() => setRotatedSecret(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Secret Rotated ✓</h3>
            <div className="secret-box">
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Client ID</label>
              <CopyableText text={consumer?.client_id} />
            </div>
            <div className="secret-box" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>New Client Secret</label>
              <CopyableText text={rotatedSecret.client_secret} />
              <p style={{ marginTop: '12px', fontSize: 13, color: '#ef4444' }}>⚠ This secret will NOT be shown again. Save it now!</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setRotatedSecret(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'

// ─── Reusable Pagination Bar ──────────────────────────────

function PaginationBar({ currentPage, totalPages, onPageChange, totalItems, startIdx, endIdx, itemsPerPage, onItemsPerPageChange }) {
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

  // Smart page numbers: always show first, last, current ±2, with ellipsis
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

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 500,
    border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s',
    userSelect: 'none',
  }
  const btnIdle = { ...btnBase, background: '#ffffff', color: '#374151' }
  const btnActive = { ...btnBase, background: '#4f46e5', color: '#ffffff', border: '1px solid #4f46e5', fontWeight: 700, boxShadow: '0 2px 8px #4f46e540' }
  const btnDisabled = { ...btnBase, background: '#f9fafb', color: '#d1d5db', cursor: 'not-allowed', border: '1px solid #f3f4f6' }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 20px', borderTop: '1px solid #e2e8f0',
      background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
      borderBottomLeftRadius: 10, borderBottomRightRadius: 10, gap: 12, flexWrap: 'wrap',
    }}>
      {/* Left: showing + rows per page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#6b7280' }}>
        <span>
          Showing <strong style={{ color: '#111827' }}>{startIdx}–{endIdx}</strong> of <strong style={{ color: '#111827' }}>{(totalItems || 0).toLocaleString()}</strong>
        </span>
        {onItemsPerPageChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Rows:</span>
            <select
              value={itemsPerPage}
              onChange={e => onItemsPerPageChange(Number(e.target.value))}
              style={{
                padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0',
                fontSize: 13, color: '#374151', background: '#fff',
                cursor: 'pointer', outline: 'none',
              }}
            >
              {[15, 25, 50, 75, 100].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Right: page controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* First + Prev */}
        <button style={currentPage === 1 ? btnDisabled : btnIdle} disabled={currentPage === 1} onClick={() => go(1)} title="First page">«</button>
        <button style={currentPage === 1 ? btnDisabled : btnIdle} disabled={currentPage === 1} onClick={() => go(currentPage - 1)} title="Previous page">‹</button>

        {/* Numbered pages */}
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`} style={{ width: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>…</span>
            : <button key={p} style={p === currentPage ? btnActive : btnIdle} onClick={() => go(p)}>{p}</button>
        )}

        {/* Next + Last */}
        <button style={currentPage >= totalPages ? btnDisabled : btnIdle} disabled={currentPage >= totalPages} onClick={() => go(currentPage + 1)} title="Next page">›</button>
        <button style={currentPage >= totalPages ? btnDisabled : btnIdle} disabled={currentPage >= totalPages} onClick={() => go(totalPages)} title="Last page">»</button>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 8px' }} />

        {/* Go to page */}
        <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={goTo}
          onChange={e => setGoTo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGoTo() }}
          onBlur={handleGoTo}
          placeholder="—"
          style={{
            width: 52, height: 34, borderRadius: 8, border: '1px solid #e2e8f0',
            textAlign: 'center', fontSize: 13, color: '#374151',
            outline: 'none', background: '#fff',
            boxShadow: 'inset 0 1px 2px #00000008',
          }}
        />
      </div>
    </div>
  )
}

// ─── Main DataTable ───────────────────────────────────────

export default function DataTable({ columns, data, actions, onRowClick, onPageChange, totalItems, currentPage: currentPageProp, itemsPerPage }) {
  const [localPage, setLocalPage] = useState(1)
  const [localItemsPerPage, setLocalItemsPerPage] = useState(itemsPerPage || 25)

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No data yet</h3>
        <p>Create your first record to see it here</p>
      </div>
    )
  }

  const isServerSide = typeof totalItems === 'number'
  const currentPage = isServerSide ? (currentPageProp || 1) : localPage
  const perPage = localItemsPerPage

  const totalPages = isServerSide
    ? Math.ceil(totalItems / perPage)
    : Math.ceil(data.length / perPage)

  const displayData = isServerSide
    ? data
    : data.slice((currentPage - 1) * perPage, currentPage * perPage)

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    if (isServerSide) {
      onPageChange && onPageChange(newPage, perPage)
    } else {
      setLocalPage(newPage)
    }
  }

  const handleItemsPerPageChange = (newSize) => {
    setLocalItemsPerPage(newSize)
    if (isServerSide) {
      onPageChange && onPageChange(1, newSize)
    } else {
      setLocalPage(1)
    }
  }

  const count = isServerSide ? totalItems : data.length
  const startIdx = count === 0 ? 0 : (currentPage - 1) * perPage + 1
  const endIdx = Math.min(currentPage * perPage, count)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick && onRowClick(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]?.toString() || '—'}
                  </td>
                ))}
                {actions && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="btn-actions">
                      {actions(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages || 1}
        onPageChange={handlePageChange}
        totalItems={count}
        startIdx={startIdx}
        endIdx={endIdx}
        itemsPerPage={perPage}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  )
}

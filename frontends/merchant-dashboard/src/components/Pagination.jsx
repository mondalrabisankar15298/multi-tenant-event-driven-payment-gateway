import { useState } from 'react'

/**
 * Pagination — shared dark-themed component for merchant dashboard.
 *
 * Props:
 *  currentPage  – active page (1-indexed)
 *  totalPages   – total number of pages
 *  onPageChange – callback(newPage)
 *  totalItems   – total record count (for display)
 *  startIdx     – first record shown on this page
 *  endIdx       – last record shown on this page
 *  itemsPerPage – current rows-per-page selection
 *  onPerPageChange – optional callback(newLimit)
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  startIdx,
  endIdx,
  itemsPerPage,
  onPerPageChange,
}) {
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

  // Smart page list with ellipsis
  const pages = []
  const delta = 2
  let last = 0
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      if (last && i - last > 1) pages.push('…')
      pages.push(i)
      last = i
    }
  }

  // Styles
  const S = {
    bar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      padding: '14px 20px',
      borderTop: '1px solid var(--border-color)',
      background: 'rgba(26,26,62,0.6)',
      borderBottomLeftRadius: 'var(--radius)',
      borderBottomRightRadius: 'var(--radius)',
      marginTop: 0,
    },
    info: {
      fontSize: 13,
      color: 'var(--text-secondary)',
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    btn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 34, height: 34, borderRadius: 8,
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-card)',
      color: 'var(--text-secondary)',
      transition: 'all 0.15s',
    },
    btnActive: {
      background: 'var(--accent-primary)',
      color: '#fff',
      border: '1px solid var(--accent-primary)',
      fontWeight: 700,
      boxShadow: '0 2px 10px rgba(99,102,241,0.4)',
    },
    btnDisabled: {
      background: 'rgba(26,26,62,0.3)',
      color: 'var(--text-muted)',
      cursor: 'not-allowed',
      border: '1px solid rgba(45,45,94,0.4)',
    },
    input: {
      width: 50, height: 34, borderRadius: 8,
      border: '1px solid var(--border-color)',
      background: 'var(--bg-input)',
      color: 'var(--text-primary)',
      textAlign: 'center', fontSize: 13, outline: 'none',
    },
    divider: {
      width: 1, height: 22,
      background: 'var(--border-color)',
      margin: '0 6px',
    },
    select: {
      height: 30, borderRadius: 6, padding: '0 6px',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-input)',
      color: 'var(--text-secondary)',
      fontSize: 12, outline: 'none', cursor: 'pointer',
    },
  }

  const isDisabledPrev = currentPage <= 1
  const isDisabledNext = currentPage >= totalPages

  return (
    <div style={S.bar}>

      {/* Left: record range + per-page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={S.info}>
          Showing{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{startIdx ?? ((currentPage - 1) * (itemsPerPage || 25) + 1)}</strong>
          {' – '}
          <strong style={{ color: 'var(--text-primary)' }}>{endIdx ?? Math.min(currentPage * (itemsPerPage || 25), totalItems)}</strong>
          {' of '}
          <strong style={{ color: 'var(--accent-primary)' }}>{totalItems.toLocaleString()}</strong>
        </span>
        {onPerPageChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Per page:</span>
            <select style={S.select} value={itemsPerPage} onChange={e => onPerPageChange(Number(e.target.value))}>
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Right: nav controls */}
      <div style={S.controls}>
        {/* First */}
        <button
          style={{ ...S.btn, ...(isDisabledPrev ? S.btnDisabled : {}) }}
          disabled={isDisabledPrev}
          onClick={() => go(1)}
          title="First page"
        >«</button>

        {/* Prev */}
        <button
          style={{ ...S.btn, ...(isDisabledPrev ? S.btnDisabled : {}) }}
          disabled={isDisabledPrev}
          onClick={() => go(currentPage - 1)}
          title="Previous"
        >‹</button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} style={{ width: 26, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>…</span>
            : (
              <button
                key={p}
                onClick={() => go(p)}
                style={{ ...S.btn, ...(p === currentPage ? S.btnActive : {}) }}
              >
                {p}
              </button>
            )
        )}

        {/* Next */}
        <button
          style={{ ...S.btn, ...(isDisabledNext ? S.btnDisabled : {}) }}
          disabled={isDisabledNext}
          onClick={() => go(currentPage + 1)}
          title="Next"
        >›</button>

        {/* Last */}
        <button
          style={{ ...S.btn, ...(isDisabledNext ? S.btnDisabled : {}) }}
          disabled={isDisabledNext}
          onClick={() => go(totalPages)}
          title="Last page"
        >»</button>

        {/* Divider */}
        <div style={S.divider} />

        {/* Go to page */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={goTo}
          onChange={e => setGoTo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleGoTo() }}
          onBlur={handleGoTo}
          placeholder="—"
          style={S.input}
        />
      </div>
    </div>
  )
}

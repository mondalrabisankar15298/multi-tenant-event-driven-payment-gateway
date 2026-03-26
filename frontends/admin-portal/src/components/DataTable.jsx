export default function DataTable({ columns, data, actions }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <h3>No data yet</h3>
        <p>Create your first record to see it here</p>
      </div>
    )
  }

  return (
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
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]?.toString() || '—'}
                </td>
              ))}
              {actions && (
                <td>
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
  )
}

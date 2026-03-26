import { useState, useEffect } from 'react'
import { useMerchant } from '../contexts/MerchantContext'
import { api } from '../api/client'
import DataTable from '../components/DataTable'

export default function RefundsPage() {
  const { selectedMerchant } = useMerchant()
  const [refunds, setRefunds] = useState([])
  const mid = selectedMerchant?.merchant_id

  useEffect(() => {
    if (mid) fetchRefunds()
  }, [mid])

  const fetchRefunds = async () => setRefunds(await api.getRefunds(mid))

  const handleProcess = async (refundId) => {
    try {
      await api.processRefund(mid, refundId)
      await fetchRefunds()
    } catch (err) { alert(err.message) }
  }

  if (!mid) return <div className="empty-state"><h3>Select a merchant to view refunds</h3></div>

  const columns = [
    { key: 'refund_id', label: 'Refund ID', render: (v) => v?.substring(0, 8) + '...' },
    { key: 'payment_id', label: 'Payment ID', render: (v) => v?.substring(0, 8) + '...' },
    { key: 'amount', label: 'Amount', render: (v) => `₹${Number(v).toLocaleString()}` },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge badge-${v}`}>{v}</span> },
    { key: 'created_at', label: 'Created', render: (v) => new Date(v).toLocaleString() },
  ]

  return (
    <div>
      <h1 className="page-title">Refunds</h1>
      <div className="card">
        <DataTable
          columns={columns}
          data={refunds}
          actions={(row) =>
            row.status === 'initiated' ? (
              <button className="btn btn-success btn-sm" onClick={() => handleProcess(row.refund_id)}>Process</button>
            ) : null
          }
        />
      </div>
    </div>
  )
}

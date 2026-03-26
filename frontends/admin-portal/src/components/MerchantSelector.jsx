import { useMerchant } from '../contexts/MerchantContext'

export default function MerchantSelector() {
  const { merchants, selectedMerchant, setSelectedMerchant } = useMerchant()

  return (
    <div className="merchant-selector">
      <label>🏦 Merchant</label>
      <select
        value={selectedMerchant?.merchant_id || ''}
        onChange={(e) => {
          const m = merchants.find(m => m.merchant_id === Number(e.target.value))
          setSelectedMerchant(m || null)
        }}
      >
        <option value="">Select Merchant...</option>
        {merchants.map(m => (
          <option key={m.merchant_id} value={m.merchant_id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  )
}

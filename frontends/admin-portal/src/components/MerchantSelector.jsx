import { useMerchant } from '../contexts/MerchantContext'

export default function MerchantSelector() {
  const { merchants, selectedMerchant, setSelectedMerchant } = useMerchant()

  return (
    <div className="merchant-selector">
      <label>🏦 Merchant</label>
      <select
        value={selectedMerchant?.merchant_uuid || ''}
        onChange={(e) => {
          const m = merchants.find(m => m.merchant_uuid === e.target.value)
          setSelectedMerchant(m || null)
        }}
      >
        <option value="">Select Merchant...</option>
        {merchants.map(m => (
          <option key={m.merchant_uuid} value={m.merchant_uuid}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  )
}

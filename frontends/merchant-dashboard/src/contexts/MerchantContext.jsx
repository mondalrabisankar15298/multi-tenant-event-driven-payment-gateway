import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const MerchantContext = createContext()

export function MerchantProvider({ children }) {
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, _setSelectedMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  const setSelectedMerchant = (merchant) => {
    _setSelectedMerchant(merchant)
    if (merchant) {
      localStorage.setItem('selected_merchant_uuid', merchant.merchant_uuid)
      api.setApiKey(merchant.api_key)
    } else {
      localStorage.removeItem('selected_merchant_uuid')
      api.setApiKey(null)
    }
  }

  useEffect(() => {
    api.getMerchants().then(data => {
      setMerchants(data)
      
      const savedUuid = localStorage.getItem('selected_merchant_uuid')
      const savedMerchant = data.find(m => String(m.merchant_uuid) === String(savedUuid))
      
      if (savedMerchant) {
        setSelectedMerchant(savedMerchant)
      } else if (data.length > 0) {
        setSelectedMerchant(data[0])
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <MerchantContext.Provider value={{ merchants, selectedMerchant, setSelectedMerchant, loading }}>
      {children}
    </MerchantContext.Provider>
  )
}

export const useMerchant = () => useContext(MerchantContext)

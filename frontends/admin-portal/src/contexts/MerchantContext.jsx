import { createContext, useContext, useState, useEffect } from 'react'
import { api, setApiKey } from '../api/client'

const MerchantContext = createContext()
const STORAGE_KEY = 'selectedMerchantUuid'

export function MerchantProvider({ children }) {
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, setSelectedMerchantState] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMerchants = async () => {
    try {
      const res = await api.getMerchants()
      const data = res.data || res
      setMerchants(data)

      if (data.length > 0) {
        const savedUuid = localStorage.getItem(STORAGE_KEY)
        const savedMerchant = savedUuid
          ? data.find(m => String(m.merchant_uuid) === savedUuid)
          : null

        const toSelect = savedMerchant || data[0]
        // Fetch api_key from admin endpoint (not exposed in public list)
        try {
          const creds = await api.getMerchantCredentials(toSelect.merchant_uuid)
          setApiKey(creds.api_key)
        } catch (e) {
          console.error('Failed to fetch merchant credentials:', e)
        }
        setSelectedMerchantState(toSelect)
      }
    } catch (err) {
      console.error('Failed to fetch merchants:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [])

  const setSelectedMerchant = async (merchant) => {
    if (merchant) {
      // Fetch api_key from admin endpoint
      try {
        const creds = await api.getMerchantCredentials(merchant.merchant_uuid)
        setApiKey(creds.api_key)
      } catch (e) {
        console.error('Failed to fetch merchant credentials:', e)
        setApiKey(null)
      }
      setSelectedMerchantState(merchant)
      localStorage.setItem(STORAGE_KEY, String(merchant.merchant_uuid))
    } else {
      setApiKey(null)
      setSelectedMerchantState(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <MerchantContext.Provider value={{
      merchants,
      selectedMerchant,
      setSelectedMerchant,
      loading,
      refreshMerchants: fetchMerchants,
    }}>
      {children}
    </MerchantContext.Provider>
  )
}

export const useMerchant = () => useContext(MerchantContext)

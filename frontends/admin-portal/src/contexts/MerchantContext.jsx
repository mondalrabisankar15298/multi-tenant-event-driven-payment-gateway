import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const MerchantContext = createContext()

export function MerchantProvider({ children }) {
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMerchants = async () => {
    try {
      const data = await api.getMerchants()
      setMerchants(data)
    } catch (err) {
      console.error('Failed to fetch merchants:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [])

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

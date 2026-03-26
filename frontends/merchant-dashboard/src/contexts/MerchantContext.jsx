import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

const MerchantContext = createContext()

export function MerchantProvider({ children }) {
  const [merchants, setMerchants] = useState([])
  const [selectedMerchant, setSelectedMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMerchants().then(data => {
      setMerchants(data)
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

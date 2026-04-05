import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Consumers from './pages/Consumers'
import ConsumerDetail from './pages/ConsumerDetail'
import { api } from './api/client'

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('admin_api_key') || '')
  const [keySubmitted, setKeySubmitted] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!localStorage.getItem('admin_api_key'))

  const [loadingLogin, setLoadingLogin] = useState(false)
  const [loginError, setLoginError] = useState(null)

  React.useEffect(() => {
    const savedKey = localStorage.getItem('admin_api_key')
    if (savedKey) {
      api.setAdminKey(savedKey)
      api.getOverview()
        .then(() => setKeySubmitted(true))
        .catch(() => {
          localStorage.removeItem('admin_api_key')
          api.setAdminKey('')
          setApiKey('')
        })
        .finally(() => setInitialLoading(false))
    }
  }, [])

  async function handleKeySubmit(e) {
    e.preventDefault()
    if (apiKey.trim()) {
      try {
        setLoadingLogin(true)
        setLoginError(null)
        api.setAdminKey(apiKey.trim())
        // Validate the key by hitting a lightweight admin endpoint
        await api.getOverview()
        setKeySubmitted(true)
      } catch (err) {
        setLoginError('Invalid API Key: ' + err.message)
        api.setAdminKey('') // remove the invalid key from client
      } finally {
        setLoadingLogin(false)
      }
    }
  }

  if (initialLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ color: '#8892b0', fontFamily: 'Inter, sans-serif' }}>Verifying authentication...</div>
      </div>
    )
  }

  if (!keySubmitted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e1a',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          background: '#1a1f35',
          border: '1px solid #2d3555',
          borderRadius: 12,
          padding: 40,
          width: 400,
        }}>
          <h2 style={{ color: '#f0f2f7', marginBottom: 8, fontSize: 22 }}>Connect Gateway Admin</h2>
          <p style={{ color: '#8892b0', fontSize: 14, marginBottom: 24 }}>Enter your admin API key to access the console.</p>
          
          {loginError && (
            <div style={{ padding: '10px', background: '#3b1c21', color: '#ff6b6b', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleKeySubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#8892b0', marginBottom: 6 }}>
                Admin API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value)
                  setLoginError(null)
                }}
                placeholder="dev-admin-key-change-in-production"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#1e2540',
                  border: '1px solid #2d3555',
                  borderRadius: 8,
                  color: '#f0f2f7',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loadingLogin}
              style={{
                width: '100%',
                padding: '10px 18px',
                background: loadingLogin ? '#4f46e5' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: loadingLogin ? 'not-allowed' : 'pointer',
                opacity: loadingLogin ? 0.7 : 1,
              }}
            >
              {loadingLogin ? 'Verifying...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Support both /admin deployment (FastAPI) and root deployment (Nginx / Vite)
  const basename = window.location.pathname.startsWith('/admin') ? '/admin' : '/'

  return (
    <BrowserRouter basename={basename}>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>Connect Gateway</h1>
            <span>Admin Console</span>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end>📊 Dashboard</NavLink>
            <NavLink to="/consumers">👥 Consumers</NavLink>
          </nav>
          <div style={{ padding: '0 12px', marginTop: 'auto' }}>
            <button
              onClick={() => {
                localStorage.removeItem('admin_api_key')
                setApiKey('')
                setKeySubmitted(false)
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid #2d3555',
                borderRadius: 8,
                color: '#8892b0',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              🔑 Change API Key
            </button>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/consumers" element={<Consumers />} />
            <Route path="/consumers/:id" element={<ConsumerDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

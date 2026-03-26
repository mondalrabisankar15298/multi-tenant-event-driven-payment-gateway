import { NavLink, Outlet } from 'react-router-dom'
import MerchantSelector from './MerchantSelector'

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          Merchant <span>Dashboard</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            📊 Overview
          </NavLink>
          <NavLink to="/payments" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            💳 Payments
          </NavLink>
          <NavLink to="/refunds" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            ↩️ Refunds
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            👤 Customers
          </NavLink>
        </nav>
      </aside>
      <div className="main-content">
        <div className="top-bar">
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Merchant Dashboard</div>
          <MerchantSelector />
        </div>
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

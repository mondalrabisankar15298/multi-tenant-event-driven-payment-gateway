const BASE_URL = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Merchants
  getMerchants: () => request('/merchants'),
  createMerchant: (data) => request('/merchants', { method: 'POST', body: JSON.stringify(data) }),
  getMerchant: (id) => request(`/merchants/${id}`),

  // Customers
  getCustomers: (mid) => request(`/${mid}/customers`),
  createCustomer: (mid, data) => request(`/${mid}/customers`, { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (mid, id, data) => request(`/${mid}/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (mid, id) => request(`/${mid}/customers/${id}`, { method: 'DELETE' }),

  // Payments
  getPayments: (mid) => request(`/${mid}/payments`),
  createPayment: (mid, data) => request(`/${mid}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  authorizePayment: (mid, id) => request(`/${mid}/payments/${id}/authorize`, { method: 'POST' }),
  capturePayment: (mid, id) => request(`/${mid}/payments/${id}/capture`, { method: 'POST' }),
  failPayment: (mid, id) => request(`/${mid}/payments/${id}/fail`, { method: 'POST' }),

  // Refunds
  createRefund: (mid, payId, data) => request(`/${mid}/payments/${payId}/refund`, { method: 'POST', body: JSON.stringify(data) }),
  processRefund: (mid, refId) => request(`/${mid}/refunds/${refId}/process`, { method: 'POST' }),
  getRefunds: (mid) => request(`/${mid}/refunds`),

  // Events
  getEvents: (status) => request(`/events${status ? `?status=${status}` : ''}`),
}

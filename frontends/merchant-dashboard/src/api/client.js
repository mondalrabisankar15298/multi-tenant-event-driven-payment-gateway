const BASE_URL = '/api'

async function request(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export const api = {
  getMerchants: () => request('/merchants'),
  getPayments: (mid, params = '') => request(`/${mid}/payments${params}`),
  getPayment: (mid, id) => request(`/${mid}/payments/${id}`),
  getRefunds: (mid) => request(`/${mid}/refunds`),
  getCustomers: (mid) => request(`/${mid}/customers`),
  getCustomer: (mid, id) => request(`/${mid}/customers/${id}`),
  getSummary: (mid) => request(`/${mid}/analytics/summary`),
  getDaily: (mid, days = 30) => request(`/${mid}/analytics/daily?days=${days}`),
  getMethods: (mid) => request(`/${mid}/analytics/methods`),
}

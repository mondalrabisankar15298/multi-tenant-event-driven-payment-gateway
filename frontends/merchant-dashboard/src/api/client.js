const BASE_URL = '/api'
let _apiKey = null

async function request(path, options = {}) {
  const { signal, ...rest } = options;
  const headers = { 'Content-Type': 'application/json', ...rest.headers }
  
  if (_apiKey) {
    headers['X-API-Key'] = _apiKey
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    signal,
    ...rest,
  })
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export const api = {
  setApiKey: (key) => { _apiKey = key },
  getMerchants: (opts) => request('/merchants', opts),
  getPayments: (muid, params = '', opts) => request(`/${muid}/payments${params}`, opts),
  getPayment: (muid, id, opts) => request(`/${muid}/payments/${id}`, opts),
  getRefunds: (muid, params = '', opts) => request(`/${muid}/refunds${params}`, opts),
  getCustomers: (muid, params = '', opts) => request(`/${muid}/customers${params}`, opts),
  getCustomer: (muid, id, opts) => request(`/${muid}/customers/${id}`, opts),
  updateCustomer: (muid, id, data, opts) => request(`/${muid}/customers/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  updatePayment: (muid, id, data, opts) => request(`/${muid}/payments/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  getSummary: (muid, opts) => request(`/${muid}/analytics/summary`, opts),
  getDaily: (muid, days = 30, opts) => request(`/${muid}/analytics/daily?days=${days}`, opts),
  getMethods: (muid, opts) => request(`/${muid}/analytics/methods`, opts),
}

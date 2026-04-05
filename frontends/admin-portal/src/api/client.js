const BASE_URL = '/api'
let globalApiKey = null;

export const setApiKey = (key) => { globalApiKey = key; }

async function request(path, options = {}) {
  const { signal, ...rest } = options;
  const headers = { 'Content-Type': 'application/json', ...rest.headers };
  if (globalApiKey) {
    headers['X-API-Key'] = globalApiKey;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    signal,
    ...rest,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getMerchants: (params = {}, opts) => {
    const qs = Object.entries({ page: 1, limit: 25, ...params })
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return request(`/merchants${qs ? `?${qs}` : ''}`, opts)
  },
  createMerchant: (data, opts) => request('/merchants', { method: 'POST', body: JSON.stringify(data), ...opts }),
  getMerchant: (uuid, opts) => request(`/merchants/${uuid}`, opts),
  updateMerchant: (uuid, data, opts) => request(`/merchants/${uuid}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  getMerchantCredentials: (uuid, opts) => request(`/admin/merchants/${uuid}/credentials`, opts),

  getCustomers: (muid, params = {}, opts) => {
    const qs = Object.entries({ page: 1, limit: 25, ...params })
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return request(`/${muid}/customers${qs ? `?${qs}` : ''}`, opts)
  },
  createCustomer: (muid, data, opts) => request(`/${muid}/customers`, { method: 'POST', body: JSON.stringify(data), ...opts }),
  updateCustomer: (muid, id, data, opts) => request(`/${muid}/customers/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  deleteCustomer: (muid, id, opts) => request(`/${muid}/customers/${id}`, { method: 'DELETE', ...opts }),

  getPayments: (muid, params = {}, opts) => {
    const qs = Object.entries({ page: 1, limit: 25, ...params })
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return request(`/${muid}/payments${qs ? `?${qs}` : ''}`, opts)
  },
  createPayment: (muid, data, opts) => request(`/${muid}/payments`, { method: 'POST', body: JSON.stringify(data), ...opts }),
  updatePayment: (muid, id, data, opts) => request(`/${muid}/payments/${id}`, { method: 'PUT', body: JSON.stringify(data), ...opts }),
  authorizePayment: (muid, id, opts) => request(`/${muid}/payments/${id}/authorize`, { method: 'POST', ...opts }),
  capturePayment: (muid, id, opts) => request(`/${muid}/payments/${id}/capture`, { method: 'POST', ...opts }),
  failPayment: (muid, id, opts) => request(`/${muid}/payments/${id}/fail`, { method: 'POST', ...opts }),

  createRefund: (muid, payId, data, opts) => request(`/${muid}/payments/${payId}/refund`, { method: 'POST', body: JSON.stringify(data), ...opts }),
  processRefund: (muid, refId, opts) => request(`/${muid}/refunds/${refId}/process`, { method: 'POST', ...opts }),
  getRefunds: (muid, params = {}, opts) => {
    const qs = Object.entries({ page: 1, limit: 25, ...params })
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return request(`/${muid}/refunds${qs ? `?${qs}` : ''}`, opts)
  },

  getEvents: (params = {}, opts) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return request(`/events${qs ? `?${qs}` : ''}`, opts)
  },
}

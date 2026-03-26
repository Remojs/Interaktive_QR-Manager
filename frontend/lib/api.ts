const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.interaqr.online'

export interface QR {
  id: number
  name: string
  destination_url: string
  group_id: number | null
  locked: number
  created_at: string
}

export interface Group {
  id: number
  name: string
  created_at: string
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // QRs
  getQrs: () =>
    req<QR[]>('/api/qrs'),
  createQr: (name: string, destination_url: string, group_id?: number | null) =>
    req<QR>('/api/qrs', { method: 'POST', body: JSON.stringify({ name, destination_url, group_id }) }),
  updateQr: (id: number, destination_url: string) =>
    req<QR>(`/api/qrs/${id}`, { method: 'PUT', body: JSON.stringify({ destination_url }) }),
  assignGroup: (id: number, group_id: number | null) =>
    req<QR>(`/api/qrs/${id}/group`, { method: 'PATCH', body: JSON.stringify({ group_id }) }),
  toggleLock: (id: number) =>
    req<QR>(`/api/qrs/${id}/lock`, { method: 'PATCH' }),
  deleteQr: (id: number) =>
    req<{ message: string }>(`/api/qrs/${id}`, { method: 'DELETE' }),
  qrImageUrl: (id: number) => `${API_BASE}/api/qrs/${id}/image`,

  // Groups
  getGroups: () =>
    req<Group[]>('/api/groups'),
  createGroup: (name: string) =>
    req<Group>('/api/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteGroup: (id: number) =>
    req<{ message: string }>(`/api/groups/${id}`, { method: 'DELETE' }),
}

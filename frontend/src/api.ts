const BASE = import.meta.env.VITE_API_URL as string

export type User = { id: number; fullName: string; email: string; role: 'Employee' | 'HrAdmin'; isActive: boolean }
export type LeaveType = { id: number; name: string }
export type Leave = {
  id: number; userId: number; userName: string; leaveTypeId: number; leaveType: string
  startDate: string; endDate: string; businessDays: number; description?: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'; rejectionReason?: string
}

export const getToken = () => localStorage.getItem('token')
export const setToken = (t: string | null) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'))

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error ?? (res.status === 403 ? 'Yetkiniz yok.' : `Hata (${res.status})`))
  return data as T
}

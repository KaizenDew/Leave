import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Leave, type User } from './api'
import { StatusBadge } from './employee'

function RequestTable({ items }: { items: Leave[] }) {
  return (
    <table>
      <thead><tr><th>Çalışan</th><th>Tür</th><th>Başlangıç</th><th>Bitiş</th><th>İş Günü</th><th>Durum</th><th></th></tr></thead>
      <tbody>
        {items.map(i => (
          <tr key={i.id}>
            <td>{i.userName}</td><td>{i.leaveType}</td><td>{i.startDate}</td><td>{i.endDate}</td><td>{i.businessDays}</td>
            <td><StatusBadge s={i.status} /></td>
            <td><Link to={`/admin/requests/${i.id}`}>Detay</Link></td>
          </tr>
        ))}
        {items.length === 0 && <tr><td colSpan={7}>Kayıt yok.</td></tr>}
      </tbody>
    </table>
  )
}

export function AdminDashboard() {
  const [all, setAll] = useState<Leave[]>([])
  const [error, setError] = useState('')
  useEffect(() => { api<Leave[]>('/admin/requests').then(setAll).catch(e => setError(e.message)) }, [])
  const count = (s: string) => all.filter(i => i.status === s).length
  return (
    <>
      <h2>Admin Dashboard</h2>
      {error && <p className="err">{error}</p>}
      <div className="stats">
        <div className="card">Bekleyen: <b>{count('Pending')}</b></div>
        <div className="card">Onaylanan: <b>{count('Approved')}</b></div>
        <div className="card">Reddedilen: <b>{count('Rejected')}</b></div>
        <div className="card">Toplam: <b>{all.length}</b></div>
      </div>
      <h3>Bekleyen Talepler</h3>
      <RequestTable items={all.filter(i => i.status === 'Pending')} />
    </>
  )
}

export function AdminRequests() {
  const [items, setItems] = useState<Leave[]>([])
  const [status, setStatus] = useState('')
  useEffect(() => { api<Leave[]>('/admin/requests' + (status ? `?status=${status}` : '')).then(setItems) }, [status])
  return (
    <>
      <h2>Tüm Talepler</h2>
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Hepsi</option>
        {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
      </select>
      <RequestTable items={items} />
    </>
  )
}

export function AdminRequestDetail() {
  const { id } = useParams()
  const [r, setR] = useState<Leave | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const load = () => api<Leave>(`/admin/requests/${id}`).then(setR).catch(e => setError(e.message))
  useEffect(() => { load() }, [id])
  async function act(kind: 'approve' | 'reject') {
    setError('')
    try { await api(`/admin/requests/${id}/${kind}`, 'POST', kind === 'reject' ? { reason } : undefined); load() }
    catch (e: any) { setError(e.message) }
  }
  if (!r) return <p>{error || 'Yükleniyor...'}</p>
  return (
    <div className="card">
      <h2>Talep #{r.id}</h2>
      <p>Çalışan: <b>{r.userName}</b></p>
      <p>Tür: {r.leaveType}</p>
      <p>Tarih: {r.startDate} → {r.endDate} ({r.businessDays} iş günü)</p>
      <p>Açıklama: {r.description || '-'}</p>
      <p>Durum: <StatusBadge s={r.status} /></p>
      {r.rejectionReason && <p>Red gerekçesi: {r.rejectionReason}</p>}
      {error && <p className="err">{error}</p>}
      {r.status === 'Pending' && (
        <>
          <button onClick={() => act('approve')}>Onayla</button>
          <hr />
          <textarea placeholder="Red gerekçesi" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="danger" onClick={() => act('reject')}>Reddet</button>
        </>
      )}
      <p><Link to="/admin/requests">← Listeye dön</Link></p>
    </div>
  )
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: 'Employee' })
  const [error, setError] = useState('')
  const load = () => api<User[]>('/admin/users').then(setUsers)
  useEffect(() => { load() }, [])
  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try { await api('/admin/users', 'POST', f); setF({ fullName: '', email: '', password: '', role: 'Employee' }); load() }
    catch (err: any) { setError(err.message) }
  }
  return (
    <>
      <h2>Kullanıcılar</h2>
      <table>
        <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th></tr></thead>
        <tbody>{users.map(u => <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td></tr>)}</tbody>
      </table>
      <form className="card" onSubmit={create}>
        <h3>Yeni Kullanıcı</h3>
        {error && <p className="err">{error}</p>}
        <input placeholder="Ad Soyad" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} />
        <input placeholder="E-posta" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input placeholder="Şifre (min 6)" type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
        <select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
          <option>Employee</option><option>HrAdmin</option>
        </select>
        <button>Oluştur</button>
      </form>
    </>
  )
}

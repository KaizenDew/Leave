import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Leave, type LeaveType } from './api'

export function StatusBadge({ s }: { s: string }) {
  return <span className={'badge ' + s}>{s}</span>
}

export function EmployeeDashboard() {
  const [items, setItems] = useState<Leave[]>([])
  const [error, setError] = useState('')
  const load = () => api<Leave[]>('/my/requests/').then(setItems).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  const count = (s: string) => items.filter(i => i.status === s).length
  async function cancel(id: number) {
    if (!confirm('Talep iptal edilsin mi?')) return
    try { await api(`/my/requests/${id}/cancel`, 'POST'); load() } catch (e: any) { setError(e.message) }
  }
  return (
    <>
      <h2>Dashboard</h2>
      <div className="stats">
        <div className="card">Bekleyen: <b>{count('Pending')}</b></div>
        <div className="card">Onaylanan: <b>{count('Approved')}</b></div>
        <div className="card">Reddedilen: <b>{count('Rejected')}</b></div>
      </div>
      <p><Link to="/new"><button>+ Yeni İzin Talebi</button></Link></p>
      {error && <p className="err">{error}</p>}
      <table>
        <thead><tr><th>Tür</th><th>Başlangıç</th><th>Bitiş</th><th>İş Günü</th><th>Durum</th><th>Not</th><th></th></tr></thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td>{i.leaveType}</td><td>{i.startDate}</td><td>{i.endDate}</td><td>{i.businessDays}</td>
              <td><StatusBadge s={i.status} /></td>
              <td>{i.rejectionReason ?? i.description}</td>
              <td>
                {i.status === 'Pending' && (
                  <>
                    <Link to={`/edit/${i.id}`}>Düzenle</Link>{' '}
                    <button onClick={() => cancel(i.id)}>İptal</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7}>Henüz talep yok.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

export function LeaveForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const [types, setTypes] = useState<LeaveType[]>([])
  const [f, setF] = useState({ leaveTypeId: 1, startDate: '', endDate: '', description: '' })
  const [error, setError] = useState('')
  useEffect(() => {
    api<LeaveType[]>('/leave-types').then(setTypes)
    if (id) api<Leave[]>('/my/requests/').then(l => {
      const r = l.find(x => x.id === +id)
      if (r) setF({ leaveTypeId: r.leaveTypeId, startDate: r.startDate, endDate: r.endDate, description: r.description ?? '' })
    })
  }, [id])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await (id ? api(`/my/requests/${id}`, 'PUT', f) : api('/my/requests/', 'POST', f))
      nav('/')
    } catch (err: any) { setError(err.message) }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>{id ? 'Talebi Düzenle' : 'Yeni İzin Talebi'}</h2>
      {error && <p className="err">{error}</p>}
      <label>İzin Türü
        <select value={f.leaveTypeId} onChange={e => setF({ ...f, leaveTypeId: +e.target.value })}>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Başlangıç <input type="date" required value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></label>
      <label>Bitiş <input type="date" required value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} /></label>
      <label>Açıklama <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
      <button>Kaydet</button>
    </form>
  )
}

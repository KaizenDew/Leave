import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api, setToken, getToken, type User } from './api'
import { EmployeeDashboard, LeaveForm } from './employee'
import { AdminDashboard, AdminRequests, AdminRequestDetail, AdminUsers } from './admin'

const Auth = createContext<{ user: User | null; logout: () => void }>({ user: null, logout: () => {} })
export const useAuth = () => useContext(Auth)

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', 'POST', { email, password })
      setToken(r.token)
      onLogin(r.user)
      nav(r.user.role === 'HrAdmin' ? '/admin' : '/')
    } catch (err: any) { setError(err.message) }
  }
  return (
    <form className="card login" onSubmit={submit}>
      <h2>LeaveApp Giriş</h2>
      {error && <p className="err">{error}</p>}
      <input placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="Şifre" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button>Giriş</button>
    </form>
  )
}

function Guard({ role, children }: { role?: 'HrAdmin' | 'Employee'; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (role && user.role !== role) return <Navigate to={user.role === 'HrAdmin' ? '/admin' : '/'} />
  return <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api<User>('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  const logout = () => { setToken(null); setUser(null) }
  if (!ready) return <p>Yükleniyor...</p>
  return (
    <Auth.Provider value={{ user, logout }}>
      <BrowserRouter>
        {user && (
          <nav>
            <b>LeaveApp</b>
            {user.role === 'HrAdmin' ? (
              <>
                <Link to="/admin">Dashboard</Link>
                <Link to="/admin/requests">Tüm Talepler</Link>
                <Link to="/admin/users">Kullanıcılar</Link>
              </>
            ) : (
              <>
                <Link to="/">Dashboard</Link>
                <Link to="/new">Yeni Talep</Link>
              </>
            )}
            <span className="grow" />
            <span>{user.fullName} ({user.role})</span>
            <button onClick={logout}>Çıkış</button>
          </nav>
        )}
        <main>
          <Routes>
            <Route path="/login" element={user ? <Navigate to={user.role === 'HrAdmin' ? '/admin' : '/'} /> : <Login onLogin={setUser} />} />
            <Route path="/" element={<Guard role="Employee"><EmployeeDashboard /></Guard>} />
            <Route path="/new" element={<Guard role="Employee"><LeaveForm /></Guard>} />
            <Route path="/edit/:id" element={<Guard role="Employee"><LeaveForm /></Guard>} />
            <Route path="/admin" element={<Guard role="HrAdmin"><AdminDashboard /></Guard>} />
            <Route path="/admin/requests" element={<Guard role="HrAdmin"><AdminRequests /></Guard>} />
            <Route path="/admin/requests/:id" element={<Guard role="HrAdmin"><AdminRequestDetail /></Guard>} />
            <Route path="/admin/users" element={<Guard role="HrAdmin"><AdminUsers /></Guard>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </BrowserRouter>
    </Auth.Provider>
  )
}

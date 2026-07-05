import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '@/lib/api'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { mutateAsync: login, isPending } = useLogin()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(password)
      navigate('/admin')
    } catch {
      setError('Incorrect password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#070b12' }}>
      <div className="w-full max-w-sm p-8 rounded-xl border border-[#1e2740]" style={{ backgroundColor: '#0d1220' }}>
        <h1 className="text-2xl font-bold mb-6 text-center" style={{ fontFamily: 'Space Grotesk, system-ui' }}>
          Admin
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#1e2740] bg-transparent text-sm outline-none focus:border-[#00d4ff] transition-colors"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isPending || !password}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#00d4ff', color: '#070b12' }}
          >
            {isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

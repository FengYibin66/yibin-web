import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Home from './pages/Home'

const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))

function AdminGuard({ children }: { children: React.ReactNode }) {
  // Auth check is inside Dashboard itself; this just provides lazy boundary
  return <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>{children}</Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/zh" element={<Home lang="zh" />} />
      <Route path="/admin/login" element={<AdminGuard><AdminLogin /></AdminGuard>} />
      <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

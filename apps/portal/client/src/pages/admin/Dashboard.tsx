import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthCheck, useProfile, useAllProjects, useUpdateProfile, useCreateProject, useUpdateProject, useDeleteProject, useLogout, uploadFile } from '@/lib/api'
import type { Project } from '@/lib/api'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data: auth, isLoading: authLoading } = useAuthCheck()
  const { data: profile } = useProfile()
  const { data: projects = [] } = useAllProjects()
  const { mutateAsync: updateProfile } = useUpdateProfile()
  const { mutateAsync: createProject } = useCreateProject()
  const { mutateAsync: updateProject } = useUpdateProject()
  const { mutateAsync: deleteProject } = useDeleteProject()
  const { mutateAsync: logout } = useLogout()
  const [tab, setTab] = useState<'profile' | 'projects'>('profile')

  if (authLoading) return <div className="min-h-screen" style={{ backgroundColor: '#070b12' }} />
  if (!auth) { navigate('/admin/login'); return null }

  return (
    <div className="min-h-screen px-6 py-10" style={{ backgroundColor: '#070b12', color: '#f0f4ff' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, system-ui' }}>Dashboard</h1>
          <button
            onClick={async () => { await logout(); navigate('/admin/login') }}
            className="text-sm px-4 py-1.5 rounded border border-[#1e2740] hover:border-red-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[#1e2740]">
          {(['profile', 'projects'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-[#00d4ff] text-[#00d4ff]' : 'border-transparent'
              }`}
              style={{ color: tab === t ? '#00d4ff' : '#8b9bbc' }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'profile' && profile && (
          <ProfileForm profile={profile} onSave={updateProfile} />
        )}
        {tab === 'projects' && (
          <ProjectsManager
            projects={projects}
            onCreate={createProject}
            onUpdate={updateProject}
            onDelete={(id) => deleteProject(id)}
          />
        )}
      </div>
    </div>
  )
}

function ProfileForm({ profile, onSave }: { profile: any; onSave: (d: any) => Promise<any> }) {
  const [form, setForm] = useState({ ...profile })
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let avatarPath = form.avatarPath
      if (avatarFile) avatarPath = await uploadFile(avatarFile)
      await onSave({ ...form, avatarPath })
    } finally {
      setSaving(false)
    }
  }

  const field = (key: string, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-xs mb-1" style={{ color: '#8b9bbc' }}>{label}</label>
      <input
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-[#1e2740] bg-transparent text-sm outline-none focus:border-[#00d4ff] transition-colors"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b9bbc' }}>Avatar</label>
        <div className="flex items-center gap-4">
          {form.avatarPath && (
            <img src={avatarFile ? URL.createObjectURL(avatarFile) : form.avatarPath} className="w-16 h-16 rounded-full object-cover" />
          )}
          <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="text-sm" style={{ color: '#8b9bbc' }} />
        </div>
      </div>
      {field('nameEn', 'Name (EN)')}
      {field('nameZh', 'Name (ZH)')}
      {field('bioEn', 'Bio (EN)')}
      {field('bioZh', 'Bio (ZH)')}
      {field('github', 'GitHub URL')}
      {field('linkedin', 'LinkedIn URL')}
      {field('email', 'Email', 'email')}
      <button type="submit" disabled={saving}
        className="px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        style={{ backgroundColor: '#00d4ff', color: '#070b12' }}>
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}

function ProjectsManager({ projects, onCreate, onUpdate, onDelete }: {
  projects: Project[]
  onCreate: (d: any) => Promise<any>
  onUpdate: (d: any) => Promise<any>
  onDelete: (id: number) => Promise<any>
}) {
  const [editing, setEditing] = useState<Project | null>(null)
  const [adding, setAdding] = useState(false)
  const blank = { nameEn: '', nameZh: '', descEn: '', descZh: '', techTags: '[]', screenshotPath: null, url: '', status: 'live', order: projects.length, visible: 1 }

  return (
    <div className="space-y-4">
      <button onClick={() => { setAdding(true); setEditing(null) }}
        className="text-sm px-4 py-2 rounded-lg border border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff11] transition-colors">
        + Add Project
      </button>

      {adding && (
        <ProjectForm
          initial={blank as any}
          onSave={async (d) => { await onCreate(d); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}

      {projects.map((p) => (
        <div key={p.id} className="p-4 rounded-xl border border-[#1e2740]" style={{ backgroundColor: '#0d1220' }}>
          {editing?.id === p.id ? (
            <ProjectForm
              initial={p}
              onSave={async (d) => { await onUpdate({ ...d, id: p.id }); setEditing(null) }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{p.nameEn}</p>
                <p className="text-sm mt-0.5" style={{ color: '#8b9bbc' }}>{p.descEn}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(p)} className="text-xs px-3 py-1 rounded border border-[#1e2740] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors">Edit</button>
                <button onClick={() => onDelete(p.id)} className="text-xs px-3 py-1 rounded border border-[#1e2740] hover:border-red-400 hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ProjectForm({ initial, onSave, onCancel }: { initial: Project; onSave: (d: any) => Promise<any>; onCancel: () => void }) {
  const [form, setForm] = useState({
    ...initial,
    techTags: (() => { try { return JSON.parse(initial.techTags ?? '[]') } catch { return [] } })(),
    visible: Boolean(initial.visible),
  })
  const [saving, setSaving] = useState(false)
  const [screenshot, setScreenshot] = useState<File | null>(null)

  const f = (key: string, label: string) => (
    <div key={key}>
      <label className="block text-xs mb-1" style={{ color: '#8b9bbc' }}>{label}</label>
      <input value={(form as any)[key] ?? ''} onChange={(e) => setForm((s: any) => ({ ...s, [key]: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-[#1e2740] bg-transparent text-sm outline-none focus:border-[#00d4ff] transition-colors" />
    </div>
  )

  async function handleSave() {
    setSaving(true)
    try {
      let screenshotPath = form.screenshotPath
      if (screenshot) screenshotPath = await uploadFile(screenshot)
      await onSave({ ...form, techTags: form.techTags, screenshotPath, visible: form.visible })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 p-4 rounded-xl border border-[#00d4ff33]" style={{ backgroundColor: '#0d1220' }}>
      {f('nameEn', 'Name (EN)')} {f('nameZh', 'Name (ZH)')}
      {f('descEn', 'Desc (EN)')} {f('descZh', 'Desc (ZH)')}
      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b9bbc' }}>Tech Tags (comma-separated)</label>
        <input value={form.techTags.join(', ')} onChange={(e) => setForm((s: any) => ({ ...s, techTags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) }))}
          className="w-full px-3 py-2 rounded-lg border border-[#1e2740] bg-transparent text-sm outline-none focus:border-[#00d4ff] transition-colors" />
      </div>
      {f('url', 'URL')}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="status" value="live" checked={form.status === 'live'} onChange={() => setForm((s: any) => ({ ...s, status: 'live' }))} /> Live
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="status" value="dev" checked={form.status === 'dev'} onChange={() => setForm((s: any) => ({ ...s, status: 'dev' }))} /> In Dev
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
          <input type="checkbox" checked={form.visible} onChange={(e) => setForm((s: any) => ({ ...s, visible: e.target.checked }))} /> Visible
        </label>
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: '#8b9bbc' }}>Screenshot</label>
        <input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} className="text-sm" style={{ color: '#8b9bbc' }} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#00d4ff', color: '#070b12' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm border border-[#1e2740] hover:border-[#8b9bbc] transition-colors">Cancel</button>
      </div>
    </div>
  )
}

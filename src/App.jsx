import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Journal from './Journal'
import ChangePassword from './ChangePassword'
import Groups from './Groups'
import Logo from './Logo'

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { const t = localStorage.getItem('theme'); if (t) return t === 'dark' } catch {}
    return false // light by default; the toggle remembers your choice
  })
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])
  return [dark, setDark]
}

function ProfileMenu({ email, dark, setDark, onPassword, onGroups }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition hover:scale-105"
        style={{ background: 'var(--soft)', color: 'var(--pri)' }}>{(email || '?')[0].toUpperCase()}</button>

      {open && (
        <div className="menu">
          <div className="px-3 pb-2 pt-2">
            <div className="text-xs" style={{ color: 'var(--mute)' }}>Signed in as</div>
            <div className="truncate text-sm font-medium">{email}</div>
          </div>
          <div className="my-1 h-px" style={{ background: 'var(--line)' }} />

          <button className="menu-item" onClick={() => { setOpen(false); onGroups() }}>
            <span>👥 Groups</span>
          </button>
          <button className="menu-item" onClick={() => setDark(!dark)} role="switch" aria-checked={dark}>
            <span>{dark ? '🌙' : '☀️'} Dark mode</span>
            <span className={`switch ${dark ? 'on' : ''}`} />
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onPassword() }}>
            <span>🔑 Change password</span>
          </button>
          <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
          <button className="menu-item" style={{ color: 'var(--bad)' }} onClick={() => supabase.auth.signOut()}>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [dark, setDark] = useTheme()
  const [pwOpen, setPwOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupsReady, setGroupsReady] = useState(false)
  const [space, setSpace] = useState(() => {
    try { return localStorage.getItem('space') || 'personal' } catch { return 'personal' }
  })
  const uid = session?.user?.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadGroups = useCallback(async () => {
    if (!uid) return []
    const { data, error } = await supabase
      .from('group_members')
      .select('role, groups(id, name, invite_code, owner_id)')
      .eq('user_id', uid)
      .order('joined_at')
    if (error) { console.error(error); setGroupsReady(true); return [] }
    const list = (data || []).filter(r => r.groups).map(r => ({ ...r.groups, role: r.role }))
    setGroups(list)
    setGroupsReady(true)
    return list
  }, [uid])

  useEffect(() => { setGroupsReady(false); loadGroups() }, [loadGroups])

  const chooseSpace = id => {
    setSpace(id)
    try { localStorage.setItem('space', id) } catch {}
  }

  // after create / join / leave / delete: refresh and jump to the new group if there is one
  async function groupsChanged(newId) {
    const list = await loadGroups()
    if (newId && list.some(g => g.id === newId)) chooseSpace(newId)
    else if (!list.some(g => g.id === space)) chooseSpace('personal')
  }

  if (session === undefined) return <div className="p-10"><div className="skel mx-auto max-w-md" /></div>
  if (!session) return <Login dark={dark} setDark={setDark} />

  const activeGroup = groups.find(g => g.id === space) || null

  return (
    <>
      <header className="sticky top-0 z-10 border-b" style={{ background: 'var(--glass)', backdropFilter: 'blur(12px)', borderColor: 'var(--line)' }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div className="leading-tight">
              <div className="font-bold tracking-tight">Tastemark</div>
              <div className="text-xs" style={{ color: 'var(--mute)' }}>Remember every great bite</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
              className="ghost grid h-9 w-9 place-items-center rounded-full text-lg transition active:scale-90">
              <span key={String(dark)} className="fade inline-block">{dark ? '☀️' : '🌙'}</span>
            </button>
            <ProfileMenu email={session.user.email} dark={dark} setDark={setDark}
              onPassword={() => setPwOpen(true)} onGroups={() => setGroupsOpen(true)} />
          </div>
        </div>

        {/* Space switcher: Personal / each group */}
        <div className="mx-auto flex max-w-2xl items-center gap-2 overflow-x-auto px-4 pb-3">
          <button className={`chip shrink-0 whitespace-nowrap ${!activeGroup ? 'on' : ''}`} onClick={() => chooseSpace('personal')}>👤 Personal</button>
          {groups.map(g => (
            <button key={g.id} className={`chip shrink-0 whitespace-nowrap ${activeGroup?.id === g.id ? 'on' : ''}`}
              onClick={() => chooseSpace(g.id)}>👥 {g.name}</button>
          ))}
          <button className="chip shrink-0 whitespace-nowrap" onClick={() => setGroupsOpen(true)}>＋ Groups</button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        {groupsReady
          ? <Journal key={activeGroup?.id || 'personal'} me={uid} group={activeGroup} groups={groups} />
          : <div className="space-y-3"><div className="skel" /><div className="skel" /><div className="skel" /></div>}
      </main>

      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
      {groupsOpen && <Groups me={uid} groups={groups} onClose={() => setGroupsOpen(false)}
        onChanged={groupsChanged} onOpen={chooseSpace} />}
    </>
  )
}

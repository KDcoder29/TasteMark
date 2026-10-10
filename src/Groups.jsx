import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const fmt = c => (c ? c.slice(0, 4) + '-' + c.slice(4) : '')
const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
const tint = s => `hsl(${hue(s)} 38% 42%)`           // a calm, distinct color per group / person
const initial = s => ((s || '?').trim()[0] || '?').toUpperCase()

function Avatar({ text, color, size = 40, round = false }) {
  return (
    <span className="grid shrink-0 place-items-center font-bold text-white"
      style={{ width: size, height: size, background: color, borderRadius: round ? '50%' : 12, fontSize: size * 0.42 }}>{initial(text)}</span>
  )
}

export default function Groups({ me, groups, onClose, onChanged, onOpen }) {
  const [tab, setTab] = useState(groups.length ? 'mine' : 'create')   // 'mine' | 'create'
  const [selectedId, setSelectedId] = useState(null)                   // group opened in the detail view
  const [mode, setMode] = useState('new')                              // inside Create: 'new' | 'join'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [myName, setMyName] = useState('')
  const [editName, setEditName] = useState(false)
  const [members, setMembers] = useState([])
  const [names, setNames] = useState({})
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState('')

  async function loadPeople() {
    const [m, p] = await Promise.all([
      supabase.from('group_members').select('group_id, user_id, role'),
      supabase.from('profiles').select('id, display_name'),
    ])
    setMembers(m.data || [])
    const map = {}
    ;(p.data || []).forEach(r => { map[r.id] = r.display_name })
    setNames(map)
    setMyName(prev => prev || map[me] || '')
  }
  useEffect(() => { loadPeople() }, [groups])

  const say = (type, text) => setMsg({ type, text })
  const switchTab = t => { setTab(t); setSelectedId(null); say('', '') }
  const selected = groups.find(g => g.id === selectedId) || null

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return say('err', 'Give your group a name.')
    setBusy('create'); say('', '')
    const { data, error } = await supabase.rpc('create_group', { gname: name })
    setBusy('')
    if (error) return say('err', error.message)
    setName('')
    await onChanged(data)
    setTab('mine'); setSelectedId(null)
    say('ok', 'Group created. Open it to get the invite code.')
  }

  async function join(e) {
    e.preventDefault()
    if (!code.trim()) return say('err', 'Enter an invite code.')
    setBusy('join'); say('', '')
    const { data, error } = await supabase.rpc('join_group', { code })
    setBusy('')
    if (error) return say('err', error.message)
    setCode('')
    const already = groups.find(g => g.id === data)
    if (already) return say('info', `You're already in "${already.name}". Find it under Your groups.`)
    await onChanged(data)
    setTab('mine'); setSelectedId(null)
    say('ok', 'You joined the group.')
  }

  async function saveName(e) {
    e.preventDefault()
    if (!myName.trim()) return say('err', 'Name cannot be empty.')
    setBusy('name'); say('', '')
    const { error } = await supabase.from('profiles').update({ display_name: myName.trim() }).eq('id', me)
    setBusy('')
    if (error) return say('err', error.message)
    setEditName(false)
    say('ok', 'Name saved.')
    loadPeople()
  }

  async function leave(g) {
    if (!confirm(`Leave "${g.name}"? Your entries stay in the group for the others.`)) return
    const { error } = await supabase.from('group_members').delete().eq('group_id', g.id).eq('user_id', me)
    if (error) return say('err', error.message)
    setSelectedId(null)
    onChanged()
  }

  async function removeGroup(g) {
    if (!confirm(`Delete "${g.name}" for everyone? All entries in this group will be deleted permanently.`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) return say('err', error.message)
    setSelectedId(null)
    onChanged()
  }

  async function removeMember(g, uid) {
    if (!confirm(`Remove ${names[uid] || 'this member'} from "${g.name}"?`)) return
    const { error } = await supabase.from('group_members').delete().eq('group_id', g.id).eq('user_id', uid)
    if (error) return say('err', error.message)
    loadPeople()
  }

  async function regenerate(g) {
    if (!confirm(`Create a new invite code for "${g.name}"? The old code will stop working. Current members stay in the group.`)) return
    const { error } = await supabase.rpc('regenerate_invite', { gid: g.id })
    if (error) return say('err', error.message)
    await onChanged()
    say('ok', 'New invite code created. The old one no longer works.')
  }

  async function makeOwner(g, uid) {
    if (!confirm(`Make ${names[uid] || 'this member'} the owner of "${g.name}"? You will become a regular member, and you can then leave the group if you want.`)) return
    const { error } = await supabase.rpc('transfer_ownership', { gid: g.id, new_owner: uid })
    if (error) return say('err', error.message)
    await onChanged()
    loadPeople()
    say('ok', `${names[uid] || 'The member'} is now the owner.`)
  }

  async function copy(g) {
    try { await navigator.clipboard.writeText(fmt(g.invite_code)); setCopied(g.id); setTimeout(() => setCopied(''), 1500) }
    catch { say('err', 'Could not copy. Select the code and copy it manually.') }
  }

  const label = 'mb-1 block text-xs font-medium'
  const mute = { color: 'var(--mute)' }
  const tabs = [['mine', `Your groups${groups.length ? ` (${groups.length})` : ''}`], ['create', 'Create group']]

  return (
    <div className="fade fixed inset-0 z-30 overflow-y-auto" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet mx-auto my-6 w-[calc(100%-24px)] max-w-xl rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Groups</h2>
          <button type="button" onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full text-xl" style={mute}>×</button>
        </div>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: 'var(--head)' }} role="tablist">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
              className="rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={tab === k ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 3px #0f172a1f' } : mute}>{l}</button>
          ))}
        </div>

        {msg.text && (
          <p className="fade mb-4 rounded-lg px-3 py-2 text-sm"
            style={msg.type === 'ok' ? { background: 'var(--okbg)', color: 'var(--ok)' }
              : msg.type === 'info' ? { background: 'var(--soft)', color: 'var(--pri)' }
              : { background: 'var(--errbg)', color: 'var(--bad)' }}>{msg.text}</p>
        )}

        <div key={tab + (selected?.id || '')} className="fade min-h-[340px]">

          {/* ---------- TAB 1a: tiles ---------- */}
          {tab === 'mine' && !selected && (
            <div>
              {groups.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mb-2 text-4xl">👥</div>
                  <p className="font-semibold">No groups yet</p>
                  <p className="mb-4 mt-1 text-sm" style={mute}>Create one, or join with a friend's invite code.</p>
                  <button onClick={() => switchTab('create')} className="btn btn-pri">Create or join a group</button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g, i) => {
                    const list = members.filter(m => m.group_id === g.id)
                    const owner = g.role === 'owner'
                    const color = tint(g.id)
                    return (
                      <div key={g.id} className="rise overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                        style={{ borderColor: 'var(--line)', background: 'var(--surface)', animationDelay: `${i * 50}ms` }}>
                        <div style={{ height: 6, background: color }} />
                        <div className="p-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar text={g.name} color={color} size={44} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold leading-snug">{g.name}</div>
                              <span className={`pill ${owner ? '' : 'pill-ok'} mt-0.5`}>{owner ? 'Owner' : 'Member'}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {list.slice(0, 4).map(m => (
                                <span key={m.user_id} style={{ boxShadow: '0 0 0 2px var(--surface)', borderRadius: '50%' }}>
                                  <Avatar text={names[m.user_id]} color={tint(m.user_id)} size={26} round />
                                </span>
                              ))}
                              {list.length > 4 && (
                                <span className="grid place-items-center rounded-full text-[10px] font-semibold"
                                  style={{ width: 26, height: 26, background: 'var(--head)', color: 'var(--mute)', boxShadow: '0 0 0 2px var(--surface)' }}>+{list.length - 4}</span>
                              )}
                            </div>
                            <span className="text-xs" style={mute}>{list.length} member{list.length === 1 ? '' : 's'}</span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button onClick={() => { onOpen(g.id); onClose() }} className="btn btn-pri !py-2 !text-sm">Open</button>
                            <button onClick={() => { setSelectedId(g.id); say('', '') }} className="btn !py-2 !text-sm">Manage</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {groups.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--bg)' }}>
                  {editName ? (
                    <form onSubmit={saveName} className="flex gap-2">
                      <input autoFocus value={myName} maxLength={40} onChange={e => setMyName(e.target.value)} className="input !py-2" />
                      <button disabled={busy === 'name'} className="btn !py-2 shrink-0">{busy === 'name' ? '…' : 'Save'}</button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span style={mute}>Your name in groups: <b style={{ color: 'var(--ink)' }}>{myName || '…'}</b></span>
                      <button onClick={() => setEditName(true)} className="text-xs font-semibold" style={{ color: 'var(--pri)' }}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ---------- TAB 1b: one group's details ---------- */}
          {tab === 'mine' && selected && (() => {
            const g = selected
            const list = members.filter(m => m.group_id === g.id)
            const owner = g.role === 'owner'
            const color = tint(g.id)
            return (
              <div>
                <button onClick={() => setSelectedId(null)} className="mb-3 text-sm font-semibold" style={{ color: 'var(--pri)' }}>‹ All groups</button>

                <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: 'var(--head)', borderLeft: `6px solid ${color}` }}>
                  <Avatar text={g.name} color={color} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold leading-snug">{g.name}</div>
                    <div className="text-xs" style={mute}>{list.length} member{list.length === 1 ? '' : 's'} · you are {owner ? 'the owner' : 'a member'}</div>
                  </div>
                  <button onClick={() => { onOpen(g.id); onClose() }} className="btn btn-pri !py-2 !text-sm shrink-0">Open</button>
                </div>

                <div className="mt-4">
                  <label className={label} style={mute}>Invite code. Share it so friends can join.</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 select-all rounded-lg border px-3 py-2.5 text-center text-lg font-semibold tracking-widest"
                      style={{ borderColor: 'var(--line)', background: 'var(--dish)' }}>{fmt(g.invite_code)}</code>
                    <button onClick={() => copy(g)} className="btn !px-4 !py-2.5 !text-sm">{copied === g.id ? 'Copied' : 'Copy'}</button>
                  </div>
                  {owner && (
                    <button onClick={() => regenerate(g)} className="tbtn mt-2 text-xs font-semibold" style={{ color: 'var(--pri)' }}>
                      Code leaked? Create a new one
                    </button>
                  )}
                </div>

                <div className="mt-4 text-xs font-medium" style={mute}>Members</div>
                <ul className="mt-1">
                  {list.map(m => (
                    <li key={m.user_id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-2.5 text-sm">
                        <Avatar text={names[m.user_id]} color={tint(m.user_id)} size={30} round />
                        <span className="truncate">{names[m.user_id] || 'Member'}{m.user_id === me && ' (you)'}</span>
                        {m.role === 'owner' && <span className="pill">Owner</span>}
                      </span>
                      {owner && m.user_id !== me && (
                        <span className="flex shrink-0 gap-3">
                          <button onClick={() => makeOwner(g, m.user_id)} className="tbtn text-xs font-medium" style={{ color: 'var(--pri)' }}>Make owner</button>
                          <button onClick={() => removeMember(g, m.user_id)} className="tbtn text-xs font-medium" style={{ color: 'var(--bad)' }}>Remove</button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                  {owner
                    ? <button onClick={() => removeGroup(g)} className="tbtn text-sm font-medium" style={{ color: 'var(--bad)' }}>Delete group and its entries</button>
                    : <button onClick={() => leave(g)} className="tbtn text-sm font-medium" style={{ color: 'var(--bad)' }}>Leave group</button>}
                </div>
              </div>
            )
          })()}

          {/* ---------- TAB 2: create / join ---------- */}
          {tab === 'create' && (
            <div>
              <div className="mb-4 flex gap-2">
                <button className={`chip ${mode === 'new' ? 'on' : ''}`} onClick={() => { setMode('new'); say('', '') }}>New group</button>
                <button className={`chip ${mode === 'join' ? 'on' : ''}`} onClick={() => { setMode('join'); say('', '') }}>Join with a code</button>
              </div>

              {mode === 'new' ? (
                <form onSubmit={create}>
                  <label className={label} style={mute}>Group name</label>
                  <input autoFocus placeholder="e.g. Friends, Family, Office" maxLength={60} value={name}
                    onChange={e => setName(e.target.value)} className="input mb-2" />
                  <p className="mb-4 text-xs" style={mute}>You become the owner and get an invite code to share. Entries in a group are visible only to its members.</p>
                  <button disabled={busy === 'create'} className="btn btn-pri w-full">{busy === 'create' ? 'Creating…' : 'Create group'}</button>
                </form>
              ) : (
                <form onSubmit={join}>
                  <label className={label} style={mute}>Invite code</label>
                  <input autoFocus placeholder="XXXX-XXXX" value={code} onChange={e => setCode(e.target.value)}
                    className="input mb-2 text-center text-base uppercase tracking-widest" />
                  <p className="mb-4 text-xs" style={mute}>Ask a group member for their 8-character invite code. You'll see the group's shared entries right after joining.</p>
                  <button disabled={busy === 'join'} className="btn btn-pri w-full">{busy === 'join' ? 'Joining…' : 'Join group'}</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

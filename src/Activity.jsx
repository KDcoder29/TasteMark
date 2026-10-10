import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { Avatar, tint, timeAgo } from './shared'

const ICON = { created: '🎉', joined: '👋', dish_added: '🍽️', rated: '⭐', commented: '💬', wish: '🔖', went: '✅', owner: '👑' }

const B = ({ children }) => <b style={{ color: 'var(--ink)' }}>{children}</b>

function sentence(a, who) {
  switch (a.kind) {
    case 'created': return <><B>{who}</B> created the group</>
    case 'joined': return <><B>{who}</B> joined the group</>
    case 'dish_added': return <><B>{who}</B> added <B>{a.dish_name}</B> at <B>{a.place_name}</B></>
    case 'rated': return <><B>{who}</B> rated <B>{a.dish_name}</B> {'★'.repeat(+a.detail || 0)} at <B>{a.place_name}</B></>
    case 'commented': return <><B>{who}</B> commented on <B>{a.dish_name}</B>: “{a.detail}”</>
    case 'wish': return <><B>{who}</B> wants to try <B>{a.place_name}</B></>
    case 'went': return <><B>{who}</B> visited <B>{a.place_name}</B> from the wishlist</>
    case 'owner': return <><B>{who}</B> is now the group owner</>
    default: return <><B>{who}</B> did something</>
  }
}

export default function Activity({ me, group, names }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data, error: err } = await supabase.from('group_activity').select('*')
      .eq('group_id', group.id).order('created_at', { ascending: false }).limit(60)
    if (err) { setError(err.message); setRows([]); return }
    setError(''); setRows(data)
  }
  useEffect(() => { load() }, [group.id])

  const mute = { color: 'var(--mute)' }
  const who = uid => (uid === me ? 'You' : names[uid] || 'Someone')

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm" style={mute}>Recent activity in <b style={{ color: 'var(--ink)' }}>{group.name}</b></p>
        <button onClick={load} className="chip !py-1">Refresh</button>
      </div>

      {error && <p className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}

      {rows === null ? (
        <div className="space-y-3"><div className="skel !h-14" /><div className="skel !h-14" /><div className="skel !h-14" /></div>
      ) : rows.length === 0 ? (
        <div className="rise py-12 text-center">
          <div className="mb-3 text-5xl">📰</div>
          <p className="font-semibold">No activity yet</p>
          <p className="mt-1 text-sm" style={mute}>Dishes, ratings and comments from your group will show up here.</p>
        </div>
      ) : (
        <ul className="rounded-2xl border" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          {rows.map((a, i) => (
            <li key={a.id} className="flex items-start gap-3 px-3.5 py-3" style={i ? { borderTop: '1px solid var(--line)' } : null}>
              <div className="relative">
                <Avatar text={who(a.user_id)} color={tint(a.user_id || a.id)} size={34} />
                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full text-[10px]"
                  style={{ background: 'var(--surface)', boxShadow: '0 0 0 1px var(--line)' }}>{ICON[a.kind] || '•'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm" style={mute}>{sentence(a, who(a.user_id))}</p>
                <p className="mt-0.5 text-xs" style={mute}>{timeAgo(a.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useState } from 'react'
import { supabase } from './supabase'
import { CATEGORIES } from './shared'

// "Want to try" list. In a group everybody sees it; in Personal only you do.
export default function Wishlist({ me, group, items, names, isOwner, onChanged, onWent }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', city: '', area: '', note: '' })
  const [cats, setCats] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mute = { color: 'var(--mute)' }
  const label = 'mb-1 block text-xs font-medium'

  const setField = k => e => setF({ ...f, [k]: e.target.value })
  const toggleCat = c => setCats(cats.includes(c) ? cats.filter(x => x !== c) : [...cats, c])

  async function add(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Enter the place name.')
    setBusy(true); setError('')
    const { error: err } = await supabase.from('wishlist').insert({
      name: f.name.trim(), city: f.city.trim() || null, area: f.area.trim() || null,
      note: f.note.trim() || null, categories: cats, group_id: group?.id ?? null,
    })
    setBusy(false)
    if (err) return setError(err.message)
    setF({ name: '', city: '', area: '', note: '' }); setCats([]); setOpen(false)
    onChanged()
  }

  async function remove(item) {
    if (!confirm(`Remove "${item.name}" from the wishlist?`)) return
    const { error: err } = await supabase.from('wishlist').delete().eq('id', item.id)
    if (err) return alert(err.message)
    onChanged()
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn mb-4 w-full !border-dashed" style={{ color: 'var(--pri)' }}>＋ Add a place to try</button>
      ) : (
        <form onSubmit={add} className="sheet mb-4 rounded-2xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Place to try</h3>
            <button type="button" onClick={() => { setOpen(false); setError('') }} className="ghost grid h-7 w-7 place-items-center rounded-full text-lg" style={mute}>×</button>
          </div>
          <label className={label} style={mute}>Place name *</label>
          <input autoFocus value={f.name} onChange={setField('name')} placeholder="e.g. Brew on the Rocks" className="input mb-2" />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div><label className={label} style={mute}>City</label><input value={f.city} onChange={setField('city')} placeholder="Vadodara" className="input" /></div>
            <div><label className={label} style={mute}>Area</label><input value={f.area} onChange={setField('area')} placeholder="Alkapuri" className="input" /></div>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            {CATEGORIES.map(c => <button key={c} type="button" onClick={() => toggleCat(c)} className={`chip ${cats.includes(c) ? 'on' : ''}`}>{c}</button>)}
          </div>
          <input value={f.note} onChange={setField('note')} placeholder="Why? (optional, e.g. Riya recommended it)" className="input mb-3" />
          {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
          <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Adding…' : 'Add to wishlist'}</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rise py-12 text-center">
          <div className="mb-3 text-5xl">🔖</div>
          <p className="font-semibold">Nothing to try yet</p>
          <p className="mt-1 text-sm" style={mute}>Save places you want to visit. When you go, tap "We went" to turn one into a journal entry.</p>
        </div>
      ) : items.map((w, i) => (
        <div key={w.id} className="rise mb-3 rounded-2xl border p-3.5" style={{ borderColor: 'var(--line)', background: 'var(--surface)', animationDelay: `${Math.min(i, 8) * 40}ms` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold leading-snug">{w.name}</div>
              {(w.area || w.city) && <div className="text-xs" style={mute}>📍 {[w.area, w.city].filter(Boolean).join(', ')}</div>}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {(w.categories || []).map(c => (
                <span key={c} className="rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ borderColor: 'var(--line)', color: 'var(--mute)' }}>{c}</span>
              ))}
            </div>
          </div>
          {w.note && <p className="mt-2 text-sm" style={mute}>{w.note}</p>}
          {group && <p className="mt-1 text-xs" style={mute}>Added by {w.user_id === me ? 'you' : (names[w.user_id] || 'a member')}</p>}
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => onWent(w)} className="btn btn-pri !py-2 !text-sm">We went ✓</button>
            {(w.user_id === me || isOwner) && (
              <button onClick={() => remove(w)} className="text-sm font-medium" style={{ color: 'var(--bad)' }}>Remove</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

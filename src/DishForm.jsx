import { useState } from 'react'
import { supabase } from './supabase'
import { addDishWithRating } from './groupApi'
import { norm } from './shared'

// Add a dish (with my rating) to a place that is already in the group.
// If the dish already exists there, my rating is added to it.
export default function DishForm({ me, place, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', price: '', rating: 0, order_again: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mute = { color: 'var(--mute)' }
  const label = 'mb-1 block text-xs font-medium'

  const existing = (place.dishes || []).find(d => norm(d.name) === norm(f.name))
  const set = (k, v) => setF({ ...f, [k]: v })

  async function save(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Enter the dish name.')
    if (!existing && f.price === '') return setError('Enter the price.')
    if (!f.rating) return setError('Give the dish a star rating.')
    setBusy(true); setError('')
    try {
      // re-read the place's dishes so a dish a friend just added is not duplicated
      const { data, error: e1 } = await supabase.from('dishes').select('id, name, dish_ratings(user_id)').eq('place_id', place.id)
      if (e1) throw e1
      await addDishWithRating(place.id, f, me, data, { overwrite: true })
      onSaved()
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="fade fixed inset-0 z-30 grid place-items-center overflow-y-auto p-4" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={save} className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a dish</h2>
          <button type="button" onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full text-xl" style={mute}>×</button>
        </div>
        <p className="mb-4 text-sm" style={mute}>at <b style={{ color: 'var(--ink)' }}>{place.name}</b></p>

        <label className={label} style={mute}>Dish name *</label>
        <input autoFocus list="dishnames" value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Hazelnut cold coffee" className="input mb-1" />
        <datalist id="dishnames">{(place.dishes || []).map(d => <option key={d.id} value={d.name} />)}</datalist>
        {existing
          ? <p className="mb-3 text-xs" style={{ color: 'var(--ok)' }}>This dish is already here, so your rating will be added to it.</p>
          : <div className="mb-3" />}

        {!existing && (
          <>
            <label className={label} style={mute}>Price ₹ *</label>
            <input type="number" min="0" inputMode="numeric" value={f.price} onChange={e => set('price', e.target.value)} placeholder="200" className="input mb-3" />
          </>
        )}

        <label className={label} style={mute}>Your rating *</label>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => set('rating', f.rating === n ? 0 : n)}
                className="px-0.5 text-2xl transition hover:scale-125 active:scale-90"
                style={{ color: n <= f.rating ? 'var(--star)' : 'var(--star-off)' }}>★</button>
            ))}
          </div>
          <div className="flex gap-1">
            {['yes', 'maybe', 'no'].map(v => (
              <button key={v} type="button" onClick={() => set('order_again', f.order_again === v ? '' : v)}
                className={`chip !px-2.5 !py-1 capitalize ${f.order_again === v ? 'on' : ''}`}>{v}</button>
            ))}
          </div>
        </div>

        <input value={f.note} onChange={e => set('note', e.target.value)} placeholder="Your take (optional)" className="input mb-4" />

        {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
        <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Saving…' : existing ? 'Add my rating' : 'Add dish'}</button>
      </form>
    </div>
  )
}

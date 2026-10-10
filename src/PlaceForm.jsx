import { useState } from 'react'
import { supabase } from './supabase'
import { CATEGORIES } from './shared'
import { findGroupPlace, addDishWithRating } from './groupApi'

const blankDish = () => ({ name: '', price: '', rating: 0, order_again: '', note: '' })

// place      = existing place being edited (null when adding)
// prefill    = starting values when adding from the wishlist; wishId = that wishlist item
// groups     = my groups; defaultGroupId = the open space ('' = Personal)
export default function PlaceForm({ me, place, cities, groups = [], defaultGroupId = '', prefill, wishId, onClose, onSaved }) {
  const editing = !!place
  const editingGroup = editing && !!place.group_id
  const start = place || prefill || {}

  const [f, setF] = useState({
    name: start.name || '', city: start.city || '', area: start.area || '', directions: start.directions || '',
  })
  const [dishes, setDishes] = useState(
    editing && place.dishes?.length
      ? place.dishes.map(d => ({ name: d.name, price: d.price ?? '', rating: d.rating || 0, order_again: d.order_again || '', note: d.note || '' }))
      : [blankDish()])
  const [cats, setCats] = useState(start.categories || [])
  const [target, setTarget] = useState(defaultGroupId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toggleCat = c => setCats(cats.includes(c) ? cats.filter(x => x !== c) : [...cats, c])

  const setField = k => e => setF({ ...f, [k]: e.target.value })
  const setDish = (i, k, v) => setDishes(dishes.map((d, j) => (j === i ? { ...d, [k]: v } : d)))

  const validate = () => {
    if (!f.name.trim() || !f.city.trim() || !f.area.trim()) return 'Please fill in place name, city and area.'
    if (!cats.length) return 'Pick at least one category.'
    if (editingGroup) return ''
    for (const d of dishes) {
      if (!d.name.trim() || d.price === '') return 'Every dish needs a name and a price.'
      if (!d.rating) return 'Please give every dish a star rating.'
    }
    return ''
  }

  async function save(e) {
    e.preventDefault()
    const bad = validate()
    setError(bad)
    if (bad) return
    setBusy(true)
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]))
      clean.categories = cats

      if (editing) {
        const { error: e1 } = await supabase.from('places').update(clean).eq('id', place.id)
        if (e1) throw e1
        if (!editingGroup) {                       // personal place: dishes are edited here
          await supabase.from('dishes').delete().eq('place_id', place.id)
          const rows = dishes.filter(d => d.name.trim()).map(d => ({
            place_id: place.id, name: d.name.trim(), price: d.price === '' ? null : +d.price,
            rating: d.rating || null, order_again: d.order_again || null, note: d.note.trim() || null,
          }))
          if (rows.length) { const { error: e2 } = await supabase.from('dishes').insert(rows); if (e2) throw e2 }
        }
      } else if (target) {
        // GROUP: reuse the group's card for this place if it already exists
        let existing = await findGroupPlace(target, f.name, f.city)
        let placeId = existing?.id
        let created = false
        if (!placeId) {
          const { data, error: e1 } = await supabase.from('places').insert({ ...clean, group_id: target }).select('id').single()
          if (e1) throw e1
          placeId = data.id; created = true
        }
        const known = existing ? [...existing.dishes] : []
        let saved = 0
        try {
          for (const d of dishes.filter(x => x.name.trim())) {
            const r = await addDishWithRating(placeId, d, me, known, { overwrite: true })
            saved++
            if (!known.some(k => k.id === r.dishId)) known.push({ id: r.dishId, name: d.name, dish_ratings: [{ user_id: me }] })
          }
        } catch (err) {
          if (created && saved === 0) await supabase.from('places').delete().eq('id', placeId)  // no empty place left behind
          throw err
        }
      } else {
        // PERSONAL
        const { data, error: e1 } = await supabase.from('places').insert({ ...clean, group_id: null }).select('id').single()
        if (e1) throw e1
        const rows = dishes.filter(d => d.name.trim()).map(d => ({
          place_id: data.id, name: d.name.trim(), price: d.price === '' ? null : +d.price,
          rating: d.rating || null, order_again: d.order_again || null, note: d.note.trim() || null,
        }))
        if (rows.length) { const { error: e2 } = await supabase.from('dishes').insert(rows); if (e2) throw e2 }
      }

      if (wishId) await supabase.from('wishlist').update({ went_at: new Date().toISOString() }).eq('id', wishId)
      setBusy(false)
      onSaved()
    } catch (err) {
      setBusy(false)
      alert(err.message || 'Could not save. Please try again.')
    }
  }

  async function remove() {
    const msg = editingGroup
      ? `Delete "${place.name}" with all its dishes, ratings and comments for everyone in the group?`
      : `Delete "${place.name}" and all its dishes?`
    if (!confirm(msg)) return
    const { error: err } = await supabase.from('places').delete().eq('id', place.id)
    if (err) return alert(err.message)
    onSaved()
  }

  const label = 'mb-1 block text-xs font-medium'
  const mute = { color: 'var(--mute)' }
  const title = editing ? 'Edit place' : wishId ? 'We went! Add your visit' : 'Add place'

  return (
    <div className="fade fixed inset-0 z-20 overflow-y-auto" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="sheet mx-auto my-6 w-[calc(100%-24px)] max-w-xl rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-xl ghost transition" style={mute}>×</button>
        </div>

        {!editing && groups.length > 0 && (
          <div className="mb-3">
            <label className={label} style={mute}>Save to</label>
            <select value={target} onChange={e => setTarget(e.target.value)} className="input">
              <option value="">👤 Personal (only me)</option>
              {groups.map(g => <option key={g.id} value={g.id}>👥 {g.name}</option>)}
            </select>
            {target && <p className="mt-1 text-xs" style={mute}>If this place is already in the group, your dishes and ratings are added to the existing card.</p>}
          </div>
        )}

        <label className={label} style={mute}>Place name *</label>
        <input required autoFocus placeholder="e.g. Coffea: Brew on the Rocks" value={f.name} onChange={setField('name')} className="input mb-3" />
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div><label className={label} style={mute}>City *</label>
            <input required list="cities" placeholder="Vadodara" value={f.city} onChange={setField('city')} className="input" /></div>
          <div><label className={label} style={mute}>Area / landmark *</label>
            <input required placeholder="13 Canal Rd" value={f.area} onChange={setField('area')} className="input" /></div>
        </div>
        <label className={label} style={mute}>Category * <span className="font-normal">(pick one or more)</span></label>
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => toggleCat(c)} className={`chip ${cats.includes(c) ? 'on' : ''}`}>{c}</button>
          ))}
        </div>
        <label className={label} style={mute}>Directions / timing</label>
        <textarea rows={2} placeholder="Optional" value={f.directions} onChange={setField('directions')} className="input mb-5" />
        <datalist id="cities">{cities.map(c => <option key={c} value={c} />)}</datalist>

        {editingGroup ? (
          <p className="mb-5 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--bg)', color: 'var(--mute)' }}>
            Dishes in a group are added, rated and edited from the place card, so everyone keeps their own rating.
          </p>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-semibold">Dishes</h3>
            {dishes.map((d, i) => (
              <div key={i} className="rise mb-3 rounded-2xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--dish)' }}>
                <div className="mb-2 flex gap-2">
                  <input required placeholder="Dish name *" value={d.name} onChange={e => setDish(i, 'name', e.target.value)} className="input" />
                  <input required min="0" type="number" inputMode="numeric" placeholder="Price ₹ *" value={d.price} onChange={e => setDish(i, 'price', e.target.value)} className="input !w-28" />
                </div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setDish(i, 'rating', d.rating === n ? 0 : n)}
                        className="px-0.5 text-2xl transition hover:scale-125 active:scale-90"
                        style={{ color: n <= d.rating ? 'var(--star)' : 'var(--star-off)' }}>★</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {['yes', 'maybe', 'no'].map(v => (
                      <button key={v} type="button" onClick={() => setDish(i, 'order_again', d.order_again === v ? '' : v)}
                        className={`chip !px-3 !py-1 capitalize ${d.order_again === v ? 'on' : ''}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <input placeholder="Review note (optional)" value={d.note} onChange={e => setDish(i, 'note', e.target.value)} className="input" />
                {dishes.length > 1 && (
                  <button type="button" onClick={() => setDishes(dishes.filter((_, j) => j !== i))}
                    className="mt-2 text-xs font-medium" style={{ color: 'var(--bad)' }}>Remove dish</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setDishes([...dishes, blankDish()])}
              className="mb-5 text-sm font-semibold" style={{ color: 'var(--pri)' }}>+ Add another dish</button>
          </>
        )}

        {error && <p className="fade mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="btn btn-pri flex-1">{busy ? 'Saving…' : 'Save'}</button>
          {editing && <button type="button" onClick={remove} className="btn" style={{ color: 'var(--bad)' }}>Delete</button>}
        </div>
      </form>
    </div>
  )
}

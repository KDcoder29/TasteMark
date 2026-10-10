import { useState } from 'react'
import { supabase } from './supabase'
import { findGroupPlace, addDishWithRating } from './groupApi'

// Shares one dish (and its place, if the group doesn't have it yet) with a group.
// The place is shared as ONE card, and your rating is added next to your friends' ratings.
// Your personal entry is left untouched.
export default function ShareDish({ me, place, dish, groups, onClose }) {
  const [target, setTarget] = useState(null)   // group chosen, waiting for confirmation
  const [done, setDone] = useState(null)       // { group, status }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    if (!dish.rating) { setError('This dish has no star rating yet. Edit the place and rate it first.'); return }
    setBusy(true); setError('')
    let createdId = null
    try {
      let match = await findGroupPlace(target.id, place.name, place.city)
      if (!match) {
        const { data, error: e2 } = await supabase.from('places').insert({
          name: place.name, city: place.city, area: place.area, directions: place.directions,
          categories: place.categories || [], group_id: target.id,
        }).select('id').single()
        if (e2) throw e2
        match = { id: data.id, dishes: [] }
        createdId = data.id
      }
      const r = await addDishWithRating(match.id, dish, me, match.dishes, { overwrite: false })
      if (r.status === 'already') { setError(`You've already rated this dish in ${target.name}.`); setBusy(false); return }
      setDone({ group: target, status: r.status })
    } catch (err) {
      if (createdId) await supabase.from('places').delete().eq('id', createdId)   // don't leave an empty place behind
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const mute = { color: 'var(--mute)' }

  return (
    <div className="fade fixed inset-0 z-30 grid place-items-center p-4" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>

        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-xl" style={{ background: 'var(--okbg)', color: 'var(--ok)' }}>✓</div>
            <h2 className="text-lg font-bold">Added to {done.group.name}</h2>
            <p className="mb-5 mt-1 text-sm" style={mute}>
              {done.status === 'created'
                ? `“${dish.name}” is now on the group's card for ${place.name}.`
                : `Your rating was added to the existing “${dish.name}” in the group.`}
              {' '}Your personal entry is unchanged.
            </p>
            <button onClick={onClose} className="btn btn-pri w-full">Done</button>
          </div>

        ) : target ? (
          <div>
            <h2 className="text-lg font-bold">Are you sure?</h2>
            <p className="mt-2 text-sm" style={mute}>
              Add <b style={{ color: 'var(--ink)' }}>{dish.name}</b> from <b style={{ color: 'var(--ink)' }}>{place.name}</b> to
              the group <b style={{ color: 'var(--ink)' }}>{target.name}</b>? Everyone in that group will see it with your rating and note.
              Your personal entry stays.
            </p>
            {error && <p className="fade mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{error}</p>}
            <div className="mt-5 flex gap-2">
              <button disabled={busy} onClick={() => { setTarget(null); setError('') }} className="btn flex-1">Cancel</button>
              <button disabled={busy} onClick={add} className="btn btn-pri flex-1">{busy ? 'Adding…' : 'Yes, add'}</button>
            </div>
          </div>

        ) : (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add to group</h2>
              <button onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full text-xl" style={mute}>×</button>
            </div>
            <p className="mb-4 text-sm" style={mute}>Choose a group for “{dish.name}”.</p>
            {groups.length === 0 ? (
              <p className="rounded-xl px-3 py-4 text-center text-sm" style={{ background: 'var(--bg)', ...mute }}>
                You're not in any group yet. Use <b>＋ Groups</b> at the top to create or join one.
              </p>
            ) : (
              <ul className="space-y-2">
                {groups.map(g => (
                  <li key={g.id}>
                    <button onClick={() => setTarget(g)}
                      className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5"
                      style={{ borderColor: 'var(--line)', background: 'var(--dish)' }}>
                      <span className="truncate font-medium">👥 {g.name}</span>
                      <span style={mute}>›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

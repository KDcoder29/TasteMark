import { useState } from 'react'
import { supabase } from './supabase'
import { Stars, Avatar, tint, timeAgo } from './shared'

const EMOJIS = ['👍', '😋', '🔥', '😐', '👎']
const ok = r => { if (r.error) throw r.error; return r }

// One dish inside a GROUP place: average rating, everyone's ratings, reactions, comments.
export default function GroupDish({ d, me, names, isOwner, onChanged }) {
  const mine = (d.dish_ratings || []).find(r => r.user_id === me)
  const [open, setOpen] = useState(false)
  const [rate, setRate] = useState(mine?.rating || 0)
  const [again, setAgain] = useState(mine?.order_again || '')
  const [note, setNote] = useState(mine?.note || '')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [en, setEn] = useState(d.name)
  const [ep, setEp] = useState(d.price ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const who = uid => (uid === me ? 'You' : names[uid] || 'A member')
  const ratings = d.dish_ratings || []
  const reactions = d.dish_reactions || []
  const comments = [...(d.dish_comments || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const canAdmin = d.user_id === me || isOwner
  const mute = { color: 'var(--mute)' }

  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); await onChanged() } catch (e) { setErr(e.message || 'Something went wrong. Please try again.') }
    setBusy(false)
  }

  const saveRating = () => {
    if (!rate) return setErr('Pick a star rating first.')
    return run(async () => ok(await supabase.from('dish_ratings').upsert({
      dish_id: d.id, user_id: me, rating: rate, order_again: again || null,
      note: note.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'dish_id,user_id' })))
  }

  const removeRating = () => run(async () => {
    ok(await supabase.from('dish_ratings').delete().eq('dish_id', d.id).eq('user_id', me))
    setRate(0); setAgain(''); setNote('')
  })

  const toggleReaction = emoji => run(async () => {
    const has = reactions.some(r => r.user_id === me && r.emoji === emoji)
    if (has) ok(await supabase.from('dish_reactions').delete().eq('dish_id', d.id).eq('user_id', me).eq('emoji', emoji))
    else ok(await supabase.from('dish_reactions').insert({ dish_id: d.id, user_id: me, emoji }))
  })

  const postComment = e => {
    e.preventDefault()
    if (!text.trim()) return
    return run(async () => { ok(await supabase.from('dish_comments').insert({ dish_id: d.id, user_id: me, body: text.trim() })); setText('') })
  }

  const deleteComment = id => run(async () => ok(await supabase.from('dish_comments').delete().eq('id', id)))

  const saveDish = e => {
    e.preventDefault()
    if (!en.trim()) return setErr('Dish name is required.')
    return run(async () => {
      ok(await supabase.from('dishes').update({ name: en.trim(), price: ep === '' ? null : +ep }).eq('id', d.id))
      setEditing(false)
    })
  }

  const deleteDish = () => {
    if (!confirm(`Delete "${d.name}" with all its ratings and comments for everyone in the group?`)) return
    return run(async () => ok(await supabase.from('dishes').delete().eq('id', d.id)))
  }

  return (
    <div>
      {/* summary row */}
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{d.name}</span>
            {d.order_again === 'yes' && <span className="pill pill-ok">Order again</span>}
          </div>
          {(comments.length > 0 || reactions.length > 0) && (
            <p className="mt-0.5 text-xs" style={mute}>
              {comments.length > 0 && <>💬 {comments.length}</>}
              {comments.length > 0 && reactions.length > 0 && ' · '}
              {reactions.length > 0 && <>{[...new Set(reactions.map(r => r.emoji))].slice(0, 3).join('')} {reactions.length}</>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <div className="text-sm font-semibold">{d.price ? '₹' + d.price : '–'}</div>
            {d.nRatings > 0 ? (
              <div className="flex items-center justify-end gap-1">
                <Stars n={Math.round(d.avg)} />
                <span className="text-xs" style={mute}>{d.avg.toFixed(1)} · {d.nRatings}</span>
              </div>
            ) : <span className="text-xs" style={mute}>Not rated</span>}
          </div>
          <span className="mt-1 text-xs transition" style={{ ...mute, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        </div>
      </button>

      {open && (
        <div className="fade mt-3 space-y-4 rounded-xl p-3" style={{ background: 'var(--dish)' }}>
          {err && <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>{err}</p>}

          {/* everyone's ratings */}
          <div>
            <div className="mb-1 text-xs font-medium" style={mute}>Ratings</div>
            {ratings.length === 0 && <p className="text-sm" style={mute}>Nobody has rated this yet.</p>}
            <ul className="space-y-2">
              {ratings.map(r => (
                <li key={r.user_id} className="flex items-start gap-2.5">
                  <Avatar text={who(r.user_id)} color={tint(r.user_id)} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium">{who(r.user_id)}</span>
                      <Stars n={r.rating} />
                      {r.order_again && <span className="text-xs capitalize" style={mute}>order again: {r.order_again}</span>}
                    </div>
                    {r.note && <p className="text-sm" style={mute}>{r.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* my rating */}
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <div className="mb-1 text-xs font-medium" style={mute}>{mine ? 'Your rating' : 'Rate this dish'}</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRate(rate === n ? 0 : n)}
                    className="px-0.5 text-2xl transition hover:scale-125 active:scale-90"
                    style={{ color: n <= rate ? 'var(--star)' : 'var(--star-off)' }}>★</button>
                ))}
              </div>
              <div className="flex gap-1">
                {['yes', 'maybe', 'no'].map(v => (
                  <button key={v} type="button" onClick={() => setAgain(again === v ? '' : v)}
                    className={`chip !px-2.5 !py-1 capitalize ${again === v ? 'on' : ''}`}>{v}</button>
                ))}
              </div>
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Your take (optional)" className="input mt-2 !py-2" />
            <div className="mt-2 flex gap-2">
              <button disabled={busy} onClick={saveRating} className="btn btn-pri !py-2 !text-sm">{busy ? '…' : mine ? 'Update' : 'Save rating'}</button>
              {mine && <button disabled={busy} onClick={removeRating} className="btn !py-2 !text-sm" style={{ color: 'var(--bad)' }}>Remove mine</button>}
            </div>
          </div>

          {/* reactions */}
          <div>
            <div className="mb-1 text-xs font-medium" style={mute}>Reactions</div>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => {
                const n = reactions.filter(r => r.emoji === e).length
                const on = reactions.some(r => r.emoji === e && r.user_id === me)
                return (
                  <button key={e} disabled={busy} onClick={() => toggleReaction(e)} className={`chip !px-3 ${on ? 'on' : ''}`}>
                    {e}{n > 0 && <span className="ml-1">{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* comments */}
          <div>
            <div className="mb-1 text-xs font-medium" style={mute}>Comments</div>
            {comments.length === 0 && <p className="text-sm" style={mute}>No comments yet.</p>}
            <ul className="space-y-2">
              {comments.map(c => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Avatar text={who(c.user_id)} color={tint(c.user_id)} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs" style={mute}>
                      <b style={{ color: 'var(--ink)' }}>{who(c.user_id)}</b> · {timeAgo(c.created_at)}
                      {(c.user_id === me || isOwner) && (
                        <button onClick={() => deleteComment(c.id)} className="ml-2 font-medium" style={{ color: 'var(--bad)' }}>Delete</button>
                      )}
                    </div>
                    <p className="break-words text-sm">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form onSubmit={postComment} className="mt-2 flex gap-2">
              <input value={text} maxLength={500} onChange={e => setText(e.target.value)} placeholder="Add a comment…" className="input !py-2" />
              <button disabled={busy || !text.trim()} className="btn !py-2 !text-sm shrink-0">Post</button>
            </form>
          </div>

          {/* dish admin */}
          {canAdmin && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
              {editing ? (
                <form onSubmit={saveDish} className="flex flex-wrap gap-2">
                  <input value={en} onChange={e => setEn(e.target.value)} placeholder="Dish name" className="input !py-2 flex-1" />
                  <input type="number" min="0" value={ep} onChange={e => setEp(e.target.value)} placeholder="₹" className="input !py-2 !w-24" />
                  <button disabled={busy} className="btn btn-pri !py-2 !text-sm">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="btn !py-2 !text-sm">Cancel</button>
                </form>
              ) : (
                <div className="flex gap-4 text-sm font-medium">
                  <button onClick={() => setEditing(true)} style={{ color: 'var(--pri)' }}>Edit name / price</button>
                  <button onClick={deleteDish} style={{ color: 'var(--bad)' }}>Delete dish</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

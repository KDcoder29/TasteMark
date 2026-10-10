import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import PlaceForm from './PlaceForm'
import ShareDish from './ShareDish'
import GroupDish from './GroupDish'
import DishForm from './DishForm'
import Wishlist from './Wishlist'
import Activity from './Activity'
import Picker from './Picker'
import { CATEGORIES, Stars } from './shared'

const SAMPLE = [
  { name: 'Coffea: Brew on the Rocks', city: 'Vadodara', area: '13 Canal Rd', categories: ['Cafe'],
    dishes: [
      { name: 'Hazelnut cold coffee', price: 200, rating: 5, order_again: 'yes', note: 'Ekdum mast. Less sweet than Irish' },
      { name: 'Irish cold coffee', price: 200, rating: 3, order_again: 'maybe', note: 'Nice but too sweet' } ] },
  { name: 'Beyond 7', city: 'Vadodara', area: 'OP Road, after Atal Bridge', categories: ['Cafe'],
    dishes: [{ name: 'Hazelnut cold coffee', price: 230, rating: 4, order_again: 'maybe', note: 'Nice but pricey' }] },
  { name: 'BiteX', city: 'Ahmedabad', area: 'Memnagar', categories: ['Cafe'],
    directions: 'Memnagar Reliance Smart Bazar to Palladium, left at first circle',
    dishes: [{ name: 'Hazelnut cold coffee', price: 173, rating: 4, order_again: 'maybe', note: 'Enough for 2, too much for 1' }] },
]

// In a group, a dish's rating is the AVERAGE of everyone's ratings.
function groupDish(d) {
  const rs = d.dish_ratings || []
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0
  const yes = rs.filter(r => r.order_again === 'yes').length
  const no = rs.filter(r => r.order_again === 'no').length
  return { ...d, avg, nRatings: rs.length, rating: avg, order_again: yes > no ? 'yes' : no > yes ? 'no' : null }
}

// me = my user id, group = the open group (null = Personal), groups = all my groups
export default function Journal({ me, group, groups }) {
  const [places, setPlaces] = useState([])
  const [wishlist, setWishlist] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('journal')      // 'journal' | 'wishlist' | 'activity'
  const [editing, setEditing] = useState(null)     // place being edited
  const [creating, setCreating] = useState(null)   // {} or { prefill, wishId }
  const [sharing, setSharing] = useState(null)     // { place, dish } being added to a group
  const [addingDish, setAddingDish] = useState(null)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [city, setCity] = useState('All')
  const [cat, setCat] = useState('All')
  const [minRate, setMinRate] = useState(0)
  const [maxPrice, setMaxPrice] = useState(300)
  const [again, setAgain] = useState(false)

  const isOwner = group?.role === 'owner'
  const canEditPlace = p => p.user_id === me || isOwner
  const mute = { color: 'var(--mute)' }

  async function load() {
    const sel = group ? '*, dishes(*, dish_ratings(*), dish_reactions(*), dish_comments(*))' : '*, dishes(*)'
    let q1 = supabase.from('places').select(sel).order('created_at', { ascending: false })
    q1 = group ? q1.eq('group_id', group.id) : q1.is('group_id', null)
    let q2 = supabase.from('wishlist').select('*').is('went_at', null).order('created_at', { ascending: false })
    q2 = group ? q2.eq('group_id', group.id) : q2.is('group_id', null)

    const [r1, r2] = await Promise.all([q1, q2])
    if (r1.error) alert(r1.error.message)
    else setPlaces(group
      ? r1.data.map(p => ({ ...p, dishes: [...(p.dishes || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(groupDish) }))
      : r1.data)
    if (r2.error) console.error(r2.error)
    else setWishlist(r2.data)

    if (group) {
      const { data: pr } = await supabase.from('profiles').select('id, display_name')
      setNames(Object.fromEntries((pr || []).map(r => [r.id, r.display_name])))
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function seed() {
    for (const { dishes, ...place } of SAMPLE) {
      const { data, error } = await supabase.from('places').insert(place).select().single()
      if (error) return alert(error.message)
      await supabase.from('dishes').insert(dishes.map(d => ({ ...d, place_id: data.id })))
    }
    load()
  }

  const opts = k => [...new Set(places.map(p => p[k]).filter(Boolean))]
  const dirty = q || city !== 'All' || cat !== 'All' || minRate || maxPrice < 300 || again
  const reset = () => { setQ(''); setCity('All'); setCat('All'); setMinRate(0); setMaxPrice(300); setAgain(false) }

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const dishFilter = minRate > 0 || maxPrice < 300 || again
    return places.flatMap(p => {
      if (city !== 'All' && p.city !== city) return []
      if (cat !== 'All' && !(p.categories || []).includes(cat)) return []
      const placeHit = !s || [p.name, p.city, p.area, (p.categories || []).join(' '), p.directions].join(' ').toLowerCase().includes(s)
      const dishes = (p.dishes || []).filter(d =>
        (!minRate || d.rating >= minRate) &&
        (maxPrice >= 300 || (d.price && d.price <= maxPrice)) &&
        (!again || d.order_again === 'yes') &&
        (!s || placeHit || [d.name, d.note].join(' ').toLowerCase().includes(s)))
      if (dishFilter && !dishes.length) return []
      if (!dishFilter && s && !placeHit && !dishes.length) return []
      return [{ ...p, dishes, allDishes: p.dishes }]
    })
  }, [places, q, city, cat, minRate, maxPrice, again])

  const tabs = [
    ['journal', 'Journal'],
    ['wishlist', `Wishlist${wishlist.length ? ` (${wishlist.length})` : ''}`],
    ...(group ? [['activity', 'Activity']] : []),
  ]

  return (
    <div className="pb-28">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={mute}>
        <div className="flex items-center gap-2">
          <span>{group ? '👥' : '👤'}</span>
          <span>
            {group
              ? <>Shared with the members of <b style={{ color: 'var(--ink)' }}>{group.name}</b></>
              : <>Personal journal <span className="opacity-80">· only you can see this</span></>}
          </span>
        </div>
        <button onClick={() => setPicking(true)} className="chip !py-1">🎲 {group ? 'Where should we eat?' : 'Where to eat?'}</button>
      </div>

      {/* Journal / Wishlist / Activity */}
      <div className="mb-4 grid gap-1 rounded-xl p-1" style={{ background: 'var(--head)', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition"
            style={view === k ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 3px #0f172a1f' } : mute}>{l}</button>
        ))}
      </div>

      {view === 'wishlist' && (
        <Wishlist me={me} group={group} items={wishlist} names={names} isOwner={isOwner} onChanged={load}
          onWent={w => setCreating({ prefill: { name: w.name, city: w.city, area: w.area, categories: w.categories || [] }, wishId: w.id })} />
      )}

      {view === 'activity' && group && <Activity me={me} group={group} names={names} />}

      {view === 'journal' && (
        <>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search dish, place, area or note…" className="input !rounded-2xl !py-3.5 !pl-11 shadow-sm" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select className="input" value={city} onChange={e => setCity(e.target.value)}>
              {['All', ...opts('city')].map(v => <option key={v} value={v}>{v === 'All' ? 'All cities' : v}</option>)}</select>
            <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
              {['All', ...CATEGORIES].map(v => <option key={v} value={v}>{v === 'All' ? 'All categories' : v}</option>)}</select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[3, 4, 5].map(n => (
              <button key={n} className={`chip ${minRate === n ? 'on' : ''}`} onClick={() => setMinRate(minRate === n ? 0 : n)}>{n}★+</button>
            ))}
            <button className={`chip ${again ? 'on' : ''}`} onClick={() => setAgain(!again)}>Order again</button>
            {dirty && <button className="chip fade" onClick={reset}>Clear ✕</button>}
          </div>

          <label className="mt-3 block text-xs font-medium" style={mute}>
            Max price: <span style={{ color: 'var(--pri)' }}>{maxPrice >= 300 ? 'any' : '₹' + maxPrice}</span>
            <input type="range" min={0} max={300} step={10} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)}
              className="mt-1 w-full" style={{ accentColor: 'var(--pri)' }} />
          </label>

          {!loading && places.length > 0 && (
            <p className="mb-3 mt-2 text-sm" style={mute}>
              {results.length} place{results.length === 1 ? '' : 's'}
            </p>
          )}

          {loading ? <div className="mt-4 space-y-3"><div className="skel" /><div className="skel" /><div className="skel" /></div> :
            places.length === 0 ? (
              <div className="rise py-14 text-center">
                <div className="mb-3 text-5xl">🍽️</div>
                <p className="font-semibold">{group ? `${group.name} has no entries yet` : 'Your journal is empty'}</p>
                <p className="mb-5 mt-1 text-sm" style={mute}>
                  {group ? 'Tap + to add the first shared place.' : 'Tap + to add your first place.'}
                </p>
                {!group && <button onClick={seed} className="text-sm font-medium underline" style={{ color: 'var(--pri)' }}>or load sample data</button>}
              </div>
            ) : results.length === 0 ? (
              <div className="fade py-14 text-center" style={mute}>Nothing found. Try fewer filters.</div>
            ) : results.map((p, i) => (
              <div key={p.id} className="rise mb-4 overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)', animationDelay: `${Math.min(i, 8) * 50}ms`, boxShadow: '0 1px 2px #0f172a0a' }}>
                {/* PARENT: place */}
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3"
                  style={{ background: 'var(--head)', borderColor: 'var(--line)' }}>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-snug">{p.name}</h3>
                    <p className="mt-0.5 text-xs" style={mute}>📍 {[p.area, p.city].filter(Boolean).join(', ')}</p>
                    {group && (
                      <p className="mt-0.5 text-xs" style={mute}>
                        Added by {p.user_id === me ? 'you' : (names[p.user_id] || 'a member')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {(p.categories || []).map(c => <span key={c} className="rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--mute)' }}>{c}</span>)}
                    {canEditPlace(p) && (
                      <button onClick={() => setEditing({ ...p, dishes: p.allDishes })}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium ghost transition" style={{ color: 'var(--pri)' }}>Edit</button>
                    )}
                  </div>
                </div>
                {p.directions && <p className="px-4 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--mute)' }}>🧭 {p.directions}</p>}

                {/* CHILDREN: dishes */}
                <div className="px-4 py-3">
                  {p.dishes.length === 0 && <p className="text-sm" style={mute}>No dishes added yet.</p>}
                  <div className="ml-1.5 border-l-2 pl-4" style={{ borderColor: 'var(--line)' }}>
                    {p.dishes.map((d, j) => (
                      <div key={d.id} className="relative py-2.5" style={j ? { borderTop: '1px dashed var(--line)' } : null}>
                        <span className="absolute -left-[23px] top-[18px] h-2 w-2 rounded-full" style={{ background: 'var(--pri)', boxShadow: '0 0 0 4px var(--surface)' }} />
                        {group ? (
                          <GroupDish d={d} me={me} names={names} isOwner={isOwner} onChanged={load} />
                        ) : (
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{d.name}</span>
                                {d.order_again === 'yes' && <span className="pill pill-ok">Order again</span>}
                              </div>
                              {d.note && <p className="mt-0.5 text-sm" style={mute}>{d.note}</p>}
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                              <div className="text-right">
                                <div className="text-sm font-semibold">{d.price ? '₹' + d.price : '–'}</div>
                                <Stars n={d.rating || 0} />
                              </div>
                              <button onClick={() => setSharing({ place: p, dish: d })}
                                title="Add to group" aria-label={`Add ${d.name} to a group`}
                                className="ghost grid h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-90"
                                style={{ color: 'var(--pri)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M7 17L17 7" /><path d="M8 7h9v9" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {group && (
                    <button onClick={() => setAddingDish({ id: p.id, name: p.name, dishes: p.allDishes })}
                      className="mt-2 text-sm font-semibold" style={{ color: 'var(--pri)' }}>+ Add a dish</button>
                  )}
                </div>
              </div>
            ))}
        </>
      )}

      {view === 'journal' && <button className="fab" onClick={() => setCreating({})} aria-label="Add place">+</button>}

      {sharing && (
        <ShareDish me={me} place={sharing.place} dish={sharing.dish} groups={groups} onClose={() => setSharing(null)} />
      )}

      {addingDish && (
        <DishForm me={me} place={addingDish} onClose={() => setAddingDish(null)}
          onSaved={() => { setAddingDish(null); load() }} />
      )}

      {picking && <Picker places={places} wishlist={wishlist} group={group} onClose={() => setPicking(false)} />}

      {(editing || creating) && (
        <PlaceForm me={me} place={editing} prefill={creating?.prefill} wishId={creating?.wishId}
          cities={opts('city')} groups={groups} defaultGroupId={group?.id || ''}
          onClose={() => { setEditing(null); setCreating(null) }}
          onSaved={() => { setEditing(null); setCreating(null); load() }} />
      )}
    </div>
  )
}

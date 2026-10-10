import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, Stars } from './shared'

// "Where should we eat?": picks a random place from favorites, the wishlist, or everything.
export default function Picker({ places, wishlist, group, onClose }) {
  const [src, setSrc] = useState('fav')            // 'fav' | 'new' | 'any'
  const [city, setCity] = useState('All')
  const [cat, setCat] = useState('All')
  const [maxPrice, setMaxPrice] = useState(300)
  const [shown, setShown] = useState(null)
  const [spin, setSpin] = useState('')
  const timer = useRef(null)
  const last = useRef(null)
  const mute = { color: 'var(--mute)' }

  useEffect(() => () => clearInterval(timer.current), [])

  const cities = useMemo(() => [...new Set([...places, ...wishlist].map(x => x.city).filter(Boolean))], [places, wishlist])

  const pool = useMemo(() => {
    const okCity = x => city === 'All' || x.city === city
    const okCat = x => cat === 'All' || (x.categories || []).includes(cat)
    const out = []

    if (src !== 'new') {
      for (const p of places) {
        if (!okCity(p) || !okCat(p)) continue
        const dishes = p.dishes || []
        if (src === 'fav' && !dishes.some(d => d.rating >= 4)) continue
        if (maxPrice < 300 && !dishes.some(d => d.price && d.price <= maxPrice)) continue
        const top = [...dishes].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 2)
        out.push({ key: 'p' + p.id, kind: 'place', name: p.name, city: p.city, area: p.area, directions: p.directions, categories: p.categories, top })
      }
    }
    if (src !== 'fav') {
      for (const w of wishlist) {
        if (!okCity(w) || !okCat(w)) continue
        out.push({ key: 'w' + w.id, kind: 'wish', name: w.name, city: w.city, area: w.area, note: w.note, categories: w.categories, top: [] })
      }
    }
    return out
  }, [places, wishlist, src, city, cat, maxPrice])

  function reset(fn) { return v => { fn(v); setShown(null) } }

  function pick() {
    if (!pool.length) return
    clearInterval(timer.current)
    setShown(null)
    let n = 0
    timer.current = setInterval(() => {
      setSpin(pool[Math.floor(Math.random() * pool.length)].name)
      if (++n >= 10) {
        clearInterval(timer.current)
        const options = pool.length > 1 ? pool.filter(x => x.key !== last.current) : pool
        const r = options[Math.floor(Math.random() * options.length)]
        last.current = r.key
        setSpin('')
        setShown(r)
      }
    }, 90)
  }

  const label = 'mb-1 block text-xs font-medium'
  const sources = [['fav', 'Favorites'], ['new', 'To try'], ['any', 'Anything']]

  return (
    <div className="fade fixed inset-0 z-30 grid place-items-center overflow-y-auto p-4" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">{group ? 'Where should we eat?' : 'Where should I eat?'}</h2>
          <button onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full text-xl" style={mute}>×</button>
        </div>
        <p className="mb-4 text-sm" style={mute}>Can't decide? Set what you're in the mood for and let it choose.</p>

        <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'var(--head)' }}>
          {sources.map(([k, l]) => (
            <button key={k} onClick={() => { setSrc(k); setShown(null) }} className="rounded-lg px-2 py-1.5 text-sm font-semibold transition"
              style={src === k ? { background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 1px 3px #0f172a1f' } : mute}>{l}</button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className={label} style={mute}>City</label>
            <select className="input !py-2" value={city} onChange={e => reset(setCity)(e.target.value)}>
              <option value="All">Any city</option>{cities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label} style={mute}>Category</label>
            <select className="input !py-2" value={cat} onChange={e => reset(setCat)(e.target.value)}>
              <option value="All">Any</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {src !== 'new' && (
          <label className="mb-4 block text-xs font-medium" style={mute}>
            Budget per dish: <span style={{ color: 'var(--pri)' }}>{maxPrice >= 300 ? 'any' : 'up to ₹' + maxPrice}</span>
            <input type="range" min={0} max={300} step={10} value={maxPrice} onChange={e => reset(setMaxPrice)(+e.target.value)}
              className="mt-1 w-full" style={{ accentColor: 'var(--pri)' }} />
          </label>
        )}

        {/* result */}
        <div className="mb-4 min-h-[120px] rounded-2xl border p-4 text-center" style={{ borderColor: 'var(--line)', background: 'var(--dish)' }}>
          {spin ? (
            <div className="grid min-h-[88px] place-items-center text-lg font-semibold" style={mute}>{spin}</div>
          ) : shown ? (
            <div className="fade text-left">
              <div className="mb-1 flex items-center gap-2">
                <span className={`pill ${shown.kind === 'wish' ? '' : 'pill-ok'}`}>{shown.kind === 'wish' ? 'From your wishlist' : 'A favorite'}</span>
              </div>
              <div className="text-xl font-bold leading-snug">{shown.name}</div>
              {(shown.area || shown.city) && <div className="text-sm" style={mute}>📍 {[shown.area, shown.city].filter(Boolean).join(', ')}</div>}
              {shown.directions && <div className="mt-1 text-sm" style={mute}>🧭 {shown.directions}</div>}
              {shown.note && <div className="mt-1 text-sm" style={mute}>{shown.note}</div>}
              {shown.top.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {shown.top.map(d => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{d.name}</span>
                      <span className="flex shrink-0 items-center gap-2"><Stars n={Math.round(d.rating || 0)} />{d.price ? <span style={mute}>₹{d.price}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : pool.length === 0 ? (
            <div className="grid min-h-[88px] place-items-center text-sm" style={mute}>
              No places match. Try another source or loosen the filters.
            </div>
          ) : (
            <div className="grid min-h-[88px] place-items-center text-sm" style={mute}>
              {pool.length} place{pool.length === 1 ? '' : 's'} to choose from
            </div>
          )}
        </div>

        <button onClick={pick} disabled={!pool.length || !!spin} className="btn btn-pri w-full">
          {spin ? 'Choosing…' : shown ? '🎲 Pick again' : '🎲 Pick for ' + (group ? 'us' : 'me')}
        </button>
      </div>
    </div>
  )
}

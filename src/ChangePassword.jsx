import { useState } from 'react'
import { supabase } from './supabase'

export default function ChangePassword({ onClose }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pw.length < 6) return setMsg({ type: 'err', text: 'Password must be at least 6 characters.' })
    if (pw !== pw2) return setMsg({ type: 'err', text: 'The two passwords do not match.' })
    setBusy(true); setMsg({ type: '', text: '' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: error.message })
    setMsg({ type: 'ok', text: 'Password updated.' })
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fade fixed inset-0 z-30 grid place-items-center p-4" style={{ background: '#0f172a80', backdropFilter: 'blur(3px)' }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="sheet w-full max-w-sm rounded-3xl p-5 shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Change password</h2>
          <button type="button" onClick={onClose} className="ghost grid h-8 w-8 place-items-center rounded-full text-xl" style={{ color: 'var(--mute)' }}>×</button>
        </div>
        <input type="password" autoFocus required placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} className="input mb-3" />
        <input type="password" required placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)} className="input mb-4" />
        {msg.text && (
          <p className="fade mb-3 rounded-lg px-3 py-2 text-sm"
            style={msg.type === 'ok' ? { background: 'var(--okbg)', color: 'var(--ok)' } : { background: 'var(--errbg)', color: 'var(--bad)' }}>{msg.text}</p>
        )}
        <button disabled={busy} className="btn btn-pri w-full">{busy ? 'Updating…' : 'Update password'}</button>
      </form>
    </div>
  )
}

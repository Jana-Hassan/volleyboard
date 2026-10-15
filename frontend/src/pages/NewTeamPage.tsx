import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import PageShell from '../components/PageShell'
import Button from '../components/ui/Button'

const errorOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback

const NewTeamPage = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<{ name: string }[]>('/reference/teams').then(r => setSuggestions(r.data.map(t => t.name))).catch(() => setSuggestions([]))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Team name is required')
    setSaving(true)
    setError('')
    try {
      const res = await api.post('/teams', { name: name.trim(), logoUrl: logoUrl.trim() || undefined })
      navigate(`/teams/${res.data.id}`)
    } catch (err) {
      setError(errorOf(err, 'Could not create the team'))
      setSaving(false)
    }
  }

  const input = 'w-full bg-card border border-line text-white placeholder-muted rounded px-3 py-2.5 text-sm focus:outline-none focus:border-us transition-motion-fast'

  return (
    <PageShell maxWidth="max-w-lg" breadcrumbs={[{ label: 'Your Teams', path: '/dashboard' }, { label: 'New Team' }]}>
      <div className="flex-1 min-h-0 flex items-center">
        <form onSubmit={submit} className="w-full border border-line bg-card rounded p-6 md:p-8 space-y-5">
          <div>
            <h1 className="text-lg font-semibold">New team</h1>
            <p className="text-xs text-muted mt-1">You will be the team's manager. Invite staff from the Staff tab afterwards.</p>
          </div>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Team name</span>
            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Japan National Team 2027" list="team-suggestions" autoFocus />
            <datalist id="team-suggestions">
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">Logo URL <span className="normal-case tracking-normal">(optional)</span></span>
            <input className={input} value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" type="url" />
          </label>

          {error && <p className="text-opp-soft text-sm">{error}</p>}

          <div className="flex gap-3 justify-end">
            <Button tone="ghost" onClick={() => navigate('/dashboard')}>Cancel</Button>
            <Button tone="primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create team'}</Button>
          </div>
        </form>
      </div>
    </PageShell>
  )
}

export default NewTeamPage

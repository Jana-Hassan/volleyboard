import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import type { Lineup } from '../types'
import PageShell from '../components/PageShell'
import Button from '../components/ui/Button'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface NationalTeam {
  name: string
  code: string
  flag: string
  confederation: string
}

interface Competitions {
  international: string[]
  club: string[]
  other: string[]
}

const GROUPS: { key: keyof Competitions; label: string }[] = [
  { key: 'international', label: 'International' },
  { key: 'club', label: 'Club' },
  { key: 'other', label: 'Other' }
]

const input = 'w-full bg-card border border-line text-white placeholder-muted rounded px-3 py-2.5 text-sm focus:outline-none focus:border-us transition-motion-fast'

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">{label}</p>
    {children}
    {hint && <p className="text-muted text-xs mt-1">{hint}</p>}
  </div>
)

const NewMatchPage = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [teamName, setTeamName] = useState('')
  const [nationalTeams, setNationalTeams] = useState<NationalTeam[]>([])
  const [competitions, setCompetitions] = useState<Competitions>({ international: [], club: [], other: [] })
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)

  const [opponent, setOpponent] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [competition, setCompetition] = useState('Friendly')
  const [customCompetition, setCustomCompetition] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [lineupId, setLineupId] = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${teamId}`),
      api.get(`/teams/${teamId}/lineups`),
      api.get('/reference/teams'),
      api.get('/reference/competitions')
    ])
      .then(([t, l, n, c]) => {
        setTeamName(t.data.name)
        setLineups(l.data)
        setNationalTeams(n.data)
        setCompetitions(c.data)
        if (l.data.length > 0) setLineupId(l.data[0].id)
        setLoaded(true)
      })
      .catch(() => navigate(`/teams/${teamId}`))
  }, [teamId, navigate])

  const query = opponent.trim().toLowerCase()
  const matchesFor = query
    ? nationalTeams.filter(t => t.name.toLowerCase().includes(query) || t.code.toLowerCase().includes(query)).slice(0, 6)
    : []

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    if (!opponent.trim()) return setError('Opponent name is required')
    if (!lineupId) return setError('Please select a lineup')
    setSubmitting(true)
    try {
      await api.post(`/teams/${teamId}/matches`, {
        opponentName: opponent.trim(),
        competition: customCompetition.trim() || competition,
        scheduledAt: date ? `${date}T${time || '00:00'}` : null,
        lineupId
      })
      navigate(`/teams/${teamId}?tab=matches`)
    } catch {
      setError('Failed to create match')
      setSubmitting(false)
    }
  }

  if (!loaded) return <div className="h-dvh bg-surface flex items-center justify-center text-muted text-sm">Loading…</div>

  const opponentField = (
    <Field label="Opponent" hint="Pick a national team or type any club name">
      <div className="relative">
        <input
          className={input}
          value={opponent}
          onChange={e => { setOpponent(e.target.value); setSuggesting(true) }}
          onFocus={() => setSuggesting(true)}
          onBlur={() => setTimeout(() => setSuggesting(false), 120)}
          placeholder="Italy, ITA, Sir Safety Perugia…"
        />
        {suggesting && matchesFor.length > 0 && (
          <div className="absolute z-10 top-full inset-x-0 mt-1 bg-card border border-line rounded">
            {matchesFor.map(t => (
              <button
                key={t.code}
                type="button"
                onMouseDown={() => { setOpponent(t.name); setSuggesting(false) }}
                className="w-full flex items-center gap-3 px-3 h-9 pointer-coarse:h-11 text-left hover:bg-line transition-motion-fast"
              >
                <span>{t.flag}</span>
                <span className="text-white text-sm">{t.name}</span>
                <span className="text-muted text-xs ml-auto">{t.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  )

  const lineupField = (
    <Field label="Lineup">
      {lineups.length === 0 ? (
        <div className="border border-line rounded px-3 py-2.5 text-sm">
          <span className="text-muted">No lineups yet. </span>
          <button type="button" onClick={() => navigate(`/teams/${teamId}/lineups/new`)} className="text-us hover:text-libero">Create one first →</button>
        </div>
      ) : (
        <select className={input} value={lineupId} onChange={e => setLineupId(e.target.value)}>
          {lineups.map(l => <option key={l.id} value={l.id}>{l.name} · {l.rotationSystem}</option>)}
        </select>
      )}
    </Field>
  )

  const whenField = (
    <Field label="Date & time" hint="Optional, leave empty if not confirmed">
      <div className="flex gap-2">
        <input type="date" className={`${input} [color-scheme:dark]`} value={date} onChange={e => setDate(e.target.value)} />
        <input type="time" className={`${input} w-32 [color-scheme:dark]`} value={time} onChange={e => setTime(e.target.value)} />
      </div>
    </Field>
  )

  const competitionField = (
    <Field label="Competition">
      <div className="space-y-3">
        {GROUPS.filter(g => competitions[g.key]?.length).map(g => (
          <div key={g.key}>
            <p className="text-muted text-xs mb-1.5">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {competitions[g.key].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCompetition(c); setCustomCompetition('') }}
                  className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-widest transition-motion-fast pointer-coarse:min-h-11 ${
                    competition === c && !customCompetition ? 'bg-us text-white' : 'border border-line text-muted hover:text-white hover:border-us'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ))}
        <input className={input} value={customCompetition} onChange={e => setCustomCompetition(e.target.value)} placeholder="Or type another competition…" />
      </div>
    </Field>
  )

  const steps = [
    { title: 'Opponent', body: <>{opponentField}{lineupField}</> },
    { title: 'Competition', body: competitionField },
    { title: 'When', body: whenField }
  ]

  return (
    <PageShell
      maxWidth="max-w-4xl"
      breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=matches` },
        { label: 'New Match' }
      ]}
    >
      <header className="shrink-0 mb-5">
        <h1 className="text-xl font-semibold">Schedule a match</h1>
        <p className="text-muted text-sm mt-1">
          {bp === 'phone' ? `Step ${step + 1} of ${steps.length} · ${steps[step].title}` : 'Add an upcoming match for your team'}
        </p>
      </header>

      <form onSubmit={e => { if (bp === 'phone' && step < steps.length - 1) { e.preventDefault(); setStep(step + 1) } else submit(e) }} className="flex-1 min-h-0 flex flex-col">
        {bp === 'phone' ? (
          <div className="flex-1 min-h-0 space-y-5">{steps[step].body}</div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-8 content-start">
            <div className="space-y-5">{opponentField}{whenField}{lineupField}</div>
            <div>{competitionField}</div>
          </div>
        )}

        {error && <p className="shrink-0 text-opp-soft text-sm mb-2">{error}</p>}

        <div className="shrink-0 flex gap-3 pt-4 border-t border-line">
          {bp === 'phone' && step > 0
            ? <Button tone="neutral" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>Back</Button>
            : <Button tone="danger" size="lg" className="flex-1" onClick={() => navigate(`/teams/${teamId}?tab=matches`)}>Cancel</Button>}
          {bp === 'phone' && step < steps.length - 1
            ? <Button tone="primary" size="lg" className="flex-1" onClick={() => setStep(step + 1)}>Next</Button>
            : <Button tone="primary" size="lg" className="flex-1" type="submit" disabled={submitting || lineups.length === 0}>{submitting ? 'Scheduling…' : 'Schedule match'}</Button>}
        </div>
      </form>
    </PageShell>
  )
}

export default NewMatchPage

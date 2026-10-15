import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import PageShell from '../components/PageShell'
import FitList from '../components/ui/FitList'
import Pill from '../components/ui/Pill'
import MarginChart from '../components/report/MarginChart'
import Court from '../components/Court'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { lastName } from '../lib/match/labels'
import type { PlayerStats } from '../types'

type Line = Omit<PlayerStats, 'playerId' | 'playerName'>

interface Report {
  match: { id: string; teamId: string; teamName: string; opponentName: string; competition: string; status: string; date: string | null }
  ourSetsWon: number
  opponentSetsWon: number
  sets: { setNumber: number; ourScore: number; opponentScore: number; status: string; progression: { rally: number; us: number; them: number }[] }[]
  players: (PlayerStats & { number: string })[]
  opponentPlayers: (Line & { opponentPlayerId: string; jersey: number; name: string | null })[]
  teams: { us: Line; opponent: Line }
  rotation: { rotation: number; won: number; lost: number; net: number }[]
  attackZones: { zone: number; attempts: number; kills: number; errors: number; efficiency: number }[]
  log: { at: string; setNumber: number; score: string; kind: 'substitution' | 'timeout' | 'challenge'; text: string }[]
}

const pct = (total: number, value: number) => (total ? `${Math.round(value * 100)}%` : '—')
const Title = ({ children }: { children: string }) => <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-2">{children}</p>

const MatchReportPage = () => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const [report, setReport] = useState<Report | null>(null)
  const [setIndex, setSetIndex] = useState(0)
  const [tab, setTab] = useState<'summary' | 'players' | 'sets' | 'log'>('summary')
  const [side, setSide] = useState<'us' | 'opponent'>('us')
  const [chartView, setChartView] = useState<'margin' | 'zones'>('margin')

  useEffect(() => {
    api.get(`/matches/${matchId}/report`).then(r => setReport(r.data)).catch(() => navigate('/dashboard'))
  }, [matchId, navigate])

  if (!report) return <div className="h-dvh bg-surface flex items-center justify-center text-muted text-sm">Loading report…</div>

  const { match } = report
  const won = report.ourSetsWon > report.opponentSetsWon
  const set = report.sets[Math.min(setIndex, report.sets.length - 1)]
  const short = match.teamName.split(' ')[0]

  const header = (
    <header className="shrink-0 flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted">
          {match.competition} · {match.date ? new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set'}
        </p>
        <h1 className="text-2xl font-semibold mt-1">
          <span className={match.status === 'completed' ? (won ? 'text-us' : 'text-opp-soft') : 'text-muted'}>
            {match.status === 'completed' ? (won ? 'Win' : 'Loss') : 'In progress'}
          </span>
          <span className="text-white tabular-nums"> {report.ourSetsWon}–{report.opponentSetsWon}</span>
          <span className="text-muted text-base font-normal"> vs {match.opponentName}</span>
        </h1>
      </div>
      <div className="flex gap-1.5">
        {report.sets.map(s => (
          <span key={s.setNumber} className={`px-2 py-0.5 rounded border border-line text-xs tabular-nums ${s.ourScore > s.opponentScore ? 'text-us' : 'text-opp-soft'}`}>
            <span className="text-muted mr-1">S{s.setNumber}</span>{s.ourScore}–{s.opponentScore}
          </span>
        ))}
      </div>
    </header>
  )

  const maxKills = Math.max(1, ...report.attackZones.map(z => z.kills))
  const zoneOverlay = Object.fromEntries(report.attackZones.filter(z => z.attempts > 0).map(z => [z.zone, {
    intensity: z.kills / maxKills,
    label: `${z.kills}/${z.attempts}`,
    sub: `${Math.round(z.efficiency * 100)}% eff`
  }]))
  const zonedAttacks = report.attackZones.reduce((n, z) => n + z.attempts, 0)

  const chart = (
    <section className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 flex items-center justify-between gap-2 mb-2">
        <div className="flex gap-1">
          <Pill selected={chartView === 'margin'} onClick={() => setChartView('margin')}>Margin</Pill>
          <Pill selected={chartView === 'zones'} onClick={() => setChartView('zones')}>Attack zones</Pill>
        </div>
        {chartView === 'margin' && (
          <div className="flex gap-1">
            {report.sets.map((s, i) => (
              <Pill key={s.setNumber} selected={i === setIndex} onClick={() => setSetIndex(i)}>S{s.setNumber}</Pill>
            ))}
          </div>
        )}
      </div>
      {chartView === 'margin' && (set ? <MarginChart progression={set.progression} teamName={match.teamName} opponentName={match.opponentName} /> : <p className="text-xs text-muted">No sets played</p>)}
      {chartView === 'zones' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <p className="shrink-0 text-xs text-muted">
            Kills / attacks by the zone the attack was hit from{zonedAttacks === 0 ? ' — no attacks were coded with a zone yet' : ` · ${zonedAttacks} attacks with a zone`}
          </p>
          <Court players={[]} mode="live" fit="contain" showFooter={false} zoneOverlay={zoneOverlay} className="flex-1 min-h-0" />
        </div>
      )}
      <table className="shrink-0 w-full text-xs mt-2 tabular-nums">
        <thead>
          <tr className="text-[9px] uppercase tracking-widest text-muted">
            <th className="text-left font-normal">Team</th>
            {report.sets.map(s => <th key={s.setNumber} className="text-right font-normal">S{s.setNumber}</th>)}
            <th className="text-right font-normal">Sets</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="text-white">{match.teamName}</td>{report.sets.map(s => <td key={s.setNumber} className="text-right">{s.ourScore}</td>)}<td className="text-right font-semibold">{report.ourSetsWon}</td></tr>
          <tr><td className="text-white">{match.opponentName}</td>{report.sets.map(s => <td key={s.setNumber} className="text-right">{s.opponentScore}</td>)}<td className="text-right font-semibold">{report.opponentSetsWon}</td></tr>
        </tbody>
      </table>
    </section>
  )

  const rowsForSide = side === 'us'
    ? report.players
    : report.opponentPlayers.map(o => ({ ...o, playerId: o.opponentPlayerId, playerName: o.name ?? `#${o.jersey}`, number: String(o.jersey) }))

  const players = (
    <FitList
      className="flex-1"
      items={rowsForSide}
      rowHeight={30}
      keyOf={p => p.playerId}
      empty={side === 'us' ? 'No events coded in this match' : 'No opponent players were coded in this match'}
      header={
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted">Players</p>
            <div className="flex gap-1.5">
              <Pill selected={side === 'us'} onClick={() => setSide('us')}>{short}</Pill>
              <Pill selected={side === 'opponent'} tone="opp" onClick={() => setSide('opponent')}>{match.opponentName}</Pill>
            </div>
          </div>
          <div className="grid grid-cols-[1.75rem_1fr_3rem_3rem_3rem_2.25rem_2.25rem] gap-2 text-[9px] uppercase tracking-widest text-muted pb-1 border-b border-line">
            <span>#</span><span>Player</span><span className="text-right">Atk</span><span className="text-right">Srv</span><span className="text-right">Rec</span><span className="text-right">Blk</span><span className="text-right">Pts</span>
          </div>
        </div>
      }
      renderRow={p => (
        <button
          type="button"
          onClick={() => side === 'us' && navigate(`/teams/${match.teamId}/players/${p.playerId}`)}
          className="w-full h-full grid grid-cols-[1.75rem_1fr_3rem_3rem_3rem_2.25rem_2.25rem] gap-2 items-center text-xs text-left border-b border-line/60 hover:bg-card transition-motion-fast"
        >
          <span className="text-us tabular-nums">{p.number}</span>
          <span className="truncate text-white">{lastName(p.playerName)}</span>
          <span className="text-right tabular-nums text-libero">{pct(p.attack.total, p.attack.efficiency)}</span>
          <span className="text-right tabular-nums text-libero">{pct(p.serve.total, p.serve.efficiency)}</span>
          <span className="text-right tabular-nums text-libero">{pct(p.reception.total, p.reception.efficiency)}</span>
          <span className="text-right tabular-nums text-white">{p.block.kills}</span>
          <span className="text-right tabular-nums text-white font-semibold">{p.totalPoints}</span>
        </button>
      )}
    />
  )

  const rows: { label: string; us: number; them: number; show: (v: number) => string }[] = [
    { label: 'Attack eff.', us: report.teams.us.attack.efficiency, them: report.teams.opponent.attack.efficiency, show: v => `${Math.round(v * 100)}%` },
    { label: 'Kills', us: report.teams.us.attack.kills, them: report.teams.opponent.attack.kills, show: String },
    { label: 'Aces', us: report.teams.us.serve.aces, them: report.teams.opponent.serve.aces, show: String },
    { label: 'Serve errors', us: report.teams.us.serve.errors, them: report.teams.opponent.serve.errors, show: String },
    { label: 'Reception eff.', us: report.teams.us.reception.efficiency, them: report.teams.opponent.reception.efficiency, show: v => `${Math.round(v * 100)}%` },
    { label: 'Blocks', us: report.teams.us.block.kills, them: report.teams.opponent.block.kills, show: String }
  ]

  const comparison = (
    <section className="shrink-0">
      <div className="flex justify-between text-[10px] uppercase tracking-widest mb-2">
        <span className="text-us">{short}</span><span className="text-muted">Head to head</span><span className="text-opp-soft">{match.opponentName}</span>
      </div>
      {rows.map(r => {
        const max = Math.max(Math.abs(r.us), Math.abs(r.them), 0.0001)
        return (
          <div key={r.label} className="grid grid-cols-[2.75rem_1fr_6.5rem_1fr_2.75rem] items-center gap-2 h-7 text-xs">
            <span className="text-right tabular-nums text-white">{r.show(r.us)}</span>
            <span className="flex justify-end"><span className="h-2 bg-us rounded-sm" style={{ width: `${(Math.max(r.us, 0) / max) * 100}%` }} /></span>
            <span className="text-center text-[10px] uppercase tracking-widest text-muted truncate">{r.label}</span>
            <span className="flex"><span className="h-2 bg-opp-soft rounded-sm" style={{ width: `${(Math.max(r.them, 0) / max) * 100}%` }} /></span>
            <span className="tabular-nums text-white">{r.show(r.them)}</span>
          </div>
        )
      })}
      <p className="text-[10px] text-muted mt-1">Opponent figures count events coded for the opponent team.</p>
    </section>
  )

  const maxRally = Math.max(1, ...report.rotation.flatMap(r => [r.won, r.lost]))
  const rotation = (
    <section className="shrink-0">
      <Title>Rotation efficiency — match</Title>
      {report.rotation.map(r => (
        <div key={r.rotation} className="grid grid-cols-[2rem_1fr_1fr_2.25rem] items-center gap-2 h-7 text-xs">
          <span className="text-white font-semibold">R{r.rotation}</span>
          <span className="flex justify-end"><span className="h-2 bg-opp-soft rounded-sm" style={{ width: `${(r.lost / maxRally) * 100}%` }} /></span>
          <span className="flex"><span className="h-2 bg-us rounded-sm" style={{ width: `${(r.won / maxRally) * 100}%` }} /></span>
          <span className={`text-right tabular-nums font-semibold ${r.net > 0 ? 'text-us' : r.net < 0 ? 'text-opp-soft' : 'text-muted'}`}>{r.net > 0 ? `+${r.net}` : r.net}</span>
        </div>
      ))}
    </section>
  )

  const log = (
    <FitList
      className="flex-1"
      items={report.log}
      rowHeight={30}
      keyOf={l => `${l.at}-${l.text}`}
      empty="No substitutions, time-outs or challenges"
      header={<Title>Subs · time-outs · challenges</Title>}
      renderRow={l => (
        <div className="h-full flex items-center gap-2 text-xs border-b border-line/60">
          <span className="text-[9px] text-muted w-6 shrink-0">S{l.setNumber}</span>
          <span className="tabular-nums text-white w-11 shrink-0">{l.score}</span>
          <span className="truncate text-libero">{l.text}</span>
        </div>
      )}
    />
  )

  return (
    <PageShell
      maxWidth="max-w-7xl"
      breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: match.teamName, path: `/teams/${match.teamId}?tab=matches` },
        { label: `Report · vs ${match.opponentName}` }
      ]}
    >
      {header}
      {bp === 'phone' ? (
        <>
          <div className="shrink-0 flex gap-1.5 mb-3">
            {(['summary', 'players', 'sets', 'log'] as const).map(t => (
              <Pill key={t} selected={tab === t} onClick={() => setTab(t)}>{t}</Pill>
            ))}
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            {tab === 'summary' && chart}
            {tab === 'players' && players}
            {tab === 'sets' && <>{comparison}{rotation}</>}
            {tab === 'log' && log}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] gap-6">
          <div className="min-h-0 flex flex-col gap-4">{chart}<div className="xl:hidden">{comparison}</div></div>
          <div className="min-h-0 flex flex-col gap-4">{players}<div className="hidden xl:block">{comparison}</div><div className="xl:hidden">{rotation}</div><div className="xl:hidden flex-1 min-h-0 flex flex-col">{log}</div></div>
          <div className="hidden xl:flex min-h-0 flex-col gap-4">{rotation}{log}</div>
        </div>
      )}
    </PageShell>
  )
}

export default MatchReportPage

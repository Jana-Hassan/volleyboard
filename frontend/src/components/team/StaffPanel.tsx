import { useState } from 'react'
import type { FormEvent } from 'react'
import api from '../../lib/api'
import type { Team, TeamMember } from '../../types'
import Button from '../ui/Button'
import FitList from '../ui/FitList'

const ROLES = ['coach', 'assistant', 'analyst', 'trainer'] as const

const MESSAGES: Record<string, string> = {
  'User not found': 'No account uses that email yet. Ask them to register, then invite them.',
  'User is already a team member': 'They are already on this team.'
}

const errorOf = (err: unknown) => {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not do that'
  return MESSAGES[message] ?? message
}

interface StaffPanelProps {
  team: Team
  currentUserId: string | undefined
  canManage: boolean
  onChange: (members: TeamMember[]) => void
}

const StaffPanel = ({ team, currentUserId, canManage, onChange }: StaffPanelProps) => {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]>('analyst')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const managers = team.members.filter(m => m.role === 'manager').length

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return setError('Enter an email address')
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.post<TeamMember>(`/teams/${team.id}/invite`, { email: email.trim(), role })
      onChange([...team.members, res.data])
      setNotice(`${res.data.user.name} joined as ${role}`)
      setEmail('')
    } catch (err) {
      setError(errorOf(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (member: TeamMember) => {
    setBusy(true)
    setError('')
    try {
      await api.delete(`/teams/${team.id}/members/${member.userId}`)
      onChange(team.members.filter(m => m.userId !== member.userId))
      setNotice(`${member.user.name} was removed`)
    } catch (err) {
      setError(errorOf(err))
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  const input = 'bg-card border border-line text-white placeholder-muted rounded px-3 py-2 text-sm focus:outline-none focus:border-us transition-motion-fast pointer-coarse:min-h-11'

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {canManage && (
        <form onSubmit={invite} className="shrink-0 border border-line bg-card rounded p-4 flex flex-col md:flex-row gap-2 md:items-end">
          <label className="flex-1">
            <span className="block text-[10px] uppercase tracking-widest text-muted mb-1">Invite by email</span>
            <input className={`${input} w-full`} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@club.com" />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-widest text-muted mb-1">Role</span>
            <select className={`${input} w-full md:w-36 capitalize`} value={role} onChange={e => setRole(e.target.value as typeof role)}>
              {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </label>
          <Button tone="primary" type="submit" disabled={busy}>Invite</Button>
        </form>
      )}
      {(error || notice) && <p className={`shrink-0 text-xs ${error ? 'text-opp-soft' : 'text-us'}`}>{error || notice}</p>}

      <FitList
        className="flex-1"
        items={team.members}
        rowHeight={48}
        keyOf={m => m.id}
        empty="No staff yet"
        renderRow={m => {
          const isSelf = m.userId === currentUserId
          const removable = canManage && !isSelf && !(m.role === 'manager' && managers <= 1)
          return (
            <div className="h-full flex items-center gap-3 border-b border-line/60 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-white truncate">{m.user.name}{isSelf && <span className="text-muted"> · you</span>}</p>
                <p className="text-[11px] text-muted truncate">{m.user.email}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-us w-20 text-right">{m.role}</span>
              <div className="w-36 flex justify-end">
                {removable && confirming !== m.userId && (
                  <Button size="sm" tone="ghost" onClick={() => setConfirming(m.userId)}>Remove</Button>
                )}
                {confirming === m.userId && (
                  <div className="flex gap-1.5">
                    <Button size="sm" tone="danger" disabled={busy} onClick={() => remove(m)}>Remove</Button>
                    <Button size="sm" tone="neutral" onClick={() => setConfirming(null)}>Keep</Button>
                  </div>
                )}
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}

export default StaffPanel

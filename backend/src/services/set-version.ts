import { Prisma } from '@prisma/client'
import type { AnyDomainEvent } from '../events/domain-events'

export const stampWithin = async (
  tx: Prisma.TransactionClient,
  setId: string,
  events: AnyDomainEvent[]
): Promise<AnyDomainEvent[]> => {
  if (events.length === 0) return events
  const updated = await tx.matchSet.update({
    where: { id: setId },
    data: { version: { increment: events.length } }
  })
  const first = updated.version - events.length + 1
  return events.map((event, i) => ({
    ...event,
    payload: { ...event.payload, setId, version: first + i }
  }) as AnyDomainEvent)
}

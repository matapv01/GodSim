import { describe, expect, it } from 'vitest'
import { CasualEncounter } from './CasualEncounter'

function makeEncounter(relationship?: {
  status: string
  interactionCount: number
  recentTopics?: string[]
}) {
  const journal = {
    getRelationship: () => relationship,
    getRecentActivities: () => [],
    getRecentDialogueSummaries: () => [],
  }
  return new CasualEncounter(
    () => {},
    () => {},
    () => {},
    () => {},
    undefined,
    undefined,
    () => journal as any,
  )
}

const minh = { id: 'citizen_1', name: 'Minh', label: 'Minh' } as any
const lan = { id: 'citizen_2', name: 'Lan', label: 'Lan' } as any

describe('CasualEncounter grounded dialogue', () => {
  it('does not invent prior events or appointments for strangers', () => {
    const encounter = makeEncounter()
    const chat = (encounter as any).buildChat(minh, lan, [])
    const text = chat.turns.map((turn: any) => turn.text).join(' ').toLowerCase()

    expect(text).toContain('lần đầu')
    expect(text).not.toMatch(/hôm trước|tối qua|tối gặp|đã hẹn|ghen/)
  })

  it('continues only the topic stored in relationship memory', () => {
    const encounter = makeEncounter({
      status: 'friend',
      interactionCount: 4,
      recentTopics: ['Lan đang cân nhắc đổi việc'],
    })
    const chat = (encounter as any).buildChat(minh, lan, [])
    const text = chat.turns.map((turn: any) => turn.text).join(' ')

    expect(chat.summary).toContain('Lan đang cân nhắc đổi việc')
    expect(text).toContain('Lan đang cân nhắc đổi việc')
    expect(text).not.toMatch(/tối gặp|tối qua/)
  })
})

import { describe, it, expect } from 'vitest'
import { extractSoulId } from '../TownConfig'

describe('extractSoulId', () => {
  it('extracts soul ID from absolute path (legacy format)', () => {
    expect(extractSoulId('/Users/xxx/agentshire/town-souls/YAN.md')).toBe('YAN')
    expect(extractSoulId('/Users/xxx/agentshire/town-data/souls/soul.md')).toBe('soul')
  })

  it('extracts soul ID from relative path (new format)', () => {
    expect(extractSoulId('town-souls/YAN.md')).toBe('YAN')
    expect(extractSoulId('town-data/souls/citizen_2.md')).toBe('citizen_2')
  })

  it('handles bare filename without directory', () => {
    expect(extractSoulId('SOUL.md')).toBe('SOUL')
  })

  it('returns empty string for empty input', () => {
    expect(extractSoulId('')).toBe('')
  })

  it('handles filename without .md extension', () => {
    expect(extractSoulId('town-souls/YAN')).toBe('YAN')
  })

  it('is case-insensitive for .md extension', () => {
    expect(extractSoulId('town-souls/YAN.MD')).toBe('YAN')
    expect(extractSoulId('town-souls/YAN.Md')).toBe('YAN')
  })
})

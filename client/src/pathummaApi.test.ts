import { describe, it, expect } from 'vitest'
import { classifyMoodFromText } from './pathummaApi'

describe('classifyMoodFromText', () => {
  it('returns a non-empty string', () => {
    expect(typeof classifyMoodFromText('ดีใจมาก')).toBe('string')
    expect(classifyMoodFromText('ดีใจมาก').length).toBeGreaterThan(0)
  })
  it('handles empty string without throwing', () => {
    expect(() => classifyMoodFromText('')).not.toThrow()
  })
  it('handles sad text', () => {
    expect(typeof classifyMoodFromText('เศร้ามาก')).toBe('string')
  })
})

import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify('Friday Night Poker!')).toBe('friday-night-poker')
  })
  it('collapses runs and trims dashes', () => {
    expect(slugify('  --Home   & Game--  ')).toBe('home-game')
  })
  it('caps at 40 chars without a trailing dash', () => {
    const slug = slugify('a'.repeat(39) + ' bcd')
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
    expect(slugify('x'.repeat(60))).toBe('x'.repeat(40))
  })
  it("falls back to 'group' when too short", () => {
    expect(slugify('A!')).toBe('group')
    expect(slugify('♠♥')).toBe('group')
    expect(slugify('')).toBe('group')
  })
  it('keeps digits', () => {
    expect(slugify('Table 42')).toBe('table-42')
  })
})

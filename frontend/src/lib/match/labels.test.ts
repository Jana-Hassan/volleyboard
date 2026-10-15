import { describe, expect, it } from 'vitest'
import { lastName } from './labels'

describe('lastName', () => {
  it('keeps the family name of a full name', () => {
    expect(lastName('Yuki Ishikawa')).toBe('Ishikawa')
  })

  it('keeps a single-word name as is', () => {
    expect(lastName('Palonsky')).toBe('Palonsky')
  })

  it('keeps surname particles with the family name', () => {
    expect(lastName('De Cecco')).toBe('De Cecco')
    expect(lastName('Luciano De Cecco')).toBe('De Cecco')
    expect(lastName('Nimir Abdel-Aziz')).toBe('Abdel-Aziz')
    expect(lastName('Jeroen van der Berg')).toBe('van der Berg')
  })
})

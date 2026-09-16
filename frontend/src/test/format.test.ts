import { describe, expect, it } from 'vitest'
import { durationToFriendlyUnit, friendlyUnitToDuration } from '../lib/format'

describe('prazo amigável', () => {
  it('converte horas e dias sem expor minutos ao usuário', () => {
    expect(friendlyUnitToDuration(24, 'hours')).toBe('24:00:00')
    expect(friendlyUnitToDuration(2, 'days')).toBe('48:00:00')
    expect(durationToFriendlyUnit('48:00:00')).toEqual({ value: 2, unit: 'days' })
    expect(durationToFriendlyUnit('12:00:00')).toEqual({ value: 12, unit: 'hours' })
  })
})

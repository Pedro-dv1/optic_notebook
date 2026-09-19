import { describe, expect, it } from 'vitest'
import { durationToFriendlyUnit, friendlyUnitToDuration, whatsappUrl } from '../lib/format'

describe('prazo amigável', () => {
  it('converte horas e dias sem expor minutos ao usuário', () => {
    expect(friendlyUnitToDuration(24, 'hours')).toBe('24:00:00')
    expect(friendlyUnitToDuration(2, 'days')).toBe('48:00:00')
    expect(durationToFriendlyUnit('48:00:00')).toEqual({ value: 2, unit: 'days' })
    expect(durationToFriendlyUnit('12:00:00')).toEqual({ value: 12, unit: 'hours' })
  })
})

describe('WhatsApp', () => {
  it('normaliza telefone brasileiro e codifica a mensagem', () => {
    expect(whatsappUrl('(11) 99999-9999', 'Olá, José!'))
      .toBe('https://wa.me/5511999999999?text=Ol%C3%A1%2C%20Jos%C3%A9!')
    expect(whatsappUrl('inválido', 'Olá')).toBeNull()
  })
})

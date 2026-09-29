import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectField } from '../components/ui'

describe('SelectField', () => {
  it('mantém teclado, seleção, validação e FormData no mesmo valor', async () => {
    const onChange = vi.fn()
    render(<form aria-label="Cadastro"><SelectField label="Unidade" name="unit" required defaultValue="" onChange={onChange}>
      <option value="" disabled>Selecione uma unidade</option>
      <option value="center">Centro</option>
      <option value="north">Norte</option>
    </SelectField></form>)
    const trigger = screen.getByRole('combobox', { name: 'Unidade' })
    const form = screen.getByRole('form', { name: 'Cadastro' }) as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'Centro' }))
    expect(trigger).toHaveTextContent('Centro')
    expect(new FormData(form).get('unit')).toBe('center')
    expect(form.checkValidity()).toBe(true)
    expect(onChange.mock.lastCall?.[0].target.value).toBe('center')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger.getAttribute('aria-activedescendant')).toMatch(/-2$/)
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(new FormData(form).get('unit')).toBe('north')
    fireEvent.keyDown(trigger, { key: ' ' })
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.reset(form)
    await waitFor(() => expect(new FormData(form).get('unit')).toBe(''))
  })

  it('mostra erro e impede abertura quando desabilitado', () => {
    render(<SelectField label="Status" disabled error="Escolha um status"><option value="">Todos</option></SelectField>)
    const trigger = screen.getByRole('combobox', { name: 'Status' })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha um status')
    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('usa placeholder sem enviar a primeira opção antes da escolha', () => {
    render(<form aria-label="Filtro"><SelectField label="Status" name="status" placeholder="Selecione um status" required><option value="ACTIVE">Ativo</option></SelectField></form>)
    const form = screen.getByRole('form', { name: 'Filtro' }) as HTMLFormElement
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Selecione um status')
    expect(new FormData(form).get('status')).toBe('')
    expect(form.checkValidity()).toBe(false)
  })
})

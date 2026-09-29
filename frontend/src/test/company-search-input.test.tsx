import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { CompanySearchInput } from '../components/CompanySearchInput'

afterEach(() => vi.useRealTimers())

it('escreve e apaga exemplos sem alterar a busca e pausa durante a digitação', () => {
  vi.useFakeTimers()
  function Search() {
    const [value, setValue] = useState('')
    return <label>Pesquisar empresa<CompanySearchInput value={value} onChange={(event) => setValue(event.target.value)} /></label>
  }
  render(<Search />)
  const input = screen.getByRole('textbox', { name: 'Pesquisar empresa' }) as HTMLInputElement
  expect(input.placeholder).toBe('S|')
  for (let index = 1; index < 'Salão de beleza'.length; index++) act(() => vi.advanceTimersByTime(100))
  expect(input.placeholder).toBe('Salão de beleza|')
  act(() => vi.advanceTimersByTime(1100))
  act(() => vi.advanceTimersByTime(55))
  expect(input.placeholder).toBe('Salão de belez|')
  expect(input.value).toBe('')
  fireEvent.focus(input)
  expect(input.placeholder).toBe('Pesquisar empresa')
  fireEvent.change(input, { target: { value: 'Barbearia' } })
  act(() => vi.advanceTimersByTime(2000))
  expect(input.value).toBe('Barbearia')
  expect(input.placeholder).toBe('Pesquisar empresa')
})

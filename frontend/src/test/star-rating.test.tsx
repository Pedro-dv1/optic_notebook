import { fireEvent, render, screen } from '@testing-library/react'
import type { FormEvent } from 'react'
import { expect, it, vi } from 'vitest'
import { StarRating } from '../components/StarRating'

it('seleciona estrelas e envia a nota pelo formulário', () => {
  const submit = vi.fn((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    expect(new FormData(event.currentTarget).get('rating')).toBe('4')
  })
  render(<form onSubmit={submit}><StarRating /><button>Enviar</button></form>)

  expect(screen.getAllByRole('radio', { name: /estrela/ })).toHaveLength(5)
  expect(screen.getByText('Nota')).toHaveClass('sr-only')
  fireEvent.mouseEnter(screen.getByRole('radio', { name: '4 estrelas' }).closest('label')!)
  expect(screen.getByRole('radio', { name: '4 estrelas' })).not.toBeChecked()
  fireEvent.click(screen.getByRole('radio', { name: '4 estrelas' }))
  expect(screen.getByRole('radio', { name: '4 estrelas' })).toBeChecked()
  expect(screen.queryByText('4 de 5 estrelas')).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '4 estrelas' }).closest('label')!.querySelector('svg')).toHaveClass('fill-[#f5c518]', 'stroke-none')
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(submit).toHaveBeenCalledOnce()
})

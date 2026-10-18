import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AreaPage } from './area-page'

function renderArea(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/area/:areaId" element={<AreaPage onCapture={() => undefined} />} /></Routes></MemoryRouter>)
}

describe('AreaPage', () => {
  it('renders seeded pages and views from generic area data', async () => {
    renderArea('/area/home-budget')
    expect(await screen.findByRole('heading', { name: 'Home Budget' })).toBeInTheDocument()
    expect(await screen.findByText('Spent this month')).toBeInTheDocument()
    expect(screen.getByText('Recent purchases')).toBeInTheDocument()
  })

  it('uses the same generic page for an area with a gallery view', async () => {
    renderArea('/area/personal-inventory')
    expect(await screen.findByRole('heading', { level: 1, name: 'Personal Inventory' })).toBeInTheDocument()
    expect(await screen.findAllByText('Rangefinder camera')).toHaveLength(2)
  })
})

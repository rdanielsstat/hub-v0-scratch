import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AreaPage } from './area-page'

function renderArea(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/area/:areaId"
          element={<AreaPage onCapture={() => undefined} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AreaPage', () => {
  it('renders seeded pages and views from generic area data', async () => {
    renderArea('/area/home-budget')
    expect(
      await screen.findByRole('heading', { name: 'Home Budget' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Spent this month')).toBeInTheDocument()
    expect(screen.getByText('Recent purchases')).toBeInTheDocument()
  })

  it('uses the same generic page for an area with a gallery view', async () => {
    renderArea('/area/personal-inventory')
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Personal Inventory',
      }),
    ).toBeInTheDocument()
    expect(await screen.findAllByText('Rangefinder camera')).toHaveLength(1)
  })

  it('opens the friendly block picker and supports slash in a text block', async () => {
    const user = userEvent.setup()
    renderArea('/area/spirituality-code')
    await user.click(await screen.findByRole('button', { name: 'Customize' }))
    await user.click(
      screen.getByRole('textbox', { name: 'Text in A personal creed' }),
    )
    await user.keyboard('/')
    expect(await screen.findAllByText('Embedded page')).not.toHaveLength(0)
    expect(
      screen.getAllByText('Add a thought, note, or longer passage.'),
    ).not.toHaveLength(0)
  })

  it('shows block menu actions and opens human-labeled settings that close with Escape', async () => {
    const user = userEvent.setup()
    renderArea('/area/personal-inventory')
    await user.click(await screen.findByRole('button', { name: 'Customize' }))
    await user.click(
      screen.getByRole('button', { name: 'Personal Inventory block menu' }),
    )
    expect(
      screen.getByRole('button', { name: 'Duplicate' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Move up' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: 'Move down' }).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Number' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Line chart' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'This month' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Last 30 days' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '12 months' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'All time' })).toBeInTheDocument()
    for (const label of [
      'Sum',
      'Average',
      'Count',
      'Lowest',
      'Highest',
      'Latest',
      'Bar chart',
      'Donut chart',
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByText('thisMonth')).not.toBeInTheDocument()
    expect(screen.queryByText('stat')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Block settings' }),
      ).not.toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute(
        'id',
        'block-inventory-gallery',
      ),
    )
  })
})

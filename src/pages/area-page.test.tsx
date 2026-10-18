import { describe, expect, it, vi } from 'vitest'
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

  it('starts a newly added page empty instead of copying overview blocks', async () => {
    const user = userEvent.setup()
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Notes')
    renderArea('/area/home-budget')
    await user.click(await screen.findByRole('button', { name: 'Customize' }))
    await user.click(screen.getByRole('button', { name: 'Edit layout' }))
    await user.click(screen.getByRole('button', { name: 'Add page' }))
    expect(await screen.findByText('This page is empty')).toBeInTheDocument()
    expect(screen.queryByText('Spent this month')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a block' })).toBeInTheDocument()
    prompt.mockRestore()
  })

  it('shows a photo-free Inventory summary on its overview page', async () => {
    renderArea('/area/personal-inventory')
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Personal Inventory',
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Total value')).toBeInTheDocument()
    expect(screen.getByText('Items tracked')).toBeInTheDocument()
    expect(screen.getByText('Warranties ending soon')).toBeInTheDocument()
    expect(screen.getByText('Items by location')).toBeInTheDocument()
    expect(screen.getByText('Recently added')).toBeInTheDocument()
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('saves page-specific settings and restores the template defaults', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderArea('/area/home-budget')

    await user.click(await screen.findByRole('button', { name: 'Customize' }))
    await user.click(screen.getByRole('button', { name: 'Page settings' }))
    const density = await screen.findByRole('combobox', { name: 'Page density' })
    await user.selectOptions(density, 'compact')
    await waitFor(() => expect(density).toHaveValue('compact'))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Customize' }))
    await user.click(screen.getByRole('button', { name: 'Page settings' }))
    expect(await screen.findByRole('combobox', { name: 'Page density' })).toHaveValue('compact')
    await user.click(screen.getByRole('button', { name: 'Reset to template' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Page density' })).toHaveValue('comfortable'))
    expect(confirm).toHaveBeenCalledOnce()
    confirm.mockRestore()
  }, 10000)

  it('opens the friendly block picker and supports slash in a text block', async () => {
    const user = userEvent.setup()
    renderArea('/area/spirituality-code')
    await user.click(await screen.findByRole('button', { name: 'Customize' }))
    await user.click(screen.getByRole('button', { name: 'Edit layout' }))
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
    await user.click(screen.getByRole('button', { name: 'Edit layout' }))
    await user.click(
      screen.getByRole('button', { name: 'Total value block menu' }),
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
      screen.getAllByRole('option', { name: 'This month' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('option', { name: 'Last 30 days' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('option', { name: '12 months' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('option', { name: 'All time' }).length,
    ).toBeGreaterThan(0)
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
        'block-inventory-value',
      ),
    )
  })
})

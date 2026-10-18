import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { areaLayoutApi } from '@/services/api'
import { AreasDashboardPage } from './areas-dashboard'

describe('AreasDashboardPage', () => {
  it('switches to cards density and remembers the choice through the mock API', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AreasDashboardPage />
      </MemoryRouter>,
    )
    const density = await screen.findByRole('combobox', {
      name: 'Areas density',
    })
    await user.selectOptions(density, 'cards')
    expect(density).toHaveValue('cards')
    await waitFor(async () =>
      expect(await areaLayoutApi.getAreasPreferences()).toMatchObject({
        density: 'cards',
      }),
    )
    expect(screen.getByText('Personal Inventory').closest('li')).toHaveClass(
      'rounded-xl',
    )
  })
})

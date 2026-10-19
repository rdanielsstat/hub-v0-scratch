import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { collectionsApi } from '@/services/api'
import { CollectionPage } from './collection-page'

afterEach(() => vi.restoreAllMocks())

describe('CollectionPage', () => {
  it('opens a field cell on Enter and saves once without reloading the collection', async () => {
    const user = userEvent.setup()
    const listItems = vi.spyOn(collectionsApi, 'listCollectionItems')
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
    render(
      <MemoryRouter initialEntries={['/area/home-budget/collection/purchases']}>
        <Routes>
          <Route
            path="/area/:areaId/collection/:collectionId"
            element={<CollectionPage />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Purchases' })
    const merchantCell = (
      await screen.findAllByRole('button', {
        name: 'Merchant Weekly pantry restock, edit',
      })
    )[0]
    merchantCell.focus()
    await user.keyboard('{Enter}')
    const editor = await screen.findByRole('textbox', {
      name: 'Merchant Weekly pantry restock',
    })
    await user.clear(editor)
    await user.type(editor, 'Market Basket II{Enter}')
    expect(
      await screen.findAllByRole('button', {
        name: 'Merchant Weekly pantry restock, edit',
      }),
    ).not.toHaveLength(0)
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(1))
  })

  it('traps keyboard focus and supports entry notes and sub-items', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={[
          '/area/home-budget/collection/purchases?entry=purchase-0001',
        ]}
      >
        <Routes>
          <Route
            path="/area/:areaId/collection/:collectionId"
            element={<CollectionPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Weekly pantry restock details',
    })
    const openFullPage = screen.getByRole('button', { name: 'Open full page' })
    await waitFor(() => expect(openFullPage).toHaveFocus())
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(screen.getByRole('button', { name: 'Add note' })).toHaveFocus()
    await user.keyboard('{Tab}')
    expect(openFullPage).toHaveFocus()

    const subItemInput = screen.getByRole('textbox', { name: 'New sub-item' })
    await user.type(subItemInput, 'Check receipt')
    await user.click(screen.getByRole('button', { name: '+ Sub-item' }))
    expect(await within(dialog).findByText('Check receipt')).toBeInTheDocument()

    const noteInput = screen.getByRole('textbox', { name: 'Add a note' })
    await user.type(noteInput, 'Review this purchase')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect(
      await within(dialog).findByText('Review this purchase'),
    ).toBeInTheDocument()
  })
})

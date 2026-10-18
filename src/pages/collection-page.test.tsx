import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { collectionsApi } from '@/services/api'
import { CollectionPage } from './collection-page'

afterEach(() => vi.restoreAllMocks())

describe('CollectionPage', () => {
  it('opens a text cell on Enter and saves once without reloading the collection', async () => {
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
    const nameCell = (
      await screen.findAllByRole('button', {
        name: 'Name Weekly pantry restock, edit',
      })
    )[0]
    nameCell.focus()
    await user.keyboard('{Enter}')
    const editor = await screen.findByRole('textbox', {
      name: 'Name Weekly pantry restock',
    })
    await user.clear(editor)
    await user.type(editor, 'Monthly pantry order{Enter}')
    expect(
      await screen.findAllByRole('button', {
        name: 'Name Monthly pantry order, edit',
      }),
    ).not.toHaveLength(0)
    await waitFor(() => expect(listItems).toHaveBeenCalledTimes(1))
  })
})

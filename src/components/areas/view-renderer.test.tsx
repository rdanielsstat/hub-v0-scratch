import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FieldDef, Item, ViewSpec } from '@/services/api'
import { ViewRenderer } from './view-renderer'

const amount: FieldDef = {
  id: 'amount',
  name: 'Amount',
  type: 'currency',
  order: 0,
}

function item(id: string, value: number): Item {
  return {
    id,
    areaId: 'sample',
    collectionId: 'records',
    title: id,
    type: 'record',
    data: { amount: value },
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}

const stat: ViewSpec = {
  id: 'total',
  title: 'Total',
  collectionId: 'records',
  display: 'stat',
  filter: [],
  period: 'allTime',
  aggregate: { operation: 'sum', fieldId: 'amount' },
}

function renderStat(flow?: 'incoming' | 'outgoing') {
  return render(
    <MemoryRouter>
      <ViewRenderer
        spec={stat}
        items={[item('a', 28000), item('b', 180.5)]}
        fields={[amount]}
        flow={flow}
        onChangeSpec={() => {}}
      />
    </MemoryRouter>,
  )
}

describe('ViewRenderer stat tiles', () => {
  it('keeps thousands separators and sets the cents apart', () => {
    const { container } = renderStat()
    expect(screen.getByText('$28,180.50')).toBeTruthy()
    const shown = container.querySelector('p > span[aria-hidden="true"]')
    expect(shown?.textContent).toBe('$28,180.50')
    expect(shown?.querySelector('sup')?.textContent).toBe('.50')
  })

  it('signs outgoing totals with a minus and incoming with a plus', () => {
    renderStat('outgoing')
    expect(screen.getByText('-$28,180.50')).toBeTruthy()
    expect(document.body.textContent).toContain('−$28,180')
  })

  it('shows incoming totals with a plus', () => {
    renderStat('incoming')
    expect(document.body.textContent).toContain('+$28,180')
  })

  it('offers no chart or table toggle for a single number', () => {
    renderStat()
    expect(
      screen.queryByRole('button', { name: /chart view|table view/i }),
    ).toBeNull()
  })
})

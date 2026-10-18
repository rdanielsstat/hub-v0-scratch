import { describe, expect, it } from 'vitest'
import type { Item, ViewSpec } from '@/services/api'
import { aggregateView, applyViewSpec, groupView } from './view-spec'
import { mockBlocks, mockItems } from '@/services/api/mock-areas-data'

function item(id: string, amount: number, date: string): Item {
  return {
    id,
    areaId: 'sample',
    collectionId: 'records',
    title: id,
    type: 'record',
    occurredAt: date.slice(0, 10),
    data: { amount, date: date.slice(0, 10) },
    createdAt: date,
    updatedAt: date,
  }
}
const records = [
  item('older', 100, '2026-01-01T00:00:00.000Z'),
  item('first', 10, '2026-10-01T00:00:00.000Z'),
  item('latest', 30, '2026-10-12T00:00:00.000Z'),
]
const spec = (
  operation: NonNullable<ViewSpec['aggregate']>['operation'],
  period: ViewSpec['period'] = 'allTime',
): ViewSpec => ({
  id: 'view',
  title: 'View',
  collectionId: 'records',
  display: 'stat',
  filter: [],
  period,
  aggregate: { operation, fieldId: 'amount' },
})

describe('ViewSpec aggregates', () => {
  it('calculates sum, average, count, min, max, and latest over the selected period', () => {
    const now = new Date('2026-10-18T00:00:00.000Z')
    const expected: Array<
      [NonNullable<ViewSpec['aggregate']>['operation'], unknown]
    > = [
      ['sum', 40],
      ['average', 20],
      ['count', 2],
      ['min', 10],
      ['max', 30],
      ['latest', 30],
    ]
    for (const [operation, value] of expected) {
      const current = spec(operation, 'last30Days')
      expect(aggregateView(current, applyViewSpec(current, records, now))).toBe(
        value,
      )
    }
  })

  it('applies filter, sort, and limit before aggregation', () => {
    const current: ViewSpec = {
      ...spec('sum'),
      filter: [{ fieldId: 'amount', operator: 'greaterThan', value: 10 }],
      sort: { fieldId: 'amount', direction: 'desc' },
      limit: 1,
    }
    expect(aggregateView(current, applyViewSpec(current, records))).toBe(100)
  })

  it('computes Home Budget income, spending, and tax savings from separate current-month data', () => {
    const current = new Date()
    const totalFor = (id: string) => {
      const block = mockBlocks.find((entry) => entry.id === id)
      if (!block || block.type !== 'view') throw new Error(`Missing view ${id}`)
      const selected = mockItems.filter(
        (entry) => entry.collectionId === block.view.collectionId,
      )
      return aggregateView(
        block.view,
        applyViewSpec(block.view, selected, current),
      )
    }
    expect(totalFor('budget-income')).toBe(8780)
    expect(totalFor('budget-taxes')).toBe(1500)
    expect(totalFor('budget-spent')).not.toBe(totalFor('budget-income'))
  })

  it('keeps month groups ordered oldest to newest', () => {
    const current = { ...spec('sum'), groupBy: 'month' }
    expect(
      groupView(current, [...records].reverse()).map((group) => group.name),
    ).toEqual(['Jan 2026', 'Oct 2026'])
  })

  it('filters this month within the current calendar month only', () => {
    const current = spec('sum', 'thisMonth')
    expect(
      applyViewSpec(current, records, new Date('2026-10-18T00:00:00.000Z')).map(
        (entry) => entry.id,
      ),
    ).toEqual(['first', 'latest'])
  })
})

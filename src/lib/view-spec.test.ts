import { describe, expect, it } from 'vitest'
import type { Item, ViewSpec } from '@/services/api'
import { aggregateView, applyViewSpec } from './view-spec'

function item(id: string, amount: number, date: string): Item {
  return { id, areaId: 'sample', collectionId: 'records', title: id, type: 'record', occurredAt: date, data: { amount }, createdAt: date, updatedAt: date }
}
const records = [item('older', 100, '2026-01-01T00:00:00.000Z'), item('first', 10, '2026-10-01T00:00:00.000Z'), item('latest', 30, '2026-10-12T00:00:00.000Z')]
const spec = (operation: NonNullable<ViewSpec['aggregate']>['operation'], period: ViewSpec['period'] = 'allTime'): ViewSpec => ({ id: 'view', title: 'View', collectionId: 'records', display: 'stat', filter: [], period, aggregate: { operation, fieldId: 'amount' } })

describe('ViewSpec aggregates', () => {
  it('calculates sum, average, count, min, max, and latest over the selected period', () => {
    const now = new Date('2026-10-18T00:00:00.000Z')
    const expected: Array<[NonNullable<ViewSpec['aggregate']>['operation'], unknown]> = [
      ['sum', 40], ['average', 20], ['count', 2], ['min', 10], ['max', 30], ['latest', 30],
    ]
    for (const [operation, value] of expected) {
      const current = spec(operation, 'last30Days')
      expect(aggregateView(current, applyViewSpec(current, records, now))).toBe(value)
    }
  })

  it('applies filter, sort, and limit before aggregation', () => {
    const current: ViewSpec = { ...spec('sum'), filter: [{ fieldId: 'amount', operator: 'greaterThan', value: 10 }], sort: { fieldId: 'amount', direction: 'desc' }, limit: 1 }
    expect(aggregateView(current, applyViewSpec(current, records))).toBe(100)
  })
})

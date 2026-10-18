export type MockAreasScenario = 'normal' | 'slow' | 'error' | 'empty'

const requestedScenario =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('areasState')

let scenario: MockAreasScenario =
  requestedScenario === 'slow' ||
  requestedScenario === 'error' ||
  requestedScenario === 'empty'
    ? requestedScenario
    : 'normal'

export function setMockAreasScenario(next: MockAreasScenario) {
  scenario = next
}

export function getMockAreasScenario() {
  return scenario
}

export async function mockAreasRequest<T>(
  value: T,
  emptyValue?: T,
): Promise<T> {
  await new Promise((resolve) =>
    setTimeout(resolve, scenario === 'slow' ? 1500 : 180),
  )
  if (scenario === 'error')
    throw new Error('The Areas preview could not load. Try again.')
  if (scenario === 'empty' && emptyValue !== undefined)
    return structuredClone(emptyValue)
  return structuredClone(value)
}

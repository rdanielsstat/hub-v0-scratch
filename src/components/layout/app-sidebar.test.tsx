import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoreProvider } from '@/store'
import { AppSidebar } from './app-sidebar'

const mockApi = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listNotes: vi.fn(),
  addNote: vi.fn(),
  deleteNote: vi.fn(),
}))
vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  api: mockApi,
}))
vi.mock('@/lib/toast', () => ({
  notifyError: vi.fn(),
  toastManager: { add: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.listProjects.mockResolvedValue([
    {
      id: 'active-1',
      name: 'One',
      status: 'Active',
      tags: [],
      pitch: '',
      description: '',
      excitement: 5,
      effort: 2,
      potential: 3,
      nextAction: '',
      targetDate: null,
      links: [],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'active-2',
      name: 'Two',
      status: 'Active',
      tags: [],
      pitch: '',
      description: '',
      excitement: 4,
      effort: 2,
      potential: 3,
      nextAction: '',
      targetDate: null,
      links: [],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'inbox-1',
      name: 'Three',
      status: 'Inbox',
      tags: [],
      pitch: '',
      description: '',
      excitement: 3,
      effort: 2,
      potential: 3,
      nextAction: '',
      targetDate: null,
      links: [],
      createdAt: '',
      updatedAt: '',
    },
  ])
})

describe('AppSidebar', () => {
  it('shows status counts and seeded saved filters', async () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <AppSidebar />
        </StoreProvider>
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('link', { name: /Active.*2/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Inbox.*1/ })).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Active, high excitement' }),
    ).toHaveAttribute('href', '/?status=Active&sort=excitement')
    expect(screen.getByRole('link', { name: 'Parked ideas' })).toHaveAttribute(
      'href',
      '/?status=Parked',
    )
  })
})

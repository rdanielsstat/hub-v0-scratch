import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { mockAuthApi as MockAuthApi } from './mock-auth'
import type {
  mockNotesApi as MockNotesApi,
  mockProjectsApi as MockProjectsApi,
} from './mock'

let authApi: typeof MockAuthApi
let notesApi: typeof MockNotesApi
let projectsApi: typeof MockProjectsApi

beforeEach(async () => {
  vi.resetModules()
  const [auth, data] = await Promise.all([
    import('./mock-auth'),
    import('./mock'),
  ])
  authApi = auth.mockAuthApi
  notesApi = data.mockNotesApi
  projectsApi = data.mockProjectsApi
})

describe('in-memory demo APIs', () => {
  it('starts with a signed-in demo user and several projects', async () => {
    await expect(authApi.getCurrentUser()).resolves.toMatchObject({
      id: 'demo-user',
      email: 'demo@hub.local',
    })
    await expect(projectsApi.listProjects()).resolves.toHaveLength(12)
  })

  it('keeps project and note changes in memory', async () => {
    const created = await projectsApi.createProject({ name: 'Demo addition' })
    expect(await projectsApi.getProject(created.id)).toEqual(created)
    await new Promise((resolve) => setTimeout(resolve, 2))

    const { note, project } = await notesApi.addNote(
      created.id,
      'A note for the demo project',
    )
    expect(await notesApi.listNotes(created.id)).toContainEqual(note)
    expect(project.updatedAt).not.toBe(created.updatedAt)

    const updated = await projectsApi.updateProject(created.id, {
      status: 'Active',
    })
    expect(updated.status).toBe('Active')

    await projectsApi.deleteProject(created.id)
    expect(await projectsApi.getProject(created.id)).toBeNull()
    await expect(notesApi.listNotes(created.id)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('supports signing out and back in without a network request', async () => {
    await authApi.logout()
    await expect(authApi.getCurrentUser()).rejects.toMatchObject({
      status: 401,
    })

    await expect(
      authApi.login('preview@example.com', 'anything'),
    ).resolves.toMatchObject({
      email: 'preview@example.com',
    })
  })
})

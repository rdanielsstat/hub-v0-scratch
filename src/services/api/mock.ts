import { HttpError } from './http'
import type {
  CreateProjectInput,
  Note,
  Project,
  UpdateProjectInput,
} from './types'

const now = new Date().toISOString()

let projects: Project[] = [
  {
    id: 'demo-project-garden',
    name: 'Neighborhood garden',
    pitch: 'Turn the unused lot into a shared growing space.',
    description:
      'A small community garden with raised beds, a seed library, and a monthly work day.',
    status: 'Active',
    tags: ['community', 'outdoors'],
    excitement: 5,
    effort: 3,
    potential: 4,
    nextAction: 'Ask the neighborhood association about the lot',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-reading',
    name: 'Reading tracker',
    pitch: 'A calmer way to remember what I read and what stood out.',
    description:
      'Keep a lightweight record of books, favorite passages, and recommendations.',
    status: 'Exploring',
    tags: ['learning', 'personal'],
    excitement: 4,
    effort: 2,
    potential: 3,
    nextAction: 'Sketch the simplest useful book-entry flow',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-meal-planner',
    name: 'Weeknight meal planner',
    pitch: 'Make it easier to decide what is for dinner.',
    description:
      'Collect reliable weeknight meals and build a reusable shopping list.',
    status: 'Inbox',
    tags: ['food', 'home'],
    excitement: 3,
    effort: 2,
    potential: 4,
    nextAction: 'List five meals we already cook often',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
]

let notes: Note[] = [
  {
    id: 'demo-note-garden',
    projectId: 'demo-project-garden',
    body: 'The library has a seed swap table every spring.',
    createdAt: now,
  },
]

const copy = <T,>(value: T): T => structuredClone(value)
const updatedAt = () => new Date().toISOString()
const missingProject = () => new HttpError(404, 'Project not found')

export const mockProjectsApi = {
  async listProjects(): Promise<Project[]> {
    return copy(projects)
  },

  async getProject(id: string): Promise<Project | null> {
    const project = projects.find((item) => item.id === id)
    return project ? copy(project) : null
  },

  async createProject(input: CreateProjectInput): Promise<Project> {
    const timestamp = updatedAt()
    const project: Project = {
      id: `demo-project-${crypto.randomUUID()}`,
      name: input.name,
      pitch: input.pitch ?? '',
      description: input.description ?? '',
      status: input.status ?? 'Inbox',
      tags: copy(input.tags ?? []),
      excitement: input.excitement ?? 3,
      effort: input.effort ?? 3,
      potential: input.potential ?? 3,
      nextAction: input.nextAction ?? '',
      targetDate: input.targetDate ?? null,
      links: copy(input.links ?? []),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    projects = [project, ...projects]
    return copy(project)
  },

  async updateProject(
    id: string,
    patch: UpdateProjectInput,
  ): Promise<Project> {
    const index = projects.findIndex((project) => project.id === id)
    if (index === -1) throw missingProject()

    const updated = { ...projects[index], ...copy(patch), updatedAt: updatedAt() }
    projects = projects.map((project, itemIndex) =>
      itemIndex === index ? updated : project,
    )
    return copy(updated)
  },

  async deleteProject(id: string): Promise<void> {
    if (!projects.some((project) => project.id === id)) throw missingProject()
    projects = projects.filter((project) => project.id !== id)
    notes = notes.filter((note) => note.projectId !== id)
  },
}

export const mockNotesApi = {
  async listNotes(projectId: string): Promise<Note[]> {
    if (!projects.some((project) => project.id === projectId)) {
      throw missingProject()
    }
    return copy(notes.filter((note) => note.projectId === projectId))
  },

  async addNote(
    projectId: string,
    body: string,
  ): Promise<{ note: Note; project: Project }> {
    const project = projects.find((item) => item.id === projectId)
    if (!project) throw missingProject()

    const note: Note = {
      id: `demo-note-${crypto.randomUUID()}`,
      projectId,
      body,
      createdAt: updatedAt(),
    }
    notes = [note, ...notes]
    const updatedProject = { ...project, updatedAt: updatedAt() }
    projects = projects.map((item) =>
      item.id === projectId ? updatedProject : item,
    )
    return { note: copy(note), project: copy(updatedProject) }
  },

  async deleteNote(id: string): Promise<Project> {
    const note = notes.find((item) => item.id === id)
    if (!note) throw new HttpError(404, 'Note not found')

    notes = notes.filter((item) => item.id !== id)
    const project = projects.find((item) => item.id === note.projectId)
    if (!project) throw missingProject()

    const updatedProject = { ...project, updatedAt: updatedAt() }
    projects = projects.map((item) =>
      item.id === project.id ? updatedProject : item,
    )
    return copy(updatedProject)
  },
}

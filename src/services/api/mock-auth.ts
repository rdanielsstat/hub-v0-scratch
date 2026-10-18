import { HttpError } from './http'
import type { RegisterInput, User } from './types'

const demoUser: User = {
  id: 'demo-user',
  email: 'demo@hub.local',
  displayName: 'Demo User',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

let currentUser: User | null = structuredClone(demoUser)
const copyUser = (user: User) => structuredClone(user)

function userForEmail(email: string, displayName?: string): User {
  const timestamp = new Date().toISOString()
  return {
    id: demoUser.id,
    email: email.trim() || demoUser.email,
    displayName: displayName?.trim() || demoUser.displayName,
    createdAt: demoUser.createdAt,
    updatedAt: timestamp,
  }
}

export const mockAuthApi = {
  async register(input: RegisterInput): Promise<User> {
    currentUser = userForEmail(input.email, input.displayName)
    return copyUser(currentUser)
  },

  async login(email: string, password: string): Promise<User> {
    void password
    currentUser = userForEmail(email)
    return copyUser(currentUser)
  },

  async getCurrentUser(): Promise<User> {
    if (!currentUser) throw new HttpError(401, 'Not authenticated')
    return copyUser(currentUser)
  },

  async logout(): Promise<void> {
    currentUser = null
  },
}

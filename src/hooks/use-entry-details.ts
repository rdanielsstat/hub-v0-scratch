import { useCallback } from 'react'
import { entryDetailsApi, type EntryDetail } from '@/services/api/entry-details'
import { useApiResource } from '@/hooks/use-api-resource'

export function useEntryDetails(itemId: string) {
  const loader = useCallback(
    () => (itemId ? entryDetailsApi.get(itemId) : Promise.resolve(null)),
    [itemId],
  )
  const resource = useApiResource<EntryDetail | null>(loader, itemId || 'no-entry')

  const update = async (operation: () => Promise<EntryDetail>) => {
    const next = await operation()
    resource.setData(next)
  }

  return {
    detail: resource.data,
    loading: resource.loading,
    refresh: resource.refresh,
    addNote: (text: string) =>
      update(() => entryDetailsApi.addNote(itemId, text)),
    addSubItem: (title: string, subItemId?: string, dueDate?: string) =>
      update(() => entryDetailsApi.addSubItem(itemId, title, subItemId, dueDate)),
    updateSubItem: (subItemId: string, completed: boolean) =>
      update(() => entryDetailsApi.updateSubItem(itemId, subItemId, completed)),
    addFile: (file: Parameters<typeof entryDetailsApi.addFile>[1]) =>
      update(() => entryDetailsApi.addFile(itemId, file)),
    addLink: (url: string) => update(() => entryDetailsApi.addLink(itemId, url)),
    recordChange: (text: string) =>
      update(() => entryDetailsApi.recordChange(itemId, text)),
  }
}

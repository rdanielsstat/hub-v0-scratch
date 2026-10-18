import useSWR from 'swr'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, CirclePlus, Compass } from 'lucide-react'
import { areasApi, collectionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export function AreaLandingPage() {
  const { areaId = '' } = useParams()
  const { data, error, isLoading, mutate } = useSWR(
    ['area-landing', areaId],
    async ([, id]) => {
      const area = await areasApi.getArea(id)
      const collections = await collectionsApi.listCollections(id)
      return { area, collections }
    },
  )

  if (isLoading)
    return (
      <div className="grid gap-4" aria-label="Loading area">
        <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    )
  if (error)
    return (
      <EmptyState
        icon={Compass}
        variant="page"
        tone="danger"
        title="Couldn’t load this area"
        message={error.message || 'Try again in a moment.'}
        action={
          <Button variant="outline" onClick={() => void mutate()}>
            Try again
          </Button>
        }
      />
    )
  if (!data?.area)
    return (
      <EmptyState
        icon={Compass}
        variant="page"
        title="Area not found"
        message="This space may have been removed."
        action={
          <Button variant="outline" render={<Link to="/areas" />}>
            Back to Areas
          </Button>
        }
      />
    )

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/areas"
        className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All areas
      </Link>
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          An ongoing space
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {data.area.name}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {data.area.description ||
            'A space for the things you want to keep tending.'}
        </p>
      </div>
      {data.collections.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/area/${areaId}/collection/${collection.id}`}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:border-primary/30">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <h2 className="font-medium">{collection.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {collection.description || 'Collection'}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CirclePlus}
          title="A quiet place to begin"
          message="This area is ready for writing, collections, and useful views as it takes shape."
        />
      )}
    </div>
  )
}

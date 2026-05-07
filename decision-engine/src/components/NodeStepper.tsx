import { cn } from '@/lib/utils'
import type { NodeStatus } from '@/types'

export type StepperNode = {
  id: string
  idx: number
  title: string
  status: NodeStatus
}

function statusLabel(status: NodeStatus) {
  if (status === 'completed') return 'Done'
  if (status === 'in_progress') return 'Active'
  return 'Queued'
}

export default function NodeStepper(props: {
  nodes: StepperNode[]
  currentNodeId: string | null
  onSelect?: (nodeId: string) => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="font-[Fraunces] text-lg tracking-tight">Decision Nodes</div>
      <div className="mt-3 space-y-2">
        {props.nodes.map((n) => {
          const isCurrent = props.currentNodeId === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => props.onSelect?.(n.id)}
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-left transition',
                isCurrent ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/70',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-300">
                    <span className="text-zinc-500">#{n.idx + 1}</span> {n.title}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{statusLabel(n.status)}</div>
                </div>
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    n.status === 'completed'
                      ? 'bg-emerald-400/90'
                      : n.status === 'in_progress'
                        ? 'bg-cyan-400/90'
                        : 'bg-zinc-600',
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}


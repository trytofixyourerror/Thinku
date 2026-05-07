import { cn } from '@/lib/utils'

type Agent = { id: string; name: string; background: string; angle: string }
type Message = {
  id: string
  agent_id: string
  round: number
  content: string
  vote: string
  vote_reason: string
  created_at: number
}

export default function DebateStream(props: { agents: Agent[]; messages: Message[] }) {
  const agentsById = new Map(props.agents.map((a) => [a.id, a]))

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="font-[Fraunces] text-lg tracking-tight">Debate</div>
        <div className="text-xs text-zinc-500">{props.messages.length ? `${props.messages.length} messages` : 'No messages yet'}</div>
      </div>
      <div className="max-h-[65vh] space-y-3 overflow-auto p-4">
        {props.messages.map((m, idx) => {
          const agent = agentsById.get(m.agent_id)
          const showRound = idx === 0 || props.messages[idx - 1]?.round !== m.round
          return (
            <div key={m.id}>
              {showRound ? (
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <div className="rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1 text-xs text-zinc-400">
                    Round {m.round}
                  </div>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
              ) : null}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-200">{agent?.name ?? m.agent_id}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {agent ? `${agent.background} · ${agent.angle}` : 'Agent'}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-1 text-xs',
                      'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
                    )}
                  >
                    {m.vote}
                  </div>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-200">{m.content}</div>
                <div className="mt-2 text-xs text-zinc-500">{m.vote_reason}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


import DebateStream from '@/components/DebateStream'
import Modal from '@/components/Modal'
import NodeStepper from '@/components/NodeStepper'
import { apiGet, apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SessionState } from '@/types'
import { ChevronRight, Loader2, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

type DebateResult =
  | { status: 'consensus'; finalDecision: string; summary: string[] }
  | { status: 'clarification'; question: string }
  | { status: 'paths'; options: Array<{ key: string; label: string; pros: string[]; cons: string[] }> }
  | { status: 'in_progress'; round: number }

export default function SessionPage() {
  const params = useParams()
  const sessionId = params.sessionId ?? ''
  const navigate = useNavigate()

  const [state, setState] = useState<SessionState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState<
    | null
    | { kind: 'clarification'; nodeId: string; question: string }
    | { kind: 'paths'; nodeId: string; options: Array<{ key: string; label: string; pros: string[]; cons: string[] }> }
  >(null)

  const [answer, setAnswer] = useState('')
  const [chosenKey, setChosenKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const data = await apiGet<SessionState>(`/api/sessions/${sessionId}/state`)
    setState(data)
    return data
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    refresh().catch((e) => setError((e as Error).message))
  }, [refresh, sessionId])

  const currentNode = useMemo(() => {
    if (!state?.currentNodeId) return null
    return state.nodes.find((n) => n.id === state.currentNodeId) ?? null
  }, [state])

  const selectedNodeId = state?.currentNodeId ?? null
  const selectedAgents = selectedNodeId ? state?.agentsByNode[selectedNodeId] ?? [] : []
  const selectedMessages = selectedNodeId ? state?.messagesByNode[selectedNodeId] ?? [] : []

  async function ensurePlan() {
    const s = state ?? (await refresh())
    if (s.nodes.length > 0) return
    await apiPost('/api/plan', { sessionId })
    await refresh()
  }

  async function ensureCast(nodeId: string) {
    const s = state ?? (await refresh())
    if ((s.agentsByNode[nodeId] ?? []).length > 0) return
    await apiPost('/api/cast', { sessionId, nodeId })
    await refresh()
  }

  async function runNode(nodeId: string) {
    await ensureCast(nodeId)
    while (true) {
      const out = await apiPost<DebateResult>('/api/debate', { sessionId, nodeId, mode: 'auto', maxRounds: 4 })
      await refresh()
      if (out.status === 'consensus') return
      if (out.status === 'clarification') {
        setAnswer('')
        setModal({ kind: 'clarification', nodeId, question: out.question })
        return
      }
      if (out.status === 'paths') {
        setChosenKey(out.options[0]?.key ?? null)
        setModal({ kind: 'paths', nodeId, options: out.options })
        return
      }
      if (out.status === 'in_progress') continue
    }
  }

  async function runAll() {
    setError(null)
    setBusy(true)
    try {
      await ensurePlan()
      const s = await refresh()
      for (const node of s.nodes) {
        if (node.status === 'completed') continue
        await runNode(node.id)
        const updated = await refresh()
        const needsInput = modal !== null
        if (needsInput) return
        const stillIncomplete = updated.nodes.find((n) => n.status !== 'completed')
        if (!stillIncomplete) break
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onSubmitModal() {
    if (!modal) return
    setError(null)
    setBusy(true)
    try {
      if (modal.kind === 'clarification') {
        const a = answer.trim()
        if (!a) {
          setBusy(false)
          return
        }
        await apiPost('/api/clarify', { sessionId, nodeId: modal.nodeId, kind: 'clarification', answer: a })
      } else {
        if (!chosenKey) {
          setBusy(false)
          return
        }
        await apiPost('/api/clarify', { sessionId, nodeId: modal.nodeId, kind: 'paths', chosenKey })
      }
      setModal(null)
      await refresh()
      await runNode(modal.nodeId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function finalize() {
    setError(null)
    setBusy(true)
    try {
      await apiPost('/api/finalize', { sessionId })
      navigate(`/session/${sessionId}/result`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const allDone = state?.nodes.length ? state.nodes.every((n) => n.status === 'completed') : false

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Session</div>
            <div className="mt-2 font-[Fraunces] text-2xl tracking-tight text-zinc-50">Plan & Debate</div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-300">{state?.session.question ?? 'Loading…'}</div>
          </div>
          <Link
            to="/"
            className="rounded-full border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-950/70"
          >
            New session
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <NodeStepper nodes={state?.nodes ?? []} currentNodeId={state?.currentNodeId ?? null} />

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-[Fraunces] text-lg tracking-tight">Controls</div>
                <button
                  type="button"
                  onClick={() => refresh().catch((e) => setError((e as Error).message))}
                  className="rounded-full border border-zinc-800 bg-zinc-950/40 p-2 text-zinc-300 hover:bg-zinc-950/70"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAll()}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                    busy
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                      : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15',
                  )}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span>{busy ? 'Running…' : 'Run (auto)'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ensurePlan().catch((e) => setError((e as Error).message))}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm transition',
                    busy
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-950/70',
                  )}
                >
                  Generate plan
                </button>

                <button
                  type="button"
                  disabled={!allDone || busy}
                  onClick={() => finalize()}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                    !allDone || busy
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15',
                  )}
                >
                  <span>Finalize</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {error ? <div className="mt-3 text-sm text-amber-300">{error}</div> : null}
              {!state ? (
                <div className="mt-3 text-xs text-zinc-500">Fetching session state…</div>
              ) : (
                <div className="mt-3 text-xs text-zinc-500">
                  Provider: <span className="text-zinc-300">mock by default</span> · Backend reads environment variables for real APIs.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="font-[Fraunces] text-lg tracking-tight">Current Node</div>
              <div className="mt-2 text-sm text-zinc-200">{currentNode?.title ?? '—'}</div>
              <div className="mt-1 text-sm text-zinc-400">{currentNode?.question ?? 'Generate a plan to begin.'}</div>
            </div>

            <DebateStream agents={selectedAgents} messages={selectedMessages} />
          </div>
        </div>
      </div>

      <Modal
        open={modal !== null}
        title={modal?.kind === 'paths' ? 'Choose a direction' : 'Clarification needed'}
        onClose={() => (busy ? null : setModal(null))}
      >
        {modal?.kind === 'clarification' ? (
          <div className="space-y-4">
            <div className="text-sm leading-relaxed text-zinc-200">{modal.question}</div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={cn(
                'h-28 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-100 outline-none',
                'focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/10',
              )}
              placeholder="Type your answer…"
            />
            <button
              type="button"
              disabled={busy || !answer.trim()}
              onClick={() => onSubmitModal()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                busy || !answer.trim()
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                  : 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit answer
            </button>
          </div>
        ) : modal?.kind === 'paths' ? (
          <div className="space-y-4">
            <div className="text-sm text-zinc-300">Two strong camps remain. Pick a direction so the debate can converge.</div>
            <div className="grid gap-3 md:grid-cols-2">
              {modal.options.map((opt) => {
                const active = chosenKey === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChosenKey(opt.key)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      active ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/70',
                    )}
                  >
                    <div className="font-[Fraunces] text-lg tracking-tight text-zinc-100">{opt.label}</div>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-emerald-300/80">Pros</div>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                      {opt.pros.map((p) => (
                        <li key={p}>• {p}</li>
                      ))}
                    </ul>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-300/80">Cons</div>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                      {opt.cons.map((c) => (
                        <li key={c}>• {c}</li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={busy || !chosenKey}
              onClick={() => onSubmitModal()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                busy || !chosenKey
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                  : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}


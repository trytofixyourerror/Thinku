import { apiGet, apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SessionState } from '@/types'
import { Copy, Loader2, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useParams } from 'react-router-dom'

type Turn = { role: 'user' | 'assistant'; content: string }

export default function ResultPage() {
  const params = useParams()
  const sessionId = params.sessionId ?? ''

  const [state, setState] = useState<SessionState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])

  async function refresh() {
    const data = await apiGet<SessionState>(`/api/sessions/${sessionId}/state`)
    setState(data)
    return data
  }

  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message))
  }, [sessionId])

  const canFinalize = useMemo(() => {
    if (!state?.nodes.length) return false
    return state.nodes.every((n) => n.status === 'completed')
  }, [state])

  async function finalizeIfNeeded() {
    setError(null)
    setBusy(true)
    try {
      await apiPost('/api/finalize', { sessionId })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onCopy() {
    if (!state?.finalOutput) return
    await navigator.clipboard.writeText(state.finalOutput)
  }

  async function onAsk() {
    const q = question.trim()
    if (!q) return
    setQuestion('')
    setError(null)
    setBusy(true)
    setTurns((t) => [...t, { role: 'user', content: q }])
    try {
      const data = await apiPost<{ answer: string }>('/api/followup', { sessionId, question: q })
      setTurns((t) => [...t, { role: 'assistant', content: data.answer }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Result</div>
            <div className="mt-2 font-[Fraunces] text-2xl tracking-tight text-zinc-50">Roadmap</div>
            <div className="mt-2 text-sm text-zinc-300">{state?.session.question ?? 'Loading…'}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/session/${sessionId}`}
              className="rounded-full border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-950/70"
            >
              Back to debate
            </Link>
            <Link
              to="/"
              className="rounded-full border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-950/70"
            >
              New session
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="font-[Fraunces] text-lg tracking-tight">Markdown Output</div>
              <button
                type="button"
                disabled={!state?.finalOutput}
                onClick={onCopy}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition',
                  state?.finalOutput
                    ? 'border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-950/70'
                    : 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500',
                )}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>

            <div className="prose prose-invert max-w-none px-5 py-4 prose-headings:font-[Fraunces] prose-headings:tracking-tight prose-a:text-cyan-300">
              {state?.finalOutput ? (
                <ReactMarkdown>{state.finalOutput}</ReactMarkdown>
              ) : (
                <div className="text-sm text-zinc-400">No final output yet.</div>
              )}
            </div>

            {!state?.finalOutput ? (
              <div className="border-t border-zinc-800 px-5 py-4">
                <button
                  type="button"
                  disabled={!canFinalize || busy}
                  onClick={finalizeIfNeeded}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                    !canFinalize || busy
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15',
                  )}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate roadmap
                </button>
                {!canFinalize ? <div className="mt-2 text-xs text-zinc-500">Finish all nodes first.</div> : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="font-[Fraunces] text-lg tracking-tight">Follow-up</div>
              <div className="mt-1 text-sm text-zinc-400">Ask why a decision was made or what would change.</div>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-auto px-5 py-4">
              {turns.length === 0 ? <div className="text-sm text-zinc-500">No follow-ups yet.</div> : null}
              {turns.map((t, i) => (
                <div
                  key={`${t.role}-${i}`}
                  className={cn(
                    'rounded-2xl border p-3 text-sm',
                    t.role === 'user'
                      ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100'
                      : 'border-cyan-400/30 bg-cyan-400/10 text-zinc-50',
                  )}
                >
                  {t.content}
                </div>
              ))}
            </div>
            <div className="border-t border-zinc-800 p-4">
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a follow-up…"
                  className={cn(
                    'h-11 flex-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 text-sm text-zinc-100 outline-none',
                    'focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10',
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onAsk().catch(() => {})
                  }}
                />
                <button
                  type="button"
                  disabled={busy || !question.trim()}
                  onClick={() => onAsk()}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl border transition',
                    busy || !question.trim()
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                      : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15',
                  )}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {error ? <div className="mt-2 text-sm text-amber-300">{error}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


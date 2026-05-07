import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [profile, setProfile] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const examples = useMemo(
    () => [
      'Should I switch jobs or stay for another year?',
      'Should I do a masters or go straight to industry?',
      'Should I bootstrap or raise funding for my product?',
    ],
    [],
  )

  async function onStart() {
    setError(null)
    const q = question.trim()
    const p = profile.trim()
    if (!q || !p) {
      setError('Add both a question and a short profile.')
      return
    }
    setBusy(true)
    try {
      const data = await apiPost<{ sessionId: string }>('/api/sessions', { question: q, profile: p })
      navigate(`/session/${data.sessionId}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center gap-2 text-cyan-200">
          <Sparkles className="h-4 w-4" />
          <div className="text-xs uppercase tracking-[0.22em]">Decision Engine</div>
        </div>
        <div className="mt-5 font-[Fraunces] text-4xl leading-[1.05] tracking-tight text-zinc-50 md:text-6xl">
          Turn uncertainty into a plan you can defend.
        </div>
        <div className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300">
          Describe your decision and your context. The app breaks it into nodes, runs a multi-agent debate per node, asks you questions
          when it’s stuck, and produces a final roadmap in markdown.
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-sm text-zinc-200">Your question</div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are you trying to decide?"
              className={cn(
                'mt-2 h-36 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-100 outline-none',
                'focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10',
              )}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuestion(ex)}
                  className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-950/70"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-sm text-zinc-200">Your profile</div>
            <textarea
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="Constraints, goals, resources, deadlines, preferences…"
              className={cn(
                'mt-2 h-36 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-100 outline-none',
                'focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10',
              )}
            />

            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition',
                busy
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-500'
                  : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15',
              )}
            >
              <span>{busy ? 'Starting…' : 'Start Session'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {error ? <div className="mt-3 text-sm text-amber-300">{error}</div> : null}
            <div className="mt-4 text-xs text-zinc-500">
              Tip: set LLM_PROVIDER=fireworks|groq|mistral and LLM_API_KEY on the server to switch off mock mode.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

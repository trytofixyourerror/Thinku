import crypto from 'node:crypto'

export type LlmRole = 'system' | 'user' | 'assistant'

export type LlmMessage = {
  role: LlmRole
  content: string
}

export type LlmClient = {
  generateText: (input: { messages: LlmMessage[] }) => Promise<string>
}

function firstJsonCandidate(text: string): string | null {
  const start = text.indexOf('{')
  const startArr = text.indexOf('[')
  const s = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr)
  if (s === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = s; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{' || ch === '[') depth += 1
    if (ch === '}' || ch === ']') {
      depth -= 1
      if (depth === 0) return text.slice(s, i + 1)
    }
  }

  return null
}

export function safeJsonParse<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const candidate = firstJsonCandidate(text)
    if (!candidate) throw new Error('Invalid JSON response')
    return JSON.parse(candidate) as T
  }
}

function getEnv(name: string): string | undefined {
  const v = process.env[name]
  if (!v) return undefined
  return v.trim()
}

async function openAiCompatibleChat(input: {
  baseUrl: string
  apiKey: string
  model: string
  messages: LlmMessage[]
}): Promise<string> {
  const resp = await fetch(`${input.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.4,
      max_tokens: 1200,
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`LLM request failed (${resp.status}): ${txt || resp.statusText}`)
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM response missing content')
  return content
}

function buildMockClient(): LlmClient {
  return {
    async generateText({ messages }) {
      const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      const seed = crypto.createHash('sha256').update(userMsg).digest('hex').slice(0, 8)

      if (userMsg.includes('TASK:PLAN')) {
        return JSON.stringify([
          { id: 'node_1', title: 'Clarify goal and constraints', question: 'What are the non-negotiables and constraints for this decision?' },
          { id: 'node_2', title: 'Enumerate options', question: 'What are the realistic options available right now?' },
          { id: 'node_3', title: 'Choose and commit', question: 'Given constraints and options, what is the best path and why?' },
        ])
      }

      if (userMsg.includes('TASK:CAST')) {
        const nodeId = safeJsonParse<{ nodeId: string }>(userMsg.split('JSON:')[1] ?? '{}').nodeId ?? 'node'
        return JSON.stringify([
          { id: `AGT-${seed}-01`, nodeId, name: 'Asha', background: 'Pragmatic planner who optimizes for execution', angle: 'Feasibility and concrete steps' },
          { id: `AGT-${seed}-02`, nodeId, name: 'Ravi', background: 'Risk analyst with a bias for safety nets', angle: 'Downside risks and contingencies' },
          { id: `AGT-${seed}-03`, nodeId, name: 'Meera', background: 'Opportunity seeker with long-term lens', angle: 'Upside potential and optionality' },
          { id: `AGT-${seed}-04`, nodeId, name: 'Kabir', background: 'Values-driven advisor focused on alignment', angle: 'Personal fit and sustainability' },
        ])
      }

      if (userMsg.includes('TASK:DEBATE_ROUND')) {
        const payload = safeJsonParse<{ round: number; agents: Array<{ id: string; name: string }>; question: string }>(
          userMsg.split('JSON:')[1] ?? '{}',
        )

        const consensusVote = payload.round >= 2 ? 'Option A' : undefined
        const votes = payload.agents.map((a, idx) => {
          const vote = consensusVote ?? (idx % 2 === 0 ? 'Option A' : 'Option B')
          return {
            agentId: a.id,
            content: `(${a.name}) My take: ${vote} is stronger given the current constraints.`,
            vote,
            voteReason: 'Balances feasibility and long-term value with manageable risk.',
          }
        })
        return JSON.stringify({ messages: votes })
      }

      if (userMsg.includes('TASK:CLARIFICATION')) {
        return JSON.stringify({
          question: 'Which matters most for you right now: speed, cost, or learning depth?',
        })
      }

      if (userMsg.includes('TASK:PATHS')) {
        return JSON.stringify({
          options: [
            { key: 'A', label: 'Option A', pros: ['Faster execution', 'Lower complexity'], cons: ['May limit upside'] },
            { key: 'B', label: 'Option B', pros: ['Higher upside', 'More optionality'], cons: ['More risk', 'Slower feedback loop'] },
          ],
        })
      }

      if (userMsg.includes('TASK:SUMMARY')) {
        return JSON.stringify([
          'Decision reached and recorded.',
          'Top reasons: feasibility and risk management.',
          'Accepted concern: tradeoff against maximum upside.',
        ])
      }

      if (userMsg.includes('TASK:FINAL_ROADMAP')) {
        return `# Decision Roadmap\n\n## Decisions\n- Step 1: Clarify constraints\n- Step 2: Pick Option A\n\n## Roadmap\n1. Write constraints in 5 bullets\n2. Run a 2-week experiment\n3. Review results and commit\n\n## Risks\n- Overfitting to short-term signals\n- Underestimating effort\n- Not leaving a fallback\n\n## First 3 Actions\n- Draft constraints\n- Choose evaluation metric\n- Schedule first checkpoint\n`
      }

      if (userMsg.includes('TASK:FOLLOWUP')) {
        return `Based on the stored debate and decisions, the main reason was feasibility under your stated constraints, with a deliberate safety net. If you change the key constraint, the recommendation could flip.`
      }

      return `{"ok":true}`
    },
  }
}

export function getLlmClient(): LlmClient {
  const provider = (getEnv('LLM_PROVIDER') ?? 'mock').toLowerCase()
  if (provider === 'mock') return buildMockClient()

  const apiKey = getEnv('LLM_API_KEY')
  const model = getEnv('LLM_MODEL') ?? 'gpt-4o-mini'
  if (!apiKey) return buildMockClient()

  const baseUrl =
    provider === 'fireworks'
      ? 'https://api.fireworks.ai/inference/v1'
      : provider === 'groq'
        ? 'https://api.groq.com/openai/v1'
        : provider === 'mistral'
          ? 'https://api.mistral.ai/v1'
          : undefined

  if (!baseUrl) return buildMockClient()

  return {
    async generateText({ messages }) {
      return openAiCompatibleChat({ baseUrl, apiKey, model, messages })
    },
  }
}


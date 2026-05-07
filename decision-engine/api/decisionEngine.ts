import crypto from 'node:crypto'
import { db } from './db.js'
import { getLlmClient, safeJsonParse, type LlmMessage } from './llm.js'

type NodeStatus = 'pending' | 'in_progress' | 'completed'

type DbNode = {
  id: string
  session_id: string
  idx: number
  title: string
  question: string
  status: NodeStatus
  final_decision: string | null
  summary_json: string | null
}

type DbAgent = {
  id: string
  node_id: string
  name: string
  background: string
  angle: string
}

type DbAgentMessage = {
  id: string
  node_id: string
  agent_id: string
  round: number
  content: string
  vote: string
  vote_reason: string
  created_at: number
}

type DebateRoundOutput = {
  messages: Array<{
    agentId: string
    content: string
    vote: string
    voteReason: string
  }>
}

type PathsOutput = {
  options: Array<{
    key: string
    label: string
    pros: string[]
    cons: string[]
  }>
}

function now(): number {
  return Date.now()
}

function normalizeVote(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getSession(sessionId: string) {
  const stmt = db.prepare('SELECT id, question, profile, created_at FROM sessions WHERE id = ?')
  const row = stmt.get(sessionId) as { id: string; question: string; profile: string; created_at: number } | undefined
  if (!row) throw new Error('Session not found')
  return row
}

function getNodes(sessionId: string): DbNode[] {
  const stmt = db.prepare(
    'SELECT id, session_id, idx, title, question, status, final_decision, summary_json FROM nodes WHERE session_id = ? ORDER BY idx ASC',
  )
  return stmt.all(sessionId) as DbNode[]
}

function getNode(nodeId: string): DbNode {
  const stmt = db.prepare(
    'SELECT id, session_id, idx, title, question, status, final_decision, summary_json FROM nodes WHERE id = ?',
  )
  const row = stmt.get(nodeId) as DbNode | undefined
  if (!row) throw new Error('Node not found')
  return row
}

function getAgents(nodeId: string): DbAgent[] {
  const stmt = db.prepare('SELECT id, node_id, name, background, angle FROM agents WHERE node_id = ? ORDER BY id ASC')
  return stmt.all(nodeId) as DbAgent[]
}

function getLastRound(nodeId: string): number {
  const stmt = db.prepare('SELECT MAX(round) as max_round FROM agent_messages WHERE node_id = ?')
  const row = stmt.get(nodeId) as { max_round: number | null } | undefined
  return row?.max_round ?? 0
}

function getMessages(nodeId: string): DbAgentMessage[] {
  const stmt = db.prepare(
    'SELECT id, node_id, agent_id, round, content, vote, vote_reason, created_at FROM agent_messages WHERE node_id = ? ORDER BY round ASC, created_at ASC',
  )
  return stmt.all(nodeId) as DbAgentMessage[]
}

function getSummariesBefore(sessionId: string, idx: number): string[] {
  const stmt = db.prepare('SELECT summary_json FROM nodes WHERE session_id = ? AND idx < ? AND status = ? ORDER BY idx ASC')
  const rows = stmt.all(sessionId, idx, 'completed') as Array<{ summary_json: string | null }>
  const out: string[] = []
  for (const r of rows) {
    if (!r.summary_json) continue
    try {
      const parsed = JSON.parse(r.summary_json) as string[]
      out.push(...parsed)
    } catch {
      continue
    }
  }
  return out
}

function getClarifications(nodeId: string): Array<{ kind: string; question_asked: string; user_answer: string | null }> {
  const stmt = db.prepare('SELECT kind, question_asked, user_answer FROM clarifications WHERE node_id = ? ORDER BY created_at ASC')
  return stmt.all(nodeId) as Array<{ kind: string; question_asked: string; user_answer: string | null }>
}

export function createSession(input: { question: string; profile: string }): { sessionId: string } {
  const sessionId = crypto.randomUUID()
  db.prepare('INSERT INTO sessions (id, question, profile, created_at) VALUES (?, ?, ?, ?)').run(
    sessionId,
    input.question,
    input.profile,
    now(),
  )
  return { sessionId }
}

export async function planNodes(input: { sessionId: string }): Promise<{ nodes: Array<{ id: string; title: string; question: string }> }> {
  const session = getSession(input.sessionId)
  const existing = getNodes(input.sessionId)
  if (existing.length > 0) {
    return {
      nodes: existing.map((n) => ({ id: n.id, title: n.title, question: n.question })),
    }
  }

  const llm = getLlmClient()
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        'You generate a concise decision plan as JSON only. Return a JSON array of nodes with fields: title, question. No markdown.',
    },
    {
      role: 'user',
      content: `TASK:PLAN\nQuestion: ${session.question}\nProfile: ${session.profile}\n`,
    },
  ]
  const text = await llm.generateText({ messages })
  const planned = safeJsonParse<Array<{ title: string; question: string }>>(text).slice(0, 8)
  const nodes = planned.map((n) => ({ id: crypto.randomUUID(), title: n.title, question: n.question }))
  const insert = db.prepare(
    'INSERT INTO nodes (id, session_id, idx, title, question, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  nodes.forEach((n, idx) => {
    insert.run(n.id, input.sessionId, idx, n.title, n.question, 'pending', now())
  })

  return { nodes }
}

export async function castAgents(input: { sessionId: string; nodeId: string }): Promise<{ agents: DbAgent[] }> {
  getSession(input.sessionId)
  const node = getNode(input.nodeId)
  const existing = getAgents(input.nodeId)
  if (existing.length > 0) return { agents: existing }

  const llm = getLlmClient()
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        'Return JSON only. Create 4-8 realistic agent personas for debating a decision. Each item: name, background, angle. No markdown.',
    },
    {
      role: 'user',
      content: `TASK:CAST\nJSON:${JSON.stringify({
        nodeId: input.nodeId,
        question: node.question,
        sessionQuestion: getSession(input.sessionId).question,
      })}`,
    },
  ]
  const text = await llm.generateText({ messages })
  const planned = safeJsonParse<Array<{ name: string; background: string; angle: string }>>(text).slice(0, 10)
  const agents: DbAgent[] = planned.map((a) => ({
    id: crypto.randomUUID(),
    node_id: input.nodeId,
    name: a.name,
    background: a.background,
    angle: a.angle,
  }))

  const insert = db.prepare('INSERT INTO agents (id, node_id, name, background, angle) VALUES (?, ?, ?, ?, ?)')
  agents.forEach((a) => {
    insert.run(a.id, input.nodeId, a.name, a.background, a.angle)
  })

  return { agents: getAgents(input.nodeId) }
}

export async function runDebate(input: {
  sessionId: string
  nodeId: string
  mode?: 'auto' | 'step'
  maxRounds?: number
}): Promise<
  | { status: 'consensus'; finalDecision: string; summary: string[] }
  | { status: 'clarification'; question: string }
  | { status: 'paths'; options: PathsOutput['options'] }
  | { status: 'in_progress'; round: number }
> {
  getSession(input.sessionId)
  const node = getNode(input.nodeId)
  if (node.status === 'completed' && node.final_decision && node.summary_json) {
    return {
      status: 'consensus',
      finalDecision: node.final_decision,
      summary: JSON.parse(node.summary_json) as string[],
    }
  }

  const agents = getAgents(input.nodeId)
  if (agents.length === 0) throw new Error('No agents for node')

  db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run('in_progress', input.nodeId)

  const llm = getLlmClient()
  const maxRounds = Math.max(1, Math.min(input.maxRounds ?? 4, 8))
  const startingRound = getLastRound(input.nodeId)
  const summaries = getSummariesBefore(node.session_id, node.idx)
  const clarifications = getClarifications(input.nodeId).filter((c) => c.user_answer)

  for (let round = startingRound + 1; round <= maxRounds; round += 1) {
    const history = getMessages(input.nodeId).map((m) => ({
      agentId: m.agent_id,
      round: m.round,
      vote: m.vote,
      content: m.content,
    }))

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'Simulate a debate round. Output JSON only: { "messages": [ { "agentId": string, "content": string, "vote": string, "voteReason": string } ] }. No markdown.',
      },
      {
        role: 'user',
        content: `TASK:DEBATE_ROUND\nJSON:${JSON.stringify({
          round,
          question: node.question,
          agents: agents.map((a) => ({ id: a.id, name: a.name, background: a.background, angle: a.angle })),
          priorSummaries: summaries,
          clarifications,
          history,
        })}`,
      },
    ]

    const text = await llm.generateText({ messages })
    const out = safeJsonParse<DebateRoundOutput>(text)

    const insertMsg = db.prepare(
      'INSERT INTO agent_messages (id, node_id, agent_id, round, content, vote, vote_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )

    const createdAt = now()
    out.messages.forEach((m) => {
      insertMsg.run(crypto.randomUUID(), input.nodeId, m.agentId, round, m.content, m.vote, m.voteReason, createdAt)
    })

    const lastVotes = out.messages.map((m) => normalizeVote(m.vote))
    const uniqueVotes = [...new Set(lastVotes)]
    if (uniqueVotes.length === 1) {
      const finalDecision = out.messages[0]?.vote ?? 'Decision'
      const summaryText = await llm.generateText({
        messages: [
          {
            role: 'system',
            content: 'Summarize the node in exactly 3 short bullet points as a JSON array of strings. Output JSON only.',
          },
          {
            role: 'user',
            content: `TASK:SUMMARY\nJSON:${JSON.stringify({
              nodeTitle: node.title,
              nodeQuestion: node.question,
              finalDecision,
              messages: getMessages(input.nodeId),
            })}`,
          },
        ],
      })
      const summary = safeJsonParse<string[]>(summaryText).slice(0, 3)
      db.prepare(
        'UPDATE nodes SET status = ?, final_decision = ?, summary_json = ?, completed_at = ? WHERE id = ?',
      ).run('completed', finalDecision, JSON.stringify(summary), now(), input.nodeId)
      return { status: 'consensus', finalDecision, summary }
    }

    if (uniqueVotes.length === 2 && round >= 2) {
      const pathText = await llm.generateText({
        messages: [
          {
            role: 'system',
            content:
              'Two camps persist. Output JSON only: { "options": [ { "key": string, "label": string, "pros": string[], "cons": string[] } ] } with 2 options. No markdown.',
          },
          {
            role: 'user',
            content: `TASK:PATHS\nJSON:${JSON.stringify({
              nodeTitle: node.title,
              nodeQuestion: node.question,
              votes: out.messages.map((m) => ({ agentId: m.agentId, vote: m.vote, voteReason: m.voteReason })),
            })}`,
          },
        ],
      })
      const paths = safeJsonParse<PathsOutput>(pathText)
      db.prepare('INSERT INTO clarifications (id, node_id, kind, question_asked, user_answer, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        input.nodeId,
        'paths',
        JSON.stringify(paths.options),
        null,
        now(),
      )
      return { status: 'paths', options: paths.options }
    }

    if (round >= maxRounds) {
      const clarifyText = await llm.generateText({
        messages: [
          {
            role: 'system',
            content: 'Write one clarifying question to ask the user. Output JSON only: { "question": string }.',
          },
          {
            role: 'user',
            content: `TASK:CLARIFICATION\nJSON:${JSON.stringify({
              nodeTitle: node.title,
              nodeQuestion: node.question,
              positions: out.messages.map((m) => ({ agentId: m.agentId, vote: m.vote, voteReason: m.voteReason })),
            })}`,
          },
        ],
      })
      const clarify = safeJsonParse<{ question: string }>(clarifyText)
      db.prepare('INSERT INTO clarifications (id, node_id, kind, question_asked, user_answer, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        input.nodeId,
        'clarification',
        clarify.question,
        null,
        now(),
      )
      return { status: 'clarification', question: clarify.question }
    }

    if (input.mode === 'step') return { status: 'in_progress', round }
  }

  return { status: 'in_progress', round: getLastRound(input.nodeId) }
}

export function saveClarification(input: {
  sessionId: string
  nodeId: string
  kind: 'clarification' | 'paths'
  answer: string
}): { ok: true } {
  getSession(input.sessionId)
  getNode(input.nodeId)
  const stmt = db.prepare(
    'SELECT id FROM clarifications WHERE node_id = ? AND kind = ? AND user_answer IS NULL ORDER BY created_at DESC LIMIT 1',
  )
  const row = stmt.get(input.nodeId, input.kind) as { id: string } | undefined
  if (!row) throw new Error('No pending clarification')
  db.prepare('UPDATE clarifications SET user_answer = ? WHERE id = ?').run(input.answer, row.id)
  return { ok: true }
}

export async function finalizeSession(input: { sessionId: string }): Promise<{ markdown: string }> {
  getSession(input.sessionId)
  const existing = db.prepare('SELECT markdown_content FROM final_outputs WHERE session_id = ?').get(input.sessionId) as
    | { markdown_content: string }
    | undefined
  if (existing?.markdown_content) return { markdown: existing.markdown_content }

  const nodes = getNodes(input.sessionId)
  const incomplete = nodes.find((n) => n.status !== 'completed')
  if (incomplete) throw new Error('All nodes must be completed before finalize')

  const decisions = nodes.map((n) => ({
    idx: n.idx,
    title: n.title,
    question: n.question,
    finalDecision: n.final_decision,
    summary: n.summary_json ? (JSON.parse(n.summary_json) as string[]) : [],
  }))

  const llm = getLlmClient()
  const markdown = await llm.generateText({
    messages: [
      {
        role: 'system',
        content:
          'Write a clear markdown roadmap. Include: Decisions (with short reasons), Roadmap (steps), Top 3 risks, First 3 concrete actions. No code fences.',
      },
      {
        role: 'user',
        content: `TASK:FINAL_ROADMAP\nJSON:${JSON.stringify({ decisions })}`,
      },
    ],
  })

  db.prepare('INSERT INTO final_outputs (session_id, markdown_content, created_at) VALUES (?, ?, ?)').run(
    input.sessionId,
    markdown,
    now(),
  )
  return { markdown }
}

export async function followup(input: { sessionId: string; question: string }): Promise<{ answer: string }> {
  getSession(input.sessionId)
  const nodes = getNodes(input.sessionId)
  const finalOutput = db.prepare('SELECT markdown_content FROM final_outputs WHERE session_id = ?').get(input.sessionId) as
    | { markdown_content: string }
    | undefined

  const context = {
    decisions: nodes.map((n) => ({
      idx: n.idx,
      title: n.title,
      question: n.question,
      status: n.status,
      finalDecision: n.final_decision,
      summary: n.summary_json ? (JSON.parse(n.summary_json) as string[]) : [],
    })),
    finalRoadmap: finalOutput?.markdown_content ?? null,
  }

  const llm = getLlmClient()
  const answer = await llm.generateText({
    messages: [
      {
        role: 'system',
        content:
          'Answer the follow-up question using the stored decisions and summaries. Be specific, concise, and explain the rationale. No markdown tables.',
      },
      {
        role: 'user',
        content: `TASK:FOLLOWUP\nUser question: ${input.question}\nContext JSON:${JSON.stringify(context)}`,
      },
    ],
  })
  return { answer }
}

export function getSessionState(sessionId: string): {
  session: { id: string; question: string; profile: string; created_at: number }
  nodes: Array<{
    id: string
    idx: number
    title: string
    question: string
    status: NodeStatus
    finalDecision: string | null
    summary: string[] | null
  }>
  currentNodeId: string | null
  agentsByNode: Record<string, DbAgent[]>
  messagesByNode: Record<string, DbAgentMessage[]>
  finalOutput: string | null
} {
  const session = getSession(sessionId)
  const nodes = getNodes(sessionId)
  const agentsByNode: Record<string, DbAgent[]> = {}
  const messagesByNode: Record<string, DbAgentMessage[]> = {}
  for (const n of nodes) {
    agentsByNode[n.id] = getAgents(n.id)
    messagesByNode[n.id] = getMessages(n.id)
  }

  const firstIncomplete = nodes.find((n) => n.status !== 'completed')?.id ?? null
  const final = db.prepare('SELECT markdown_content FROM final_outputs WHERE session_id = ?').get(sessionId) as
    | { markdown_content: string }
    | undefined

  return {
    session,
    nodes: nodes.map((n) => ({
      id: n.id,
      idx: n.idx,
      title: n.title,
      question: n.question,
      status: n.status,
      finalDecision: n.final_decision,
      summary: n.summary_json ? (JSON.parse(n.summary_json) as string[]) : null,
    })),
    currentNodeId: firstIncomplete,
    agentsByNode,
    messagesByNode,
    finalOutput: final?.markdown_content ?? null,
  }
}

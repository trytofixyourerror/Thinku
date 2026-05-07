export type NodeStatus = 'pending' | 'in_progress' | 'completed'

export type SessionState = {
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
  agentsByNode: Record<string, Array<{ id: string; node_id: string; name: string; background: string; angle: string }>>
  messagesByNode: Record<
    string,
    Array<{
      id: string
      node_id: string
      agent_id: string
      round: number
      content: string
      vote: string
      vote_reason: string
      created_at: number
    }>
  >
  finalOutput: string | null
}


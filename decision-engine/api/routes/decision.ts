import { Router, type Request, type Response } from 'express'
import {
  createSession,
  planNodes,
  castAgents,
  runDebate,
  saveClarification,
  finalizeSession,
  followup,
  getSessionState,
} from '../decisionEngine.js'

const router = Router()

router.post('/sessions', async (req: Request, res: Response) => {
  const question = String(req.body?.question ?? '').trim()
  const profile = String(req.body?.profile ?? '').trim()
  if (!question || !profile) {
    res.status(400).json({ success: false, error: 'Missing question or profile' })
    return
  }
  const out = createSession({ question, profile })
  res.json({ success: true, data: out })
})

router.get('/sessions/:sessionId/state', async (req: Request, res: Response) => {
  try {
    const state = getSessionState(req.params.sessionId)
    res.json({ success: true, data: state })
  } catch (e) {
    res.status(404).json({ success: false, error: (e as Error).message })
  }
})

router.post('/plan', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing sessionId' })
      return
    }
    const out = await planNodes({ sessionId })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

router.post('/cast', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    const nodeId = String(req.body?.nodeId ?? '').trim()
    if (!sessionId || !nodeId) {
      res.status(400).json({ success: false, error: 'Missing sessionId or nodeId' })
      return
    }
    const out = await castAgents({ sessionId, nodeId })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

router.post('/debate', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    const nodeId = String(req.body?.nodeId ?? '').trim()
    const mode = req.body?.mode === 'step' ? 'step' : 'auto'
    const maxRoundsRaw = req.body?.maxRounds
    const maxRounds = typeof maxRoundsRaw === 'number' ? maxRoundsRaw : undefined
    if (!sessionId || !nodeId) {
      res.status(400).json({ success: false, error: 'Missing sessionId or nodeId' })
      return
    }
    const out = await runDebate({ sessionId, nodeId, mode, maxRounds })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

router.post('/clarify', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    const nodeId = String(req.body?.nodeId ?? '').trim()
    const kind = req.body?.kind === 'paths' ? 'paths' : 'clarification'
    const answer = kind === 'paths' ? String(req.body?.chosenKey ?? '').trim() : String(req.body?.answer ?? '').trim()
    if (!sessionId || !nodeId || !answer) {
      res.status(400).json({ success: false, error: 'Missing sessionId, nodeId, or answer' })
      return
    }
    const out = saveClarification({ sessionId, nodeId, kind, answer })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

router.post('/finalize', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing sessionId' })
      return
    }
    const out = await finalizeSession({ sessionId })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

router.post('/followup', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '').trim()
    const question = String(req.body?.question ?? '').trim()
    if (!sessionId || !question) {
      res.status(400).json({ success: false, error: 'Missing sessionId or question' })
      return
    }
    const out = await followup({ sessionId, question })
    res.json({ success: true, data: out })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
})

export default router


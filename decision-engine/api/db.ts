import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'decision-engine.sqlite')

export const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    profile TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL,
    final_decision TEXT,
    summary_json TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS nodes_session_idx ON nodes(session_id, idx);

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    name TEXT NOT NULL,
    background TEXT NOT NULL,
    angle TEXT NOT NULL,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS agents_node_id ON agents(node_id);

  CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    content TEXT NOT NULL,
    vote TEXT NOT NULL,
    vote_reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS agent_messages_node_round ON agent_messages(node_id, round);

  CREATE TABLE IF NOT EXISTS clarifications (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    question_asked TEXT NOT NULL,
    user_answer TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS clarifications_node_id ON clarifications(node_id);

  CREATE TABLE IF NOT EXISTS final_outputs (
    session_id TEXT PRIMARY KEY,
    markdown_content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`)


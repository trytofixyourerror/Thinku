# Decision Engine — Product Spec & MVP Plan

---

## What Is This Product?

A universal decision-making tool. You give it any question — career, life, business, anything — and it breaks the question into steps, runs a debate between multiple AI agents at each step, asks you questions when it gets stuck, and gives you a final clear roadmap in a readable format.

It remembers everything so you can come back later and ask why any decision was made.

---

## How It Works (Simple Version)

1. You type your question and a bit about yourself
2. A planning agent reads your question and creates decision nodes (steps)
3. At each node, multiple AI agents debate each other
4. If agents get stuck or find multiple valid paths, it asks you a question
5. When all agents agree, that node is done
6. The summary of that node passes to the next node
7. After all nodes, a final agent writes a full roadmap in markdown
8. Everything is saved so you can ask follow-up questions later

---

## Core Concepts

**Node** — One decision step. Example: "Should I do MTech or not?"

**Agent** — An AI playing a specific real-world role. Example: "A software engineer with 10 years at a startup." Each agent has a unique ID and stays in character throughout the debate.

**Consensus** — A node is only complete when all agents agree. No judge. They debate until unanimous.

**Clarification Popup** — If agents loop for too long OR find two equally valid paths, the system pauses and asks you a question.

**Summary** — After each node, a short 3-point summary is created and saved. This is what gets passed to the next node (not the full debate).

**Follow-up** — Because everything is saved, you can later ask "why was this decision made" or "what if my situation was different."

---

## Features List

Remember i have mentioned claude but i will not use it we will use fireworks groq and mistral models and their apis

### Must Have (MVP)

- User inputs their question and profile
- System creates decision nodes automatically
- 4 to 10 agents assigned per node based on complexity
- Agents debate in rounds until consensus
- Clarification popup when agents are stuck in a loop
- Multiple paths popup with pros/cons when two options are equally valid
- Node summary saved after each node
- Final output in markdown with full roadmap
- Basic follow-up: user can ask why a decision was made

### Nice to Have (After MVP)

- Re-run a single node with a changed assumption
- Mermaid diagrams in final output
- Agent personas change based on query type
- Previous session history
- Export final roadmap as PDF

---

## Tech Stack (Recommended Simple Choices)

| Part | What to Use |
|---|---|
| Frontend | React (simple, component-based) |
| Backend | Node.js with Express |
| Database | Supabase for MVP (simple, local, no setup) |
| AI | Fireworks Ai and Groq and mistral |
| Diagrams | Mermaid.js (free, no API key needed) |
| Markdown render | React-Markdown library |

---

---

# MVP Implementation Plan

Build this in order. Do not skip ahead.

---

## Step 1 — Project Setup

**What to do:**
- Create a React frontend project
- Create a Node.js + Express backend project
- Set up your Claude API key in a .env file
- Connect frontend to backend with a simple test call
- Set up Supabse database with basic tables

**Tables to create:**
- `sessions` — stores session_id, user question, user profile, created_at
- `nodes` — stores node_id, session_id, node_title, node_question, final_decision, summary
- `agents` — stores agent_id, node_id, persona_name, persona_description
- `agent_messages` — stores agent_id, round_number, message_content, vote, vote_reason
- `clarifications` — stores node_id, question_asked, user_answer
- `final_output` — stores session_id, markdown_content

**Done when:** You can send a test message from frontend, it hits backend, backend calls LLm , response comes back and displays on screen.

---

## Step 2 — The Planning Agent

**What to do:**
- Build one API route: `POST /api/plan`
- Send user question + profile to LLm
- LLm responds with a list of nodes

**What to send to LLM:**
- The user's question
- The user's profile
- Instruction: Return a JSON list of nodes. Each node has a title, a question, and a reason why this step comes before the next one.

**What Claude returns (example):**
```json
[
  { "id": "node_1", "title": "BTech Foundation", "question": "Which college type and branch?" },
  { "id": "node_2", "title": "MTech Decision", "question": "Should I do MTech at all?" }
]
```

- Save these nodes to the database under the session
- Display them on screen as a list so the user can see the plan before debate starts

**Done when:** User types a question, hits start, and sees a list of nodes appear on screen.

---

## Step 3 — The Casting Agent

**What to do:**
- Build one API route: `POST /api/cast`
- For each node, send the node question to Claude and ask it to create agents
- Claude returns a list of 4 to 10 agents with names, background, and what angle they will argue from

**What Claude returns (example):**
```json
[
  { "id": "AGT-01", "name": "Priya", "background": "IIT graduate, now works at Google", "angle": "Practical career outcomes" },
  { "id": "AGT-02", "name": "Rahul", "background": "Failed startup founder, went back to job", "angle": "Risk and backup plans" }
]
```

- Save agents to the database linked to their node
- Personas should feel like real people, not job titles

**Done when:** Each node has a set of agents assigned and saved in database.

---

## Step 4 — The Debate Engine

This is the main part. Build it carefully.

**What to do:**
- Build one API route: `POST /api/debate`
- Run debate in rounds. Each round, every agent responds
- After each round, check if all agents agree on the same conclusion
- If yes, node is done
- If agents have gone 4+ rounds with no consensus, trigger clarification popup

**How one agent message works:**
- Send Claude: agent's persona + node question + previous rounds of debate + instruction to respond in character and state a clear vote at the endw
- Claude responds as that agent
- Save the message to `agent_messages` table

**How consensus check works:**
- After every round, look at the vote field of each agent's last message
- If all votes point to the same conclusion, mark node as complete
- If not, start next round

**Round structure:**
- Round 1: Each agent gives their independent opinion (no one has seen others yet)
- Round 2 onwards: Each agent sees everyone else's messages and responds

**Debate loop stops when:**
- All agents agree, OR
- 4 rounds pass with no consensus (trigger popup), OR
- You manually intervene

**Done when:** A full debate runs for one node, agents go back and forth, and either reach consensus or trigger a popup.

---

## Step 5 — Clarification Popup

**Two triggers:**

**Trigger A — Agents stuck in loop:**
- Detected when: 4+ rounds passed, no consensus
- What happens: System sends all agent positions to Claude and asks it to write one question to ask the user that would break the deadlock
- Show that question to the user as a popup
- User answers, answer is saved, debate resumes with user's answer added to context

**Trigger B — Multiple valid paths:**
- Detected when: Agents split into two clear camps and both sides have strong reasoning
- What happens: System generates a pros/cons list for each path
- Show popup with both paths, pros, cons, and ask user: "Which tradeoffs can you accept?"
- User picks or types answer, debate continues with that direction locked in

**Done when:** Popup appears at the right time, user can answer, debate continues after answer.

---

## Step 6 — Node Summary

**What to do:**
- After each node reaches consensus, send the full debate to Claude
- Ask Claude to summarize in exactly 3 points:
  - What was decided
  - Top 2 reasons why
  - Any concern that was noted but accepted anyway
- Save this summary to the `nodes` table
- This summary (not the full debate) is what gets passed to the next node

**Done when:** After a node finishes, a short 3-point summary appears on screen and is saved.

---

## Step 7 — Running All Nodes in Sequence

**What to do:**
- After Step 6 is working for one node, chain all nodes together
- Node 1 completes → its summary is attached to Node 2's context → Node 2 debate starts
- Each node gets: its own question + all previous node summaries
- Show progress bar or step indicator on screen

**Edge case to handle:**
- If an agent in a later node raises a concern about an earlier node's decision, show a popup asking user if they want to reopen that node or just note the concern and continue

**Done when:** All nodes run one after another, each using previous summaries as context.

---

## Step 8 — Final Output

**What to do:**
- After all nodes complete, collect only the final decisions (not full debates, not summaries)
- Send to Claude with instruction to write a full markdown document
- The markdown should contain:
  - Each decision with a short reason
  - A final roadmap section
  - Top 3 risks to watch out for
  - First 3 concrete actions to take
- Render the markdown on screen using React-Markdown
- Save to `final_output` table

**Done when:** User sees a clean formatted roadmap at the end with all decisions clearly written.

---

## Step 9 — Follow-up Questions (Basic)

**What to do:**
- Add a chat box below the final output
- User can type any follow-up question
- Build one API route: `POST /api/followup`
- System loads the relevant node's agent messages and summary from database
- Sends to Claude: "User asked X. Here is what the agents debated. Answer their question."
- Claude responds explaining the reasoning behind any decision

**Examples that should work:**
- "Why did agents reject the foreign MTech option?"
- "Which agent was most against doing a startup?"
- "What would change if I had more savings?"

**Done when:** User can ask one follow-up question and get a relevant, sourced answer.

---

## Step 10 — Basic UI Polish

**What to do:**
- Show which node is currently being debated
- Show each agent message appearing one by one as debate runs
- Show agent name and ID clearly on each message
- Show consensus reached message when a node finishes
- Show progress through all nodes
- Make popups clean and easy to answer on mobile

**Done when:** The whole flow from question to roadmap feels smooth and readable.

---

## MVP Is Complete When

- [ ] User can enter a question and profile
- [ ] Nodes are created automatically
- [ ] Agents are assigned per node
- [ ] Debate runs and reaches consensus
- [ ] Clarification popup works
- [ ] Multiple paths popup works
- [ ] Node summaries are saved and passed forward
- [ ] All nodes run in sequence
- [ ] Final roadmap is generated in markdown
- [ ] Basic follow-up questions work
- [ ] Everything is saved in SQLite

---

## What NOT to Build in MVP

- Do not build user accounts or login
- Do not build PDF export yet
- Do not build diagram generation yet
- Do not build session history browser yet
- Do not build re-run with changed assumptions yet
- Do not over-design the UI — functionality first

---

## Suggested Build Order Summary

```
Step 1  →  Project setup + database
Step 2  →  Planning agent (creates nodes)
Step 3  →  Casting agent (creates agents per node)
Step 4  →  Debate engine (core logic)
Step 5  →  Clarification popups
Step 6  →  Node summary
Step 7  →  Chain all nodes together
Step 8  →  Final output in markdown
Step 9  →  Follow-up questions
Step 10 →  UI polish
```

Build and test each step before moving to the next one.

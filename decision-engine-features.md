# Decision Engine — Full Feature Specification

Plain English. No code. Every feature explained in detail.

---

# SECTION 1 — SESSION MANAGEMENT

## Feature 1.1 — Starting a Session

When a user opens the app for the first time or starts a new decision, a new session is created. Every session is completely independent from others. A session has a unique ID that ties everything together — the nodes, the agents, the debate, the summaries, and the final output all belong to one session.

A session begins when the user submits two things: their question and their profile. The question is what they want to decide. The profile is context about who they are — their background, constraints, preferences, resources, and anything else relevant. The profile does not need to follow a format. The user can write it in any way they want, like a casual paragraph or bullet points.

Once submitted, the session is saved immediately to the database with a timestamp, the raw question, and the raw profile. The session stays in an "in progress" state until the final output is generated.

## Feature 1.2 — Session Persistence

Every single thing that happens inside a session is saved to the database as it happens. Nothing is kept only in memory. This means if the user closes the tab or the app crashes, the session can be resumed exactly where it left off.

The app checks on load if there is an incomplete session. If yes, it shows the user an option to continue from where they stopped or start fresh.

## Feature 1.3 — Session History

Every completed session is accessible from a history screen. The user can open any past session and read the full roadmap again. They can also open a past session to ask new follow-up questions about old decisions.

Sessions are listed by date with a short label that is auto-generated from the original question.

---

# SECTION 2 — THE PLANNING AGENT

## Feature 2.1 — What the Planning Agent Does

The planning agent is the first AI that runs after the user submits their question. Its only job is to read the question and profile and figure out how many decision nodes this problem needs and what each node should focus on.

It does not answer the question. It only breaks the question into logical, sequential decision steps. Each step must be a decision that genuinely needs to be made before the next step can be approached properly.

## Feature 2.2 — How Nodes Are Sequenced

The planning agent thinks about dependency. Node 2 can only start after Node 1 because Node 1's answer changes what Node 2 even means. For example, deciding whether to do a masters degree at all must come before deciding where to do it. The planning agent enforces this order.

Simple questions get fewer nodes. A question like "should I buy an iPhone or Android" might get 2 nodes. A complex question like "should I leave my job and move cities for a new opportunity" might get 7 or 8 nodes. The planning agent decides this based on how many genuinely separate decisions are embedded in the question.

## Feature 2.3 — Node Structure

Each node has the following information attached to it:
- A short title that describes the decision in 3 to 5 words
- A full question that frames what needs to be decided at this step
- A brief explanation of why this node comes before the next one
- An estimated complexity level which will later determine how many agents are assigned

## Feature 2.4 — User Can See the Plan Before Starting

After the planning agent finishes, the app shows the user the full list of nodes before any debate begins. The user can read through the plan and understand the path. This is read-only in the MVP — the user cannot edit nodes yet. But they can choose to start the debate or go back and rewrite their question or profile.

---

# SECTION 3 — THE CASTING AGENT

## Feature 3.1 — What the Casting Agent Does

Before debate begins at each node, a casting agent reads the node question and the user profile and decides which real-world perspectives would be most useful for this specific decision.

It creates a set of agents. Each agent is a specific person with a specific background, not a generic title. Instead of "financial advisor" the casting agent creates someone like "a person who took a career risk at 28, lost savings, and rebuilt successfully over 5 years." The specificity of the persona is what makes the debate valuable.

## Feature 3.2 — Agent Count Per Node

The casting agent assigns between 4 and 10 agents per node. The number depends on how complex and multi-dimensional the decision is. A node about a straightforward financial tradeoff might get 4 agents. A node about a major life direction change might get 9 or 10.

Every agent gets a unique ID within the session, for example AGT-01, AGT-02, and so on. This ID never changes for that agent throughout the debate. It is how the system tracks which agent said what and why.

## Feature 3.3 — Agent Persona Contents

Each agent has the following information defined before the debate starts:
- Their unique ID
- A first name to make them feel like a person
- A background description of 2 to 3 sentences describing their life experience
- Their primary angle or lens through which they see this decision
- Any known biases or blind spots they might have, so the debate stays honest

All of this is saved to the database before the debate starts. The persona is fixed for the entire debate at that node. Agents do not change their background mid-debate.

## Feature 3.4 — Persona Relevance to Query Type

The casting agent picks personas based on the domain of the question. Career questions get people who have lived through career decisions. Relationship questions get people with relevant emotional and practical experience. Business questions get founders, investors, customers, and critics. Health or lifestyle decisions get people with relevant personal experience. The casting agent reads the query and matches persona types intelligently.

---

# SECTION 4 — THE DEBATE ENGINE

This is the most important part of the entire system.

## Feature 4.1 — How a Debate Round Works

A debate happens in rounds. In Round 1, every agent independently gives their opinion on the node question. They have not seen what other agents said yet. This ensures the first opinions are genuinely independent and not influenced.

From Round 2 onwards, each agent gets to read everything everyone else said in the previous round and then respond. They can agree, disagree, add new points, challenge someone's logic, or update their own position. Each agent responds to the group, not just to one other agent.

Every agent message is saved to the database immediately when it is generated, linked to the agent ID, the node, and the round number.

## Feature 4.2 — Agent Message Structure

Each agent message has three parts. First, their analysis and reasoning — what they think and why. Second, a response to the strongest opposing point from the previous round — they must address it directly and cannot ignore it. Third, a clear vote — a one-sentence statement of what they think should be decided at this node, with a confidence level of either strong, moderate, or uncertain.

## Feature 4.3 — Consensus Detection

After every round, the system checks all the votes from that round. Consensus means all agents have voted for the same conclusion and all of them have a confidence level of strong or moderate. If even one agent votes differently or says uncertain, the debate continues into the next round.

Consensus is unanimous. Not majority. Not 80 percent. Every agent must agree. This is intentional because a decision with one strong unresolved objection is a weaker decision than one where all perspectives have been addressed.

## Feature 4.4 — Agent Position Change Tracking

When an agent changes their vote from one round to the next, this is tracked and flagged. It means the debate is making progress. If no agent changes their vote across two consecutive rounds, this is a signal that the debate is stuck and the clarification system should be triggered.

## Feature 4.5 — Maximum Rounds

A node can run for a maximum of 6 rounds. If consensus is not reached by round 6, the system automatically triggers the clarification popup. The debate does not run endlessly.

## Feature 4.6 — Context Each Agent Receives

Each agent, when generating their message, receives the following context:
- Their own persona description
- The node question
- The user's original profile
- A compressed summary of all previous nodes that have been completed
- The full transcript of the current debate so far
- A reminder that they are debating in order to find the best answer for this specific user, not to win the argument

They do not receive the full debate transcripts of previous nodes. They only receive the short summaries. This keeps the context manageable and focused.

---

# SECTION 5 — CLARIFICATION SYSTEM

## Feature 5.1 — Trigger A: Agents Stuck in a Loop

This is triggered when two consecutive rounds pass with no agent changing their vote AND consensus has not been reached. This means agents are repeating themselves without making progress.

When this happens, the system reads all current agent positions and sends them to a separate analysis step that figures out the exact point of disagreement. It then writes one clear, specific question for the user that, if answered, would give the agents the information they need to break the deadlock.

The question is shown to the user as a popup overlay. The user can either type an answer or skip. If they answer, the answer is saved to the database and added to the context for the next round of debate. If they skip, agents note the skip and make explicit assumptions to move forward.

## Feature 5.2 — Trigger B: Two Valid Paths Detected

This is triggered when agents clearly split into two camps across two or more rounds, with each camp having strong reasoning, and neither side being clearly wrong. This means there are genuinely two valid directions and the right one depends on the user's personal priorities.

When this happens, the system pauses the debate and generates a structured comparison. For each path it shows a title, what it means in practice, a list of genuine advantages, a list of genuine disadvantages, and what kind of person this path is better suited for.

This comparison is shown to the user as a popup. The user is then asked which tradeoffs they can accept and which they cannot. They are also given the option to say they want both paths explored further, in which case the agents will find if there is a hybrid approach.

The user's answer is saved and the debate resumes with that direction as a constraint.

## Feature 5.3 — Clarification History

Every question asked and every answer given during clarification is saved to the database linked to the node. This becomes part of the follow-up context later so the user can understand why certain questions were asked.

---

# SECTION 6 — NODE SUMMARY

## Feature 6.1 — What a Node Summary Is

After a node reaches consensus, a summary is generated. This summary is short by design. It contains exactly three things: what was decided in one clear sentence, the two or three strongest reasons why this was the right decision based on the debate, and any concern that was raised and acknowledged but ultimately accepted.

The summary is not a recap of the debate. It is a compressed decision record. It is designed to be read in 30 seconds.

## Feature 6.2 — How the Summary Is Used

This summary is what every future node receives as context. Not the full debate. Not all the agent messages. Just this summary. This is how the system solves the context limit problem — each node only passes forward what matters, not everything that was said.

When an agent in Node 5 needs to understand what was decided in Node 2, they read a 3-point summary, not 40 messages.

## Feature 6.3 — What Is Saved vs What Is Passed Forward

Everything is saved to the database — full agent messages, all rounds, all votes, all clarification questions and answers. But only the summary is passed forward in the context to future nodes. The full history lives in the database for follow-up queries, not in the active context window.

---

# SECTION 7 — NODE REOPEN SYSTEM

## Feature 7.1 — When a Later Node Challenges an Earlier Decision

Any agent in any node can raise a flag that says a previous node's decision is directly problematic for what they are currently debating. This is a formal flag, not just a comment in the debate.

When this flag is raised, the system shows a popup to the user. The popup explains which earlier node is being challenged, what the current agent's concern is, and what the impact is on the current decision.

The user has two choices. They can note the concern and continue anyway — in which case the concern is saved and the debate proceeds. Or they can reopen the earlier node — in which case the earlier node's debate runs again with the new information as added context.

## Feature 7.2 — Reopening a Node

When a node is reopened, it runs a fresh debate with the same agent personas but with the new concern added to the context. The agents know what was originally decided and they know why a later node is questioning it.

If the debate reaches a different conclusion this time, the summary is updated and all nodes between the reopened node and the current one are flagged for review. The user is notified and can decide whether to re-run those middle nodes or continue with the updated summary.

If the debate reaches the same conclusion again, the original decision stands and the concern is noted as "reviewed and confirmed."

---

# SECTION 8 — FINAL OUTPUT

## Feature 8.1 — What Gets Sent to the Final Agent

After all nodes are complete, a final agent receives only the following: the user's original question, the user's profile, and the final consensus decision from each node — one sentence per node. Nothing else. No debate transcripts. No summaries. Just the decisions.

This final agent's job is to take these decisions and write a complete, coherent, human-readable roadmap.

## Feature 8.2 — Final Output Structure

The final output is a markdown document with the following sections:

The first section is a one-paragraph overview of the full decision path in plain language.

The second section covers each node's decision with a short explanation of why it was the right call given the user's profile.

The third section is the roadmap itself — a step-by-step plan organized by time. What to do first, what to do in the medium term, and what to plan for long term.

The fourth section covers the top risks — what could go wrong with this plan and what to watch out for.

The fifth section lists the first three concrete actions the user should take, written as specific tasks not vague advice.

If there were any paths that were considered and rejected, the sixth section briefly lists them with a one-line reason for why they were set aside.

## Feature 8.3 — Diagrams in Final Output

Where a diagram would make the output clearer, the final agent generates a Mermaid diagram. This could be a decision tree showing what led to each choice, a timeline showing the roadmap visually, or a simple comparison chart. Mermaid is plain text that renders as a diagram in the app. No external service is needed.

The final agent decides on its own where a diagram adds value. It does not add diagrams everywhere, only where a visual genuinely makes something easier to understand.

## Feature 8.4 — Saving and Displaying the Output

The full markdown is saved to the database linked to the session. It is rendered in the app as a formatted document with proper headings, bold text, bullet points, and diagrams. The user can scroll through it and read it as a clean document.

---

# SECTION 9 — FOLLOW-UP SYSTEM

## Feature 9.1 — What Follow-up Questions Are

After the final output is shown, a chat input appears below it. The user can type any question related to the decisions that were made. This is not a general chat. It is specifically tied to the session and its decisions.

## Feature 9.2 — Types of Follow-up Questions Supported

The first type is an explanation question. The user asks why a specific decision was made. The system loads the relevant node's debate from the database, finds the strongest reasoning, and explains the decision clearly. It also mentions which agents were most influential in that decision.

The second type is a rejection question. The user asks why a certain option was not chosen. The system finds where that option was discussed in the debate, loads the arguments against it, and explains specifically why agents rejected it.

The third type is a hypothetical question. The user asks what would change if one thing about their situation were different — more money, a different timeline, a different constraint. The system uses the existing debate as context and reasons through how that change would have affected the outcome. It does not re-run the full debate. It reasons about it.

The fourth type is a challenge. The user says they disagree with a decision. The system acknowledges the disagreement, presents the agents' reasoning clearly, and asks the user what specifically they disagree with. Based on the answer, it either explains why the agents still stand by the decision or identifies that the user has new information that was not in the original profile, in which case it suggests reopening that node.

## Feature 9.3 — Follow-up Context

Every follow-up response is generated using the saved database records, not from memory. The system specifically loads the relevant node's agent messages, clarifications, and summary to answer the question. This means answers are grounded in what was actually debated, not in general knowledge.

## Feature 9.4 — Follow-up History

All follow-up questions and answers are saved to the database linked to the session. If the user comes back days later and asks more follow-ups, the system still has everything it needs to answer accurately.

---

# SECTION 10 — DATA AND STORAGE

## Feature 10.1 — What Gets Saved

Every piece of information generated or received is saved. This includes the original question and profile, the list of nodes, every agent's persona, every message from every agent in every round, every vote, every position change, every clarification question and answer, every node summary, every flag raised, and the final output.

Nothing is thrown away. The database is the source of truth.

## Feature 10.2 — Agent Traceability

Because every agent message is saved with the agent ID, the node number, and the round number, it is always possible to trace exactly which agent said what and when. If a user asks "which agent was most skeptical about this decision," the system can look at all votes and reasoning from that node and answer specifically.

## Feature 10.3 — Decision Audit Trail

Every node has a complete audit trail. You can look at any node and see exactly how the debate progressed round by round, where agents changed their minds, what clarification was asked, and what the final unanimous conclusion was. This is available at any time through follow-up questions.

---

# SECTION 11 — UI AND EXPERIENCE

## Feature 11.1 — Session Start Screen

A clean screen with two input areas. One for the question, one for the profile. A start button that only activates when both are filled. Below the inputs, a simple explanation of what is about to happen so new users understand the process.

## Feature 11.2 — Node Plan Preview Screen

After the planning agent runs, the user sees the full list of nodes laid out clearly. Each node shows its title and the question it will answer. A start debate button begins the process from Node 1.

## Feature 11.3 — Debate Screen

The main screen during the debate. It shows which node is currently active and displays agent messages as they appear in real time. Each message is clearly labeled with the agent's name and ID. Messages appear one by one, not all at once, so the user can follow the conversation.

The current round number is visible. A consensus status indicator shows whether agents are converging or still split.

## Feature 11.4 — Popup Design

Clarification popups and path comparison popups appear as modal overlays. They block the debate from continuing until the user responds or skips. They are clean and focused — they show only what is needed to answer the question.

Popups can be skipped. Skipping is always an option and never blocks the user permanently.

## Feature 11.5 — Node Completion Indicator

When a node reaches consensus, a clear visual confirmation appears showing the one-sentence decision. The debate collapses and the next node begins automatically after a brief pause so the user has time to read the decision.

## Feature 11.6 — Progress Indicator

A persistent progress indicator is visible throughout the debate. It shows all nodes as steps, highlights the current one, and marks completed ones. The user always knows where they are in the process.

## Feature 11.7 — Final Output Screen

The final markdown document rendered as a clean, readable page. Proper typography, section headings, and any Mermaid diagrams rendered visually. Below the document, the follow-up chat input is always accessible.

## Feature 11.8 — Mobile Considerations

All popups and screens should be usable on a phone screen. Text inputs should be large enough to type comfortably. Agent messages should not be walls of text — the system prompt for agents should enforce concise responses during the debate so the screen stays readable.

---

# SECTION 12 — EDGE CASES AND GUARDRAILS

## Feature 12.1 — Vague Questions

If the user's question is too vague for the planning agent to create meaningful nodes, the planning agent asks for clarification before proceeding. It specifies exactly what information is missing and why it matters.

## Feature 12.2 — Agent Hallucination Guard

Agents are given their persona and told explicitly that they are helping a specific person with a specific background. They are not answering a general question. This grounding in the user's profile reduces generic responses.

## Feature 12.3 — Infinite Loop Prevention

The maximum number of debate rounds per node is 6. After round 6 with no consensus, the clarification system triggers automatically. This cannot be bypassed. There is no scenario where debate runs forever.

## Feature 12.4 — Context Overflow Prevention

Only node summaries are passed forward, not full debate transcripts. Each summary is capped at a fixed length. This ensures the total context passed to any agent never grows beyond a manageable size regardless of how many nodes there are.

## Feature 12.5 — Empty or Low Quality Agent Messages

If an agent generates a message that does not include a clear vote or does not address the question, the system retries that specific agent once. If the retry also fails, a placeholder vote of uncertain is assigned and the debate continues. This is logged for debugging.

---

# END OF SPECIFICATION

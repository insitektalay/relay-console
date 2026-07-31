# ClawChat Web Feature Reference

Last reviewed: 2026-05-07
Source of truth: current `web` repo implementation

## Purpose

This document is a product reference for the current ClawChat web app so marketing, waitlist, and launch-site copy can describe what already exists in the product.

It is based on the implemented UI in the web repo, not on planned features.

## Navigation Notes

- The visible sidebar currently exposes: `Chats`, `Agents`, `Agent Docs`, `Applications`, `Insights`, `Settings`, and optionally `Setup` and `Operations`.
- There is still a direct `analytics` section in code, but the current user-facing analytics experience is primarily exposed through `Insights`.
- The "analytics page" in practical product terms is best described as the `Insights` experience, specifically its analytics view.

## Product-Level Capabilities

- Multi-workspace desktop-style web app with persistent workspace selection.
- Authenticated shell with account identity shown in the sidebar.
- Realtime chat updates over websocket-backed infrastructure.
- Distinct personal, family, and business organizational models.
- Multiple agent runtimes supported in the UI:
  - OpenClaw
  - Claude Code
  - Hermes
- Rich operational surfaces for chats, agents, agent documentation, applications, reports, analytics, tasks, and integrations.

---

## 1. Chat Page

Sidebar label: `Chats`

### What the page is

The Chats page is the main conversation workspace. It combines:

- a searchable conversation list
- conversation filtering by domain
- a new-chat creation flow
- a full live thread view
- wrap-up history for cyclical chats
- realtime runtime-status visibility
- attachment sending
- Paperclip thread linking

### Chat list features

- Search input for conversation lookup.
- Filters for:
  - All
  - Business
  - Family
  - Personal
- Additional department filter when `Business` is selected.
- Thread cards show:
  - title
  - avatar
  - last message preview
  - thread type badge
  - unread count
  - recent activity timestamp
- Thread types currently represented in the UI include:
  - Direct
  - Team
  - Department
  - Meeting
  - Agent to Agent
  - Group Agent
  - System
  - Approval
  - Incident
  - Report
- Direct threads can reflect custom browser-only display names for agents.
- Threads can be archived from the list.
- Empty and error states are implemented for missing workspace, loading, failed fetches, and no results.

### New chat creation

The chat page includes a dedicated `New chat` composer pane with multiple modes:

- Direct chat
  - opens or creates a 1:1 thread with a single agent
- Team chat
  - opens an existing team thread or creates one from a team
  - supports creating a new team inline
  - new team creation includes team name, department selection, and initial agent assignment
- Department chat
  - opens or creates a department thread
- Agent-to-agent chat
  - lets the user select two agents and start a coordination thread
- Company meeting
  - lets the user select multiple agents for a larger meeting thread
  - explicitly supports manager-plus-staff style meetings

### Important chat-creation rules and behaviors

- Existing compatible chats are reopened instead of always creating duplicates.
- Team creation inline is supported directly from the new-chat pane.
- Team chats enforce a single-manager rule in selection flows.
- Company meeting creation expects at least one selected manager.
- Agent search is reused across the applicable new-chat modes.

### Thread detail view

When a thread is selected, the detail pane supports:

- full message history
- live realtime updates
- message sending
- attachment upload
- thread avatar editing
- thread copy/export-style actions
- wrap-up and transcript history
- team member management for team chats
- runtime context visibility

### Messaging and composer capabilities

- Freeform text composer.
- Send action for messages.
- Attachment upload support for:
  - images
  - audio
  - video
  - documents
  - generic files
- Drag-and-drop attachments into the composer.
- Separate quick actions for general files vs image/video attachments.
- Attachment uploads are chunked and tracked in-progress.
- Upload progress, failure, cancellation, and removal states are implemented.
- Current limit: up to 10 attachments on a message.

### Live and realtime chat behavior

- Typing indicators are shown.
- Realtime incoming messages update the thread.
- Runtime dispatch activity is surfaced before a final reply arrives.
- Agents can show as:
  - thinking
  - replying
  - failed/unavailable
- Realtime context-usage data is shown per agent in active threads.
- Context usage includes token-volume and percentage-used style indicators.
- Context tiles can also show whether usage is estimated vs fresh and whether referenced docs were involved.

### Thread header controls

- Thread avatar can be updated from the header.
- Thread title is shown with type indicator.
- Updated time is surfaced.
- Manager badge is shown on team chats when relevant.
- Current cycle shortcut is shown for wrappable chats.
- Wrap-up transcript history dropdown is shown when prior cycles exist.
- Team member dropdown is shown for team chats.
- Quick add-agent dropdown is shown for eligible team chats.
- Copy thread action.
- Copy thread with references action.
- Wrap up and reset action for supported thread types.
- Full vs condensed view toggle for team chats.
- Message count badge.

### Team chat management

For team threads, the chat detail surface supports:

- viewing all team members
- manager visibility
- removing agents from the team
- adding agents not currently in the team
- blocking second-manager additions

### Condensed team-chat mode

Team chats can switch between:

- full thread view
- condensed list view

Condensed mode summarizes agent output and realtime status into a tighter feed better suited to multi-agent coordination threads.

### Wrap-up and cyclical conversation history

Direct and team chats support a wrap-up flow.

Implemented behavior includes:

- `Wrap up and reset` action
- confirmation modal
- generation of a wrap-up report for the current cycle
- preservation of the existing chat identity
  - same team or direct chat
  - same avatar
  - same agent membership
- reset of the live chat to a blank new cycle
- transcript history dropdown for prior cycles
- read-only viewing of historical wrapped transcripts
- jump from transcript view to the associated wrap-up report

This is one of the more distinctive ClawChat features: ongoing multi-cycle chats where each completed cycle becomes a reportable artifact and the same chat continues on a clean canvas.

### Paperclip integration inside chat

Each thread can optionally be linked to a Paperclip object.

Supported thread-linking features:

- link a thread to a Paperclip issue or approval
- choose a configured Paperclip connection
- enter an issue identifier, issue id, or approval id
- show linked object metadata in-thread
- show object status and summary
- deep-link into Paperclip
- refresh linked object state
- relink or unlink

Admin/permission behavior:

- non-admin users do not see the unlinked card if no link exists
- admins can create, relink, and unlink
- if no Paperclip connection exists, the chat surface routes admins to integrations setup

### Empty and recovery states on the chat page

- No workspace selected
- No chats yet
- No matching chats
- No messages yet
- No transcript messages found
- Thread load failure
- Attachment upload failure
- Runtime dispatch failure

---

## 2. Agents Page

Sidebar label: `Agents`

### What the page is

The Agents page is both:

- an agent roster
- an agent-management system

It covers agent creation, classification, organizational structure, scheduling/task operations, and direct access to agent workspace/library files.

### Agent roster/list features

- Search agents by:
  - name
  - role
  - OpenClaw id
  - runtime
  - capability
- Agents are grouped in the list by:
  - top-level group type: business, personal, family
  - group label
  - department
- Agent cards show:
  - avatar
  - display name
  - role
  - runtime label
  - status
- Agent display names can be overridden cosmetically in the browser UI.
- Empty states exist for:
  - no agents yet
  - no matching agents
  - failed agent roster load

### Agent page tabs

The management surface exposes these tabs:

- Agent Detail
- Structure
- Classification
- Work Calendar
- Tasks

### New agent creation

The page includes a `New Agent` flow with support for multiple runtime types.

Supported agent types:

- OpenClaw
- Claude Code
- Hermes

#### Shared creation options

- avatar selection or upload
- optional manager designation
- placement into:
  - business
  - personal
  - family

#### Business placement fields

- company
- department
- team

#### Family placement field

- family label / family member grouping

### OpenClaw agent provisioning

OpenClaw agent creation includes:

- agent name
- OpenClaw id / slug
- role
- model
- bridge connection selection
- business/personal/family placement
- markdown import into the agent workspace
- default workspace files or custom uploaded replacements
- live provisioning job status

Provisioning job tracking includes:

- job name and slug
- status
- stage
- message updates

### Claude Code and Hermes agent creation

Runtime-bound agent creation supports:

- agent name
- external id
- role
- model
- business/personal/family placement
- runtime-specific binding fields

Runtime-specific examples exposed by the UI:

- Claude Code repo binding
- Hermes workspace-root style binding

The UI explicitly frames these as persistent ClawChat agents bound to a runtime.

### Agent detail surface

The current visible default detail view is primarily:

- avatar editing
- display-name override management
- runtime metadata display
- direct access to the agent workspace/library manager

Header/runtime detail includes:

- runtime label
- adapter kind
- routing mode
- target external id

### Agent display-name management

- custom UI-only display names can be saved
- names can be reset
- overrides apply to grouped agent ids associated with the same logical agent entry

### Agent workspace and library manager

The default agent detail view includes a large file-management surface for agent and library content.

Capabilities implemented there include:

- browse library and workspace trees
- separate roots depending on runtime
  - OpenClaw-style library and workspace roots
  - Hermes workspace, shared, sessions, and project roots
- navigate folders and editable files
- create new markdown files
- edit markdown and environment files
- upload markdown and PNG assets
- create folders
- delete files and folders
- maintain canonical baselines in local storage
- compare/use saved baselines
- sync selected folders or files with local desktop folders/files using the File System Access API
- track linked-local sync state
- handle linked-local missing-permission and relink flows

This is a substantial product surface. It makes the Agents page feel like both an agent console and a lightweight workspace IDE for agent knowledge files.

### Structure tab

The Structure tab supports organization across business, family, and personal scopes.

#### Scope switching

- Business
- Family
- Personal

#### Family structure features

- family overview
- family-member filtering
- family-member grouped agent counts
- family-focused summary metrics

#### Personal structure features

- personal overview summary
- counts for agents, threads, and tasks

#### Business structure features

- create organization
- create department
- create team
- organization-level summary
- department dashboard
- team dashboard

#### Department dashboard features

- team count
- agent count
- pending approvals count
- open incidents count
- department deletion
- department inbox view for alerts tied to the department

#### Team dashboard features

- agents count
- running tasks count
- blocked tasks count
- pending approvals count
- add team memory items
- view handovers
- view team memory

#### Team memory creation

- title
- type
- content

### Classification tab

The Classification tab is used to classify agents into the app’s operating structures.

It supports:

- family, personal, and business scoped classification
- assignment of organization/department/team
- family-member grouping
- saving classifications back to the backend

### Work Calendar tab

The Work Calendar tab provides a group-level agent activity view.

Visible behaviors indicate support for:

- calendar display for agent work activity
- date-range navigation
- previous/next/latest range controls
- grouping controls
- department-aware calendar views
- loading and error states

This reads as an operations view for how active agents have been over time.

### Tasks tab

The Tasks tab is a full scheduled-message and dispatch system for agents.

#### Task list features

- search tasks
- create new scheduled task
- per-agent task list
- task status badges
- schedule summary label on each task

#### Task target types supported

- direct
- team
- department
- agent-to-agent

#### Task creation features

- title
- priority
- target type
- target agent/team/department
- message body
- send date and time
- time zone
- recurrence
- approval gate toggle

#### Task lifecycle features

- send now
- open related chat
- cancel schedule
- archive task
- edit schedule and content
- manual status controls
- see last error
- view run history

#### Task detail metadata shown

- priority
- target
- assigned agent
- run count
- next send time
- recurrence
- time zone
- last sent
- approval requirement
- approval id
- chat id
- created time

This makes the Agents page not just about agent identity, but about operational automation and deferred messaging into ClawChat threads.

---

## 3. Agent Docs Page

Sidebar label: `Agent Docs`

### What the page is

This is the documentation-ops surface for turning real applications into reusable agent documentation packs and then syncing or installing those packs into agents.

The page description in the app is effectively:

- link app repos
- generate reviewed documentation packs
- sync approved library docs
- install startup routers into OpenClaw agents

### Top-level tabs

- Linked Apps
- Blueprints
- Generated Packs
- Review
- OpenClaw Sync
- Agent Installs
- Drift

### Linked Apps tab

Purpose: register source applications that should have agent-ready documentation generated from them.

Implemented features:

- create a linked application
  - application name
  - repo path on the bridge machine
- duplicate prevention
- list all linked apps
- display each linked app’s:
  - repo path
  - dirty vs clean state
  - current git commit
  - documentation pack status
  - latest proposal status
- run a repo scan
- generate a proposal for initial documentation-pack creation
- open the latest proposal directly

Proposal generation status handling includes:

- background generation messaging
- queued/started timing metadata
- timeout metadata
- failed-state error display

### Blueprints tab

Purpose: manage reusable documentation blueprints.

Implemented features:

- list system and workspace blueprints
- show blueprint name, system key, and version
- show whether a blueprint is a system blueprint or a workspace fork
- preview blueprint content
- fork a blueprint into the workspace layer

### Generated Packs tab

Purpose: inspect compiled documentation packs that have already been created.

Implemented features:

- list generated packs
- show:
  - pack path
  - sync status
  - number of generated files
  - source repo commit
  - review status

### Review tab

Purpose: human review and selective application of generated documentation changes.

Implemented features:

- list proposals
- select a proposal
- inspect proposal status
- display failed-generation errors
- for each generated file:
  - choose it with a checkbox
  - see classification
  - see refresh policy
  - see whether manual review is required
  - compare previous content vs updated content
- apply only selected files from a proposal

This is effectively a docs-diff and staged-apply workflow for agent knowledge packs.

### OpenClaw Sync tab

Purpose: move approved documentation packs into the OpenClaw library.

Implemented features:

- optional target folder override
- sync pack into OpenClaw library
- per-pack sync action
- sync status visibility
- warning when no applied pack exists yet

### Agent Installs tab

Purpose: install generated documentation/router content into agents.

Implemented features:

- choose an agent
- choose install role
  - manager
  - worker
- install a selected pack into an agent
- view current installs
- current-install rows expose:
  - agent id
  - role
  - install status
  - drift status

### Drift tab

Purpose: inspect documentation drift state.

Implemented features:

- drift dashboard rendered as raw structured JSON output

### Why this page matters

This page is one of the clearest indicators that ClawChat is not just a chat UI. It has a built-in system for:

- linking real codebases
- generating agent-facing documentation artifacts
- reviewing diffs
- syncing knowledge into OpenClaw
- installing role-specific agent docs
- monitoring drift

---

## 4. Applications Page

Sidebar label: `Applications`

Internal view modes:

- Dashboard
- Marketplace
- Pipeline
- Classify Apps

### What the page is

This page is ClawChat’s application-control and app-installation surface. It mixes:

- operational visibility across apps
- category-based app organization
- workflow mapping
- marketplace install flows

### Dashboard view

Purpose: operational snapshot of the app estate.

Implemented capabilities include:

- fetch and render an applications status snapshot
- error handling with retry
- filter the snapshot by ClawChat’s app classifications
- show grouped application sections by classification and subgroup
- display app health states such as:
  - healthy
  - partial
  - stopped
  - errored
- summarize process/runtime state
- expose operational app actions through toolbar/menu controls

Examples of visible control vocabulary in the dashboard code include:

- start
- stop
- restart
- view logs
- open browser
- open terminal
- open finder
- open Codex
- open Claude
- commit and push
- sync GitHub with Codex

The Applications dashboard is positioned more like mission control than a simple app list.

### Marketplace view

Purpose: browse, connect, preview, and install application packs into agent runtimes.

#### Marketplace list features

- app catalogue grouped by category
- search filter
- category filter
- risk filter
- app cards showing:
  - name
  - category
  - risk level
  - connection types
  - capability count
  - short agent-use summary
  - status such as Available, Connected, Installed, or Coming soon
- workspace-level counts for:
  - apps
  - connections
  - installs

#### App detail features

Selecting an app opens a full install/configuration view with:

- detailed description
- provider docs link
- provider website link
- risk badge

#### Connection setup

- select an existing connection or create one
- connection name
- environment
- auth type
- credentials based on the app’s required credential schema
- save connection

#### Runtime and policy selection

- choose runtime format
- runtime support labels and install-support states
- choose approval profile
- view approval-profile description

#### Capability selection

- toggle supported capabilities on/off
- defaults come from app capability defaults

#### Install target selection

- use existing agent
- activate new agent

#### Existing-agent install flow

- choose one or more existing agents
- see whether each agent is already installed
- installability is filtered by runtime compatibility

#### New-agent activation flow

- new agent name
- new agent role
- runtime type
- current UI note: new-agent activation is currently direct for OpenClaw, while Hermes remains preview-only

#### Install behavior and constraints

- choose install role:
  - worker router
  - manager router
- approve and install into existing agents
- activate and install into a new agent
- installs write into a library target folder of the form `marketplace/<app-slug>`
- install-blocking reasons are surfaced in the UI

#### Policy visibility

Each marketplace app shows policy segmentation for:

- Allowed actions
- Approval-required actions
- Blocked actions

#### Pack preview

- preview generated install files before install
- file list navigator
- code/content preview of the selected file
- runtime-format and install-support badges

#### Marketplace audit history

- per-app audit history
- event type
- created time
- resource type

#### Fallback and diagnostics behavior

- if the live catalogue is missing, the UI can fall back to a seeded catalogue
- dedicated diagnostics UI exists for empty catalogue states
- dedicated no-results UI exists for filter mismatches

### Pipeline view

Purpose: visualize workflow relationships between applications and system artifacts.

Implemented characteristics visible from the workflow map code:

- graph-based flow map powered by React Flow
- custom avatar, system, and artifact node types
- glowing workflow edges
- draggable layout
- persistent saved layout in local storage
- viewport persistence
- custom nodes support
- edge editing support
- deleted-node persistence

This is a visual systems map rather than a simple table or list.

### Classify Apps view

Purpose: group applications into business, family, and personal buckets, including subgrouping.

Implemented features:

- app-by-app classification table
- choose parent category:
  - business
  - family
  - personal
- choose subgroup
- create new subgroup labels
- save classifications in browser state/local storage
- show app icon, name, and repo path while classifying

### Default application grouping model

The current classification model is designed around:

- Business
- Family
- Personal

This same domain model appears in other parts of the product and is part of the ClawChat worldview, not just a display filter.

---

## 5. Analytics Page

Best user-facing label today: `Insights`

Important note:

- The sidebar currently says `Insights`.
- Inside Insights, the product supports both `Report` and `Analytics` views.
- There is also a direct analytics section in code that reuses the same analytics pane, but the main user-facing analytics journey is through Insights.

### What the page is

Insights is the reporting and analytics surface for threads. It combines:

- generated reports
- wrap-up artifacts
- raw structured snapshots
- conversation analytics
- exports

### Insights list/navigation features

- search reports
- filter by report source:
  - all reports
  - snapshots
  - chat reports
- sort by:
  - newest
  - oldest
  - title
- grouped report presentation for related chat cycles
- archive action on reports
- empty state when no reports exist

### Report types

The UI currently supports at least two report families:

- snapshot reports
- wrap-up chat reports

### Wrap-up report detail

Wrap-up reports show:

- cycle number
- provider
- model
- status
  - generating
  - failed
  - completed
- message count
- created time
- backing file name
- markdown report body
- structured data payload

Wrap-up report states are handled explicitly:

- generating state message
- failed state message with error details
- completed state with full content

### Snapshot report detail

Snapshot reports show:

- type
- period
- created time
- reporting range
- raw snapshot data in structured form

### Analytics view

The analytics view is thread-centric. A user selects a thread/report context and then inspects message history metrics.

#### Header controls

- active-gap input in minutes
- export CSV
- export JSON

#### Core metrics

- total messages
- total senders
- total sessions
- thread length
- requesting-user message count
- agent message count
- user message count
- active-window count
- first message time
- last message time

#### Messages by sender

Per-sender analytics include:

- sender name
- sender kind
- message count
- session count
- share of thread
- first and last message timestamps

#### Active periods

The analytics engine splits conversations into active windows based on the selected message-gap threshold.

Per active window, the UI shows:

- window number
- start and end time
- message count
- unique sender count
- duration

#### Session breakdown

The analytics view also breaks the thread into sessions/cycles and shows:

- session number
- first and last message time
- message count
- agent message count
- requesting-user message count
- session status

#### Additional session analysis

The analytics code also includes session-level analysis components for:

- intervention analysis
- agent repeat analysis

Agent repeat analysis is only run on demand for a selected session.

### Export features

- JSON export of analytics payload
- CSV export of analytics payload

This is useful for downstream analysis or external reporting.

---

## Cross-Cutting Integrations and Themes

### Realtime

Across chat and analytics-adjacent experiences, ClawChat supports:

- websocket-backed realtime updates
- typing state
- message updates
- runtime dispatch events
- context-usage events
- participant health style events

### Organizational model

A core product pattern across the app is the split between:

- Business
- Family
- Personal

That model appears in:

- chat filtering
- agent grouping
- application classification
- structure dashboards

### Multi-agent coordination

ClawChat is not only 1:1 chat. The current app already supports:

- direct chats
- team chats
- department chats
- agent-to-agent threads
- company/meeting threads
- manager-aware team composition

### Knowledge and documentation operations

The app contains unusually deep knowledge-management tooling for an AI product:

- agent workspace browsing
- library editing
- linked local file/folder sync
- application-to-doc-pack generation
- proposal review and selective apply
- OpenClaw library sync
- installable agent docs and routers

### Operational posture

The product already behaves like an operations console as much as a chat app:

- scheduled tasks
- team and department dashboards
- application mission control
- workflow map
- analytics exports
- install/audit flows for application packs

---

## Recommended Website Framing

If this repo is the source of truth, the current product can honestly be framed as:

- a multi-agent operating system for personal, family, and business workflows
- a chat-first control surface for teams of AI agents
- a runtime-aware coordination layer across OpenClaw, Claude Code, and Hermes
- an application marketplace and install system for agent capabilities
- a documentation and knowledge pipeline for making real codebases usable by agents
- a reporting and analytics product for ongoing AI conversations and work cycles

## Copy Risks To Avoid

To stay accurate to the current web app:

- Do not describe analytics as a completely separate primary sidebar page without noting that it currently sits under `Insights`.
- Do not imply every backend query visible in code has a first-class polished UI; for example, the default Agent Detail surface is more workspace/library-centric than performance-dashboard-centric.
- Do not imply local-only or developer-only backend switching; this app is Railway-oriented in its web configuration.

# Booking and Enquiry Rescue Demo

## Purpose

This brief defines the workflow used for Relay Console screenshots and a 60 to 120 second product video. Four agents research a small-business problem, build a working form, review a proposed approach and produce durable artifacts. The demonstration does not contact a real business or collect real customer data.

## Business idea

Booking and Enquiry Rescue helps small service businesses replace unstructured email and telephone enquiries with a short online form and a clear follow-up process. The customer pays for a tailored enquiry workflow that captures the information needed to quote, schedule or qualify a new customer.

The public demonstration uses a fictional UK tutoring company named `Oakfield Tutors`. The agents research real market patterns, then build and review a fictional prototype.

## Demonstration boundary

- Use public market evidence.
- Refer to researched businesses as `Business A`, `Business B` and `Business C` in public artifacts.
- Use fictional details in the prototype.
- Do not submit the prototype with realistic personal information.
- Do not contact a business, collect a real submission or send email.
- Luca must record `DEMONSTRATION APPROVED; EXTERNAL CONTACT NOT APPROVED` in the final review.

## Agents and applications

| Agent | Harness | Role | Connected applications |
| --- | --- | --- | --- |
| Leo Metrics | Hermes | Website-signal analyst | Exa Search, Craft |
| Hugo Prototype | Hermes | Enquiry-flow prototyper | Jotform, Craft |
| Omar Digest | OpenClaw | Prospect briefing editor | Exa Search |
| Luca Signoff | OpenClaw | Approval controller | Jotform, read only |

No two agents have the same application combination. Leo and Omar share Exa for separate research and review tasks. Hugo creates the Jotform prototype, while Luca receives read-only access so he can inspect it. Omar and Luca are the two single-app agents.

PayPal, Amplitude and Brevo are not part of this workflow. Existing connections may remain in the workspace, but the agents should not use them for the demonstration. Brevo's current signup requires a paid plan, which conflicts with the free-account requirement.

### Current Craft blocker

Craft now issues scoped API URLs in this form:

```text
https://connect.craft.do/links/<connection-id>/api/v1
```

The current Relay backend accepts only the obsolete singular `/link/` path. Craft returns success for the plural path and `404` for the singular path, so Relay rejects a valid Craft connection and deletes the encrypted credential.

The intended Craft assignments remain Leo and Hugo with Standard authority. Until the connector fix reaches Railway, leave Craft unassigned and ask both agents to save final files in Relay's supplied artifact directory. Do not place a real Craft connection URL in this document or in public screenshots.

## Identity-file policy

Hermes uses `SOUL.md` as its principal identity file. Its profile may also contain `AGENTS.md`, `USER.md`, `TOOLS.md` and `HEARTBEAT.md`.

OpenClaw provisions `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `USER.md` and `TOOLS.md`. `MEMORY.md` and `HEARTBEAT.md` are optional runtime files. Leave `MEMORY.md` empty at setup; the runtime owns learned state.

## Leo Metrics identity

### `SOUL.md`

```markdown
# Leo Metrics

You are a website-signal analyst.

Find specific evidence of weak enquiry processes. Separate observed facts from assumptions. Never contact a prospect.
```

### `AGENTS.md`

```markdown
Research the market and hand concise evidence to Hugo and Omar.

Score opportunities by visible friction, suitability for a simple form and strength of supporting evidence.
```

### `USER.md`

```markdown
Alex is preparing a public Relay Console demonstration.

Use public information, avoid personal data and make each deliverable safe to show in screenshots.
```

### `TOOLS.md`

```markdown
Use Exa for public-web research.

Use Craft for organised working notes when the connection is available. Save final documents and data files in the artifact directory supplied by Relay.
```

### `HEARTBEAT.md`

```markdown
Run market scans only when a Relay cron job provides the scope and output directory.
```

## Hugo Prototype identity

### `SOUL.md`

```markdown
# Hugo Prototype

You are an enquiry-flow prototyper.

Turn research into a small working demonstration. Keep forms short, useful and easy to explain.
```

### `AGENTS.md`

```markdown
Build from Leo's evidence.

State each design assumption. Ask for approval before creating or changing an external form.
```

### `USER.md`

```markdown
Alex wants a genuine demonstration without contacting or collecting data from real customers.

Use fictional business details and labelled test content.
```

### `TOOLS.md`

```markdown
Use Jotform to create the working form.

Use Craft for the build brief when the connection is available. Save the specification and external-form pointer in Relay's artifact directory.
```

### `HEARTBEAT.md`

```markdown
Do no background work unless a Relay chat or scheduled job assigns it.
```

## Omar Digest identity

### `SOUL.md`

```markdown
# Omar Digest

You are a prospect briefing editor.

Turn research and prototypes into short business explanations. Do not submit forms or send messages.
```

### `IDENTITY.md`

```markdown
Name: Omar Digest
Role: Prospect briefing editor
Harness: OpenClaw
```

### `AGENTS.md`

```markdown
Review Leo's evidence and Hugo's prototype.

Identify unsupported claims, then prepare an unsent approach for Luca's review.
```

### `USER.md`

```markdown
Alex is demonstrating Relay Console publicly.

Keep names fictional and outputs suitable for screenshots.
```

### `TOOLS.md`

```markdown
Use Exa when a claim needs fresh public evidence.

Use the browser for inspection, not for submitting an enquiry. Save deliverables in Relay's supplied artifact directory.
```

## Luca Signoff identity

### `SOUL.md`

```markdown
# Luca Signoff

You are an approval controller.

Check evidence, consent and action boundaries before anything leaves the workspace.
```

### `IDENTITY.md`

```markdown
Name: Luca Signoff
Role: Approval controller
Harness: OpenClaw
```

### `AGENTS.md`

```markdown
Review the research, prototype and proposed message.

Record a decision for this demonstration. Do not authorise external contact.
```

### `USER.md`

```markdown
Alex wants visible approval controls and no real outreach.

Treat each external send as blocked unless Alex gives explicit approval.
```

### `TOOLS.md`

```markdown
Use Jotform in read-only mode to inspect the prototype's form metadata and submission state.

Do not edit or delete the form. Do not open personal submission data. Save approval records in Relay's supplied artifact directory.
```

## Prototype specification

Hugo creates a Jotform named `Oakfield Tutors Enquiry Prototype`. The form should include:

- Parent or guardian name
- Student year group
- Subject
- Current difficulty
- Preferred lesson format
- Preferred times
- Contact details
- Consent to receive a response

The title and introduction must identify the form as a fictional Relay Console demonstration. The form must not request payment, medical information or data about a real child.

## Chat sequence

### 1. Leo creates the market evidence

Start a direct chat with Leo:

```text
We are preparing a public demonstration of a booking and enquiry rescue service.

Research how independent UK tutoring businesses collect new-student enquiries. Use current public evidence, but do not contact anyone or collect personal data.

Create two durable artifacts in the exact Relay artifact directory supplied with this run:

1. tutoring-enquiry-market-scan.md
2. tutoring-opportunity-scorecard.csv

Identify five recurring problems. Explain what a structured enquiry form could improve and provide source URLs. Compare three anonymised examples called Business A, Business B and Business C in the scorecard.
```

### 2. Hugo designs and creates the form

Create a team chat with Leo and Hugo, then send:

```text
@Hugo Prototype, use Leo's market scan to design a working enquiry form for the fictional company Oakfield Tutors.

Create enquiry-flow-spec.md in the Relay artifact directory. Then use Jotform to create the form from the approved specification.

Label the form as a demonstration. Do not request payment, medical information or data about a real child. Ask for approval before the Jotform mutation.
```

Capture the pending `jotform_manage` action on the Approvals page. After approval, send:

```text
Create the approved Jotform prototype.

After Jotform returns the form URL, save oakfield-tutors-form.artifact.json in the supplied artifact directory with the title Oakfield Tutors Enquiry Prototype, kind document, the final HTTPS URL as external_url and Jotform as provider.
```

### 3. Omar prepares an unsent approach

Attach or reference Leo's scan and Hugo's specification:

```text
Review the tutoring market scan and the Oakfield Tutors prototype.

Create outreach-preview.md in the Relay artifact directory. Explain the visible problem, what the prototype changes, the likely business benefit and the questions that need answers before delivery.

Include a short proposed enquiry message marked UNSENT. Do not open or submit an external contact form.
```

### 4. Luca records the decision

Send Luca the market scan, prototype specification and unsent approach:

```text
Review the market scan, prototype specification and unsent approach.

Use your read-only Jotform access to confirm that the prototype exists, identifies itself as a demonstration and contains no real submissions. Do not edit or delete the form.

Create approval-record.md and demo-launch-checklist.md in the Relay artifact directory. Set the decision to DEMONSTRATION APPROVED; EXTERNAL CONTACT NOT APPROVED.

List the evidence reviewed, remaining assumptions and the approval required before real outreach.
```

## Artifact catalogue

The completed workflow should produce:

| Artifact | Agent | Purpose |
| --- | --- | --- |
| `tutoring-enquiry-market-scan.md` | Leo | Market evidence and sources |
| `tutoring-opportunity-scorecard.csv` | Leo | Anonymised comparison |
| `enquiry-flow-spec.md` | Hugo | Form design and assumptions |
| `Oakfield Tutors Enquiry Prototype` | Hugo | External Jotform pointer |
| `outreach-preview.md` | Omar | Unsent business explanation |
| `approval-record.md` | Luca | Evidence and decision |
| `demo-launch-checklist.md` | Luca | Screenshot and safety checks |

Relay injects an artifact directory under `.clawchat/artifacts/runs/<date>/<run-id>` into each dispatched chat. Agents must use that supplied path. After the source device synchronises, the macOS, web and iOS Artifacts pages show the catalogue entry while local file bytes remain on the source device.

## Scheduled work

Use the `Europe/London` time zone. These jobs create screenshot material without contacting anyone.

| Agent | Schedule | Cron expression | Output |
| --- | --- | --- | --- |
| Leo | Monday at 08:30 | `30 8 * * 1` | `.clawchat/artifacts/cron/tutoring-market-scan/` |
| Luca | Friday at 16:00 | `0 16 * * 5` | `.clawchat/artifacts/cron/booking-rescue-review/` |

### Leo cron instruction

```text
Research changes in online enquiry practices among independent UK tutoring businesses. Write a dated Markdown report to .clawchat/artifacts/cron/tutoring-market-scan. Use public evidence, anonymise example businesses and do not contact anyone.
```

### Luca cron instruction

```text
Review the available Booking and Enquiry Rescue artifacts. Write demo-readiness-review.md to .clawchat/artifacts/cron/booking-rescue-review. Check that the prototype is fictional, the outreach remains unsent and no personal data appears. Do not send email.
```

## Screenshot and video plan

Capture these Relay Console states:

1. Agents page showing two Hermes and two OpenClaw agents.
2. Leo's Hermes `SOUL.md` and Omar's OpenClaw identity files.
3. Applications page showing each agent's distinct assignments.
4. Leo's cited research conversation.
5. Hugo's pending Jotform approval.
6. The working Oakfield Tutors form.
7. Artifacts page showing Markdown, CSV and the external Jotform pointer.
8. Omar's unsent briefing and Luca's blocked-contact decision.
9. Cron Jobs page showing the two schedules.

A 90-second video can follow this order:

| Time | Screen |
| --- | --- |
| 0:00 to 0:10 | Agent roster and harness mix |
| 0:10 to 0:20 | Editable identity files |
| 0:20 to 0:35 | Leo's Exa research and artifacts |
| 0:35 to 0:50 | Hugo's Jotform approval |
| 0:50 to 1:00 | Working prototype |
| 1:00 to 1:12 | Artifact catalogue and previews |
| 1:12 to 1:22 | Omar's unsent briefing |
| 1:22 to 1:30 | Luca's decision and cron jobs |

Keep credentials, private filesystem paths and provider-account details outside every public capture.

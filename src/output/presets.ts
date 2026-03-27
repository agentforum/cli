import type { PresetRecord } from "@/domain/preset.js";
import { DEFAULT_RELATION_CATALOG } from "@/domain/relation.js";

const defaultRelationCatalog = DEFAULT_RELATION_CATALOG.map((entry) => ({ ...entry }));

export const BUILTIN_PRESETS: Record<string, PresetRecord> = {
  "software-delivery": {
    id: "software-delivery",
    title: "Software Delivery",
    description: "Default software-team workflow with stable built-in types.",
    typeOrder: ["finding", "question", "decision", "note"],
    typeTemplates: {
      finding: `FINDING - suggested body structure (free to adapt):

## What changed
## Impact
## Context
## Project metadata (optional)
- Repo / project
- Branch
- Commit
- Modified files
- PR / Ticket
- Environment / Version
## Notes`,
      question: `QUESTION - suggested body structure (free to adapt):

## Question
## Why I'm asking
## What I already know
## Blocking?
## Project metadata (optional)
- Repo / project
- Branch
- Commit
- Modified files
- PR / Ticket
- Environment / Version`,
      decision: `DECISION - suggested body structure (free to adapt):

## What was decided
## Why
## What was discarded
## Consequences
## Project metadata (optional)
- Repo / project
- Branch
- Commit
- PR / Ticket`,
      note: `NOTE - free form by default:

Use notes for project context, architecture overviews, reminders, or anything that does not fit the other types.`,
    },
    relationTypes: defaultRelationCatalog,
  },
  research: {
    id: "research",
    title: "Research",
    description: "Investigation-heavy workflow for analysis, opportunities, and review.",
    typeOrder: ["initiative", "opportunity", "risk", "question", "note"],
    typeTemplates: {
      initiative: `INITIATIVE

## Goal
## Why now
## Scope
## Expected outputs`,
      opportunity: `OPPORTUNITY

## Observation
## Why it matters
## Suggested next step
## Confidence`,
      risk: `RISK

## Risk
## Impact
## Evidence
## Suggested mitigation`,
      question: `QUESTION

## Question
## Why it matters
## What would unblock`,
      note: `NOTE

Free-form context and references.`,
    },
    relationTypes: defaultRelationCatalog,
  },
  "openclaw-analysis": {
    id: "openclaw-analysis",
    title: "OpenClaw Analysis",
    description: "OpenClaw-oriented preset for investigation and cross-agent analysis.",
    typeOrder: ["initiative", "opportunity", "risk", "question", "decision", "note"],
    typeTemplates: {
      initiative: `INITIATIVE

## Goal
## Affected repos/workspaces
## Teams/actors involved
## Desired outputs`,
      opportunity: `OPPORTUNITY

## Observation
## Repo/workspace
## Evidence
## Suggested owner
## Confidence`,
      risk: `RISK

## Risk
## Impact
## Repo/workspace
## Evidence
## Suggested mitigation`,
      question: `QUESTION

## Question
## Why this blocks or matters
## Repo/workspace context`,
      decision: `DECISION

## What was decided
## Why
## Consequences`,
      note: `NOTE

Free-form analysis context and runtime provenance.`,
    },
    relationTypes: defaultRelationCatalog,
  },
};

export function getPreset(id?: string | null): PresetRecord {
  return BUILTIN_PRESETS[id ?? "software-delivery"] ?? BUILTIN_PRESETS["software-delivery"];
}

# Agent instructions

## Read the project rules first

Before planning, designing, implementing, modifying, or reviewing work in this repository, agents **MUST**:

1. Read [the rule routing index](rules/index.md). Read every rule it routes your task to, and only those; skip the rest. Reading the index alone is not sufficient. [The rules README](rules/README.md) describes the rules and their writing criteria.
2. Read [Git workflow](rules/git-workflow.md) before committing, [GitHub Projects](rules/github-projects.md) when planning, assigning, implementing, or tracking work, and the project-wide policies the index routes to your task.
3. Consult relevant sections of [the project document](master-document.md) when needed for product scope and agreed decisions, not the whole document by default. Resolve conflicts with the team instead of silently overriding either source.

The documents in `rules/` are the authoritative source for project conventions. Follow them and link to them rather than duplicating their requirements here.

## Bounded reads and tool execution

- Agents **MUST** locate and read the sections needed for the task rather than dump full documents by default. Include applicable constraints and dependencies; smaller reads are not permission to omit requirements.
- Keep grouped reads small enough to avoid truncated output. If output is truncated, recover only the missing relevant sections; do not assume unseen text was read or repeat the whole batch.
- Request bounded tool results. For Blender inspection, query only the relevant objects and properties instead of full scene inventories; do not omit evidence needed to verify the result.
- Batch independent operations when safe and supported. Preserve dependency order, consent boundaries, error visibility, and required verification; do not combine operations that need an earlier result or approval.
- Discover tools through the interface actually available before invoking unfamiliar operations. Do not assume a directly callable tool also exists under the same name inside `codemode`; use its documented discovery interface.

These practices do not change harness, memory, skill, or review requirements and do not guarantee token savings.

## Track your work

Agents **MUST** keep the acting participant's tracker current, as defined in [the changelog guide](changelogs/README.md). Work performed with AI assistance belongs in that participant's `changelogs/tracker-<name>.md`; agents **MUST NOT** create per-agent or per-session trackers or edit another participant's history.

1. Before starting meaningful work, add or update an `in-progress` entry.
2. After significant changes, update that entry with the affected areas and the reason.
3. When stopping or finishing, mark it `completed` or `blocked` and record the next step.

Before editing an area someone else touched recently, review the relevant trackers.

## Local work plans and inspection artifacts

The root `odd/` directory contains local agent work plans (`odd/tasks/`), offline Blender authoring scripts (`odd/scripts/blender/`), temporary Blender test renders (`*.png`), check reports (`*.json`), and browser preview captures (`odd/previews/`, `odd/artifacts/`). Keep `odd/` untracked; do not commit `odd/` contents or force-add ignored files. Document delivered features, assets, technical decisions, and verification in `docs/` as required by [Quality and testing](rules/quality-and-testing.md) and [Documentation and decisions](rules/documentation-and-decisions.md).

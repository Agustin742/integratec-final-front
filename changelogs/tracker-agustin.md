# Tracker — Agustin

## 2026-10-30 — Rewrite master document for the school niche

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Rewrote the product scope for schools (teachers, students, parents, school owner/admin): organization paths, roles, activities and grades, points and shop, classroom controls, 2D classic mode, RAG-based AI bot, MVP split into core and extended, updated R1-R8 checks, and version 0.3. Removed offices/rooms, Kanban, generic tasks, and meetings. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The team narrowed the product to an education niche; the master document must match before the data model and rules are derived from it.
- **Next step:** Realign the `rules/` files with the new scope (classrooms and roles, activities and grading, points and shop, live classroom tools, notifications, data, AI bot); decide the candidate technologies in `docs/technical-justification.md`.

## 2026-10-28 — Record Terraform decision in master document

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Added Terraform to the stack table and deployment section and listed the backend-owned infrastructure-as-code rule in section 13. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Keep the master document synchronized with the backend after adopting Terraform.
- **Next step:** None.

## 2026-10-27 — Confirm rendering technology and complete frontend rules

- **Status:** completed
- **Area / files:** `rules/`, `rules/3d-world-and-camera.md`, `docs/technical-justification.md`, `docs/ai-usage.md`, `docs/architecture.md`, `master-document.md`, `AGENTS.md`
- **Change:** Replaced "undecided rendering engine" wording with the agreed Three.js + React Three Fiber decision; added the 3D world and camera rule and the technical justification, AI usage declaration, and architecture docs; aligned the master document rule index with real filenames; required tracker updates in agent instructions. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Close the gaps between master document section 13 and the existing rules, and resolve the contradiction about the rendering technology.
- **Next step:** Team to fill the real cases in `docs/ai-usage.md`, then open a pull request to `develop`.

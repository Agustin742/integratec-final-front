# Tracker — Luis

## 2026-11-02 — Align ERS, user stories, and requirements decisions with the v0.3 school niche

- **Status:** completed
- **Area / files:** `docs/requirements-decision.md`, `docs/functional-requirements.md`, `docs/user-stories.md`, `master-document.md`, `changelogs/tracker-luis.md`
- **Change:** Updated the functional requirements specification (ERS v0.2), user stories catalog (v0.2), and requirements decisions to align 100% with the v0.3 **School Niche (3D Virtual Classroom for Schools)** model (`master-document.md` v0.3 and domain rules in `rules/`). Replaced the legacy office, room, and Kanban model with schools, classrooms, school roles (`Teacher`, `Student`, `Parent`, `School Owner / Admin`), academic activities (`TP` and `Exam`), submissions, grades with weighted points ledger transactions, daily streak, medals, shop, classroom pet, live classroom tools, Classic 2D Mode, and the RAG Study Guide Bot over teacher-approved material.
- **Reason:** Eliminate documentation drift between `docs/` requirements artifacts and the authoritative v0.3 school domain baseline across both repositories.
- **Next step:** Proceed with MVP Core implementation and keep cross-repository contracts synchronized.

## 2026-10-26 — Align master document and add functional specification

- **Status:** completed
- **Area / files:** `master-document.md`, `docs/functional-requirements.md`, `docs/user-stories.md`, `docs/requirements-decision.md`
- **Change:** Documented complete functional requirements (ERS), user stories with acceptance criteria, and permission decisions; aligned the master document with the office/room domain model, office-scoped roles without Superadmin, expiring single-use invite links, and read-only AI bot scope for MVP.
- **Reason:** Establish a traceable functional baseline across both repositories and eliminate inconsistencies between architectural documentation and agreed product scope.
- **Next step:** Sync documentation to frontend repository and review technical architecture.

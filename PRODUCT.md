# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Independent teachers who run their own classrooms.
- Schools: owners/administrators who invite teachers, and teachers who manage classrooms.
- Students who attend, submit work and earn points.
- Parents or guardians who follow their child's progress through a simple view.

## Product Purpose

IntegrarTec is a web app of persistent 3D virtual classrooms for schools, seen through an isometric camera. It brings into one shared classroom, with social presence, what remote or hybrid teaching usually spreads across scattered tools: the live class, study material, activities and grades, announcements, communication and progress tracking. Success means teachers teach, track and moderate in one place, students participate and stay motivated, and families can follow progress easily.

## Positioning

A navigable classroom with presence rather than a set of disconnected tools. Game elements (points, shop, streak, pet, minigames) exist only to motivate school participation; it is not an MMO or a competitive game. An equivalent classic 2D mode serves anyone who prefers a conventional interface.

## Capabilities and Constraints

- Two organization paths at sign-up: independent teacher (teacher → classrooms) or school (school → teachers → classrooms).
- Roles and capabilities come from the server per classroom; the client never extends the capability matrix.
- 3D scene built with Three.js + React Three Fiber inside React; React renders navigation, authentication and functional panels.
- Source of truth for scope: `master-document.md`; module rules in `rules/`; art direction in `rules/art-direction.md`.

## Brand Commitments

- Name: IntegrarTec.
- Tone: warm, cozy and welcoming ("Cozy Virtual Classroom", `rules/art-direction.md`). General reference for tone, clarity and readability: the 3D visual language of Pokémon Pokopia, without copying characters, models or assets.
- UI copy in Spanish (Rioplatense, voseo).

## Evidence on Hand

No testimonials, customers, metrics or press exist; do not fabricate them.

## Product Principles

- Teaching and participation first; game elements serve motivation, never the other way around.
- Everything essential must also work without the 3D scene (classic 2D mode).
- Clear, friendly guidance over technical detail; never expose internal errors to users.
- Server-derived permissions; the interface never implies access the user does not have.

## Accessibility & Inclusion

Keyboard and screen-reader access for all essential functions, touch input equivalent to mouse, and layouts adapted to phones and touch screens.

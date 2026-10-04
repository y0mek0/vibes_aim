# MISTAKES — vibes_aim (working title: MARKET//AIM)

> Append-only. Honest record of what was tried, what actually happened, and what to do next time. Failures belong here, not in CHANGELOG.

## Stage 0 — Repo skeleton (2026-10-04)

- First attempt to install the `market-aim-dev-log` skill description in 129 chars was rejected by the skill loader. Corrected to a 60-char summary in the description, detail moved into the body, then accepted.
- Lesson: skill `description` is capped at 60 chars; long detail belongs in the body, not the description.

## Stage 0b — Repo relocation (2026-10-04)

- Started the skeleton at the wrong path (`C:\Users\azi\market-aim`) because I picked a default project root instead of asking. The user corrected the path on the next turn.
- Lesson: when the user has not specified a project root and the project will be revisited across sessions, ask before initializing. The earlier skeleton was small (4 markdown files) so the cost was minor; in a larger project this would have meant a re-clone and re-import.
- Mitigation: the new path is now the only source of truth; the old path is left empty and ignored.

# SKILLS.md — Codex Project Skills and Workflows

> Companion to `AGENTS.md`. This file defines practical capabilities and repeatable workflows for implementing and maintaining this application. It does not install Codex skills or grant tool permissions.

## 1. Source of truth
- Read `AGENTS.md` for global project rules.
- Read `ui-design.md` before UI work, if present.
- Read project specifications, README, and existing code before implementing features.
- If documents disagree, flag the conflict rather than silently choosing.
- Never invent requirements, API contracts, or design tokens that are not documented.

## 2. Project discovery
- Identify the framework, package manager, scripts, routes, component structure, styling system, and tests.
- Reuse installed libraries and established patterns instead of adding dependencies by default.
- Inspect only the files relevant to the current task first; expand the search when necessary.

## 3. UI implementation
- Translate `ui-design.md` into reusable components and consistent design tokens.
- Implement mobile and desktop layouts with responsive behavior.
- Cover loading, empty, error, disabled, and success states where relevant.
- Use semantic HTML, keyboard-accessible controls, visible focus indicators, and readable contrast.
- Preserve existing visual conventions unless the specification explicitly changes them.
- Do not introduce placeholder interactions that appear functional but do nothing.

## 4. Backend and integration
- Respect existing API contracts and data models.
- Validate inputs and handle failures explicitly.
- Keep secrets in environment configuration; never hardcode credentials.
- Avoid unrelated database, schema, or infrastructure changes.
- Use mock data only when clearly labeled and approved for the task.

## 5. Debugging and testing
- Reproduce the issue before changing code when feasible.
- Find the root cause and make the smallest reliable fix.
- Run the most targeted tests first, then lint/type checks and the build when available.
- Add or update tests for behavior changes when the project has a testing setup.
- Report commands run, results, and any verification blocked by environment limitations.

## 6. Efficient Codex workflow
1. **Inspect:** Read relevant documentation and files.
2. **Plan:** State a short implementation plan for multi-file or risky work.
3. **Implement:** Make small, cohesive changes; avoid unrelated refactors.
4. **Verify:** Run relevant tests/build and inspect errors.
5. **Report:** Summarize changed files, verified behavior, and remaining issues.

### Token and context efficiency
- Prefer targeted file reads and searches over dumping entire repositories.
- Do not repeatedly reread unchanged files.
- Keep status messages concise and focused on decisions or blockers.
- Use simpler solutions unless complexity is justified.
- Ask a clarifying question only when a missing requirement blocks a safe choice.

## 7. Safety and permissions
- Work only within the authorized project workspace.
- Request approval for destructive operations, new external services, major dependency changes, or sensitive data access.
- Never bypass sandbox restrictions or permission prompts.
- Do not run destructive commands (`rm -rf`, force resets, database drops) without explicit authorization.
- Do not overwrite user changes without checking the current state.

## 8. Completion checklist
- [ ] Implementation matches the documented requirements.
- [ ] Mobile and desktop behavior considered for UI changes.
- [ ] Accessibility and edge states addressed where applicable.
- [ ] Relevant tests, linting, or build attempted.
- [ ] No secrets or unrelated changes introduced.
- [ ] Final summary lists changed files, verification results, and known limitations.

## 9. Skill activation examples
- **Build UI:** Read `ui-design.md`, inspect components, implement responsive screens, verify build.
- **Fix a bug:** Reproduce, isolate cause, patch minimally, add regression test.
- **Add a feature:** Trace existing data flow, plan affected files, implement, test.
- **Review code:** Prioritize correctness, security, regressions, and missing tests; cite file locations.
- **Improve performance:** Measure or identify bottleneck before optimizing; compare behavior afterward.

## Note on native Codex skills
Codex's native reusable skills typically live in their own skill directories with a `SKILL.md` file. This root-level `SKILLS.md` is a human-readable project guide, not a replacement for a native skill installation. Reference it from `AGENTS.md` if you want Codex to read it consistently.

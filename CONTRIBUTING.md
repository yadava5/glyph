# Contributing

Thanks for your interest in `glyph`. This guide covers the workflow we follow on the repo.

## Quick start

```sh
# one-time
git clone git@github.com:yadava5/glyph.git
cd glyph

# C++ build + tests
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build

# web app
cd web
npm install        # triggers husky install via the prepare script
npm run dev        # localhost:5173
```

See `README.md` for deeper build flags and benchmark commands.

## Branching

We use a **track-branch** workflow:

- `main` — always releasable; protected. **No direct pushes.**
- `hygiene`, `frontend`, `backend`, `optimization` — long-running track branches.
- Work happens on short-lived feature branches off a track branch, following the naming scheme below.

Only track branches merge into `main` (as a single "major merge" per milestone). Feature branches merge into their track branch via squash.

### Branch naming

```
<type>/<slug>
```

`type` is one of the Conventional Commit types: `feat`, `fix`, `perf`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`.

Examples:

- `feat/activation-heatmap`
- `perf/avx512-gemm-tuning`
- `chore/dependabot-config`
- `fix/touch-pressure-ios`

If the work is clearly tied to one track, prefix the slug: `feat/frontend-activation-heatmap`. Nested slashes (`feat/frontend/activation-heatmap`) conflict with the track-branch refs and are avoided.

## Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/). The commit-msg hook enforces this locally; `commitlint-github-action` enforces it in CI.

Accepted scopes: `frontend`, `backend`, `optimization`, `hygiene`, `docs`, `viz`, `canvas`, `ci`, `deps`, `release`.

### Commit body format

We prefer **one commit per file** where practical, with a structured body:

```
<type>(<scope>): <subject ≤72 chars, imperative>

WHAT
- concrete changes in this file

WHY
- underlying problem, user-visible bug, or product goal

INTENT
- the broader objective this file-level change contributes to

VALIDATION
- commands run and what you observed

Co-Authored-By: <name> <email>
```

Exceptions where multiple files in one commit are acceptable:

- Generated lockfiles paired with the manifest (`package.json` + `package-lock.json`).
- Rename pairs (file + its test) where splitting would break the test.

Never use `--no-verify` or `--no-gpg-sign` unless the maintainer explicitly asks.

## Pull requests

Open PRs targeting the appropriate **track branch**, not `main`. The PR template covers the expected sections: Summary, Why, Changes, Test plan, Perf impact, Screenshots, Breaking changes, Rollback plan.

Link every PR to an issue (`Closes #N`).

CI must pass before merge. We squash-merge feature PRs into their track branch and delete the feature branch.

## Issues

File issues using the YAML forms in `.github/ISSUE_TEMPLATE/`:

- `bug_report.yml` — something is broken.
- `feature_request.yml` — a new capability.
- `performance_regression.yml` — a benchmark got slower or a latency target was missed.
- `rfc.yml` — design proposal; may become an ADR under `docs/adr/`.

Security issues: see `SECURITY.md` (private vulnerability reporting).

## Code style

- C++: 4-space indent, ≤80 char lines, `const`-correct, Doxygen blocks on public API. Types PascalCase, functions/locals camelCase. `clang-format -i` enforces layout; `.clang-format` at the repo root is the source of truth.
- TypeScript/React: 2-space indent, single quotes, semicolons, trailing commas. Prettier + ESLint enforce it; lint-staged runs on every commit.
- Markdown/YAML: 2-space indent, LF line endings, UTF-8. `.editorconfig` covers this across editors.

## Tests + benchmarks

- C++ unit tests live in `tests/` (Catch2). Aim for coverage of any new math kernel or data-loading change.
- Frontend tests TBD; use Vitest when we add them.
- Benchmarks in `benchmarks/` (Google Benchmark). Include numbers in the PR body when touching a hot path.

## Roadmap

Longer-term plans live in `~/.claude/plans/fast-mnist-2026-upgrade-v3.md` (maintainer-local). Milestones and issues on GitHub reflect the publicly-agreed scope.

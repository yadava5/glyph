# Security Policy

## Supported versions

Security patches target the `main` branch and the latest tagged release. Older tags receive fixes only at the maintainer's discretion.

| Version | Supported |
| --- | --- |
| `main` (unreleased) | ✅ |
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security problems.** Use GitHub's private reporting channel:

- <https://github.com/yadava5/glyph/security/advisories/new>

Please include:

- A description of the issue and its impact.
- A minimal reproduction (commands, inputs, commit or tag).
- Your assessment of severity (CVSS if you have one, rough impact if not).

## Response expectations

Best-effort acknowledgement within **7 days**. This project is maintained by a single person in spare time; urgent fixes may take longer depending on scope.

Public disclosure follows a coordinated timeline — the maintainer will agree a date with the reporter before publishing an advisory and patched release.

## Scope

- C++ core library, HTTP server, and CLI tools.
- Web frontend in `web/`.
- Build and CI pipelines in this repository.

Out of scope: third-party dependencies (report upstream), user misconfiguration, and issues in forks.

## Recognition

Reporters are credited in the published advisory unless they request otherwise.

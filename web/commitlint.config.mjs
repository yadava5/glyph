// Dependabot writes its own subject. For a grouped update it spells out the
// group name, the directory and the update count, so whether it clears the
// 80-char cap depends on the group's name and on how many updates landed in
// that batch -- which means the same job reds on some grouped PRs and not
// others. Measured on the four grouped PRs open when this was written:
//
//   FAIL 85  chore(deps): bump the actions-minor-and-patch group across 1 directory with 4 updates
//   FAIL 85  chore(deps): bump the booklet-minor-and-patch group across 1 directory with 7 updates
//   pass 75  chore(deps): bump the codeql-action group across 1 directory with 4 updates
//   pass 78  chore(deps): bump the minor-and-patch group across 1 directory with 14 updates
//
// The count moves every month, so renaming a group does not retire this.
//
// Raising header-max-length for everyone would be the wrong trade — the cap
// exists so a hand-written subject survives GitHub's " (#N)" suffix on a
// squash merge. So the generated headers are exempted by shape instead, and
// the cap stays at 80 for anything a human types.
//
// The pattern is deliberately narrow: a conventional type, an optional
// `(deps)` / `(deps-dev)` scope, then the literal `bump `. It is anchored
// with `^` and compiled WITHOUT the `m` flag, so it can only ever match the
// header — a body line that happens to start with "chore(deps): bump " in a
// hand-written commit does not exempt that commit.
const DEPENDABOT_BUMP_HEADER = /^(chore|build|ci)(\(deps(-dev)?\))?: bump /;

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],

  // `ignores` receives the full commit message, header first.
  ignores: [(message) => DEPENDABOT_BUMP_HEADER.test(message)],

  rules: {
    // Subject: cap at 80 to leave room for GitHub's auto-appended " (#N)"
    // suffix on squash merges. Hand-written subjects still target ~66 chars
    // to stay comfortably under the cap after squashing.
    'header-max-length': [2, 'always', 80],

    // Disable body/footer line caps — we write long URLs in VALIDATION
    // sections and the default 100-char limit fails on real URLs.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],

    // Blank-line rules: warn, don't block. Squash merges can collapse
    // the leading blank line between body and footer; not worth failing
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],

    // Case rules disabled: we often use acronyms in subjects ("ADR-0001",
    // "SIMD", "OKLCH", "MLP", "WASM") which config-conventional flags as
    // pascal/upper-case. Not worth the noise.
    'subject-case': [0],

    // Type must be one of these.
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'chore', 'docs', 'refactor', 'test', 'build', 'ci', 'style'],
    ],

    // Scope is a soft suggestion (level 1 = warning). Expanded to cover
    // the organic set we've used so far so existing commits are silent.
    'scope-enum': [
      1,
      'always',
      [
        // tracks
        'frontend',
        'backend',
        'optimization',
        'hygiene',
        // areas
        'docs',
        'viz',
        'canvas',
        'web',
        // infra
        'ci',
        'deps',
        'release',
        'github',
        'automation',
        'security',
        'meta',
        'hooks',
        'deploy',
        'theme',
        'utils',
        'components',
        'scaffolds',
      ],
    ],
  },
};

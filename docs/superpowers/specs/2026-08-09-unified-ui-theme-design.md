# Unified UI theme — design

**Date:** 2026-08-09
**Status:** approved

## Problem

The landing page was rebuilt on a neutral system — zinc/white type, hairline
`rgba(255,255,255,0.06)` rules, mono microlabels, the six agent hues as soft
background radials. Every other surface still runs the previous violet/cyan
theme: 30+ files reference `violet-*`, `cyan-*` or `#7c3aed`, and `globals.css`
itself hardcodes violet into the input focus ring, the resize handle, the active
tab underline and five keyframe animations. Landing and app read as two products.

Motion is equally split: the landing page alone runs three animation systems —
an IntersectionObserver `Reveal` component, GSAP + ScrollTrigger
(`PipelineRail`, `RevealText`, `ScrollExpand`), and framer-motion
(`ScrollVelocity`). Nothing anywhere respects `prefers-reduced-motion`.

## Goal

One visual and motion system across every surface, with the landing page as the
reference. No hue outside agent identity and status.

## 1 — Token layer

`app/globals.css` is rewritten (not appended to) as the single source of truth.
No component hardcodes a hex value.

```
surfaces
  --bg-base       #09090b        page ground
  --bg-raised     #0A0A0D        cards, panels
  --bg-overlay    #0D0D12        hover on raised, modals
  --surface       rgba(255,255,255,.03)
  --surface-hover rgba(255,255,255,.06)
  --hairline        rgba(255,255,255,.06)
  --hairline-strong rgba(255,255,255,.12)

text — all WCAG AA on --bg-base
  --text-primary   #fafafa   18.9:1
  --text-secondary #a1a1aa    7.2:1
  --text-tertiary  #8b8b96    5.5:1

interaction — monochrome, no hue
  --focus-ring rgba(255,255,255,.45)
  --cta-bg #fafafa   --cta-fg #09090b

agent identity — the only color in the product
  --agent-architect #60a5fa   --agent-designer  #22d3ee
  --agent-coder     #4ade80   --agent-debugger  #fb7185
  --agent-tester    #c084fc   --agent-assistant #fbbf24

status
  --ok #34d399   --warn #fbbf24   --err #fb7185

motion
  --dur-fast 150ms  --dur-base 300ms  --dur-slow 700ms
  --ease-out cubic-bezier(.16,1,.3,1)
```

Deleted from `globals.css`: `--accent-muted`, `--accent-glow`, the violet
`.gradient-text`, the violet input-focus rule, `.pulse-glow`, `.writing-pulse`,
`.resize-handle:hover`, the `.tab-active` gradient underline,
`.gradient-placeholder`, and the entire unused shadcn block
(`--card/--popover/--sidebar/--chart-*` plus the `.dark` class) — the app is
dark-only and ships no theme switch, so those tokens tint nothing.

`lib/agents/index.ts` changes the debugger's `color` from `text-red-400` to
`text-rose-400` so agent identity and the `--err` status token agree.

Primitives replacing the ~40 inline repeats of `bg-white/[0.03] border-white/[0.08]`:
`.surface`, `.surface-raised`, `.hairline`, `.btn-primary`, `.btn-ghost`,
`.field`. `.glass` is declared but never used today — it is removed.

## 2 — Motion

New `lib/motion.ts` (~50 lines) owns GSAP registration and the shared scale:

```ts
gsap.registerPlugin(ScrollTrigger);
export const REDUCED = /* prefers-reduced-motion */;
export const EASE = 'power3.out';
export const DUR = { fast: 0.15, base: 0.3, slow: 0.7 };
export function reveal(el, opts);   // ScrollTrigger batch; no-op when REDUCED
```

Ownership:

- **GSAP + ScrollTrigger** — every scroll-linked effect. Absorbs the landing
  page's `Reveal`/`useReveal` IntersectionObserver component, and
  `ScrollVelocity` is ported off framer's `useVelocity` onto a ScrollTrigger
  `onUpdate` velocity read (~20 lines).
- **CSS** — hover, focus, active, and enter animations, using `--dur-*` and
  `--ease-out`.
- **framer-motion** — retained *only* for `AnimatePresence` exit animations on
  modals and dropdowns. Nineteen files already depend on it and CSS cannot do
  exit animation without extra state plumbing; removing it would be churn, not
  simplification.

A `prefers-reduced-motion: reduce` guard is added at both layers — a CSS block
that collapses durations to `0.01ms`, and the `REDUCED` early-return in
`lib/motion.ts`. There is no such coverage today.

## 3 — Landing page fixes

| flaw | fix |
| --- | --- |
| hero line 2 `text-zinc-500` ≈ 3.9:1, below AA | `--text-secondary` |
| three animation systems on one page | GSAP only (§2) |
| nav renders identically at every scroll position | ScrollTrigger toggles hairline + backdrop blur past the hero |
| `.glass` declared but unused; `white/[0.03]` inlined ~40× | `.surface` primitives, actually applied |
| dead violet tokens tinting nothing | deleted (§1) |

## 4 — Sweep

Token substitution only. No layout, copy, or behaviour changes.

- **Chrome** — `Header`, `WorkspaceLayout`, `WorkspacePanel`, `ProjectSidebar`,
  `WelcomeScreen`
- **Auth / marketing** — `LoginForm` (its violet/cyan blur mesh becomes the same
  agent-hue radial treatment as the landing hero), `AuthModal`, `app/s/[id]`
- **Dialogs** — `SettingsModal`, `DeployModal`, `ShareModal`,
  `GitHubCloneDialog`, `GitHubCommitDialog`, `ExitConfirmModal`,
  `KeyboardShortcutsModal`, `InlineEditPopup`
- **Panels & pickers** — `ChatPanel`, `MessageBubble`, `FileTree`, `Terminal`,
  `PreviewPanel`, `EditorPanel`, `DiffViewer`, `TemplateGallery`,
  `TemplateCard`, `SnippetLibrary`, `ComponentLibrary`, `QuickFilePicker`,
  `FindInFiles`, `StyleInspector`, `CustomDropdown`, `ImageUpload`,
  `ErrorBoundary`

## Verification

1. `npm run build` succeeds.
2. `npm run lint` clean.
3. `npm run ui:smoke` passes and its screenshots show no violet.
4. Grep gate: `grep -rE "violet|purple-|7c3aed" app components` returns nothing.
   `lib/templates/*` is excluded — that is generated user code, out of scope.
5. `test/a11y-audit.mjs` reports no new contrast violations.
6. Playwright screenshots of `/landing`, `/login`, `/app` reviewed side by side.

## Corrections found during implementation

The design above was written from a read of the codebase. Six things turned out
differently once the work started; they are recorded here rather than edited
away, because each changed the shape of the change.

1. **`.glass` / `.glass-strong` are used, not dead.** Twelve panels and dialogs
   spell them. They were retinted in place instead of deleted, which also means
   those twelve files needed no edit at all. The same applies to `.glow-border`,
   `.pulse-glow`, `.writing-pulse`, `.gradient-placeholder`, `.resize-handle`
   and `.tab-active`: recolouring the class beat touching every call site.
   Only `.gradient-border` was genuinely unreferenced.

2. **The agent hue mapping in the design was wrong.** `lib/agents/index.ts` is
   the source of truth and reads assistant = cyan, designer = purple, tester =
   amber. The tokens were corrected to match it. Only the debugger changed
   colour, red → rose, so that an agent never renders in the same hue as a crash.

3. **The landing page ran two live animation systems, not three.** The
   `useReveal` hook and the memoised `Reveal` wrapper were defined, memoised,
   and never rendered — as was `components/ScrollReveal.tsx`. Both were deleted
   rather than ported. Every heading already revealed through `RevealText`,
   which is GSAP.

4. **The wash needed two variants.** `.agent-wash` places its radials at 62–92%
   on x, which suits a full-width hero and bunches them off the edge of the
   half-width login panel. `.agent-wash-panel` carries the same five hues at
   panel-appropriate coordinates.

5. **`ScrollVelocity` carried three defects** found while porting it off
   framer-motion: its inner `VelocityText` was declared inside the parent's body
   (so every parent render produced a new component type and remounted the
   marquee), its `velocityMapping` default object re-fired the effect on every
   render, and it had no reduced-motion path. It also typed `texts` as `never[]`,
   which was the repo's one standing `tsc` error; that is now fixed.

6. **`ExitConfirmModal` needed no change** — its only colour is red on a
   destructive confirm, which the status rule preserves.

## Verification status

Passing: `npm run build`, `tsc --noEmit` (clean, including the pre-existing
error above), `npm test` (48/48), `test/a11y-audit.mjs` (0 axe violations
across the three reachable routes), and a purpose-built theme audit asserting
zero banned colours, zero WCAG AA contrast failures and zero page errors on
`/landing` and `/login`.

**Not verified: the `/app` workspace.** `proxy.ts` requires a Supabase session,
so `/app` redirects to `/` for an unauthenticated client — which also means
`npm run ui:smoke` cannot reach its textarea. That is pre-existing and unrelated
to this work, but it does mean the workspace chrome has been checked only by
static grep and typecheck, never rendered. It needs either a test account or a
signed-in session to close out.

## Follow-up round — CSS defects and workspace design

Five CSS defects, found after the theme landed. Four were introduced by the
rewrite; the fifth predates it.

1. **Triple focus ring with square corners.** The global ring painted a
   `box-shadow` as well as an `outline`. Tailwind's `focus:outline-none`
   removes an outline but cannot remove a shadow, so controls that had opted
   out still got a ring; and a shadow traces the element's own `border-radius`,
   which a bare `<textarea>` has none of — so the WelcomeScreen composer drew a
   square ring inside its rounded wrapper. The ring is now `outline` only, and
   `.glow-border :focus-visible` stands the inner control's ring down so a
   wrapper and its child never both draw one.

2. **Landing anchor links hard-jumped and landed under the nav.**
   `scroll-behavior: smooth` sat on `html`, which carries `overflow: hidden`
   and never scrolls. Moved to `#landing-scroller`, with `scroll-margin-top`
   so a target clears the sticky nav.

3. **Every control became 50% slower.** `transition: all 0.2s` was retokenised
   to `all var(--dur-base)` — 300ms — which also interpolates `background-image`
   for `.btn-shimmer`. Now enumerated properties at `--dur-fast`.

4. **Reduced motion froze loading spinners.** `animation-iteration-count: 1`
   parks a spinner at an arbitrary angle, which reads as a hung app.
   Indeterminate spinners are exempt and keep turning, slower.

5. **Firefox got default scrollbars** — the styling was `::-webkit-` only.

Two further contrast defects, both predating the theme work: disabled buttons
carried `opacity: 0.4` *and* `filter: saturate(0.3)`, two dimmers compounding
to near-invisible on a near-black ground; and the chat context meter used a
`zinc-600` label at 3.0:1 with a 30%-white fill indistinguishable from its own
track.

### Workspace design changes

- **The composer takes the stage until the first file exists.** `hasProject`
  flips on the first *message*, not the first file, so the whole opening turn
  was spent looking at a file tree and an editor rendering two empty states
  across two thirds of the screen. Both now mount on the first file write.
- **Status is a control when it is an error.** It was the only red thing on
  screen and had no affordance; it is now a bordered, hoverable button that
  opens Settings. Every other state stays a passive span.
- **Disabled Deploy reads as disabled, not broken** — a dashed outline and a
  tooltip giving the reason, opting out of the global dimmer.
- **Both chrome rows tightened** (44→40px and 36→32px) rather than merged.
  The merge was costed at ~64px of reclaimed height from a screenshot estimate;
  the code says `h-11` plus a `py-2` bar, so the real saving was ~36px — for a
  refactor lifting `activeTab` out of `WorkspacePanel` and the five auto-switch
  effects that depend on it. Not worth it at the true number.

## Out of scope

- `lib/templates/**` — starter code shipped into the user's sandbox.
- `remotion/**` — the promo video.
- Any light theme. The app is dark-only and no switch exists.

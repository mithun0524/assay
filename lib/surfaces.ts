/**
 * The workspace's right-hand panel, as data.
 *
 * What a person sees while an agent works used to be settled in three places at
 * once: a hardcoded row of tabs in WorkspacePanel, five separate `useEffect`s
 * racing to call `setActiveTab`, and whatever `hasFiles` happened to be. Adding
 * a surface, hiding one from beginners, or changing what auto-opens meant
 * editing all three and hoping.
 *
 * Here each surface declares three things and nothing else decides them:
 *
 *   tiers      — who is offered it at all
 *   available  — whether it is meaningful given the current state
 *   focusWhen  — whether the app should switch to it on its own
 *
 * The tab bar is then a filter, and auto-focus is one pass over one list.
 * Changing what a user sees is editing this table.
 *
 * `tier` is a stored preference today. It is meant to come from an onboarding
 * step later — which is why nothing outside this file asks what tier means.
 */

export type SurfaceId = 'build' | 'app' | 'code' | 'logs';

/**
 * Audience, not skill. `simple` is the default because someone who typed
 * "a task management app" wants to watch the app, not the scaffold.
 */
export type Tier = 'simple' | 'developer';

/** Everything a surface is allowed to base its decisions on. */
export type SurfaceState = {
  /** files written into the project so far */
  fileCount: number;
  /** the sandbox has a URL we can frame */
  hasPreview: boolean;
  /** anything has been printed to the terminal this session */
  hasOutput: boolean;
  /** the agent loop is mid-turn */
  isStreaming: boolean;
  /** coarse phase of the current turn — mirrors GenerationPhase in lib/store */
  phase: 'idle' | 'writing' | 'searching' | 'installing' | 'starting' | 'verifying' | 'done';
  /** the sandbox or the build is in an error state */
  hasError: boolean;
};

export type Surface = {
  id: SurfaceId;
  label: string;
  tiers: Tier[];
  available: (s: SurfaceState) => boolean;
  focusWhen?: (s: SurfaceState) => boolean;
};

export const SURFACES: Surface[] = [
  {
    // The build itself, as something to watch: the agent pipeline and a frame
    // where the app will appear. Exists so that a `simple` user has somewhere
    // to look while files are being written — the transcript deliberately says
    // very little, so this carries the sense of progress.
    id: 'build',
    label: 'Build',
    tiers: ['simple', 'developer'],
    // Unconditional, and it has to stay that way. Build is the home surface:
    // it is the only one every tier is offered and the only one that does not
    // depend on files, a preview or a running turn existing.
    //
    // It used to require `isStreaming || phase !== 'idle' || fileCount > 0`,
    // which is false for a project whose first turn failed before writing
    // anything — messages but no files, no preview, idle. Every other surface
    // was also unavailable, so the tab bar came back empty and the panel
    // rendered nothing at all. `neverEmpty` in the tests pins this.
    available: () => true,
    // Every working phase except 'done' — the build is the thing to watch right
    // up until there is a running app to look at instead.
    focusWhen: (s) => s.isStreaming && s.phase !== 'idle' && s.phase !== 'done',
  },
  {
    id: 'app',
    label: 'App',
    tiers: ['simple', 'developer'],
    available: (s) => s.hasPreview,
    // The whole point of the product. The moment it runs, show it.
    focusWhen: (s) => s.hasPreview && (s.phase === 'done' || s.phase === 'idle') && !s.hasError,
  },
  {
    id: 'code',
    label: 'Code',
    tiers: ['developer'],
    available: (s) => s.fileCount > 0,
  },
  {
    id: 'logs',
    label: 'Logs',
    tiers: ['developer'],
    available: (s) => s.hasOutput,
    // Only ever on a failure, and only for someone who asked to see logs at all
    // by being in the developer tier. It never opens itself on a green build.
    focusWhen: (s) => s.hasError,
  },
];

/** Surfaces this person is offered right now, in tab order. */
export function visibleSurfaces(tier: Tier, state: SurfaceState): Surface[] {
  return SURFACES.filter((s) => s.tiers.includes(tier) && s.available(state));
}

/**
 * The surface the app should switch to on its own, or null to leave the user
 * where they are.
 *
 * Two rules keep this from yanking the panel around:
 *   - it only ever returns a surface the user is actually offered, and
 *   - it returns null when the current surface already wants focus, so a
 *     re-render mid-phase is not a reason to move.
 *
 * Callers should also stop honouring this once the user has picked a tab by
 * hand for the current turn; auto-focus is a starting position, not a leash.
 */
export function surfaceToFocus(
  tier: Tier,
  state: SurfaceState,
  current: SurfaceId | null,
): SurfaceId | null {
  const visible = visibleSurfaces(tier, state);
  if (visible.length === 0) return null;

  const wanted = visible.find((s) => s.focusWhen?.(state));
  if (!wanted) {
    // Nothing is asking for focus. Only intervene if where they are has become
    // unavailable — otherwise leave them alone.
    return current && visible.some((s) => s.id === current) ? null : visible[0].id;
  }
  return wanted.id === current ? null : wanted.id;
}

/** Fallback when the current surface disappears (e.g. tier changed). */
export function firstAvailable(tier: Tier, state: SurfaceState): SurfaceId | null {
  return visibleSurfaces(tier, state)[0]?.id ?? null;
}

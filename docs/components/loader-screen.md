# LoaderScreen Component

## Overview

Premium loader screen for landing page with logo animation and morphing transition.

## Features

- Minimum 1.5s display time ensures visibility
- Page ready detection (window load event)
- Logo with entrance, breathing, and exit animations
- 18 floating particles with staggered delays
- Subtle grid pattern background
- Morphing transition to hero heading
- Reduced motion support
- GPU-accelerated animations

## Usage

```typescript
import { LoaderScreen } from './LoaderScreen';

function MyPage() {
  const [showLoader, setShowLoader] = useState(true);

  return (
    <>
      {showLoader && (
        <LoaderScreen onComplete={() => setShowLoader(false)} />
      )}
      {/* Page content */}
    </>
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| onComplete | () => void | Callback fired when loader completes (after exit animation) |

## Timing

- **Entrance:** 0.6s (logo scales + fades in)
- **Breathing:** 2s cycle (continuous until exit)
- **Minimum Display:** 1.5s
- **Exit Transition:** 0.8s total (0.6s logo + 0.3s overlap with hero)

## Animations

All animations defined in `app/globals.css`:
- `logo-entrance` - initial scale and fade in
- `logo-breathe` - subtle pulsing effect
- `logo-exit` - scale up and fade out
- `hero-morph-entrance` - coordinated hero heading entrance
- `loader-fade-out` - full screen fade

## Performance

- Uses CSS transforms (GPU-accelerated)
- `will-change: transform, opacity` hints
- Logo preloaded with `priority` flag
- 18 particles chosen for 60fps performance

## Accessibility

- Respects `prefers-reduced-motion` preference
- Does not trap keyboard focus
- Logo has alt text
- Minimum display prevents jarring flash

## Browser Support

Tested in:
- Chrome 120+
- Safari 17+
- Firefox 120+
- Edge 120+

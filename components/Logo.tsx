/**
 * The mark and the wordmark, inline.
 *
 * These are React components rather than <Image src="/logo.svg"> on purpose.
 * An <img> is its own document: it inherits neither the page's `color` nor its
 * fonts, so `currentColor` inside the file resolves to black and the logo
 * disappears on a dark ground. Inlined, `currentColor` works, and the mark
 * takes whatever colour the surrounding text has — one asset for the dark
 * chrome, a light print sheet, and a hover state.
 *
 * The mark is an "A" reduced to its apex with the crossbar replaced by the
 * bead: the button of pure metal an assay leaves behind once the fire has taken
 * everything that was not real.
 */

type MarkProps = { className?: string; title?: string };

export function AssayMark({ className = 'w-5 h-5', title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M7 25 16 7l9 18"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="20.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Mark plus name. The name is real text, not paths — it stays selectable,
 * searchable and readable to a screen reader, and it picks up Geist from the
 * page the way the drawn-path version never could.
 */
export function AssayWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AssayMark className="w-[1.15em] h-[1.15em] shrink-0" />
      <span className="font-semibold tracking-[-0.03em]">Assay</span>
    </span>
  );
}

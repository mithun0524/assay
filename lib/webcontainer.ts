import { WebContainer } from '@webcontainer/api';

let instance: WebContainer | null = null;
let bootingPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (bootingPromise) return bootingPromise;

  bootingPromise = WebContainer.boot({
    workdirName: 'project',
    forwardPreviewErrors: true,
  })
    .then((wc) => {
      instance = wc;
      bootingPromise = null;
      attachPreviewErrorForwarding(wc);
      return wc;
    })
    .catch((err) => {
      // Reset so a transient boot failure (COOP/COEP hiccup, tab throttling)
      // doesn't wedge every later call on the same rejected promise.
      bootingPromise = null;
      throw err;
    });

  return bootingPromise;
}

/**
 * `forwardPreviewErrors` makes the container relay uncaught exceptions and
 * unhandled rejections from the preview iframe. Piping them into the store is
 * what lets the QA gate see runtime failures the terminal never prints.
 */
function attachPreviewErrorForwarding(wc: WebContainer) {
  wc.on('preview-message', (message: unknown) => {
    const m = message as {
      type?: string;
      message?: string;
      stack?: string;
      args?: unknown[];
    };
    if (!m || typeof m !== 'object') return;

    const isError =
      m.type === 'PREVIEW_UNCAUGHT_EXCEPTION' ||
      m.type === 'PREVIEW_UNHANDLED_REJECTION' ||
      m.type === 'PREVIEW_CONSOLE_ERROR';
    if (!isError) return;

    const text =
      m.message ||
      (Array.isArray(m.args) ? m.args.map(String).join(' ') : '') ||
      m.stack ||
      'Unknown preview error';

    // Imported lazily to keep this module usable outside React.
    import('./store').then(({ useStore }) => {
      useStore.getState().addPreviewError(text.slice(0, 2000));
    });
  });
}

export function getWebContainerSync(): WebContainer | null {
  return instance;
}

import { WebContainer } from '@webcontainer/api';

let instance: WebContainer | null = null;
let bootingPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (bootingPromise) return bootingPromise;

  bootingPromise = WebContainer.boot({
    workdirName: 'project',
    forwardPreviewErrors: true,
  }).then((wc) => {
    instance = wc;
    bootingPromise = null;
    return wc;
  });

  return bootingPromise;
}

export function getWebContainerSync(): WebContainer | null {
  return instance;
}
import JSZip from 'jszip';
import type { FileEntry } from './store';

export async function downloadProject(files: Record<string, FileEntry>) {
    const zip = new JSZip();

    Object.entries(files).forEach(([path, entry]) => {
        zip.file(path, entry.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

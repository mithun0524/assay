/**
 * Action history for undo/redo functionality
 * Maintains snapshots of file state for time-travel
 */

import { FileEntry } from './store';

interface Snapshot {
  files: Record<string, FileEntry>;
  timestamp: number;
}

export class ActionHistory {
  private snapshots: Snapshot[] = [];
  private currentIndex = -1;
  private readonly maxSnapshots = 50; // Keep last 50 snapshots

  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  get canRedo(): boolean {
    return this.currentIndex < this.snapshots.length - 1;
  }

  /**
   * Take a snapshot of current file state
   */
  take(files: Record<string, FileEntry>): void {
    // Remove any snapshots after current index (if we're in the middle of history)
    if (this.currentIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    }

    // Add new snapshot
    this.snapshots.push({
      files: JSON.parse(JSON.stringify(files)), // Deep clone
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    } else {
      this.currentIndex++;
    }

    // Ensure currentIndex is at the last snapshot
    this.currentIndex = this.snapshots.length - 1;
  }

  /**
   * Undo to previous snapshot
   */
  undo(): Snapshot | null {
    if (!this.canUndo) return null;
    this.currentIndex--;
    return this.snapshots[this.currentIndex];
  }

  /**
   * Redo to next snapshot
   */
  redo(): Snapshot | null {
    if (!this.canRedo) return null;
    this.currentIndex++;
    return this.snapshots[this.currentIndex];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.snapshots = [];
    this.currentIndex = -1;
  }
}

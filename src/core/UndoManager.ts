import type { UIFileDefinition } from '../types/JsonUITypes';
import { ProjectManager } from './ProjectManager';
import { EventBus } from './EventBus';

interface UndoSnapshot {
  files: Map<string, string>; // filePath -> JSON string
  globalVariables: string;
}

/** Manages undo/redo history via project snapshots */
export class UndoManager {
  private readonly undoStack: UndoSnapshot[] = [];
  private readonly redoStack: UndoSnapshot[] = [];
  private readonly maxHistory = 50;
  private isApplying = false;

  constructor(
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    // Take snapshot on every mutation event
    const trackEvents = [
      'control:updated', 'control:created', 'control:deleted',
      'file:created', 'file:deleted', 'file:renamed',
    ] as const;
    for (const evt of trackEvents) {
      this.events.on(evt, () => {
        if (!this.isApplying) this.saveSnapshot();
      });
    }
    // Save initial state
    this.saveSnapshot();
  }

  private takeSnapshot(): UndoSnapshot {
    const files = new Map<string, string>();
    for (const fp of this.projectManager.getFilePaths()) {
      const file = this.projectManager.getFile(fp);
      if (file) files.set(fp, JSON.stringify(file));
    }
    return {
      files,
      globalVariables: JSON.stringify(this.projectManager.getGlobalVariables()),
    };
  }

  private saveSnapshot(): void {
    this.undoStack.push(this.takeSnapshot());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack.length = 0;
  }

  private applySnapshot(snapshot: UndoSnapshot): void {
    this.isApplying = true;
    try {
      // Remove files not in snapshot
      const currentFiles = this.projectManager.getFilePaths();
      for (const fp of currentFiles) {
        if (!snapshot.files.has(fp)) {
          this.projectManager.removeFile(fp);
        }
      }
      // Add/update files from snapshot  
      for (const [fp, json] of snapshot.files) {
        const parsed = JSON.parse(json) as UIFileDefinition;
        const existing = this.projectManager.getFile(fp);
        if (existing) {
          // Update all controls
          const controlNames = this.projectManager.getControlNames(fp);
          for (const name of controlNames) {
            this.projectManager.deleteControl(fp, name);
          }
          // Set namespace
          const fileObj = this.projectManager.getFile(fp) as Record<string, unknown>;
          if (fileObj) fileObj['namespace'] = parsed['namespace'];
          // Add controls from snapshot
          for (const [key, value] of Object.entries(parsed)) {
            if (key === 'namespace') continue;
            this.projectManager.addControl(fp, key, value as Record<string, unknown>);
          }
        } else {
          this.projectManager.addFile(fp, parsed);
        }
      }
      // Restore global variables
      this.projectManager.setGlobalVariables(JSON.parse(snapshot.globalVariables));
    } finally {
      this.isApplying = false;
    }
    this.events.emit('tree:refresh');
    this.events.emit('inspector:refresh');
  }

  undo(): boolean {
    if (this.undoStack.length <= 1) return false; // Need at least initial + one change
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    const previous = this.undoStack[this.undoStack.length - 1];
    this.applySnapshot(previous);
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.applySnapshot(next);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

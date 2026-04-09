import type {
  UIFileDefinition,
  UIControlProperties,
  UIControlChild,
  GlobalVariables,
  UIDefsFile,
  TextureAsset,
  JsonUIProject,
} from '../types/JsonUITypes';
import { EventBus } from './EventBus';
import { parseJsonc } from './JsoncParser';

/** Error thrown when project operations fail */
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_JSON' | 'MISSING_NAMESPACE' | 'DUPLICATE_FILE' | 'FILE_NOT_FOUND' | 'INVALID_STRUCTURE',
    public readonly details?: string
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

/** Manages the JSON UI project state: files, textures, and operations */
export class ProjectManager {
  private project: JsonUIProject;
  private readonly events: EventBus;
  private dirty = false;

  constructor(events: EventBus) {
    this.events = events;
    this.project = this.createEmptyProject('Untitled');
  }

  /** Create an empty project */
  private createEmptyProject(name: string): JsonUIProject {
    return {
      name,
      files: new Map(),
      globalVariables: {},
      uiDefs: { ui_defs: [] },
      textures: new Map(),
    };
  }

  /** Get the current project */
  getProject(): Readonly<JsonUIProject> {
    return this.project;
  }

  /** Check if project has unsaved changes */
  isDirty(): boolean {
    return this.dirty;
  }

  /** Mark as clean (after export) */
  markClean(): void {
    this.dirty = false;
  }

  /** Create a new blank project */
  newProject(name: string): void {
    this.project = this.createEmptyProject(name);
    this.dirty = false;
    this.events.emit('project:loaded', { projectName: name });
    this.events.emit('tree:refresh');
  }

  /** Parse a raw JSON string into a UIFileDefinition, validating structure */
  parseUIFile(jsonString: string, filePath: string): UIFileDefinition {
    let parsed: unknown;
    try {
      parsed = parseJsonc(jsonString);
    } catch {
      throw new ProjectError(
        `Invalid JSON in file "${filePath}"`,
        'INVALID_JSON',
        'Check for syntax errors: missing commas, unclosed brackets, or trailing commas.'
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ProjectError(
        `File "${filePath}" must be a JSON object`,
        'INVALID_STRUCTURE',
        'The root of a JSON UI file must be a {} object with a "namespace" key.'
      );
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj['namespace'] !== 'string' || obj['namespace'].trim() === '') {
      throw new ProjectError(
        `File "${filePath}" is missing a "namespace" property`,
        'MISSING_NAMESPACE',
        'Every JSON UI file must have a "namespace": "your_namespace" at the root.'
      );
    }

    return obj as unknown as UIFileDefinition;
  }

  /** Add a UI file to the project */
  addFile(filePath: string, content: UIFileDefinition): void {
    this.project.files.set(filePath, content);
    this.addToUIDefs(filePath);
    this.dirty = true;
    this.events.emit('file:created', { filePath });
    this.events.emit('tree:refresh');
  }

  /** Remove a file from the project */
  removeFile(filePath: string): void {
    if (!this.project.files.has(filePath)) {
      throw new ProjectError(`File "${filePath}" not found`, 'FILE_NOT_FOUND');
    }
    this.project.files.delete(filePath);
    this.removeFromUIDefs(filePath);
    this.dirty = true;
    this.events.emit('file:deleted', { filePath });
    this.events.emit('tree:refresh');
  }

  /** Get a file definition */
  getFile(filePath: string): UIFileDefinition | undefined {
    return this.project.files.get(filePath);
  }

  /** Get all file paths */
  getFilePaths(): string[] {
    return Array.from(this.project.files.keys());
  }

  /** Rename a file */
  renameFile(oldPath: string, newPath: string): void {
    const file = this.project.files.get(oldPath);
    if (!file) {
      throw new ProjectError(`File "${oldPath}" not found`, 'FILE_NOT_FOUND');
    }
    this.project.files.delete(oldPath);
    this.project.files.set(newPath, file);
    this.removeFromUIDefs(oldPath);
    this.addToUIDefs(newPath);
    this.dirty = true;
    this.events.emit('file:renamed', { oldPath, newPath });
    this.events.emit('tree:refresh');
  }

  /** Add a control to a file */
  addControl(filePath: string, controlName: string, control: UIControlProperties): void {
    const file = this.project.files.get(filePath);
    if (!file) {
      throw new ProjectError(`File "${filePath}" not found`, 'FILE_NOT_FOUND');
    }
    (file as Record<string, unknown>)[controlName] = control;
    this.dirty = true;
    this.events.emit('control:created', { filePath, controlName });
    this.events.emit('tree:refresh');
  }

  /** Update a control in a file */
  updateControl(filePath: string, controlName: string, control: UIControlProperties): void {
    const file = this.project.files.get(filePath);
    if (!file) {
      throw new ProjectError(`File "${filePath}" not found`, 'FILE_NOT_FOUND');
    }
    (file as Record<string, unknown>)[controlName] = control;
    this.dirty = true;
    this.events.emit('control:updated', { filePath, controlName });
  }

  /** Delete a control from a file */
  deleteControl(filePath: string, controlName: string): void {
    const file = this.project.files.get(filePath);
    if (!file) {
      throw new ProjectError(`File "${filePath}" not found`, 'FILE_NOT_FOUND');
    }
    delete (file as Record<string, unknown>)[controlName];
    this.dirty = true;
    this.events.emit('control:deleted', { filePath, controlName });
    this.events.emit('tree:refresh');
  }

  /** Get control names from a file (excluding 'namespace') */
  getControlNames(filePath: string): string[] {
    const file = this.project.files.get(filePath);
    if (!file) return [];
    return Object.keys(file).filter(k => k !== 'namespace');
  }

  /** Get a specific control */
  getControl(filePath: string, controlName: string): UIControlProperties | undefined {
    const file = this.project.files.get(filePath);
    if (!file) return undefined;
    const val = (file as Record<string, unknown>)[controlName];
    if (typeof val === 'object' && val !== null) return val as UIControlProperties;
    return undefined;
  }

  /** Set global variables */
  setGlobalVariables(vars: GlobalVariables): void {
    this.project.globalVariables = vars;
    this.dirty = true;
  }

  /** Get global variables */
  getGlobalVariables(): GlobalVariables {
    return this.project.globalVariables;
  }

  /** Get UI defs */
  getUIDefs(): UIDefsFile {
    return this.project.uiDefs;
  }

  /** Add a texture asset */
  addTexture(texture: TextureAsset): void {
    this.project.textures.set(texture.id, texture);
    this.dirty = true;
    this.events.emit('texture:added', { textureId: texture.id });
  }

  /** Remove a texture */
  removeTexture(id: string): void {
    this.project.textures.delete(id);
    this.dirty = true;
    this.events.emit('texture:removed', { textureId: id });
  }

  /** Get all textures */
  getTextures(): Map<string, TextureAsset> {
    return this.project.textures;
  }

  /** Get a specific texture */
  getTexture(id: string): TextureAsset | undefined {
    return this.project.textures.get(id);
  }

  /** Update texture nineslice */
  updateTextureNineslice(id: string, nineslice: TextureAsset['nineslice']): void {
    const tex = this.project.textures.get(id);
    if (tex) {
      tex.nineslice = nineslice;
      this.dirty = true;
      this.events.emit('texture:updated', { textureId: id });
    }
  }

  /** Serialize a file definition back to JSON (handles comments removal) */
  serializeFile(fileDef: UIFileDefinition): string {
    return JSON.stringify(fileDef, null, '\t');
  }

  /** Get children of a control */
  getControlChildren(control: UIControlProperties): UIControlChild[] {
    return control.controls ?? [];
  }

  /** Add a child to a control */
  addChildToControl(filePath: string, controlName: string, childName: string, childProps: UIControlProperties): void {
    const control = this.getControl(filePath, controlName);
    if (!control) return;
    if (!control.controls) control.controls = [];
    control.controls.push({ [childName]: childProps });
    this.dirty = true;
    this.events.emit('control:updated', { filePath, controlName });
    this.events.emit('tree:refresh');
  }

  private addToUIDefs(filePath: string): void {
    if (!this.project.uiDefs.ui_defs.includes(filePath)) {
      this.project.uiDefs.ui_defs.push(filePath);
    }
  }

  private removeFromUIDefs(filePath: string): void {
    const idx = this.project.uiDefs.ui_defs.indexOf(filePath);
    if (idx !== -1) {
      this.project.uiDefs.ui_defs.splice(idx, 1);
    }
  }
}

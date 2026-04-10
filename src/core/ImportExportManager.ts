import type { GlobalVariables, PreviewBaseMount, TextureAsset, UIFileDefinition } from '../types/JsonUITypes';
import { ProjectManager, ProjectError } from './ProjectManager';
import { EventBus } from './EventBus';
import { parseJsonc } from './JsoncParser';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/** Handles importing files/folders and exporting projects */
export class ImportExportManager {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {}

  /** Import a single JSON file */
  async importFile(file: File): Promise<void> {
    const text = await file.text();
    const filePath = file.webkitRelativePath || file.name;
    this.processJsonFile(filePath, text);
  }

  /** Import a whole folder (from input[webkitdirectory]) */
  async importFolder(files: FileList): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    const fileArray = Array.from(files);
    const projectName = this.extractProjectName(fileArray);
    this.projectManager.newProject(projectName);
    // import all texture images first
    for (const file of fileArray) {
      if (!this.isTextureFile(file.name)) continue;
      const relativePath = file.webkitRelativePath || file.name;
      try {
        await this.importTexture(file, relativePath);
        imported++;
      } catch (err) {
        errors.push(`Texture "${relativePath}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // process JSON files
    // Companion texture JSONs (nineslice / flipbook) are parsed and applied
    // to the matching texture. Regular UI JSONs go through the normal flow.
    for (const file of fileArray) {
      if (!file.name.endsWith('.json')) continue;
      const relativePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
      try {
        const text = await file.text();
        // Is this file inside a "textures/" subtree?
        if (this.isInTexturesFolder(relativePath)) {
          if (this.tryApplyTextureConfig(text, relativePath)) {
            imported++;
            continue;
          }
          // Not a recognised texture config then don't treat as UI file
          continue;
        }
        this.processJsonFile(relativePath, text);
        imported++;
      } catch (err) {
        if (err instanceof ProjectError) {
          errors.push(`${relativePath}: ${err.message}${err.details ? ` — ${err.details}` : ''}`);
        } else {
          errors.push(`${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    this.events.emit('project:loaded', { projectName });
    this.events.emit('tree:refresh');
    return { imported, errors };
  }

  async importPreviewBase(files: FileList): Promise<{ files: number; textures: number; errors: string[]; name: string }> {
    const errors: string[] = [];
    let importedFiles = 0;
    let importedTextures = 0;
    const fileArray = Array.from(files);
    const previewBase: PreviewBaseMount = {
      name: this.extractPreviewBaseName(fileArray),
      files: new Map(),
      globalVariables: {},
      textures: new Map(),
    };

    for (const file of fileArray) {
      const normalizedPath = this.normalizePreviewBasePath(file.webkitRelativePath || file.name);
      if (!normalizedPath || !this.isTextureFile(file.name) || !normalizedPath.startsWith('textures/')) {
        continue;
      }
      try {
        await this.importTextureIntoMap(file, normalizedPath, previewBase.textures);
        importedTextures++;
      } catch (err) {
        errors.push(`Texture "${normalizedPath}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const file of fileArray) {
      if (!file.name.endsWith('.json')) {
        continue;
      }
      const normalizedPath = this.normalizePreviewBasePath(file.webkitRelativePath || file.name);
      if (!normalizedPath) {
        continue;
      }
      try {
        const text = await file.text();
        if (normalizedPath.startsWith('textures/')) {
          if (this.tryApplyTextureConfigToMap(text, normalizedPath, previewBase.textures)) {
            continue;
          }
          continue;
        }
        if (!normalizedPath.startsWith('ui/')) {
          continue;
        }
        this.processPreviewBaseJson(normalizedPath, text, previewBase);
        if (normalizedPath.endsWith('.json') && !normalizedPath.endsWith('_ui_defs.json') && !normalizedPath.endsWith('_global_variables.json')) {
          importedFiles++;
        }
      } catch (err) {
        if (err instanceof ProjectError) {
          errors.push(`${normalizedPath}: ${err.message}${err.details ? ` — ${err.details}` : ''}`);
        } else {
          errors.push(`${normalizedPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    this.projectManager.setPreviewBase(previewBase);
    return { files: importedFiles, textures: importedTextures, errors, name: previewBase.name };
  }

  /** Export the project as a ZIP file */
  async exportProject(): Promise<void> {
    const project = this.projectManager.getProject();
    const zip = new JSZip();
    // Add UI files
    for (const [path, fileDef] of project.files) {
      const json = this.projectManager.serializeFile(fileDef);
      zip.file(path, json);
    }
    // Add _ui_defs.json
    zip.file('_ui_defs.json', JSON.stringify(project.uiDefs, null, '\t'));
    // Add _global_variables.json if non-empty
    if (Object.keys(project.globalVariables).length > 0) 
      zip.file('_global_variables.json', JSON.stringify(project.globalVariables, null, '\t'));
    // Add textures
    for (const [, texture] of project.textures) {
      const base64Data = texture.data.split(',')[1];
      if (base64Data) 
        zip.file(texture.path, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${project.name}.zip`);
    this.projectManager.markClean();
    this.events.emit('project:exported');
    this.events.emit('status:message', { text: `Project "${project.name}" exported successfully`, type: 'info' });
  }

  /** Export a single file as JSON download */
  exportFile(filePath: string): void {
    const fileDef = this.projectManager.getFile(filePath);
    if (!fileDef) return;
    const json = this.projectManager.serializeFile(fileDef);
    const blob = new Blob([json], { type: 'application/json' });
    const name = filePath.split('/').pop() ?? 'file.json';
    saveAs(blob, name);
  }

  private processJsonFile(filePath: string, jsonText: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = normalizedPath.split('/').pop() ?? '';
    // Handle special files
    if (fileName === '_global_variables.json') {
      try {
        const parsed = parseJsonc(jsonText) as GlobalVariables;
        this.projectManager.setGlobalVariables(parsed);
      } catch {
        throw new ProjectError('Invalid _global_variables.json', 'INVALID_JSON');
      }
      return;
    }
    if (fileName === '_ui_defs.json') {
      // We rebuild ui_defs from loaded files, so skip importing it
      return;
    }
    // Parse and add regular UI file
    const fileDef = this.projectManager.parseUIFile(jsonText, normalizedPath);
    this.projectManager.addFile(normalizedPath, fileDef);
  }

  private async importTexture(file: File, relativePath: string): Promise<void> {
    const dataUrl = await this.readFileAsDataUrl(file);
    const dimensions = await this.getImageDimensions(dataUrl);
    const id = crypto.randomUUID();
    const texture: TextureAsset = {
      id,
      name: file.name,
      path: relativePath.replace(/\\/g, '/'),
      data: dataUrl,
      width: dimensions.width,
      height: dimensions.height,
    };
    this.projectManager.addTexture(texture);
  }

  private async importTextureIntoMap(file: File, relativePath: string, target: Map<string, TextureAsset>): Promise<void> {
    const dataUrl = await this.readFileAsDataUrl(file);
    const dimensions = await this.getImageDimensions(dataUrl);
    target.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      name: file.name,
      path: relativePath.replace(/\\/g, '/'),
      data: dataUrl,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  private getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  private isTextureFile(name: string): boolean {
    const ext = name.toLowerCase().split('.').pop();
    return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'tga';
  }

  /** Returns true if the path is inside a textures/ subdirectory */
  private isInTexturesFolder(relPath: string): boolean {
    return /(?:^|\/)textures\//i.test(relPath);
  }

  /**
   * Try to parse a JSON file as a texture companion config (nineslice / flipbook).
   * If successful, finds the matching texture by path and applies the config.
   * Returns true if the file was handled as a texture config.
   */
  private tryApplyTextureConfig(jsonText: string, relPath: string): boolean {
    let data: Record<string, unknown>;
    try {
      const parsed = parseJsonc(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      data = parsed as Record<string, unknown>;
    } catch {
      return false;
    }
    // must be a texture companion file (no namespace, has texture specific fields)
    if ('namespace' in data) return false;
    const isNineslice = 'nineslice_size' in data;
    const isFlipbook  = 'flipbook_frames' in data;
    if (!isNineslice && !isFlipbook && !('base_size' in data)) return false;
    if (isNineslice) {
      const ns = data['nineslice_size'];
      let nineslice: { top: number; right: number; bottom: number; left: number };
      if (Array.isArray(ns) && ns.length >= 4) {
        nineslice = {
          top:    Number(ns[0]),
          right:  Number(ns[1]),
          bottom: Number(ns[2]),
          left:   Number(ns[3]),
        };
      } else if (typeof ns === 'number' || (Array.isArray(ns) && ns.length === 1)) {
        const v = Array.isArray(ns) ? Number(ns[0]) : ns;
        nineslice = { top: v, right: v, bottom: v, left: v };
      } else return false;
      // find the matching texture: same path but with an image extension instead of .json
      const basePath = relPath.replace(/\.json$/i, '').toLowerCase();
      for (const [id, tex] of this.projectManager.getTextures()) {
        const texBase = tex.path
          .replace(/\\/g, '/')
          .replace(/\.(png|jpg|jpeg|tga|webp|gif)$/i, '')
          .toLowerCase();
        if (texBase === basePath || texBase.endsWith('/' + basePath.split('/').pop())) {
          this.projectManager.updateTextureNineslice(id, nineslice);
          return true;
        }
      }
    }
    // flipbook / other texture configs are noted but we don't crash on them
    return isFlipbook || isNineslice;
  }

  private tryApplyTextureConfigToMap(jsonText: string, relPath: string, textures: Map<string, TextureAsset>): boolean {
    let data: Record<string, unknown>;
    try {
      const parsed = parseJsonc(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
      data = parsed as Record<string, unknown>;
    } catch {
      return false;
    }
    if ('namespace' in data) return false;
    const isNineslice = 'nineslice_size' in data;
    const isFlipbook = 'flipbook_frames' in data;
    if (!isNineslice && !isFlipbook && !('base_size' in data)) return false;
    if (isNineslice) {
      const parsed = this.parseNineslice(data['nineslice_size']);
      if (!parsed) return false;
      const basePath = relPath.replace(/\.json$/i, '').toLowerCase();
      for (const texture of textures.values()) {
        const textureBase = texture.path
          .replace(/\\/g, '/')
          .replace(/\.(png|jpg|jpeg|tga|webp|gif)$/i, '')
          .toLowerCase();
        if (textureBase === basePath || textureBase.endsWith('/' + basePath.split('/').pop())) {
          texture.nineslice = parsed;
          return true;
        }
      }
    }
    return isFlipbook || isNineslice;
  }

  private parseNineslice(value: unknown): TextureAsset['nineslice'] | null {
    if (Array.isArray(value) && value.length >= 4) {
      return {
        top: Number(value[0]),
        right: Number(value[1]),
        bottom: Number(value[2]),
        left: Number(value[3]),
      };
    }
    if (typeof value === 'number') {
      return { top: value, right: value, bottom: value, left: value };
    }
    if (Array.isArray(value) && value.length === 1) {
      const entry = Number(value[0]);
      return { top: entry, right: entry, bottom: entry, left: entry };
    }
    return null;
  }

  private processPreviewBaseJson(filePath: string, jsonText: string, previewBase: PreviewBaseMount): void {
    const fileName = filePath.split('/').pop() ?? '';
    if (fileName === '_global_variables.json') {
      try {
        previewBase.globalVariables = parseJsonc(jsonText) as GlobalVariables;
      } catch {
        throw new ProjectError('Invalid _global_variables.json', 'INVALID_JSON');
      }
      return;
    }
    if (fileName === '_ui_defs.json') {
      return;
    }
    const fileDef = this.projectManager.parseUIFile(jsonText, filePath) as UIFileDefinition;
    previewBase.files.set(filePath, fileDef);
  }

  private normalizePreviewBasePath(inputPath: string): string | null {
    const normalized = inputPath.replace(/\\/g, '/');
    const resourcePackMatch = normalized.match(/(?:^|\/)resource_pack\/(.*)$/i);
    const candidate = resourcePackMatch?.[1]
      ?? normalized.match(/(?:^|\/)(ui\/.*)$/i)?.[1]
      ?? normalized.match(/(?:^|\/)(textures\/.*)$/i)?.[1]
      ?? null;
    return candidate?.replace(/^\/+/, '') ?? null;
  }

  private extractPreviewBaseName(files: File[]): string {
    const firstPath = files[0]?.webkitRelativePath?.replace(/\\/g, '/');
    if (!firstPath) {
      return 'Vanilla Base';
    }
    const resourcePackMatch = firstPath.match(/^(.*?)\/resource_pack\//i);
    if (resourcePackMatch?.[1]) {
      return resourcePackMatch[1].split('/').pop() ?? 'Vanilla Base';
    }
    return firstPath.split('/')[0] ?? 'Vanilla Base';
  }

  private extractProjectName(files: File[]): string {
    if (files.length === 0) return 'Untitled';
    const firstPath = files[0].webkitRelativePath;
    if (firstPath) {
      const parts = firstPath.split('/');
      if (parts.length > 1) return parts[0];
    }
    return 'Imported Project';
  }
}
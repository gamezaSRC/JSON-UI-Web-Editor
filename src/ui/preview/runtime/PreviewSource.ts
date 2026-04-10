import type { PreviewBaseMount, TextureAsset, UIControlProperties, UIFileDefinition } from '../../../types/JsonUITypes';
import type { PreviewMockData } from './PreviewMockData';
import { preparePreviewDefinitions } from './PreviewDocument';
import { getAutoPreviewMockData } from './PreviewMockData';

export type PreviewMockMode = 'live' | 'auto' | 'custom';

export interface PreviewSourceOptions {
  currentFilePath: string;
  customMockData: PreviewMockData;
  mockMode: PreviewMockMode;
  previewBase: Readonly<PreviewBaseMount> | null;
  projectFiles: ReadonlyMap<string, UIFileDefinition>;
  projectGlobals: Record<string, unknown>;
  projectTextures: ReadonlyMap<string, TextureAsset>;
}

export interface PreparedPreviewSource {
  allDefs: Map<string, UIControlProperties>;
  fileDefs: Map<string, UIControlProperties>;
  globalVars: Record<string, unknown>;
  mockData: PreviewMockData | null;
  namespace: string;
  textures: Map<string, TextureAsset>;
}

export function buildPreviewSource(options: PreviewSourceOptions): PreparedPreviewSource {
  const files = combineFiles(options.projectFiles, options.previewBase);
  const currentFile = files.get(options.currentFilePath);
  const namespace = currentFile?.namespace ?? '';
  const allDefs = new Map<string, UIControlProperties>();
  let fileDefs = new Map<string, UIControlProperties>();
  for (const [filePath, fileDef] of files) {
    const defs = preparePreviewDefinitions(extractControlMap(fileDef));
    if (filePath === options.currentFilePath) 
      fileDefs = defs;
    for (const [name, control] of defs) 
      allDefs.set(`${fileDef.namespace}.${name}`, control);
  }
  return {
    allDefs,
    fileDefs,
    globalVars: { ...(options.previewBase?.globalVariables ?? {}), ...options.projectGlobals },
    mockData: resolveMockData(options.currentFilePath, namespace, fileDefs, options.mockMode, options.customMockData),
    namespace,
    textures: mergeTextures(options.projectTextures, options.previewBase?.textures ?? null),
  };
}

function combineFiles(
  projectFiles: ReadonlyMap<string, UIFileDefinition>,
  previewBase: Readonly<PreviewBaseMount> | null
): Map<string, UIFileDefinition> {
  const combined = new Map<string, UIFileDefinition>();
  for (const [filePath, fileDef] of previewBase?.files ?? []) 
    combined.set(filePath, clone(fileDef));
  for (const [filePath, fileDef] of projectFiles) {
    const base = combined.get(filePath);
    combined.set(filePath, base ? mergeFile(base, fileDef) : clone(fileDef));
  }
  return combined;
}

function mergeFile(base: UIFileDefinition, override: UIFileDefinition): UIFileDefinition {
  const merged = clone(base);
  merged.namespace = override.namespace || base.namespace;
  for (const [key, value] of Object.entries(override)) {
    if (key === 'namespace') continue;
    const baseValue = merged[key];
    if (isControl(baseValue) && isControl(value)) {
      merged[key] = mergeControl(baseValue, value);
    } else merged[key] = clone(value);
  }
  return merged;
}

function mergeControl(base: UIControlProperties, override: UIControlProperties): UIControlProperties {
  const merged: UIControlProperties = { ...clone(base) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (key === 'controls' && Array.isArray(value) && value.length > 0) {
      (merged as Record<string, unknown>)[key] = clone(value);
      continue;
    }
    if (key === 'modifications' && Array.isArray(value)) {
      const existing = Array.isArray((merged as Record<string, unknown>)[key]) ? (merged as Record<string, unknown>)[key] as unknown[] : [];
      (merged as Record<string, unknown>)[key] = [...clone(existing), ...clone(value)];
      continue;
    }
    (merged as Record<string, unknown>)[key] = clone(value);
  }
  return merged;
}

function extractControlMap(fileDef: UIFileDefinition): Map<string, UIControlProperties> {
  const controls = new Map<string, UIControlProperties>();
  for (const [name, value] of Object.entries(fileDef)) {
    if (name === 'namespace' || !isControl(value)) continue;
    controls.set(name, value);
  }
  return controls;
}

function resolveMockData(
  filePath: string,
  namespace: string,
  fileDefs: Map<string, UIControlProperties>,
  mockMode: PreviewMockMode,
  customMockData: PreviewMockData
): PreviewMockData | null {
  if (mockMode === 'live') return null;
  if (mockMode === 'custom') return customMockData;
  return getAutoPreviewMockData(filePath, namespace, fileDefs);
}

function mergeTextures(
  projectTextures: ReadonlyMap<string, TextureAsset>,
  previewTextures: ReadonlyMap<string, TextureAsset> | null
): Map<string, TextureAsset> {
  const merged = new Map<string, TextureAsset>();
  const seen = new Set<string>();
  for (const [id, texture] of projectTextures) {
    merged.set(id, texture);
    seen.add(normalizePath(texture.path));
  }
  for (const [id, texture] of previewTextures ?? []) {
    if (seen.has(normalizePath(texture.path))) continue;
    merged.set(`preview:${id}`, texture);
  }
  return merged;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\.(png|jpg|jpeg|tga|webp|gif)$/i, '').toLowerCase();
}

function isControl(value: unknown): value is UIControlProperties {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
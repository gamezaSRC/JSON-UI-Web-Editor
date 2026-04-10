import type { ModificationEntry, UIControlProperties, UIControlChild } from '../../../types/JsonUITypes';

type ControlMap = Map<string, UIControlProperties>;

export function preparePreviewDefinitions(defs: ControlMap): ControlMap {
  const prepared = new Map<string, UIControlProperties>();
  for (const [name, control] of defs) 
    prepared.set(name, cloneValue(control));
  for (const [, control] of prepared) 
    prepareControl(control);
  return prepared;
}

export function getPreviewRootNames(defs: ControlMap, namespace: string): string[] {
  const referenced = new Set<string>();
  const templated = new Set<string>();
  for (const [, control] of defs) 
    collectRefs(control, namespace, referenced, templated);
  const roots: string[] = [];
  for (const name of defs.keys()) {
    if (!referenced.has(name) && !templated.has(name))
      roots.push(name);
  }
  return roots.length > 0 ? roots : [...defs.keys()].filter(name => !templated.has(name));
}

function prepareControl(control: UIControlProperties): void {
  applyModifications(control);
  if (!control.controls) return;
  for (const child of control.controls) {
    for (const [, childControl] of Object.entries(child)) 
      prepareControl(childControl);
  }
}

function applyModifications(control: UIControlProperties): void {
  if (!control.modifications?.length) 
    return;
  for (const modification of control.modifications) 
    applyModification(control, modification);
}

function applyModification(control: UIControlProperties, modification: ModificationEntry): void {
  if (!modification.array_name || !modification.operation) return;
  const current = getControlArray(control, modification.array_name);
  const values = getModificationValues(modification.value);
  const targetIndex = findTargetIndex(current, modification.target_control ?? modification.control_name);
  switch (modification.operation) {
    case 'insert_back':
      current.push(...values);
      break;
    case 'insert_front':
      current.unshift(...values);
      break;
    case 'insert_after':
      insertAt(current, targetIndex === -1 ? current.length : targetIndex + 1, values);
      break;
    case 'insert_before':
      insertAt(current, targetIndex === -1 ? 0 : targetIndex, values);
      break;
    case 'replace':
      if (targetIndex !== -1) {
        current.splice(targetIndex, 1, ...values);
      } else current.splice(0, current.length, ...values);
      break;
    case 'remove':
      if (targetIndex !== -1) 
        current.splice(targetIndex, 1);
      break;
    default:
      break;
  }
  if (current.length > 0) {
    setControlArray(control, modification.array_name, current);
  } else delete (control as Record<string, unknown>)[modification.array_name];
}

function getControlArray(control: UIControlProperties, arrayName: ModificationEntry['array_name']): unknown[] {
  const value = arrayName ? (control as Record<string, unknown>)[arrayName] : undefined;
  return Array.isArray(value) ? [...value] : [];
}

function setControlArray(control: UIControlProperties, arrayName: ModificationEntry['array_name'], value: unknown[]): void {
  if (!arrayName) 
    return;
  (control as Record<string, unknown>)[arrayName] = value;
}

function getModificationValues(value: ModificationEntry['value']): unknown[] {
  if (Array.isArray(value)) 
    return value.map(entry => cloneValue(entry));
  if (value && typeof value === 'object') 
    return [cloneValue(value)];
  return [];
}

function findTargetIndex(items: unknown[], targetName?: string): number {
  if (!targetName) 
    return -1;
  return items.findIndex(item => getControlEntryName(item) === targetName);
}

function getControlEntryName(item: unknown): string | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) 
    return null;
  const key = Object.keys(item as UIControlChild)[0];
  if (!key) 
    return null;
  return key.split('@')[0] ?? key;
}

function insertAt(items: unknown[], index: number, values: unknown[]): void {
  items.splice(Math.max(0, Math.min(index, items.length)), 0, ...values);
}

function collectRefs(
  control: UIControlProperties,
  namespace: string,
  referenced: Set<string>,
  templated: Set<string>
): void {
  const templateRef = control.grid_item_template;
  if (typeof templateRef === 'string') {
    const localName = getLocalRefName(templateRef, namespace);
    if (localName) 
      templated.add(localName);
  }
  if (!control.controls) 
    return;
  for (const child of control.controls) {
    for (const [childName, childControl] of Object.entries(child)) {
      const localName = getLocalRefName(childName.includes('@') ? childName.slice(childName.indexOf('@') + 1) : '', namespace);
      if (localName) 
        referenced.add(localName);
      collectRefs(childControl, namespace, referenced, templated);
    }
  }
}

function getLocalRefName(ref: string, namespace: string): string | null {
  if (!ref) 
    return null;
  if (!ref.includes('.'))
    return ref;
  const [refNamespace, refName] = ref.split('.', 2);
  return refNamespace === namespace ? refName : null;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
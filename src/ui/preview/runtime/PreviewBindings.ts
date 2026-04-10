import type { BindingEntry, SizeValue, UIControlProperties } from '../../../types/JsonUITypes';
import type { PreviewMockCollectionItem, PreviewMockData } from './PreviewMockData';

export interface PreviewBindingContext {
  controlName: string;
  mockData: PreviewMockData | null;
  collectionItem?: PreviewMockCollectionItem;
  collectionIndex?: number;
  scopeStates: Map<string, Record<string, unknown>>;
}

export function bindPreviewControl(
  controlName: string,
  control: UIControlProperties,
  ctx: PreviewBindingContext
): { control: UIControlProperties; state: Record<string, unknown> } {
  const state = seedState(controlName, ctx);
  for (const binding of control.bindings ?? []) 
    applyBinding(binding, controlName, state, ctx);
  return {
    control: applyState(control, state),
    state,
  };
}

function seedState(controlName: string, ctx: PreviewBindingContext): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  assignStateValues(state, ctx.collectionItem);
  assignStateValues(state, ctx.mockData?.controls?.[controlName]);
  if (ctx.collectionIndex !== undefined) 
    state['#collection_index'] = ctx.collectionIndex;
  return state;
}

function applyBinding(
  binding: BindingEntry,
  controlName: string,
  state: Record<string, unknown>,
  ctx: PreviewBindingContext
): void {
  if (binding.binding_type === 'collection_details' && ctx.collectionIndex !== undefined)
    state['#collection_index'] = ctx.collectionIndex;
  const target = binding.target_property_name ?? binding.binding_name_override ?? binding.binding_name;
  if (binding.binding_name && (!binding.binding_type || binding.binding_type === 'global' || binding.binding_type === 'collection')) {
    const value = readLookup(binding.binding_name, state, ctx, controlName);
    const resolvedTarget = binding.binding_name_override ?? binding.binding_name;
    if (value !== undefined && resolvedTarget) 
      state[resolvedTarget] = value;
    return;
  }
  if (binding.binding_type !== 'view' || !target) 
    return;
  const sourceState = binding.source_control_name
    ? ctx.scopeStates.get(binding.source_control_name) ?? state
    : state;
  const value = evaluateExpression(binding.source_property_name, sourceState, state, ctx, controlName);
  if (value !== undefined) {
    state[target] = value;
    return;
  }

  const fallback = readLookup(target, state, ctx, controlName);
  if (fallback !== undefined) 
    state[target] = fallback;
}

function evaluateExpression(
  expression: string | undefined,
  sourceState: Record<string, unknown>,
  currentState: Record<string, unknown>,
  ctx: PreviewBindingContext,
  controlName: string
): unknown {
  if (!expression) 
    return undefined;
  const trimmed = expression.trim();
  if (!trimmed)
    return undefined;
  if (trimmed.startsWith('#')) 
    return readLookup(trimmed, currentState, { ...ctx, scopeStates: new Map(ctx.scopeStates).set(controlName, sourceState) }, controlName);
  if (trimmed.includes("'%."))
    return undefined;
  const js = toJsExpression(trimmed);
  try {
    return Function('get', `return (${js});`)(
      (token: string) => readLookup(token, sourceState, ctx, controlName) ?? readLookup(token, currentState, ctx, controlName)
    ) as unknown;
  } catch {
    return undefined;
  }
}

function toJsExpression(expression: string): string {
  let js = expression.replace(/\r/g, '').replace(/\n/g, '\\n');
  js = js.replace(/\bnot\b/g, '!');
  js = js.replace(/\band\b/g, '&&');
  js = js.replace(/\bor\b/g, '||');
  js = js.replace(/(^|[^<>=!])=([^=])/g, '$1==$2');
  js = js.replace(/#([A-Za-z0-9_]+)/g, (_, name: string) => `get("#${name}")`);
  return js;
}

function applyState(control: UIControlProperties, state: Record<string, unknown>): UIControlProperties {
  const next: UIControlProperties = { ...control };
  const visible = resolveTokenValue(next.visible, state);
  const alpha = resolveTokenValue(next.alpha, state);
  const texture = resolveTokenValue(next.texture, state) ?? readStateValue(state, '#texture');
  const text = resolveTokenValue(next.text, state) ?? readStateValue(state, '#text');
  const xSize = readNumericValue(state, '#size_binding_x_absolute');
  const ySize = readNumericValue(state, '#size_binding_y_absolute');
  if (typeof visible === 'boolean') 
    next.visible = visible;
  if (typeof alpha === 'number') 
    next.alpha = alpha;
  if (typeof texture === 'string' && texture)
    next.texture = texture;
  if (typeof text === 'string') 
    next.text = text;
  if (xSize !== undefined || ySize !== undefined) {
    const [currentX, currentY] = expandSize(next.size);
    next.size = [xSize ?? currentX, ySize ?? currentY];
  }
  return next;
}

function expandSize(size: SizeValue | undefined): [number | string, number | string] {
  if (Array.isArray(size)) 
    return [size[0], size[1]];
  if (typeof size === 'number' || typeof size === 'string') 
    return [size, size];
  return ['default', 'default'];
}

function resolveTokenValue(value: unknown, state: Record<string, unknown>): unknown {
  if (typeof value !== 'string' || !value.startsWith('#')) 
    return value;
  return readStateValue(state, value);
}

function readLookup(
  token: string,
  state: Record<string, unknown>,
  ctx: PreviewBindingContext,
  controlName: string
): unknown {
  const direct = readStateValue(state, token);
  if (direct !== undefined) 
    return direct;
  const scoped = ctx.scopeStates.get(controlName);
  const scopedValue = scoped ? readStateValue(scoped, token) : undefined;
  if (scopedValue !== undefined) 
    return scopedValue;
  const itemValue = readStateValue(ctx.collectionItem, token);
  if (itemValue !== undefined) 
    return itemValue;
  const controlValue = readStateValue(ctx.mockData?.controls?.[controlName], token);
  if (controlValue !== undefined) 
    return controlValue;
  return readStateValue(ctx.mockData?.globals, token);
}

function assignStateValues(target: Record<string, unknown>, source?: Record<string, unknown>): void {
  if (!source) 
    return;
  for (const [key, value] of Object.entries(source)) 
    target[key.startsWith('#') ? key : `#${key}`] = value;
}

function readStateValue(source: Record<string, unknown> | undefined, token: string): unknown {
  if (!source) 
    return undefined;
  if (token in source) 
    return source[token];
  const normalized = normalizeToken(token);
  return normalized in source ? source[normalized] : undefined;
}

function readNumericValue(source: Record<string, unknown>, token: string): number | undefined {
  const value = readStateValue(source, token);
  return typeof value === 'number' ? value : undefined;
}

function normalizeToken(token: string): string {
  return token.replace(/^#/, '');
}
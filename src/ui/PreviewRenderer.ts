import type { UIControlProperties, UIControlChild, TextureAsset } from '../types/JsonUITypes';

/* ═══════════════════════════════════════════════════════════════════════════
   Minecraft Bedrock JSON UI Preview Renderer
   ═══════════════════════════════════════════════════════════════════════════
   Key behaviours:
   - Resolves `@` control references (inheritance/extension)
   - Resolves `$variable|default` notation
   - Propagates `$` variables from parent to children
   - Detects root controls (ones not referenced by others) and only renders those
   - Stack panels use flex layout; other containers use absolute anchor positioning
   ══════════════════════════════════════════════════════════════════════════ */

// ── Anchor maps ────────────────────────────────────────────────────────────
const ANCHOR_MAP: Record<string, [number, number]> = {
  top_left:      [0,   0  ],
  top_middle:    [0.5, 0  ],
  top_right:     [1,   0  ],
  left_middle:   [0,   0.5],
  center:        [0.5, 0.5],
  right_middle:  [1,   0.5],
  bottom_left:   [0,   1  ],
  bottom_middle: [0.5, 1  ],
  bottom_right:  [1,   1  ],
};

// ── Context passed down the render tree ────────────────────────────────────
interface RenderCtx {
  /** $globals from _global_variables.json */
  globalVars: Record<string, unknown>;
  /** $variables inherited from ancestor controls */
  localVars: Record<string, unknown>;
  /** Uploaded texture assets keyed by path */
  textures: Map<string, TextureAsset>;
  /** All control definitions in the current file (for @ resolution) */
  fileDefs: Map<string, UIControlProperties>;
  /** Current file namespace */
  namespace: string;
  /** Controls across all files keyed by "namespace.controlName" */
  allDefs: Map<string, UIControlProperties>;
  /** Set of hidden control names (user toggled off) */
  hidden: Set<string>;
  /** Whether to show debug name labels */
  showDebugNames: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a JSON UI size scalar to pixels.
 * Handles: number | "N%" | "N% + M" | "N% - M" | "N%c" | "default" | "fill"
 */
function resolveScalar(val: unknown, parent: number, ctx: RenderCtx): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return parent;

  let s = val.trim();

  // Variable reference
  if (s.startsWith('$')) {
    const resolved = resolveVarRaw(s, ctx);
    if (resolved !== undefined && resolved !== s) {
      return resolveScalar(resolved, parent, ctx);
    }
    return parent;
  }

  if (s === 'default' || s === 'fill' || s === '') return parent;

  // "N%c + M" or "N%c - M" or "N% + Mpx"
  const exprPct = s.match(/^(-?\d+(?:\.\d+)?)%c?\s*([+-])\s*(\d+(?:\.\d+)?)(?:px)?$/);
  if (exprPct) {
    const base = (parseFloat(exprPct[1]) / 100) * parent;
    const delta = parseFloat(exprPct[3]);
    return exprPct[2] === '+' ? base + delta : base - delta;
  }

  // "N%c" or "N%"
  const pct = s.match(/^(-?\d+(?:\.\d+)?)%c?$/);
  if (pct) return (parseFloat(pct[1]) / 100) * parent;

  // Pure number string "123" or "123px"
  s = s.replace(/px$/, '');
  const num = parseFloat(s);
  if (!isNaN(num)) return num;

  return parent;
}

function resolveSize(
  sizeVal: unknown,
  parentW: number,
  parentH: number,
  ctx: RenderCtx
): [number, number] {
  if (sizeVal === undefined || sizeVal === null) return [parentW, parentH];
  // Variable reference
  if (typeof sizeVal === 'string' && sizeVal.startsWith('$')) {
    const resolved = resolveVarRaw(sizeVal, ctx);
    if (resolved !== undefined && resolved !== sizeVal) {
      return resolveSize(resolved, parentW, parentH, ctx);
    }
    return [parentW, parentH];
  }
  if (Array.isArray(sizeVal)) {
    return [
      resolveScalar(sizeVal[0], parentW, ctx),
      resolveScalar(sizeVal[1], parentH, ctx),
    ];
  }
  if (typeof sizeVal === 'number') return [sizeVal, sizeVal];
  if (typeof sizeVal === 'string') return [resolveScalar(sizeVal, parentW, ctx), resolveScalar(sizeVal, parentH, ctx)];
  return [parentW, parentH];
}

function resolveOffset(
  offsetVal: unknown,
  ctx: RenderCtx
): [number, number] {
  if (!offsetVal) return [0, 0];
  if (typeof offsetVal === 'string' && offsetVal.startsWith('$')) {
    const resolved = resolveVarRaw(offsetVal, ctx);
    if (resolved !== undefined && resolved !== offsetVal) {
      return resolveOffset(resolved, ctx);
    }
    return [0, 0];
  }
  if (Array.isArray(offsetVal)) {
    return [
      typeof offsetVal[0] === 'number' ? offsetVal[0] : 0,
      typeof offsetVal[1] === 'number' ? offsetVal[1] : 0,
    ];
  }
  return [0, 0];
}

/**
 * Strip "|default" suffix from a variable name.
 * "$size|default" -> "size"
 */
function stripVarName(key: string): string {
  let name = key;
  if (name.startsWith('$')) name = name.slice(1);
  const pipe = name.indexOf('|');
  if (pipe !== -1) name = name.substring(0, pipe);
  return name;
}

/** Resolve a $ variable to its raw (non-string) value */
function resolveVarRaw(val: string | unknown, ctx: RenderCtx): unknown {
  if (typeof val !== 'string' || !val.startsWith('$')) return val;
  const name = stripVarName(val);
  return ctx.localVars[name] ?? ctx.globalVars[name] ?? val;
}

/** Resolve to a string for display */
function resolveText(text: unknown, ctx: RenderCtx): string {
  if (typeof text !== 'string') return '';
  if (text.startsWith('$')) {
    const v = resolveVarRaw(text, ctx);
    return v !== text ? String(v) : text;
  }
  if (text.startsWith('#')) return text; // runtime binding - show raw
  return text;
}

/** Normalize a texture path: lowercase, forward slashes, no extension */
function normalizePath(p: string): string {
  return p.trim()
    .replace(/\\/g, '/')
    .replace(/\.(png|jpg|jpeg|tga|webp|gif)$/i, '')
    .toLowerCase();
}

/** Find a texture by path in the texture map (case-insensitive, extension-agnostic) */
function findTexture(texturePath: string, textures: Map<string, TextureAsset>): TextureAsset | undefined {
  const search = normalizePath(texturePath);
  const searchName = search.split('/').pop() ?? '';

  // 1. Full normalized path match
  for (const [, t] of textures) {
    if (normalizePath(t.path) === search) return t;
  }
  // 2. Stored path ends with the search path (handles extra prefix)
  for (const [, t] of textures) {
    const tNorm = normalizePath(t.path);
    if (tNorm.endsWith('/' + search) || tNorm.endsWith(search)) return t;
  }
  // 3. Filename-only match
  for (const [, t] of textures) {
    const tName = normalizePath(t.name);
    if (tName === searchName) return t;
  }
  return undefined;
}

/**
 * Resolve a `childName@namespace.controlRef` or `childName@controlRef` reference.
 * Merges the referenced definition's properties with inline overrides.
 */
function resolveReference(
  childName: string,
  inlineProps: UIControlProperties,
  ctx: RenderCtx
): UIControlProperties {
  const atIdx = childName.indexOf('@');
  if (atIdx === -1) return inlineProps;

  const ref = childName.substring(atIdx + 1);

  let baseDef: UIControlProperties | undefined;

  if (ref.includes('.')) {
    const [ns, ctrlName] = ref.split('.', 2);
    // Same namespace -> look in current file
    if (ns === ctx.namespace) {
      baseDef = ctx.fileDefs.get(ctrlName);
    }
    // Different namespace -> look in allDefs
    if (!baseDef) {
      baseDef = ctx.allDefs.get(ref);
    }
    // Try just the control name in current file
    if (!baseDef) {
      baseDef = ctx.fileDefs.get(ctrlName);
    }
  } else {
    // No namespace -> search current file
    baseDef = ctx.fileDefs.get(ref);
    if (!baseDef) {
      baseDef = ctx.allDefs.get(`${ctx.namespace}.${ref}`);
    }
  }

  if (!baseDef) return inlineProps;

  // The base definition may itself have an @ reference in its name...
  // But since fileDefs keys are clean names, this is already resolved.

  // Deep merge: base provides defaults, inline overrides
  return mergeControls(baseDef, inlineProps);
}

/** Merge base definition with inline overrides */
function mergeControls(
  base: UIControlProperties,
  override: UIControlProperties
): UIControlProperties {
  const merged: UIControlProperties = { ...base };

  for (const [key, val] of Object.entries(override)) {
    if (key === 'controls' && val && Array.isArray(val) && val.length > 0) {
      (merged as Record<string, unknown>)[key] = val;
    } else if (val !== undefined) {
      (merged as Record<string, unknown>)[key] = val;
    }
  }

  return merged;
}

/** Collect all $variable definitions from a control (including `|default`) */
function collectVars(ctrl: UIControlProperties): Record<string, unknown> {
  const vars: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(ctrl)) {
    if (key.startsWith('$')) {
      vars[stripVarName(key)] = val;
    }
  }
  return vars;
}

/** Detect which controls are "roots" - never referenced by @ from other controls */
function findRootControls(defs: Map<string, UIControlProperties>, namespace: string): string[] {
  const referenced = new Set<string>();

  function scanChildren(children: UIControlChild[]) {
    for (const child of children) {
      for (const [childName, childProps] of Object.entries(child)) {
        const atIdx = childName.indexOf('@');
        if (atIdx !== -1) {
          const ref = childName.substring(atIdx + 1);
          if (ref.includes('.')) {
            const [ns, name] = ref.split('.', 2);
            if (ns === namespace) referenced.add(name);
          } else {
            referenced.add(ref);
          }
        }
        if (childProps.controls) scanChildren(childProps.controls);
      }
    }
  }

  for (const [, ctrl] of defs) {
    if (ctrl.controls) scanChildren(ctrl.controls);
  }

  const roots: string[] = [];
  for (const name of defs.keys()) {
    if (!referenced.has(name)) {
      roots.push(name);
    }
  }

  return roots.length > 0 ? roots : [...defs.keys()];
}

// ═══════════════════════════════════════════════════════════════════════════
//  PreviewRenderer class
// ═══════════════════════════════════════════════════════════════════════════

export class PreviewRenderer {
  private ctx: RenderCtx;

  constructor(
    textures: Map<string, TextureAsset>,
    globalVars: Record<string, unknown>,
    fileDefs: Map<string, UIControlProperties>,
    namespace: string,
    allDefs: Map<string, UIControlProperties> = new Map(),
    hidden: Set<string> = new Set(),
    showDebugNames = false
  ) {
    this.ctx = {
      globalVars,
      localVars: {},
      textures,
      fileDefs,
      namespace,
      allDefs,
      hidden,
      showDebugNames,
    };
  }

  /** Render root controls from the file into the container */
  render(container: HTMLElement, screenW: number, screenH: number): void {
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.width = `${screenW}px`;
    container.style.height = `${screenH}px`;

    const roots = findRootControls(this.ctx.fileDefs, this.ctx.namespace);

    for (const name of roots) {
      const ctrl = this.ctx.fileDefs.get(name);
      if (!ctrl) continue;
      const el = this.renderControl(name, ctrl, screenW, screenH, this.ctx);
      if (el) container.appendChild(el);
    }
  }

  renderControl(
    name: string,
    rawCtrl: UIControlProperties,
    parentW: number,
    parentH: number,
    ctx: RenderCtx
  ): HTMLElement | null {
    const cleanName = name.includes('@') ? name.substring(0, name.indexOf('@')) : name;
    if (ctx.hidden.has(cleanName) || ctx.hidden.has(name)) return null;

    // Resolve @ reference
    const ctrl = resolveReference(name, rawCtrl, ctx);

    if (ctrl.visible === false) return null;

    // Build local context with this control's variables
    const childVars = collectVars(ctrl);
    const localCtx: RenderCtx = {
      ...ctx,
      localVars: { ...ctx.localVars, ...childVars },
    };

    const type = resolveType(ctrl, localCtx);
    const isStackPanel = type === 'stack_panel';
    const orientation = (ctrl.orientation ?? 'vertical') as string;

    // ── Resolve size ───────────────────────────────────────────────────
    let [w, h] = resolveSize(ctrl.size, parentW, parentH, localCtx);
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));

    // ── Resolve position from anchors ──────────────────────────────────
    const anchorFrom = resolveAnchor(ctrl.anchor_from, localCtx);
    const anchorTo = resolveAnchor(ctrl.anchor_to, localCtx);
    const [afX, afY] = ANCHOR_MAP[anchorFrom] ?? [0.5, 0.5];
    const [atX, atY] = ANCHOR_MAP[anchorTo] ?? [0.5, 0.5];

    const [offsetX, offsetY] = resolveOffset(ctrl.offset, localCtx);

    const left = Math.round(afX * parentW - atX * w + offsetX);
    const top = Math.round(afY * parentH - atY * h + offsetY);

    // ── Build element ──────────────────────────────────────────────────
    const el = document.createElement('div');
    el.className = `preview-ctrl preview-type-${type}`;
    el.dataset.name = cleanName;

    el.style.position = 'absolute';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.overflow = 'hidden';

    // Alpha
    const alpha = resolveAlpha(ctrl.alpha, localCtx);
    if (alpha < 1) el.style.opacity = String(alpha);

    // Layer -> z-index
    if (ctrl.layer !== undefined) el.style.zIndex = String(ctrl.layer);

    // ── Type-specific rendering ────────────────────────────────────────
    switch (type) {
      case 'image':
        this.renderImage(el, ctrl, localCtx);
        break;
      case 'label':
        this.renderLabel(el, ctrl, localCtx);
        break;
      case 'button':
        this.renderButton(el, ctrl, localCtx);
        break;
      case 'edit_box':
        this.renderEditBox(el, ctrl, localCtx);
        break;
      case 'slider':
        this.renderSlider(el);
        break;
      case 'toggle':
        this.renderToggle(el, ctrl, localCtx);
        break;
      default:
        break;
    }

    // Debug label
    if (ctx.showDebugNames) {
      const dbg = document.createElement('span');
      dbg.className = 'preview-debug-name';
      dbg.textContent = cleanName;
      el.appendChild(dbg);
    }

    // ── Children ───────────────────────────────────────────────────────
    if (ctrl.controls && ctrl.controls.length > 0) {
      if (isStackPanel) {
        this.renderStackPanel(el, ctrl.controls, w, h, orientation, localCtx);
      } else {
        this.renderChildren(el, ctrl.controls, w, h, localCtx);
      }
    }

    return el;
  }

  // ── Image ──────────────────────────────────────────────────────────────
  private renderImage(el: HTMLElement, ctrl: UIControlProperties, ctx: RenderCtx): void {
    let texturePath = ctrl.texture;
    if (typeof texturePath === 'string' && texturePath.startsWith('$')) {
      const resolved = resolveVarRaw(texturePath, ctx);
      texturePath = typeof resolved === 'string' ? resolved : texturePath;
    }
    if (!texturePath || texturePath.startsWith('$') || texturePath.startsWith('#')) {
      el.style.background = 'rgba(60,30,100,0.4)';
      return;
    }

    const tex = findTexture(texturePath, ctx.textures);
    if (!tex) {
      // Texture not found – show placeholder with the path name
      el.style.background = 'rgba(60,30,100,0.4)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      const label = document.createElement('span');
      label.className = 'preview-tex-placeholder';
      label.textContent = texturePath.split('/').pop() ?? texturePath;
      el.appendChild(label);
      console.warn('[Preview] Texture not found:', texturePath, '— available:', Array.from(ctx.textures.values()).map(t => t.path));
      return;
    }

    el.style.border = 'none';
    el.style.outline = 'none';

    // Resolve nineslice: control property takes priority, then companion JSON on the texture
    let nineslice: [number, number, number, number] | null = null;
    if (ctrl.nineslice_size !== undefined) {
      const ns = ctrl.nineslice_size;
      nineslice = Array.isArray(ns)
        ? [ns[0] as number, ns[1] as number, ns[2] as number, ns[3] as number]
        : [ns as number, ns as number, ns as number, ns as number];
    } else if (tex.nineslice) {
      nineslice = [tex.nineslice.top, tex.nineslice.right, tex.nineslice.bottom, tex.nineslice.left];
    }

    if (nineslice) {
      // ── 9-slice: render via CSS border-image on a positioned div ──────
      // We use a child div so children of the control are not clipped by the border.
      const [t, r, b, l] = nineslice;
      const ns = document.createElement('div');
      ns.style.position = 'absolute';
      ns.style.inset = '0';
      ns.style.pointerEvents = 'none';
      ns.style.imageRendering = 'pixelated';
      // border-image-slice uses source image pixels; border-image-width uses CSS px
      ns.style.borderStyle = 'solid';
      ns.style.borderColor = 'transparent';
      ns.style.borderWidth = `${t}px ${r}px ${b}px ${l}px`;
      ns.style.borderImageSource = `url('${tex.data}')`;
      ns.style.borderImageSlice = `${t} ${r} ${b} ${l} fill`;
      ns.style.borderImageWidth = `${t}px ${r}px ${b}px ${l}px`;
      ns.style.borderImageOutset = '0';
      ns.style.borderImageRepeat = 'stretch';
      el.appendChild(ns);
    } else {
      // ── Simple stretched image ─────────────────────────────────────────
      const img = document.createElement('img');
      img.src = tex.data;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'fill';
      img.style.imageRendering = 'pixelated';
      img.style.position = 'absolute';
      img.style.top = '0';
      img.style.left = '0';
      img.style.pointerEvents = 'none';
      el.appendChild(img);
    }
  }

  // ── Label ──────────────────────────────────────────────────────────────
  private renderLabel(el: HTMLElement, ctrl: UIControlProperties, ctx: RenderCtx): void {
    const text = resolveText(ctrl.text, ctx);
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent =
      ctrl.text_alignment === 'center' ? 'center' :
      ctrl.text_alignment === 'right' ? 'flex-end' : 'flex-start';
    el.style.padding = '0 2px';
    el.style.color = this.resolveColor(ctrl.color) ?? '#ffffff';
    el.style.fontSize = this.resolveFontSize(ctrl.font_scale_factor, ctrl.font_size, ctrl.font_type) + 'px';
    el.style.fontFamily = ctrl.font_type === 'MinecraftTen' ? '"Minecraft Ten", monospace' : 'monospace';
    el.style.fontWeight = ctrl.font_type === 'MinecraftTen' ? 'bold' : 'normal';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.textOverflow = 'ellipsis';
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.outline = 'none';
    el.textContent = text || ' ';

    if (ctrl.shadow) {
      el.style.textShadow = '1px 1px 0 rgba(0,0,0,0.6)';
    }
  }

  // ── Button ─────────────────────────────────────────────────────────────
  private renderButton(el: HTMLElement, ctrl: UIControlProperties, ctx: RenderCtx): void {
    el.style.cursor = 'pointer';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    const text = resolveText(ctrl.text, ctx);
    if (text) {
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '11px';
      el.style.color = '#cdd6f4';
      el.textContent = text;
    }
  }

  // ── Edit box ───────────────────────────────────────────────────────────
  private renderEditBox(el: HTMLElement, ctrl: UIControlProperties, ctx: RenderCtx): void {
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.padding = '0 4px';
    el.style.border = '1px solid #6c7086';
    el.style.background = 'rgba(17,17,27,0.8)';
    const ph = document.createElement('span');
    ph.style.color = '#6c7086';
    ph.style.fontSize = '11px';
    ph.style.fontFamily = 'monospace';
    ph.textContent = resolveText(ctrl.place_holder_text ?? ctrl.text_box_name ?? ctrl.text, ctx) || '...';
    el.appendChild(ph);
  }

  // ── Slider ─────────────────────────────────────────────────────────────
  private renderSlider(el: HTMLElement): void {
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.padding = '0 4px';
    const track = document.createElement('div');
    track.style.cssText = 'width:100%;height:4px;background:#45475a;border-radius:2px;position:relative;';
    const thumb = document.createElement('div');
    thumb.style.cssText = 'position:absolute;left:40%;top:-4px;width:8px;height:12px;background:#89b4fa;border-radius:2px;';
    track.appendChild(thumb);
    el.appendChild(track);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────
  private renderToggle(el: HTMLElement, ctrl: UIControlProperties, ctx: RenderCtx): void {
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '6px';
    el.style.padding = '0 4px';
    const pill = document.createElement('div');
    pill.style.cssText = 'width:28px;height:14px;background:#313244;border-radius:7px;border:1px solid #6c7086;flex-shrink:0;';
    const dot = document.createElement('div');
    dot.style.cssText = 'width:10px;height:10px;background:#6c7086;border-radius:5px;margin:1px 2px;';
    pill.appendChild(dot);
    el.appendChild(pill);
    const label = document.createElement('span');
    label.style.cssText = 'font-size:11px;color:#cdd6f4;font-family:monospace;';
    label.textContent = resolveText(ctrl.toggle_name, ctx) || 'toggle';
    el.appendChild(label);
  }

  // ── Children (absolute positioning) ────────────────────────────────────
  private renderChildren(
    parent: HTMLElement,
    children: UIControlChild[],
    w: number,
    h: number,
    ctx: RenderCtx
  ): void {
    for (const child of children) {
      for (const [childName, childProps] of Object.entries(child)) {
        const el = this.renderControl(childName, childProps, w, h, ctx);
        if (el) parent.appendChild(el);
      }
    }
  }

  // ── Stack panel (flex layout) ──────────────────────────────────────────
  private renderStackPanel(
    parent: HTMLElement,
    children: UIControlChild[],
    parentW: number,
    parentH: number,
    orientation: string,
    ctx: RenderCtx
  ): void {
    const flow = document.createElement('div');
    flow.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:100%', 'height:100%',
      'display:flex',
      `flex-direction:${orientation === 'horizontal' ? 'row' : 'column'}`,
      'flex-wrap:nowrap',
      'gap:0',
      'overflow:hidden',
    ].join(';');

    for (const child of children) {
      for (const [childName, childProps] of Object.entries(child)) {
        const childEl = this.renderControl(childName, childProps, parentW, parentH, ctx);
        if (childEl) {
          // In a stack panel, children flow - remove absolute positioning
          childEl.style.position = 'relative';
          childEl.style.left = '0';
          childEl.style.top = '0';
          childEl.style.flexShrink = '0';
          flow.appendChild(childEl);
        }
      }
    }
    parent.appendChild(flow);
  }

  // ── Utility ────────────────────────────────────────────────────────────
  private resolveColor(color: unknown): string | null {
    if (Array.isArray(color) && color.length >= 3) {
      const [r, g, b, a = 1] = color as number[];
      return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
    }
    if (typeof color === 'string') return color;
    return null;
  }

  private resolveFontSize(scaleFactor: unknown, fontSize: unknown, fontType: unknown): number {
    const base = 11;
    if (typeof scaleFactor === 'number') return Math.round(base * scaleFactor);
    if (fontType === 'MinecraftTen') return 14;
    if (fontSize === 'large') return 16;
    if (fontSize === 'extra_large') return 20;
    if (fontSize === 'small') return 9;
    return base;
  }
}

// ── Small helpers ────────────────────────────────────────────────────────

function resolveType(ctrl: UIControlProperties, ctx: RenderCtx): string {
  const t = ctrl.type ?? 'panel';
  if (typeof t === 'string' && t.startsWith('$')) {
    const resolved = resolveVarRaw(t, ctx);
    return typeof resolved === 'string' ? resolved : 'panel';
  }
  return t;
}

function resolveAnchor(anchor: unknown, ctx: RenderCtx): string {
  if (typeof anchor !== 'string') return 'center';
  if (anchor.startsWith('$')) {
    const resolved = resolveVarRaw(anchor, ctx);
    return typeof resolved === 'string' ? resolved : 'center';
  }
  return anchor;
}

function resolveAlpha(alpha: unknown, ctx: RenderCtx): number {
  if (typeof alpha === 'number') return alpha;
  if (typeof alpha === 'string' && alpha.startsWith('$')) {
    const resolved = resolveVarRaw(alpha, ctx);
    if (typeof resolved === 'number') return resolved;
  }
  return 1;
}

import { ProjectManager } from '../core/ProjectManager';
import { EventBus } from '../core/EventBus';
import { el, clearElement, showToast } from './DomUtils';
import { PreviewRenderer } from './PreviewRenderer';
import type { UIControlProperties } from '../types/JsonUITypes';

// Eye icon SVGs for visibility toggles
const EYE_OPEN_SVG = `<svg viewBox="0 0 16 11" width="13" height="9" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C4.5 0 1.5 2.2.2 5.5 1.5 8.8 4.5 11 8 11s6.5-2.2 7.8-5.5C14.5 2.2 11.5 0 8 0zm0 9.2c-2.1 0-3.7-1.7-3.7-3.7S5.9 1.8 8 1.8s3.7 1.7 3.7 3.7S10.1 9.2 8 9.2zm0-5.9c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2-1-2.2-2.2-2.2z"/></svg>`;
const EYE_CLOSED_SVG = `<svg viewBox="0 0 16 11" width="13" height="9" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5l13 8M8 1C4.5 1 1.8 3 .5 5.5c.7 1.4 1.8 2.5 3.1 3.3L5.1 7.3A3.7 3.7 0 0 1 8 1.8c.3 0 .6 0 .9.1L7 3.7A2.2 2.2 0 0 0 5.8 5.5l-2 1.3A5.6 5.6 0 0 1 2.4 5.5 7.4 7.4 0 0 1 8 2.5V1zm2.9 2.2L14.5.5M8 10c3.5 0 6.2-2 7.5-4.5C14.2 3 11.5 1 8 1"/><line x1="1" y1="1" x2="15" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

/** Screen resolution presets for the preview canvas */
const SCREEN_PRESETS = [
  { label: 'Mobile (480x270)',  w: 480,  h: 270  },
  { label: 'Tablet (854x480)',  w: 854,  h: 480  },
  { label: 'PC (1280x720)',     w: 1280, h: 720  },
] as const;

/** Visual editor - split view: block hierarchy + live UI preview */
export class VisualEditor {
  private readonly container: HTMLElement;
  private currentFile: string | null = null;
  private presetIndex = 0;
  private showDebugNames = false;
  private hiddenControls = new Set<string>();

  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;

    this.events.on('file:selected', (data) => {
      if (data) { this.currentFile = data.filePath; this.hiddenControls.clear(); this.render(); }
    });
    this.events.on('control:created',  () => this.render());
    this.events.on('control:deleted',  () => this.render());
    this.events.on('control:updated',  () => this.render());
    this.events.on('tree:refresh',     () => this.render());

    this.setupDropZone();
  }

  /** Render everything */
  render(): void {
    clearElement(this.container);

    if (!this.currentFile) {
      this.container.appendChild(this.renderWelcome());
      return;
    }

    if (this.currentFile === '_global_variables.json') {
      this.renderGlobalVariables();
      return;
    }

    const fileDef = this.projectManager.getFile(this.currentFile);
    if (!fileDef) {
      this.container.appendChild(el('div', { className: 'visual-empty' }, 'File not found'));
      return;
    }

    // ── Info bar ─────────────────────────────────────────────────────────
    this.container.appendChild(
      el('div', { className: 'visual-info-bar' },
        el('span', { className: 'namespace-badge' }, `namespace: ${fileDef.namespace}`),
        el('span', { className: 'file-path' }, this.currentFile)
      )
    );

    // ── Split layout ────────────────────────────────────────────────────
    const split = el('div', { className: 'visual-split' });

    // Left pane: block hierarchy
    const treePaneEl = el('div', { className: 'visual-tree-pane' });
    this.renderTreePane(treePaneEl);
    split.appendChild(treePaneEl);

    // Resize handle between hierarchy and preview
    const resizer = el('div', { className: 'visual-resizer' });
    this.setupResizer(resizer, treePaneEl, 'left');
    split.appendChild(resizer);

    // Right pane: live UI preview
    const previewPaneEl = el('div', { className: 'visual-preview-pane' });
    this.renderPreviewPane(previewPaneEl);
    split.appendChild(previewPaneEl);

    this.container.appendChild(split);
  }

  // ── Resizable splitter logic ───────────────────────────────────────────

  private setupResizer(handle: HTMLElement, pane: HTMLElement, side: 'left' | 'right'): void {
    let startX = 0;
    let startW = 0;

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const delta = e.clientX - startX;
      const newW = side === 'left' ? startW + delta : startW - delta;
      pane.style.width = `${Math.max(180, Math.min(600, newW))}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startW = pane.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // ── Block tree pane ────────────────────────────────────────────────────

  private renderTreePane(pane: HTMLElement): void {
    pane.appendChild(
      el('div', { className: 'visual-pane-header' },
        el('span', {}, 'Hierarchy'),
        el('button', {
          className: 'btn small',
          onclick: () => {
            const name = prompt('Control name:');
            if (!name || !this.currentFile) return;
            this.projectManager.addControl(this.currentFile, name, { type: 'panel' });
          }
        }, '+ Add')
      )
    );

    const controlNames = this.projectManager.getControlNames(this.currentFile!);
    if (controlNames.length === 0) {
      pane.appendChild(el('div', { className: 'visual-empty-file' }, 'No controls yet'));
      return;
    }

    const tree = el('div', { className: 'visual-block-tree' });
    for (const name of controlNames) {
      const ctrl = this.projectManager.getControl(this.currentFile!, name);
      if (ctrl) tree.appendChild(this.renderControlBlock(name, ctrl, 0));
    }
    pane.appendChild(tree);
  }

  private renderControlBlock(name: string, control: UIControlProperties, depth: number): HTMLElement {
    const typeLabel = control.type ?? 'inherited';
    const hasChildren = control.controls && control.controls.length > 0;
    const hasBindings = control.bindings && control.bindings.length > 0;
    const isHidden = this.hiddenControls.has(name);

    const sizeStr = control.size
      ? (Array.isArray(control.size) ? `${control.size[0]}x${control.size[1]}` : String(control.size))
      : '';

    // Visibility eye toggle
    const eyeBtn = document.createElement('button');
    eyeBtn.className = `btn-icon visibility-toggle ${isHidden ? 'hidden-ctrl' : ''}`;
    eyeBtn.title = isHidden ? 'Show' : 'Hide';
    eyeBtn.innerHTML = isHidden ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
    eyeBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (isHidden) {
        this.hiddenControls.delete(name);
      } else {
        this.hiddenControls.add(name);
      }
      this.render();
    });

    const block = el('div', {
      className: `control-block type-${typeLabel} ${isHidden ? 'ctrl-hidden' : ''}`,
      style: `margin-left: ${depth * 16}px`,
      draggable: 'true',
      onclick: (e: Event) => {
        e.stopPropagation();
        this.events.emit('control:selected', { filePath: this.currentFile!, controlName: name });
      },
      ondragstart: (e: DragEvent) => {
        e.dataTransfer?.setData('text/plain', JSON.stringify({ file: this.currentFile, control: name }));
      },
      ondragover: (e: DragEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag-over'); },
      ondrop: (e: DragEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove('drag-over'); },
    },
      el('div', { className: 'block-header' },
        eyeBtn,
        el('span', { className: 'block-name' }, name),
        el('span', { className: `block-type badge-${typeLabel}` }, typeLabel),
        sizeStr ? el('span', { className: 'block-size' }, sizeStr) : null,
        hasBindings ? el('span', { className: 'block-bindings-badge' }, `[B] ${control.bindings!.length}`) : null,
        name.includes('@') ? el('span', { className: 'block-ref' }, `-> ${name.split('@')[1]}`) : null,
      ),
      this.renderControlSummary(control)
    );

    if (hasChildren) {
      const childrenContainer = el('div', { className: 'block-children' });
      for (const child of control.controls!) {
        for (const [childName, childProps] of Object.entries(child)) {
          childrenContainer.appendChild(this.renderControlBlock(childName, childProps, depth + 1));
        }
      }
      block.appendChild(childrenContainer);
    }

    return block;
  }

  private renderControlSummary(control: UIControlProperties): HTMLElement {
    const preview = el('div', { className: 'block-preview' });
    if (control.text)           preview.appendChild(el('span', { className: 'preview-text'       }, `"${control.text}"`));
    if (control.texture)        preview.appendChild(el('span', { className: 'preview-texture'    }, `[img] ${control.texture.split('/').pop()}`));
    if (control.factory)        preview.appendChild(el('span', { className: 'preview-factory'    }, `factory: ${control.factory.name}`));
    if (control.renderer)       preview.appendChild(el('span', { className: 'preview-renderer'   }, `renderer: ${control.renderer}`));
    if (control.collection_name)preview.appendChild(el('span', { className: 'preview-collection' }, `[col] ${control.collection_name}`));
    if (control.toggle_name)    preview.appendChild(el('span', { className: 'preview-toggle'     }, control.toggle_name!));
    return preview;
  }

  // ── Live preview pane ──────────────────────────────────────────────────

  private renderPreviewPane(pane: HTMLElement): void {
    const preset = SCREEN_PRESETS[this.presetIndex];

    // Header with controls
    pane.appendChild(
      el('div', { className: 'visual-pane-header' },
        el('span', {}, 'Preview'),
        el('div', { className: 'preview-controls' },
          // Debug names toggle
          el('label', { className: 'preview-toggle-label' },
            el('input', {
              type: 'checkbox',
              checked: this.showDebugNames,
              onchange: (e: Event) => {
                this.showDebugNames = (e.target as HTMLInputElement).checked;
                this.render();
              }
            }),
            ' Names'
          ),
          // Screen size selector
          el('select', {
            className: 'inspector-input',
            style: 'width:auto;font-size:11px;padding:2px 4px;',
            onchange: (e: Event) => {
              this.presetIndex = (e.target as HTMLSelectElement).selectedIndex;
              this.render();
            }
          },
            ...SCREEN_PRESETS.map((p, i) =>
              el('option', { value: String(i), selected: i === this.presetIndex }, p.label)
            )
          )
        )
      )
    );

    // Scrollable wrapper
    const scroll = el('div', { className: 'preview-scroll' });

    // The mock game screen
    const screen = el('div', { className: 'preview-screen' });
    screen.style.width  = `${preset.w}px`;
    screen.style.height = `${preset.h}px`;

    // Game-like background
    const bg = el('div', { className: 'preview-game-bg' });
    screen.appendChild(bg);

    // Build control definitions map for this file
    const controlNames = this.projectManager.getControlNames(this.currentFile!);
    const fileDefs = new Map<string, UIControlProperties>();
    for (const name of controlNames) {
      const ctrl = this.projectManager.getControl(this.currentFile!, name);
      if (ctrl) fileDefs.set(name, ctrl);
    }

    // Build allDefs across all loaded files
    const allDefs = new Map<string, UIControlProperties>();
    for (const fp of this.projectManager.getFilePaths()) {
      const fd = this.projectManager.getFile(fp);
      if (!fd) continue;
      const ns = fd.namespace;
      for (const cn of this.projectManager.getControlNames(fp)) {
        const c = this.projectManager.getControl(fp, cn);
        if (c) allDefs.set(`${ns}.${cn}`, c);
      }
    }

    // Get file namespace
    const fileDef = this.projectManager.getFile(this.currentFile!);
    const namespace = fileDef?.namespace ?? '';

    const textures = this.projectManager.getTextures();
    const globalVars = this.projectManager.getGlobalVariables() as Record<string, unknown>;

    const renderer = new PreviewRenderer(
      textures,
      globalVars,
      fileDefs,
      namespace,
      allDefs,
      this.hiddenControls,
      this.showDebugNames
    );
    renderer.render(screen, preset.w, preset.h);

    scroll.appendChild(screen);
    pane.appendChild(scroll);

    // Legend
    pane.appendChild(
      el('div', { className: 'preview-legend' },
        el('span', { className: 'preview-legend-item' }, '\u25A3 panel'),
        el('span', { className: 'preview-legend-item' }, '\u229E stack'),
        el('span', { className: 'preview-legend-item label-item' }, 'T label'),
        el('span', { className: 'preview-legend-item image-item' }, '\u25A3 image'),
        el('span', { className: 'preview-legend-item button-item' }, '\u25C9 button'),
      )
    );
  }

  // ── Welcome screen ────────────────────────────────────────────────────

  private renderWelcome(): HTMLElement {
    return el('div', { className: 'visual-empty' },
      el('h2', {}, 'JsonUI Editor'),
      el('p', {}, 'Select a file from the tree or import a project to begin'),
      el('div', { className: 'quick-actions' },
        el('button', {
          className: 'btn primary',
          onclick: () => this.events.emit('status:message', { text: 'Use File > Import to load a project', type: 'info' })
        }, 'Import Project'),
        el('button', {
          className: 'btn',
          onclick: () => {
            this.projectManager.newProject('New Project');
            const file = 'ui/main.json';
            this.projectManager.addFile(file, { namespace: 'main' });
            this.events.emit('file:selected', { filePath: file });
          }
        }, '+ New Project')
      )
    );
  }

  // ── Global variables editor ────────────────────────────────────────────

  private renderGlobalVariables(): void {
    const vars = this.projectManager.getGlobalVariables();
    const content = el('div', { className: 'global-vars-editor' });
    content.appendChild(el('h3', {}, 'Global Variables'));
    const textarea = el('textarea', {
      className: 'raw-json-editor full',
      rows: '30',
      value: JSON.stringify(vars, null, 2),
    }) as HTMLTextAreaElement;
    content.appendChild(textarea);
    content.appendChild(
      el('button', {
        className: 'btn primary',
        onclick: () => {
          try {
            const parsed = JSON.parse(textarea.value);
            this.projectManager.setGlobalVariables(parsed);
            showToast('Global variables updated', 'info');
          } catch { showToast('Invalid JSON', 'error'); }
        }
      }, 'Save')
    );
    this.container.appendChild(content);
  }

  // ── Drag-and-drop setup ────────────────────────────────────────────────

  private setupDropZone(): void {
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.container.classList.add('drop-active');
    });
    this.container.addEventListener('dragleave', () => {
      this.container.classList.remove('drop-active');
    });
    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.container.classList.remove('drop-active');
    });
  }
}

import { ProjectManager } from '../../core/ProjectManager';
import { EventBus } from '../../core/EventBus';
import { el, clearElement, closeModal, showModal, showToast } from '../shared/DomUtils';
import { PreviewRenderer } from './PreviewRenderer';
import { buildPreviewSource, type PreparedPreviewSource, type PreviewMockMode } from './runtime/PreviewSource';
import { createEmptyPreviewMockData } from './runtime/PreviewMockData';
import { t, onLangChange } from '../../core/i18n';
import type { PreviewMockData } from './runtime/PreviewMockData';
import type { UIControlProperties } from '../../types/JsonUITypes';

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
  private customMockData = createEmptyPreviewMockData();
  private mockMode: PreviewMockMode = 'auto';
  private presetIndex = 0;
  private showDebugNames = false;
  private showTextures = true;
  private show3D = false;
  private hiddenControls = new Set<string>();
  private selectedControl: string | null = null;

  // 3D camera state
  private rotX = -25;
  private rotY = 35;
  private layerSpacing = 40;

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
    this.events.on('control:selected', (data) => {
      if (data) { this.selectedControl = data.controlName; this.highlightSelected(); }
    });
    this.events.on('control:created',  () => this.render());
    this.events.on('control:deleted',  () => this.render());
    this.events.on('control:updated',  () => this.render());
    this.events.on('preview-base:changed', () => this.render());
    this.events.on('tree:refresh',     () => this.render());
    onLangChange(() => this.render());
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
    this.container.appendChild(
      el('div', { className: 'visual-info-bar' },
        el('span', { className: 'namespace-badge' }, `namespace: ${fileDef.namespace}`),
        el('span', { className: 'file-path' }, this.currentFile),
        this.projectManager.getPreviewBase()
          ? el('span', { className: 'preview-base-badge' }, `${t('toolbar.vanillaMounted')}: ${this.projectManager.getPreviewBase()!.name}`)
          : null
      )
    );
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

  private renderTreePane(pane: HTMLElement): void {
    pane.appendChild(
      el('div', { className: 'visual-pane-header' },
        el('span', {}, t('visual.hierarchy')),
        el('button', {
          className: 'btn small',
          onclick: () => {
            const name = prompt('Control name:');
            if (!name || !this.currentFile) return;
            this.projectManager.addControl(this.currentFile, name, { type: 'panel' });
          }
        }, t('visual.addControl'))
      )
    );
    const controlNames = this.projectManager.getControlNames(this.currentFile!);
    if (controlNames.length === 0) {
      pane.appendChild(el('div', { className: 'visual-empty-file' }, t('visual.noControls')));
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
    const eyeBtn = document.createElement('button');
    eyeBtn.className = `btn-icon visibility-toggle ${isHidden ? 'hidden-ctrl' : ''}`;
    eyeBtn.title = isHidden ? 'Show' : 'Hide';
    eyeBtn.innerHTML = isHidden ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
    eyeBtn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (isHidden) {
        this.hiddenControls.delete(name);
      } else this.hiddenControls.add(name);
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
        for (const [childName, childProps] of Object.entries(child))
          childrenContainer.appendChild(this.renderControlBlock(childName, childProps, depth + 1));
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

  private renderPreviewPane(pane: HTMLElement): void {
    const preset = SCREEN_PRESETS[this.presetIndex];
    const preview = this.createPreviewInput();
    pane.appendChild(
      el('div', { className: 'visual-pane-header' },
        el('span', {}, t('visual.preview')),
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
            ` ${t('visual.names')}`
          ),
          // Textures toggle
          el('label', { className: 'preview-toggle-label' },
            el('input', {
              type: 'checkbox',
              checked: this.showTextures,
              onchange: (e: Event) => {
                this.showTextures = (e.target as HTMLInputElement).checked;
                this.render();
              }
            }),
            ` ${t('visual.textures')}`
          ),
          // 3D view toggle
          el('label', { className: 'preview-toggle-label' },
            el('input', {
              type: 'checkbox',
              checked: this.show3D,
              onchange: (e: Event) => {
                this.show3D = (e.target as HTMLInputElement).checked;
                this.render();
              }
            }),
            ` ${t('visual.3dView')}`
          ),
          el('select', {
            className: 'preview-inline-select',
            value: this.mockMode,
            onchange: (e: Event) => {
              this.mockMode = (e.target as HTMLSelectElement).value as PreviewMockMode;
              this.render();
            }
          },
            el('option', { value: 'live', selected: this.mockMode === 'live' }, t('visual.mockLive')),
            el('option', { value: 'auto', selected: this.mockMode === 'auto' }, t('visual.mockAuto')),
            el('option', { value: 'custom', selected: this.mockMode === 'custom' }, t('visual.mockCustom')),
          ),
          this.mockMode === 'custom'
            ? el('button', {
                className: 'btn small preview-inline-button',
                onclick: () => this.openMockDataEditor(preview.mockData ?? this.customMockData)
              }, t('visual.editMock'))
            : null,
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
    if (this.show3D) {
      this.render3DView(pane, preset, preview);
      return;
    }
    const scroll = el('div', { className: 'preview-scroll' });
    const screen = el('div', { className: 'preview-screen' });
    screen.style.width  = `${preset.w}px`;
    screen.style.height = `${preset.h}px`;
    const bg = el('div', { className: 'preview-game-bg' });
    screen.appendChild(bg);
    const renderer = new PreviewRenderer(
      preview.textures,
      preview.globalVars,
      preview.fileDefs,
      preview.namespace,
      preview.allDefs,
      this.hiddenControls,
      this.showDebugNames,
      this.showTextures,
      preview.mockData
    );
    renderer.render(screen, preset.w, preset.h);
    this.attachInteractiveHandlers(screen);
    scroll.appendChild(screen);
    pane.appendChild(scroll);
    pane.appendChild(
      el('div', { className: 'preview-legend' },
        el('span', { className: 'preview-legend-item' }, `\u25A3 ${t('preview.legend.panel')}`),
        el('span', { className: 'preview-legend-item' }, `\u229E ${t('preview.legend.stack')}`),
        el('span', { className: 'preview-legend-item label-item' }, `T ${t('preview.legend.label')}`),
        el('span', { className: 'preview-legend-item image-item' }, `\u25A3 ${t('preview.legend.image')}`),
        el('span', { className: 'preview-legend-item button-item' }, `\u25C9 ${t('preview.legend.button')}`),
      )
    );
  }

  private attachInteractiveHandlers(screen: HTMLElement): void {
    const ctrls = screen.querySelectorAll<HTMLElement>('.preview-ctrl');
    ctrls.forEach(ctrlEl => {
      const name = ctrlEl.dataset.name;
      if (!name) return;
      // selected state
      if (name === this.selectedControl) {
        ctrlEl.classList.add('preview-ctrl-selected');
        this.addResizeHandles(ctrlEl, name);
      }
      // click to select
      ctrlEl.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.selectedControl = name;
        this.events.emit('control:selected', { filePath: this.currentFile!, controlName: name });
        this.render();
      });
    });
    // click background to deselect
    screen.addEventListener('click', () => {
      this.selectedControl = null;
      this.render();
    });
  }

  private addResizeHandles(ctrlEl: HTMLElement, controlName: string): void {
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const;
    for (const dir of handles) {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${dir}`;
      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.startResize(ctrlEl, controlName, dir, e);
      });
      ctrlEl.appendChild(handle);
    }
  }

  private startResize(
    ctrlEl: HTMLElement,
    controlName: string,
    dir: string,
    startEvent: MouseEvent
  ): void {
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startW = ctrlEl.offsetWidth;
    const startH = ctrlEl.offsetHeight;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW;
      let newH = startH;
      if (dir.includes('e')) newW = Math.max(4, startW + dx);
      if (dir.includes('w')) newW = Math.max(4, startW - dx);
      if (dir.includes('s')) newH = Math.max(4, startH + dy);
      if (dir.includes('n')) newH = Math.max(4, startH - dy);
      ctrlEl.style.width = `${newW}px`;
      ctrlEl.style.height = `${newH}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      // Commit the new size
      const w = ctrlEl.offsetWidth;
      const h = ctrlEl.offsetHeight;
      const ctrl = this.projectManager.getControl(this.currentFile!, controlName);
      if (ctrl) {
        ctrl.size = [w, h];
        this.projectManager.updateControl(this.currentFile!, controlName, ctrl);
      }
    };
    document.body.style.cursor =
      dir === 'nw' || dir === 'se' ? 'nwse-resize' :
      dir === 'ne' || dir === 'sw' ? 'nesw-resize' :
      dir === 'n' || dir === 's' ? 'ns-resize' : 'ew-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private highlightSelected(): void {
    const prev = this.container.querySelector('.preview-ctrl-selected');
    if (prev) {
      prev.classList.remove('preview-ctrl-selected');
      prev.querySelectorAll('.resize-handle').forEach(h => h.remove());
    }
    if (!this.selectedControl) return;
    const el = this.container.querySelector<HTMLElement>(`.preview-ctrl[data-name="${this.selectedControl}"]`);
    if (el) {
      el.classList.add('preview-ctrl-selected');
      this.addResizeHandles(el, this.selectedControl);
    }
  }

  private render3DView(
    pane: HTMLElement,
    preset: typeof SCREEN_PRESETS[number],
    preview: PreparedPreviewSource
  ): void {
    const controls3D = el('div', { className: 'view3d-controls' },
      el('button', {
        className: 'btn small',
        onclick: () => { this.rotX = -25; this.rotY = 35; this.render(); }
      }, t('view3d.resetCamera')),
      el('label', { style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary);' },
        t('view3d.layerSpacing'),
        el('input', {
          type: 'range',
          min: '10',
          max: '100',
          value: String(this.layerSpacing),
          style: 'width:80px;',
          oninput: (e: Event) => {
            this.layerSpacing = parseInt((e.target as HTMLInputElement).value);
            this.update3DTransform();
          }
        })
      )
    );
    pane.appendChild(controls3D);
    // 3D scene container
    const viewport = el('div', { className: 'view3d-viewport' });
    viewport.style.perspective = '1200px';
    const scene = el('div', { className: 'view3d-scene' });
    scene.style.transform = `rotateX(${this.rotX}deg) rotateY(${this.rotY}deg)`;
    // Render the 2D preview first to get the element tree
    const tempScreen = document.createElement('div');
    tempScreen.style.width = `${preset.w}px`;
    tempScreen.style.height = `${preset.h}px`;
    tempScreen.style.position = 'relative';
    const renderer = new PreviewRenderer(
      preview.textures,
      preview.globalVars,
      preview.fileDefs,
      preview.namespace,
      preview.allDefs,
      this.hiddenControls,
      true,
      this.showTextures,
      preview.mockData
    );
    renderer.render(tempScreen, preset.w, preset.h);
    const layers = this.flattenToLayers(tempScreen, 0);
    for (let i = 0; i < layers.length; i++) {
      const { element, depth, name } = layers[i];
      const layer = el('div', { className: 'view3d-layer' });
      layer.style.transform = `translateZ(${depth * this.layerSpacing}px)`;
      layer.style.width = `${preset.w}px`;
      layer.style.height = `${preset.h}px`;
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      layer.appendChild(clone);
      const label = el('div', { className: 'view3d-layer-label' }, name);
      layer.appendChild(label);
      scene.appendChild(layer);
    }
    viewport.appendChild(scene);
    pane.appendChild(viewport);
    this.setup3DRotation(viewport, scene);
  }

  private createPreviewInput(): PreparedPreviewSource {
    return buildPreviewSource({
      currentFilePath: this.currentFile!,
      customMockData: this.customMockData,
      mockMode: this.mockMode,
      previewBase: this.projectManager.getPreviewBase(),
      projectFiles: this.projectManager.getProject().files,
      projectGlobals: this.projectManager.getGlobalVariables() as Record<string, unknown>,
      projectTextures: this.projectManager.getTextures(),
    });
  }

  private openMockDataEditor(seed: PreviewMockData): void {
    const textarea = el('textarea', {
      className: 'raw-json-editor full',
      rows: '26',
      value: JSON.stringify(seed, null, 2),
    }) as HTMLTextAreaElement;
    const content = el('div', { className: 'mock-data-editor' },
      textarea,
      el('div', { className: 'mock-data-actions' },
        el('button', {
          className: 'btn primary',
          onclick: () => {
            try {
              this.customMockData = JSON.parse(textarea.value) as PreviewMockData;
              this.mockMode = 'custom';
              closeModal();
              this.render();
            } catch {
              showToast('Invalid JSON', 'error');
            }
          }
        }, t('common.save'))
      )
    );
    showModal(t('visual.mockEditor'), content);
  }

  private flattenToLayers(container: HTMLElement, depth: number): Array<{ element: HTMLElement; depth: number; name: string }> {
    const result: Array<{ element: HTMLElement; depth: number; name: string }> = [];
    const children = container.querySelectorAll<HTMLElement>(':scope > .preview-ctrl');
    children.forEach(child => {
      const name = child.dataset.name ?? 'unknown';
      result.push({ element: child, depth, name });
      // Recurse into children
      const nested = this.flattenToLayers(child, depth + 1);
      result.push(...nested);
    });
    return result;
  }

  private setup3DRotation(viewport: HTMLElement, scene: HTMLElement): void {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    viewport.addEventListener('mousedown', (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.style.cursor = 'grabbing';
    });

    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      this.rotY += dx * 0.5;
      this.rotX -= dy * 0.5;
      this.rotX = Math.max(-90, Math.min(90, this.rotX));
      scene.style.transform = `rotateX(${this.rotX}deg) rotateY(${this.rotY}deg)`;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
      viewport.style.cursor = 'grab';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    viewport.style.cursor = 'grab';
  }

  private update3DTransform(): void {
    const layers = this.container.querySelectorAll<HTMLElement>('.view3d-layer');
    const allLayers = Array.from(layers);
    // Recompute translateZ for each layer based on its index
    let i = 0;
    for (const layer of allLayers) {
      layer.style.transform = `translateZ(${i * this.layerSpacing}px)`;
      i++;
    }
  }

  private renderWelcome(): HTMLElement {
    return el('div', { className: 'visual-empty' },
      el('h2', {}, t('visual.welcome')),
      el('p', {}, t('visual.welcomeDesc')),
      el('div', { className: 'quick-actions' },
        el('button', {
          className: 'btn primary',
          onclick: () => this.events.emit('status:message', { text: 'Use File > Import to load a project', type: 'info' })
        }, t('visual.importProject')),
        el('button', {
          className: 'btn',
          onclick: () => {
            this.projectManager.newProject('New Project');
            const file = 'ui/main.json';
            this.projectManager.addFile(file, { namespace: 'main' });
            this.events.emit('file:selected', { filePath: file });
          }
        }, t('visual.newProject'))
      )
    );
  }

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
/**
 * FormBuilder — Drag-and-drop server_form builder for Minecraft Bedrock.
 * Designed to be usable by non-technical users (even kids).
 *
 * Layout: [Palette] | [Canvas] | [Properties]
 */

import { el, clearElement, showToast, showModal, closeModal } from '../shared/DomUtils';
import {
  type FormType,
  type FormElementType,
  type FormElement,
  createFormElement,
  generateCompleteForm,
  ELEMENT_DEFAULTS,
} from './FormCodeGen';
import { parseJsonc } from '../../core/JsoncParser';

/* ------------------------------------------------------------------ */
/*  Palette definitions                                                */
/* ------------------------------------------------------------------ */

interface PaletteItem {
  type: FormElementType;
  label: string;
  icon: string;
  color: string;
  description: string;
  /** Only available for these form types. undefined = all */
  forTypes?: FormType[];
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Universal elements
  { type: 'title',        label: 'Title',        icon: 'T̲',  color: '#f9e2af', description: 'Form title (uses #title_text)' },
  { type: 'header',       label: 'Header',       icon: 'H',  color: '#cba6f7', description: 'Section title, large text' },
  { type: 'label',        label: 'Label',        icon: 'T',  color: '#a6e3a1', description: 'Text label' },
  { type: 'body',         label: 'Body Text',    icon: '¶',  color: '#94e2d5', description: 'Form body text (from server)' },
  { type: 'divider',      label: 'Divider',      icon: '—',  color: '#6c7086', description: 'Horizontal separator line' },
  { type: 'button',       label: 'Button',       icon: '▣',  color: '#89b4fa', description: 'Clickable action button' },
  { type: 'image',        label: 'Image',        icon: '🖼', color: '#f5c2e7', description: 'Image or icon' },
  { type: 'panel',        label: 'Panel',        icon: '☐',  color: '#585b70', description: 'Container — drop elements inside' },
  { type: 'scroll_panel', label: 'Scroll Panel', icon: '⇕',  color: '#74c7ec', description: 'Scrollable container' },
  { type: 'stack_panel',  label: 'Stack Panel',  icon: '⊞',  color: '#89dceb', description: 'Stack children vertically or horizontally' },
  { type: 'grid',         label: 'Grid',         icon: '⊟',  color: '#89b4fa', description: 'Arrange children in a grid layout' },
  { type: 'close_button', label: 'Close Button', icon: '✕',  color: '#f38ba8', description: 'Close / exit button' },
  // Modal-only elements
  { type: 'dropdown',     label: 'Dropdown',     icon: '▾',  color: '#fab387', description: 'Dropdown selector',       forTypes: ['modal'] },
  { type: 'slider',       label: 'Slider',       icon: '⊟',  color: '#f9e2af', description: 'Value slider',            forTypes: ['modal'] },
  { type: 'toggle',       label: 'Toggle',       icon: '⊙',  color: '#a6e3a1', description: 'On/off toggle switch',    forTypes: ['modal'] },
  { type: 'text_input',   label: 'Text Input',   icon: '⌨',  color: '#74c7ec', description: 'Text input field',        forTypes: ['modal'] },
];

/* ------------------------------------------------------------------ */
/*  FormBuilder class                                                  */
/* ------------------------------------------------------------------ */

export class FormBuilder {
  private readonly container: HTMLElement;

  // State
  private formType: FormType | null = null;
  private formName = '';
  private elements: FormElement[] = [];
  private selectedElementId: string | null = null;
  private draggedPaletteType: FormElementType | null = null;
  private draggedElementId: string | null = null;
  private canvasWidth = 460;
  private canvasHeight = 520;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
  }

  /** Render the form builder */
  render(): void {
    clearElement(this.container);

    if (!this.formType) {
      this.renderTypeSelection();
    } else {
      this.renderBuilder();
    }
  }

  /* ================================================================ */
  /*  Phase 1: Form type selection                                     */
  /* ================================================================ */

  private renderTypeSelection(): void {
    const page = el('div', { className: 'fb-type-selection' },
      el('div', { className: 'fb-type-header' },
        el('h1', {}, '🎮 Form Builder'),
        el('p', { className: 'fb-type-subtitle' }, 'Create custom server forms for Minecraft Bedrock — just drag and drop!')
      ),
      el('div', { className: 'fb-type-cards' },
        // Action Form card
        el('div', {
          className: 'fb-type-card fb-card-action',
          onclick: () => this.selectFormType('action'),
        },
          el('div', { className: 'fb-card-icon' }, '📋'),
          el('h2', {}, 'Action Form'),
          el('p', {}, 'Buttons, text, and images'),
          el('ul', {},
            el('li', {}, '✔ Buttons'),
            el('li', {}, '✔ Body text'),
            el('li', {}, '✔ Labels & headers'),
            el('li', {}, '✔ Dividers'),
            el('li', {}, '✔ Images'),
          ),
        ),
        // Modal Form card
        el('div', {
          className: 'fb-type-card fb-card-modal',
          onclick: () => this.selectFormType('modal'),
        },
          el('div', { className: 'fb-card-icon' }, '⚙️'),
          el('h2', {}, 'Modal Form'),
          el('p', {}, 'Inputs, sliders, toggles + everything above'),
          el('ul', {},
            el('li', {}, '✔ Everything from Action Form'),
            el('li', {}, '✔ Dropdowns'),
            el('li', {}, '✔ Sliders'),
            el('li', {}, '✔ Toggles'),
            el('li', {}, '✔ Text inputs'),
          ),
        ),
      ),
    );
    this.container.appendChild(page);
  }

  private selectFormType(type: FormType): void {
    this.formType = type;
    this.formName = type === 'action' ? 'my_action_form' : 'my_modal_form';
    this.elements = [];
    this.selectedElementId = null;
    this.render();
  }

  /* ================================================================ */
  /*  Phase 2: The builder layout                                      */
  /* ================================================================ */

  private renderBuilder(): void {
    const layout = el('div', { className: 'fb-layout' });

    // Left: Palette
    layout.appendChild(this.renderPalette());

    // Center: Canvas
    layout.appendChild(this.renderCanvas());

    // Right: Properties
    layout.appendChild(this.renderProperties());

    this.container.appendChild(layout);
  }

  /* ================================================================ */
  /*  Palette                                                          */
  /* ================================================================ */

  private renderPalette(): HTMLElement {
    const palette = el('div', { className: 'fb-palette' });

    palette.appendChild(
      el('div', { className: 'fb-palette-header' },
        el('span', {}, '🧩 Elements'),
      ),
    );

    const items = PALETTE_ITEMS.filter(item =>
      !item.forTypes || item.forTypes.includes(this.formType!)
    );

    for (const item of items) {
      const paletteEl = el('div', {
        className: 'fb-palette-item',
        draggable: 'true',
        title: item.description,
        ondragstart: (e: DragEvent) => {
          this.draggedPaletteType = item.type;
          this.draggedElementId = null;
          e.dataTransfer!.effectAllowed = 'copy';
          e.dataTransfer!.setData('text/plain', item.type);
          (e.currentTarget as HTMLElement).classList.add('dragging');
        },
        ondragend: (e: DragEvent) => {
          this.draggedPaletteType = null;
          (e.currentTarget as HTMLElement).classList.remove('dragging');
        },
      },
        el('span', {
          className: 'fb-palette-icon',
          style: `background: ${item.color}20; color: ${item.color}; border-color: ${item.color}40;`,
        }, item.icon),
        el('div', { className: 'fb-palette-label' },
          el('span', { className: 'fb-palette-name' }, item.label),
          el('span', { className: 'fb-palette-desc' }, item.description),
        ),
      );
      palette.appendChild(paletteEl);
    }

    // Back button
    palette.appendChild(
      el('div', { className: 'fb-palette-footer' },
        el('button', {
          className: 'btn',
          onclick: () => {
            this.formType = null;
            this.render();
          },
        }, '← Back'),
      ),
    );

    return palette;
  }

  /* ================================================================ */
  /*  Canvas                                                           */
  /* ================================================================ */

  private renderCanvas(): HTMLElement {
    const canvasContainer = el('div', { className: 'fb-canvas-container' });

    // Top toolbar
    const toolbar = el('div', { className: 'fb-canvas-toolbar' },
      el('div', { className: 'fb-form-name-group' },
        el('label', {}, 'Form name:'),
        el('input', {
          type: 'text',
          value: this.formName,
          className: 'fb-form-name-input',
          placeholder: 'my_form_name',
          oninput: (e: Event) => {
            this.formName = (e.target as HTMLInputElement).value.trim() || 'my_form';
          },
          onblur: () => this.render(),
        }),
        el('span', { className: 'fb-form-type-badge' },
          this.formType === 'action' ? '📋 Action' : '⚙️ Modal'
        ),
      ),
      el('div', { className: 'fb-canvas-actions' },
        el('button', {
          className: 'btn',
          onclick: () => this.clearAll(),
        }, '🗑 Clear'),
        el('label', { className: 'btn' },
          '📂 Import JSON',
          el('input', {
            type: 'file',
            accept: '.json',
            className: 'hidden-input',
            onchange: (e: Event) => this.handleImportJSON(e),
          }),
        ),
        el('button', {
          className: 'btn primary',
          onclick: () => this.exportForm(),
        }, '📦 Export JSON'),
      ),
    );
    canvasContainer.appendChild(toolbar);

    // The canvas area
    const canvasScroll = el('div', { className: 'fb-canvas-scroll' });
    const canvas = el('div', { className: 'fb-canvas' });

    // The form preview
    const formPreview = el('div', {
      className: 'fb-form-preview',
      style: `width: ${this.canvasWidth}px; min-height: ${this.canvasHeight}px;`,
    });

    // Form title bar
    formPreview.appendChild(
      el('div', { className: 'fb-form-title-bar' },
        el('span', { className: 'fb-form-title-text' }, this.formName || 'My Form'),
      ),
    );

    // Form body — the drop zone
    const formBody = el('div', {
      className: 'fb-form-body',
      style: `min-height: ${this.canvasHeight - 44}px;`,
      ondragover: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = this.draggedPaletteType ? 'copy' : 'move';
        formBody.classList.add('fb-drop-active');
      },
      ondragleave: (e: DragEvent) => {
        // Only remove if leaving the actual element
        if (!formBody.contains(e.relatedTarget as Node)) {
          formBody.classList.remove('fb-drop-active');
        }
      },
      ondrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        formBody.classList.remove('fb-drop-active');
        const rect = formBody.getBoundingClientRect();
        const posX = Math.max(0, e.clientX - rect.left - 20);
        const posY = Math.max(0, e.clientY - rect.top - 10);
        this.handleCanvasDrop(null, posX, posY);
      },
    });

    if (this.elements.length === 0) {
      formBody.appendChild(
        el('div', { className: 'fb-drop-hint' },
          el('span', { className: 'fb-drop-hint-icon' }, '⬇'),
          el('span', {}, 'Drag elements here'),
        ),
      );
    } else {
      for (let i = 0; i < this.elements.length; i++) {
        formBody.appendChild(this.renderCanvasElement(this.elements[i], i, null));
      }
    }

    formPreview.appendChild(formBody);

    // Canvas resize handle (bottom-right corner)
    const canvasResizeHandle = el('div', { className: 'fb-canvas-resize-handle', title: 'Drag to resize canvas' });
    canvasResizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = this.canvasWidth;
      const startH = this.canvasHeight;
      document.body.style.cursor = 'nwse-resize';
      const onMove = (ev: MouseEvent) => {
        this.canvasWidth = Math.max(300, startW + ev.clientX - startX);
        this.canvasHeight = Math.max(200, startH + ev.clientY - startY);
        formPreview.style.width = `${this.canvasWidth}px`;
        formPreview.style.minHeight = `${this.canvasHeight}px`;
        formBody.style.minHeight = `${this.canvasHeight - 44}px`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    formPreview.appendChild(canvasResizeHandle);

    canvas.appendChild(formPreview);
    canvasScroll.appendChild(canvas);
    canvasContainer.appendChild(canvasScroll);

    return canvasContainer;
  }

  private renderCanvasElement(
    element: FormElement,
    _index: number,
    parentId: string | null,
    parentType: FormElementType | null = null
  ): HTMLElement {
    const isSelected = this.selectedElementId === element.id;
    const isContainer = element.type === 'panel' || element.type === 'scroll_panel'
      || element.type === 'stack_panel' || element.type === 'grid';
    // Elements inside a panel (or top-level) can be freely repositioned
    const isFreePositioned = parentType === null || parentType === 'panel';

    // Auto-assign position for free-positioned elements that don't have one
    if (isFreePositioned && element.posX === undefined) element.posX = 10;
    if (isFreePositioned && element.posY === undefined) element.posY = 10 + _index * (element.height + 14);

    const baseStyle = isFreePositioned
      ? `width: ${element.width}px; min-height: ${element.height}px; position: absolute; left: ${element.posX}px; top: ${element.posY}px;`
      : `width: ${element.width}px; min-height: ${element.height}px;`;

    const wrapper = el('div', {
      className: `fb-canvas-element fb-el-${element.type}${isSelected ? ' fb-selected' : ''}${isFreePositioned ? ' fb-top-level' : ''}`,
      style: baseStyle,
      draggable: 'true',
      onclick: (e: Event) => {
        e.stopPropagation();
        this.selectedElementId = element.id;
        this.render();
      },
      ondragstart: (e: DragEvent) => {
        e.stopPropagation();
        this.draggedElementId = element.id;
        this.draggedPaletteType = null;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', element.id);
        setTimeout(() => (e.target as HTMLElement).classList.add('fb-dragging'), 0);
      },
      ondragend: (e: DragEvent) => {
        this.draggedElementId = null;
        (e.currentTarget as HTMLElement).classList.remove('fb-dragging');
      },
      ondragover: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.draggedElementId !== element.id) {
          (e.currentTarget as HTMLElement).classList.add('fb-drag-over');
        }
      },
      ondragleave: (e: DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('fb-drag-over');
      },
      ondrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).classList.remove('fb-drag-over');
        if (isContainer) {
          this.handleCanvasDrop(element.id);
        } else {
          // Reorder: drop before this element
          this.handleReorderDrop(element.id, parentId);
        }
      },
    });

    // Drag handle — shown for all free-positioned elements (top-level and inside panels)
    if (isFreePositioned) {
      const dragHandle = el('div', { className: 'fb-drag-handle', title: 'Drag to reposition' });
      dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedElementId = element.id;
        const startX = e.clientX;
        const startY = e.clientY;
        const startPosX = element.posX!;
        const startPosY = element.posY!;
        document.body.style.cursor = 'grabbing';
        wrapper.style.zIndex = '10';

        const onMove = (ev: MouseEvent) => {
          element.posX = Math.max(0, startPosX + ev.clientX - startX);
          element.posY = Math.max(0, startPosY + ev.clientY - startY);
          wrapper.style.left = `${element.posX}px`;
          wrapper.style.top = `${element.posY}px`;
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.cursor = '';
          wrapper.style.zIndex = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      wrapper.appendChild(dragHandle);
    }

    // Element visual content
    const content = this.renderElementVisual(element);
    wrapper.appendChild(content);

    // Move buttons
    const moveBar = el('div', { className: 'fb-element-move' },
      el('button', {
        className: 'fb-move-btn',
        title: 'Move up',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.moveElement(element.id, parentId, -1);
        },
      }, '▲'),
      el('button', {
        className: 'fb-move-btn',
        title: 'Move down',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.moveElement(element.id, parentId, 1);
        },
      }, '▼'),
      el('button', {
        className: 'fb-move-btn fb-delete-btn',
        title: 'Delete',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.removeElement(element.id, parentId);
        },
      }, '✕'),
    );
    wrapper.appendChild(moveBar);

    // Resize handles for selected element
    if (isSelected) {
      this.addCanvasResizeHandles(wrapper, element);
    }

    // Container children
    if (isContainer) {
      // Determine child layout class based on container type
      const isFreeChildLayout = element.type === 'panel';
      const childLayoutClass = isFreeChildLayout ? 'fb-children-free'
        : element.type === 'grid' ? 'fb-children-grid'
        : 'fb-children-stack';
      const childZoneStyle = isFreeChildLayout
        ? `min-height: ${element.height}px;`
        : element.type === 'stack_panel' && element.orientation === 'horizontal'
          ? 'flex-direction: row; flex-wrap: wrap;'
          : element.type === 'grid'
            ? `grid-template-columns: repeat(${element.gridColumns ?? 3}, 1fr);`
            : '';

      const childZone = el('div', {
        className: `fb-container-children ${childLayoutClass}`,
        style: childZoneStyle,
        ondragover: (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer!.dropEffect = this.draggedPaletteType ? 'copy' : 'move';
          childZone.classList.add('fb-drop-active');
        },
        ondragleave: (e: DragEvent) => {
          if (!childZone.contains(e.relatedTarget as Node)) {
            childZone.classList.remove('fb-drop-active');
          }
        },
        ondrop: (e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          childZone.classList.remove('fb-drop-active');
          if (isFreeChildLayout) {
            const rect = childZone.getBoundingClientRect();
            this.handleCanvasDrop(element.id, Math.max(0, e.clientX - rect.left - 20), Math.max(0, e.clientY - rect.top - 10));
          } else {
            this.handleCanvasDrop(element.id);
          }
        },
      });

      if (element.children.length === 0) {
        childZone.appendChild(
          el('div', { className: 'fb-drop-hint small' },
            el('span', {}, 'Drop inside'),
          ),
        );
      } else {
        for (let i = 0; i < element.children.length; i++) {
          childZone.appendChild(this.renderCanvasElement(
            element.children[i], i, element.id, element.type
          ));
        }
      }
      wrapper.appendChild(childZone);
    }

    return wrapper;
  }

  private renderElementVisual(element: FormElement): HTMLElement {
    const paletteItem = PALETTE_ITEMS.find(p => p.type === element.type);
    const color = paletteItem?.color ?? '#585b70';

    switch (element.type) {
      case 'header':
        return el('div', { className: 'fb-vis-header' },
          el('span', { style: `color: ${color}` }, element.text || 'Header'),
        );
      case 'title':
        return el('div', { className: 'fb-vis-header fb-vis-title' },
          el('span', { style: `color: ${color}` }, element.text || '[Form Title]'),
          el('span', { className: 'fb-vis-binding-tag' }, '#title_text'),
        );
      case 'label':
        return el('div', { className: 'fb-vis-label' },
          el('span', {}, element.text || 'Label text'),
        );
      case 'body':
        return el('div', { className: 'fb-vis-body' },
          el('span', {}, element.text || 'Body text (from server)'),
        );
      case 'button':
        return el('div', { className: 'fb-vis-button' },
          el('span', {}, element.text || 'Button'),
        );
      case 'divider':
        return el('div', { className: 'fb-vis-divider' });
      case 'image':
        return el('div', { className: 'fb-vis-image' },
          el('span', {}, element.texture ? element.texture.split('/').pop()! : '🖼 Image'),
        );
      case 'close_button':
        return el('div', { className: 'fb-vis-close' }, el('span', {}, '✕'));
      case 'panel':
        return el('div', { className: 'fb-vis-container' },
          el('span', { className: 'fb-vis-container-label', style: `color: ${color}` }, '☐ Panel'),
        );
      case 'scroll_panel':
        return el('div', { className: 'fb-vis-container' },
          el('span', { className: 'fb-vis-container-label', style: `color: ${color}` }, '⇕ Scroll Panel'),
        );
      case 'stack_panel':
        return el('div', { className: 'fb-vis-container' },
          el('span', { className: 'fb-vis-container-label', style: `color: ${color}` },
            `⊞ Stack (${element.orientation ?? 'vertical'})`),
        );
      case 'grid':
        return el('div', { className: 'fb-vis-container' },
          el('span', { className: 'fb-vis-container-label', style: `color: ${color}` },
            `⊟ Grid ${element.gridColumns ?? 3}×${element.gridRows ?? 3}`),
        );
      case 'dropdown':
        return el('div', { className: 'fb-vis-dropdown' },
          el('span', {}, element.text || 'Select...'),
          el('span', { className: 'fb-vis-dropdown-arrow' }, '▾'),
        );
      case 'slider':
        return el('div', { className: 'fb-vis-slider' },
          el('span', { className: 'fb-vis-slider-label' }, element.text || 'Slider'),
          el('div', { className: 'fb-vis-slider-track' },
            el('div', { className: 'fb-vis-slider-fill' }),
            el('div', { className: 'fb-vis-slider-thumb' }),
          ),
        );
      case 'toggle':
        return el('div', { className: 'fb-vis-toggle' },
          el('span', {}, element.text || 'Toggle'),
          el('div', { className: 'fb-vis-toggle-switch' },
            el('div', { className: 'fb-vis-toggle-knob' }),
          ),
        );
      case 'text_input':
        return el('div', { className: 'fb-vis-textinput' },
          el('span', {}, element.text || 'Type here...'),
        );
      default:
        return el('div', {}, element.type);
    }
  }

  private addCanvasResizeHandles(wrapper: HTMLElement, element: FormElement): void {
    const handle = el('div', { className: 'fb-resize-handle fb-resize-se' });
    let startX = 0;
    let startY = 0;
    let startW = element.width;
    let startH = element.height;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = element.width;
      startH = element.height;

      const onMove = (ev: MouseEvent) => {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        element.width = Math.max(20, startW + dx);
        element.height = Math.max(4, startH + dy);
        wrapper.style.width = `${element.width}px`;
        wrapper.style.minHeight = `${element.height}px`;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        this.render();
      };

      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    wrapper.appendChild(handle);
  }

  /* ================================================================ */
  /*  Properties panel                                                 */
  /* ================================================================ */

  private renderProperties(): HTMLElement {
    const panel = el('div', { className: 'fb-properties' });

    panel.appendChild(
      el('div', { className: 'fb-properties-header' },
        el('span', {}, '⚙ Properties'),
      ),
    );

    const selected = this.findElement(this.selectedElementId);
    if (!selected) {
      panel.appendChild(
        el('div', { className: 'fb-props-empty' },
          el('span', {}, 'Click an element on the canvas to edit its properties'),
        ),
      );
      return panel;
    }

    const paletteItem = PALETTE_ITEMS.find(p => p.type === selected.type);
    const body = el('div', { className: 'fb-props-body' });

    // Type badge
    body.appendChild(
      el('div', { className: 'fb-prop-type' },
        el('span', {
          className: 'fb-prop-type-badge',
          style: `background: ${paletteItem?.color ?? '#585b70'}30; color: ${paletteItem?.color ?? '#cdd6f4'}; border-color: ${paletteItem?.color ?? '#585b70'}50;`,
        }, `${paletteItem?.icon ?? '?'} ${paletteItem?.label ?? selected.type}`),
      ),
    );

    // Text property (for text-bearing elements)
    if (['label', 'header', 'body', 'button', 'dropdown', 'slider', 'toggle', 'text_input'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'Text',
        'text',
        el('input', {
          type: 'text',
          value: selected.text,
          className: 'fb-prop-input',
          placeholder: 'Enter text...',
          oninput: (e: Event) => {
            selected.text = (e.target as HTMLInputElement).value;
          },
          onblur: () => this.render(),
        }),
      ));
    }

    // Texture path (for images)
    if (selected.type === 'image') {
      body.appendChild(this.renderPropField(
        'Texture Path',
        'texture',
        el('input', {
          type: 'text',
          value: selected.texture ?? '',
          className: 'fb-prop-input',
          placeholder: 'textures/ui/my_image',
          oninput: (e: Event) => {
            selected.texture = (e.target as HTMLInputElement).value;
          },
          onblur: () => this.render(),
        }),
      ));
    }

    // Size
    body.appendChild(this.renderPropField(
      'Width',
      'width',
      el('input', {
        type: 'range',
        min: '20',
        max: '400',
        value: String(selected.width),
        className: 'fb-prop-slider',
        oninput: (e: Event) => {
          selected.width = parseInt((e.target as HTMLInputElement).value);
          const suffix = (e.target as HTMLElement).parentElement?.querySelector('.fb-prop-suffix');
          if (suffix) suffix.textContent = `${selected.width}px`;
        },
        onchange: () => this.render(),
      }),
      `${selected.width}px`,
    ));

    body.appendChild(this.renderPropField(
      'Height',
      'height',
      el('input', {
        type: 'range',
        min: '2',
        max: '200',
        value: String(selected.height),
        className: 'fb-prop-slider',
        oninput: (e: Event) => {
          selected.height = parseInt((e.target as HTMLInputElement).value);
          const suffix = (e.target as HTMLElement).parentElement?.querySelector('.fb-prop-suffix');
          if (suffix) suffix.textContent = `${selected.height}px`;
        },
        onchange: () => this.render(),
      }),
      `${selected.height}px`,
    ));

    // Layout options for stack_panel
    if (selected.type === 'stack_panel') {
      body.appendChild(this.renderPropField(
        'Orientation',
        'orientation',
        el('select', {
          className: 'fb-prop-input',
          onchange: (e: Event) => {
            selected.orientation = (e.target as HTMLSelectElement).value as 'vertical' | 'horizontal';
            this.render();
          },
        },
          el('option', { value: 'vertical',   selected: !selected.orientation || selected.orientation === 'vertical' },   'Vertical'),
          el('option', { value: 'horizontal', selected: selected.orientation === 'horizontal' }, 'Horizontal'),
        ),
      ));
    }

    // Layout options for grid
    if (selected.type === 'grid') {
      body.appendChild(this.renderPropField(
        'Columns',
        'gridColumns',
        el('input', {
          type: 'number', min: '1', max: '20',
          value: String(selected.gridColumns ?? 3),
          className: 'fb-prop-input',
          oninput: (e: Event) => { selected.gridColumns = parseInt((e.target as HTMLInputElement).value) || 3; },
          onblur: () => this.render(),
        }),
      ));
      body.appendChild(this.renderPropField(
        'Rows',
        'gridRows',
        el('input', {
          type: 'number', min: '1', max: '20',
          value: String(selected.gridRows ?? 3),
          className: 'fb-prop-input',
          oninput: (e: Event) => { selected.gridRows = parseInt((e.target as HTMLInputElement).value) || 3; },
          onblur: () => this.render(),
        }),
      ));
    }

    // Anchor From
    body.appendChild(this.renderPropField(
      'Anchor From',
      'anchorFrom',
      this.createAnchorSelect(selected.anchorFrom ?? '', (v) => { selected.anchorFrom = v || undefined; this.render(); }),
    ));

    // Anchor To
    body.appendChild(this.renderPropField(
      'Anchor To',
      'anchorTo',
      this.createAnchorSelect(selected.anchorTo ?? '', (v) => { selected.anchorTo = v || undefined; this.render(); }),
    ));

    // Offset X/Y
    body.appendChild(this.renderPropField(
      'Offset X',
      'offsetX',
      el('input', {
        type: 'number',
        value: String(selected.offsetX ?? 0),
        className: 'fb-prop-input',
        oninput: (e: Event) => {
          selected.offsetX = parseInt((e.target as HTMLInputElement).value) || 0;
        },
        onblur: () => this.render(),
      }),
    ));

    body.appendChild(this.renderPropField(
      'Offset Y',
      'offsetY',
      el('input', {
        type: 'number',
        value: String(selected.offsetY ?? 0),
        className: 'fb-prop-input',
        oninput: (e: Event) => {
          selected.offsetY = parseInt((e.target as HTMLInputElement).value) || 0;
        },
        onblur: () => this.render(),
      }),
    ));

    // Font size (for text elements)
    if (['label', 'header', 'button'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'Font Size',
        'fontSize',
        el('select', {
          className: 'fb-prop-input',
          onchange: (e: Event) => {
            selected.fontSize = (e.target as HTMLSelectElement).value as FormElement['fontSize'];
            this.render();
          },
        },
          el('option', { value: 'small', selected: selected.fontSize === 'small' }, 'Small'),
          el('option', { value: 'normal', selected: !selected.fontSize || selected.fontSize === 'normal' }, 'Normal'),
          el('option', { value: 'large', selected: selected.fontSize === 'large' }, 'Large'),
          el('option', { value: 'extra_large', selected: selected.fontSize === 'extra_large' }, 'Extra Large'),
        ),
      ));
    }

    // Text Alignment
    if (['label', 'header', 'body', 'button'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'Text Align',
        'textAlignment',
        el('select', {
          className: 'fb-prop-input',
          onchange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            selected.textAlignment = v || undefined;
            this.render();
          },
        },
          el('option', { value: '', selected: !selected.textAlignment }, 'Auto'),
          el('option', { value: 'left', selected: selected.textAlignment === 'left' }, 'Left'),
          el('option', { value: 'center', selected: selected.textAlignment === 'center' }, 'Center'),
          el('option', { value: 'right', selected: selected.textAlignment === 'right' }, 'Right'),
        ),
      ));
    }

    // Shadow
    if (['label', 'header', 'body', 'button'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'Text Shadow',
        'shadow',
        el('select', {
          className: 'fb-prop-input',
          onchange: (e: Event) => {
            selected.shadow = (e.target as HTMLSelectElement).value === 'true';
            this.render();
          },
        },
          el('option', { value: 'false', selected: !selected.shadow }, 'Off'),
          el('option', { value: 'true', selected: !!selected.shadow }, 'On'),
        ),
      ));
    }

    // Color picker
    if (['label', 'header', 'body', 'divider', 'button'].includes(selected.type)) {
      const currentColor = selected.color ?? [1, 1, 1];
      const hexColor = rgbToHex(currentColor);
      body.appendChild(this.renderPropField(
        'Color',
        'color',
        el('input', {
          type: 'color',
          value: hexColor,
          className: 'fb-prop-color',
          onchange: (e: Event) => {
            selected.color = hexToRgb((e.target as HTMLInputElement).value);
            this.render();
          },
        }),
      ));
    }

    // Background Texture (for text elements + buttons)
    if (['label', 'header', 'body', 'button'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'BG Texture',
        'bgTexture',
        el('input', {
          type: 'text',
          value: selected.type === 'button' ? (selected.buttonTexture ?? '') : (selected.bgTexture ?? ''),
          className: 'fb-prop-input',
          placeholder: 'textures/ui/my_bg',
          oninput: (e: Event) => {
            const v = (e.target as HTMLInputElement).value || undefined;
            if (selected.type === 'button') {
              selected.buttonTexture = v;
            } else {
              selected.bgTexture = v;
            }
          },
          onblur: () => this.render(),
        }),
      ));

      // Hover texture for buttons
      if (selected.type === 'button') {
        body.appendChild(this.renderPropField(
          'Hover Texture',
          'buttonHoverTexture',
          el('input', {
            type: 'text',
            value: selected.buttonHoverTexture ?? '',
            className: 'fb-prop-input',
            placeholder: 'textures/ui/my_hover',
            oninput: (e: Event) => {
              selected.buttonHoverTexture = (e.target as HTMLInputElement).value || undefined;
            },
            onblur: () => this.render(),
          }),
        ));
      }

      // Collection mode for buttons — wraps in collection_panel so
      // button.form_button_click sends the correct index to the server.
      if (selected.type === 'button') {
        const useCol = selected.useCollection !== false; // default true
        body.appendChild(this.renderPropField(
          'Form Button',
          'useCollection',
          el('select', {
            className: 'fb-prop-input',
            onchange: (e: Event) => {
              selected.useCollection = (e.target as HTMLSelectElement).value === 'true';
              this.render();
            },
          },
            el('option', { value: 'true',  selected: useCol  }, 'Yes (w/ collection)'),
            el('option', { value: 'false', selected: !useCol }, 'No (standalone)'),
          ),
        ));

        if (useCol) {
          body.appendChild(this.renderPropField(
            'Collection',
            'collectionName',
            el('input', {
              type: 'text',
              value: selected.collectionName ?? 'form_buttons',
              className: 'fb-prop-input',
              placeholder: 'form_buttons',
              oninput: (e: Event) => {
                selected.collectionName = (e.target as HTMLInputElement).value || 'form_buttons';
              },
              onblur: () => this.render(),
            }),
          ));
        }
      }

      // Nineslice Size (for bg textures)
      if (selected.type !== 'button' ? selected.bgTexture : selected.buttonTexture) {
        body.appendChild(this.renderPropField(
          'Nineslice',
          'ninesliceSize',
          el('input', {
            type: 'number',
            value: String(selected.ninesliceSize ?? ''),
            className: 'fb-prop-input',
            placeholder: 'e.g. 4',
            min: '0',
            max: '64',
            oninput: (e: Event) => {
              const v = parseInt((e.target as HTMLInputElement).value);
              selected.ninesliceSize = isNaN(v) ? undefined : v;
            },
            onblur: () => this.render(),
          }),
        ));
      }
    }

    // Use Binding toggle (for text elements)
    if (['label', 'header'].includes(selected.type)) {
      body.appendChild(this.renderPropField(
        'Use Binding',
        'useBinding',
        el('select', {
          className: 'fb-prop-input',
          onchange: (e: Event) => {
            selected.useBinding = (e.target as HTMLSelectElement).value === 'true';
            this.render();
          },
        },
          el('option', { value: 'false', selected: !selected.useBinding }, 'Hardcoded text'),
          el('option', { value: 'true', selected: !!selected.useBinding }, 'From binding'),
        ),
      ));

      if (selected.useBinding) {
        body.appendChild(this.renderPropField(
          'Binding Name',
          'bindingName',
          el('input', {
            type: 'text',
            value: selected.bindingName ?? '#title_text',
            className: 'fb-prop-input',
            placeholder: '#title_text',
            oninput: (e: Event) => {
              selected.bindingName = (e.target as HTMLInputElement).value;
            },
            onblur: () => this.render(),
          }),
        ));
      }
    }

    // Nineslice for images
    if (selected.type === 'image') {
      body.appendChild(this.renderPropField(
        'Nineslice',
        'ninesliceSize',
        el('input', {
          type: 'number',
          value: String(selected.ninesliceSize ?? ''),
          className: 'fb-prop-input',
          placeholder: 'e.g. 4',
          min: '0',
          max: '64',
          oninput: (e: Event) => {
            const v = parseInt((e.target as HTMLInputElement).value);
            selected.ninesliceSize = isNaN(v) ? undefined : v;
          },
          onblur: () => this.render(),
        }),
      ));
    }

    // Slider steps
    if (selected.type === 'slider') {
      body.appendChild(this.renderPropField(
        'Steps',
        'steps',
        el('input', {
          type: 'number',
          value: String(selected.sliderSteps ?? 10),
          className: 'fb-prop-input',
          min: '2',
          max: '100',
          oninput: (e: Event) => {
            selected.sliderSteps = parseInt((e.target as HTMLInputElement).value) || 10;
          },
          onblur: () => this.render(),
        }),
      ));
    }

    // Max length for text input
    if (selected.type === 'text_input') {
      body.appendChild(this.renderPropField(
        'Max Length',
        'maxLength',
        el('input', {
          type: 'number',
          value: String(selected.maxLength ?? 256),
          className: 'fb-prop-input',
          min: '1',
          max: '1000',
          oninput: (e: Event) => {
            selected.maxLength = parseInt((e.target as HTMLInputElement).value) || 256;
          },
          onblur: () => this.render(),
        }),
      ));
    }

    panel.appendChild(body);

    // JSON preview button
    panel.appendChild(
      el('div', { className: 'fb-props-preview' },
        el('button', {
          className: 'btn small',
          onclick: () => this.previewElementJSON(selected),
        }, '{ } View JSON'),
      ),
    );

    return panel;
  }

  private renderPropField(
    label: string,
    _key: string,
    input: HTMLElement,
    suffix?: string
  ): HTMLElement {
    return el('div', { className: 'fb-prop-row' },
      el('label', { className: 'fb-prop-label' }, label),
      el('div', { className: 'fb-prop-value' },
        input,
        suffix ? el('span', { className: 'fb-prop-suffix' }, suffix) : null,
      ),
    );
  }

  private createAnchorSelect(current: string, onChange: (v: string) => void): HTMLElement {
    const anchors = ['', 'top_left', 'top_middle', 'top_right', 'left_middle', 'center', 'right_middle', 'bottom_left', 'bottom_middle', 'bottom_right'];
    const labels = ['Auto', 'Top Left', 'Top Middle', 'Top Right', 'Left Middle', 'Center', 'Right Middle', 'Bottom Left', 'Bottom Middle', 'Bottom Right'];
    return el('select', {
      className: 'fb-prop-input',
      onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
    }, ...anchors.map((a, i) =>
      el('option', { value: a, selected: current === a }, labels[i])
    ));
  }

  /* ================================================================ */
  /*  Element operations                                               */
  /* ================================================================ */

  private handleCanvasDrop(targetContainerId: string | null, posX?: number, posY?: number): void {
    if (this.draggedPaletteType) {
      // New element from palette
      const newEl = createFormElement(this.draggedPaletteType);
      if (posX !== undefined && posY !== undefined) {
        newEl.posX = posX;
        newEl.posY = posY;
      }
      if (targetContainerId) {
        const container = this.findElement(targetContainerId);
        if (container) container.children.push(newEl);
      } else {
        this.elements.push(newEl);
      }
      this.selectedElementId = newEl.id;
      this.draggedPaletteType = null;
      this.render();
    } else if (this.draggedElementId) {
      // Move existing element into container
      if (this.draggedElementId === targetContainerId) return;
      const el = this.findElement(this.draggedElementId);
      if (!el) return;
      // Prevent dropping into own children
      if (targetContainerId && this.isDescendant(this.draggedElementId, targetContainerId)) return;
      this.removeElementFromTree(this.draggedElementId);
      if (targetContainerId) {
        const container = this.findElement(targetContainerId);
        if (container) container.children.push(el);
      } else {
        this.elements.push(el);
      }
      this.draggedElementId = null;
      this.render();
    }
  }

  private handleReorderDrop(beforeElementId: string, parentId: string | null): void {
    if (!this.draggedElementId && !this.draggedPaletteType) return;

    let targetEl: FormElement;
    if (this.draggedPaletteType) {
      targetEl = createFormElement(this.draggedPaletteType);
      this.draggedPaletteType = null;
    } else if (this.draggedElementId) {
      if (this.draggedElementId === beforeElementId) return;
      const found = this.findElement(this.draggedElementId);
      if (!found) return;
      this.removeElementFromTree(this.draggedElementId);
      targetEl = found;
      this.draggedElementId = null;
    } else {
      return;
    }

    // Insert before the target element
    const siblings = parentId ? this.findElement(parentId)?.children : this.elements;
    if (!siblings) return;
    const idx = siblings.findIndex((e: { id: string; }) => e.id === beforeElementId);
    if (idx >= 0) {
      siblings.splice(idx, 0, targetEl);
    } else {
      siblings.push(targetEl);
    }
    this.selectedElementId = targetEl.id;
    this.render();
  }

  private removeElement(id: string, _parentId: string | null): void {
    this.removeElementFromTree(id);
    if (this.selectedElementId === id) this.selectedElementId = null;
    this.render();
  }

  private moveElement(id: string, parentId: string | null, direction: number): void {
    const siblings = parentId ? this.findElement(parentId)?.children : this.elements;
    if (!siblings) return;
    const idx = siblings.findIndex((e: { id: string; }) => e.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    const tmp = siblings[idx];
    siblings[idx] = siblings[newIdx];
    siblings[newIdx] = tmp;
    this.render();
  }

  private findElement(id: string | null): FormElement | null {
    if (!id) return null;
    return this.findInTree(this.elements, id);
  }

  private findInTree(elements: FormElement[], id: string): FormElement | null {
    for (const el of elements) {
      if (el.id === id) return el;
      const found = this.findInTree(el.children, id);
      if (found) return found;
    }
    return null;
  }

  private removeElementFromTree(id: string): void {
    this.removeFromList(this.elements, id);
  }

  private removeFromList(list: FormElement[], id: string): boolean {
    const idx = list.findIndex(e => e.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      return true;
    }
    for (const el of list) {
      if (this.removeFromList(el.children, id)) return true;
    }
    return false;
  }

  private isDescendant(parentId: string, childId: string): boolean {
    const parent = this.findElement(parentId);
    if (!parent) return false;
    return this.findInTree(parent.children, childId) !== null;
  }

  private clearAll(): void {
    this.elements = [];
    this.selectedElementId = null;
    this.render();
  }

  /* ================================================================ */
  /*  Export                                                            */
  /* ================================================================ */

  private exportForm(): void {
    if (this.elements.length === 0) {
      showToast('Add some elements to the form first!', 'warning');
      return;
    }

    const result = generateCompleteForm(this.formName, this.formType!, this.elements);

    const content = el('div', { className: 'fb-export-modal' },
      el('h3', {}, 'server_form.json'),
      el('p', { className: 'fb-export-desc' }, 'Base file — put this in your ui/ folder'),
      el('textarea', {
        className: 'fb-export-code',
        rows: '12',
        value: result.serverForm,
        readonly: 'true',
        onclick: (e: Event) => (e.target as HTMLTextAreaElement).select(),
      }),
      el('h3', {}, result.formFileName),
      el('p', { className: 'fb-export-desc' }, 'Your form — put this in your ui/ folder too'),
      el('textarea', {
        className: 'fb-export-code',
        rows: '12',
        value: result.formFile,
        readonly: 'true',
        onclick: (e: Event) => (e.target as HTMLTextAreaElement).select(),
      }),
      el('div', { className: 'fb-export-actions' },
        el('button', {
          className: 'btn primary',
          onclick: () => {
            this.downloadFile('server_form.json', result.serverForm);
            this.downloadFile(result.formFileName.split('/').pop()!, result.formFile);
            showToast('Files downloaded!', 'info');
          },
        }, '💾 Download Both Files'),
        el('button', {
          className: 'btn',
          onclick: () => {
            navigator.clipboard.writeText(result.serverForm + '\n\n// ---\n\n' + result.formFile);
            showToast('Copied to clipboard!', 'info');
          },
        }, '📋 Copy All'),
        el('button', {
          className: 'btn',
          onclick: () => closeModal(),
        }, 'Close'),
      ),
    );

    showModal('📦 Export Form', content);
  }

  private downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private previewElementJSON(element: FormElement): void {
    const gen = generateCompleteForm(this.formName, this.formType!, [element]);
    const content = el('div', {},
      el('textarea', {
        className: 'fb-export-code',
        rows: '20',
        value: gen.formFile,
        readonly: 'true',
      }),
    );
    showModal(`JSON: ${element.type}`, content);
  }

  /* ================================================================ */
  /*  Import JSON                                                      */
  /* ================================================================ */

  private async handleImportJSON(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseJsonc(text) as Record<string, unknown>;
      const ns = parsed['namespace'] as string | undefined;
      if (ns) this.formName = ns;

      // Find the content control (typically <name>_content or the main stack_panel/panel)
      const elements = this.parseJsonToElements(parsed);
      if (elements.length > 0) {
        this.elements = elements;
        this.selectedElementId = null;
        this.render();
        showToast(`Imported ${elements.length} elements from ${file.name}`, 'info');
      } else {
        showToast('No elements found in the JSON file', 'warning');
      }
    } catch (err) {
      showToast(`Import error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    input.value = '';
  }

  private parseJsonToElements(parsed: Record<string, unknown>): FormElement[] {
    const elements: FormElement[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'namespace' || key === 'form_root') continue;
      if (typeof value !== 'object' || value === null) continue;
      const control = value as Record<string, unknown>;
      if (!control['type']) continue;
      const el = this.controlToFormElement(key, control);
      if (el) elements.push(el);
    }
    // If we found a single content wrapper with nested controls, flatten it
    if (elements.length === 1 && elements[0].children.length > 0) {
      return elements[0].children;
    }
    return elements;
  }

  private controlToFormElement(_name: string, control: Record<string, unknown>): FormElement | null {
    const type = control['type'] as string;

    // When we import our own generated JSON, buttons are wrapped in collection_panel.
    // Unwrap: look inside for the real button control.
    if (type === 'collection_panel') {
      const collName = control['collection_name'] as string | undefined;
      const size = control['size'] as unknown[] | undefined;
      const w = Array.isArray(size) ? (typeof size[0] === 'number' ? size[0] : 200) : 200;
      const h = Array.isArray(size) ? (typeof size[1] === 'number' ? size[1] : 100) : 100;
      // Find button child inside
      const innerControls = control['controls'] as Record<string, unknown>[] | undefined;
      if (innerControls) {
        for (const child of innerControls) {
          for (const [, childProps] of Object.entries(child)) {
            const childControl = childProps as Record<string, unknown>;
            if (childControl['type'] === 'button') {
              const el = this.controlToFormElement('button', { ...childControl, size: [w, h] });
              if (el) {
                el.useCollection = true;
                el.collectionName = collName ?? 'form_buttons';
                // Carry over anchor/offset from the wrapper panel
                if (control['offset'] && Array.isArray(control['offset'])) {
                  el.offsetX = control['offset'][0] as number;
                  el.offsetY = control['offset'][1] as number;
                }
                if (control['anchor_from']) el.anchorFrom = control['anchor_from'] as string;
                if (control['anchor_to']) el.anchorTo = control['anchor_to'] as string;
                return el;
              }
            }
          }
        }
      }
      return null; // Empty collection_panel — skip
    }

    const size = control['size'] as unknown[] | undefined;
    const w = Array.isArray(size) ? (typeof size[0] === 'number' ? size[0] : 200) : 200;
    const h = Array.isArray(size) ? (typeof size[1] === 'number' ? size[1] : 100) : 100;

    const elType = this.mapControlType(type);
    const formEl = createFormElement(elType, {
      width: w,
      height: h,
      text: (control['text'] as string) ?? ELEMENT_DEFAULTS[elType]?.text ?? '',
    });

    // Apply properties
    if (control['color'] && Array.isArray(control['color'])) {
      formEl.color = control['color'] as [number, number, number];
    }
    if (control['texture']) formEl.texture = control['texture'] as string;
    if (control['font_size']) formEl.fontSize = control['font_size'] as FormElement['fontSize'];
    if (control['shadow'] !== undefined) formEl.shadow = control['shadow'] as boolean;
    if (control['text_alignment']) formEl.textAlignment = control['text_alignment'] as string;
    if (control['anchor_from']) formEl.anchorFrom = control['anchor_from'] as string;
    if (control['anchor_to']) formEl.anchorTo = control['anchor_to'] as string;
    if (control['orientation']) formEl.orientation = control['orientation'] as 'vertical' | 'horizontal';
    if (control['grid_dimensions'] && Array.isArray(control['grid_dimensions'])) {
      formEl.gridColumns = control['grid_dimensions'][0] as number;
      formEl.gridRows = control['grid_dimensions'][1] as number;
    }
    if (control['nineslice_size']) formEl.ninesliceSize = control['nineslice_size'] as number;
    if (control['keep_ratio'] !== undefined) formEl.texture = formEl.texture ?? '';
    if (control['offset'] && Array.isArray(control['offset'])) {
      formEl.offsetX = control['offset'][0] as number;
      formEl.offsetY = control['offset'][1] as number;
    }
    if (control['slider_steps']) formEl.sliderSteps = control['slider_steps'] as number;
    if (control['max_length']) formEl.maxLength = control['max_length'] as number;

    // Handle bindings
    if (control['bindings'] && Array.isArray(control['bindings'])) {
      const bindings = control['bindings'] as Record<string, unknown>[];
      for (const b of bindings) {
        if (b['binding_name']) {
          formEl.useBinding = true;
          formEl.bindingName = b['binding_name'] as string;
        }
        // Detect collection_details binding — restore useCollection/collectionName
        if (b['binding_type'] === 'collection_details') {
          formEl.useCollection = true;
          if (b['binding_collection_name']) {
            formEl.collectionName = b['binding_collection_name'] as string;
          }
        }
      }
    }

    // Parse children
    if (control['controls'] && Array.isArray(control['controls'])) {
      for (const child of control['controls'] as Record<string, unknown>[]) {
        for (const [childName, childProps] of Object.entries(child)) {
          if (typeof childProps === 'object' && childProps !== null) {
            const childControl = childProps as Record<string, unknown>;
            // Skip button state children (default, hover, pressed)
            if (['default', 'hover', 'pressed', 'locked'].includes(childName)) continue;
            // Skip collection_panel viewport/scrollbar helpers we add during generation
            if (['scroll_view_port', 'scrollbar_track', 'scrollbar_box'].includes(childName)) continue;
            // Skip scroll_content wrappers — descend into them
            if (childName === 'scroll_content' && childControl['controls']) {
              for (const sc of childControl['controls'] as Record<string, unknown>[]) {
                for (const [scName, scProps] of Object.entries(sc)) {
                  const scEl = this.controlToFormElement(scName, scProps as Record<string, unknown>);
                  if (scEl) formEl.children.push(scEl);
                }
              }
              continue;
            }
            const childEl = this.controlToFormElement(childName, childControl);
            if (childEl) formEl.children.push(childEl);
          }
        }
      }
    }

    return formEl;
  }

  private mapControlType(type: string): FormElementType {
    const mapping: Record<string, FormElementType> = {
      'panel': 'panel',
      'collection_panel': 'button',  // our generated collection_panel always wraps a button
      'stack_panel': 'stack_panel',
      'grid': 'grid',
      'label': 'label',
      'image': 'image',
      'button': 'button',
      'toggle': 'toggle',
      'slider': 'slider',
      'edit_box': 'text_input',
      'dropdown': 'dropdown',
      'scroll_view': 'scroll_panel',
    };
    return mapping[type] ?? 'panel';
  }
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function rgbToHex(rgb: [number, number, number]): string {
  const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0');
  const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0');
  const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [Math.round(r * 100) / 100, Math.round(g * 100) / 100, Math.round(b * 100) / 100];
}

import type { TextureAsset, NinesliceConfig } from '../types/JsonUITypes';
import { ProjectManager } from '../core/ProjectManager';
import { EventBus } from '../core/EventBus';
import { el, clearElement, showModal, closeModal, showToast } from './DomUtils';

/** Texture manager with nineslice editor */
export class TextureManager {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {}

  /** Open the texture manager modal */
  open(): void {
    const content = el('div', { className: 'texture-manager' });
    this.renderContent(content);
    showModal('Texture Manager', content);
  }

  private renderContent(container: HTMLElement): void {
    clearElement(container);

    // Upload section
    const uploadSection = el('div', { className: 'texture-upload' },
      el('label', { className: 'btn primary upload-label' },
        '+ Add Textures',
        el('input', {
          type: 'file',
          accept: 'image/png,image/jpeg,image/tga',
          multiple: 'true',
          className: 'hidden-input',
          onchange: (e: Event) => this.handleUpload(e, container)
        })
      )
    );
    container.appendChild(uploadSection);

    // Texture grid
    const textures = this.projectManager.getTextures();
    if (textures.size === 0) {
      container.appendChild(el('div', { className: 'texture-empty' }, 'No textures yet. Upload PNG, JPG, or TGA files.'));
      return;
    }

    const grid = el('div', { className: 'texture-grid' });
    for (const [, tex] of textures) {
      grid.appendChild(this.renderTextureCard(tex, container));
    }
    container.appendChild(grid);
  }

  private renderTextureCard(texture: TextureAsset, parentContainer: HTMLElement): HTMLElement {
    const card = el('div', { className: 'texture-card' },
      el('div', { className: 'texture-preview' },
        (() => {
          const img = document.createElement('img');
          img.src = texture.data;
          img.alt = texture.name;
          img.style.imageRendering = 'pixelated';
          return img;
        })()
      ),
      el('div', { className: 'texture-info' },
        el('span', { className: 'texture-name' }, texture.name),
        el('span', { className: 'texture-dims' }, `${texture.width}x${texture.height}`),
        el('span', { className: 'texture-path' }, texture.path)
      ),
      el('div', { className: 'texture-actions' },
        el('button', {
          className: 'btn small',
          onclick: () => this.openNinesliceEditor(texture)
        }, '9-Slice'),
        el('button', {
          className: 'btn small',
          onclick: () => {
            const newPath = prompt('Texture path:', texture.path);
            if (newPath) {
              texture.path = newPath;
              this.events.emit('texture:updated', { textureId: texture.id });
              this.renderContent(parentContainer);
            }
          }
        }, 'Edit Path'),
        el('button', {
          className: 'btn small danger',
          onclick: () => {
            if (confirm(`Delete texture "${texture.name}"?`)) {
              this.projectManager.removeTexture(texture.id);
              this.renderContent(parentContainer);
            }
          }
        }, 'Delete')
      ),
      texture.nineslice ? el('div', { className: 'nineslice-badge' },
        `9-Slice: [${texture.nineslice.left}, ${texture.nineslice.top}, ${texture.nineslice.right}, ${texture.nineslice.bottom}]`
      ) : null
    );
    return card;
  }

  private async handleUpload(e: Event, parentContainer: HTMLElement): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await this.readFile(file);
        const dims = await this.getImageDims(dataUrl);
        const defaultPath = `textures/ui/${file.name.replace(/\.[^.]+$/, '')}`;
        const texture: TextureAsset = {
          id: crypto.randomUUID(),
          name: file.name,
          path: defaultPath,
          data: dataUrl,
          width: dims.width,
          height: dims.height,
        };
        this.projectManager.addTexture(texture);
      } catch (err) {
        showToast(`Failed to load ${file.name}: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    this.renderContent(parentContainer);
  }

  /** Open nineslice editor for a texture */
  private openNinesliceEditor(texture: TextureAsset): void {
    closeModal();

    const ns = texture.nineslice ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const scale = Math.max(1, Math.min(8, Math.floor(200 / Math.max(texture.width, texture.height))));

    const canvas = document.createElement('canvas');
    canvas.width = texture.width * scale;
    canvas.height = texture.height * scale;
    canvas.className = 'nineslice-canvas';
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.src = texture.data;
    img.onload = () => {
      this.drawNineslice(ctx, img, ns, scale, texture.width, texture.height);
    };

    const createSlider = (label: string, key: keyof NinesliceConfig, max: number): HTMLElement => {
      const input = el('input', {
        type: 'range',
        min: '0',
        max: String(max),
        value: String(ns[key]),
        className: 'nineslice-slider',
        oninput: (e: Event) => {
          ns[key] = parseInt((e.target as HTMLInputElement).value, 10);
          valueLabel.textContent = String(ns[key]);
          this.drawNineslice(ctx, img, ns, scale, texture.width, texture.height);
        }
      });
      const valueLabel = el('span', { className: 'ns-value' }, String(ns[key]));
      return el('div', { className: 'nineslice-control' },
        el('label', {}, label),
        input,
        valueLabel
      );
    };

    const nsCode = el('span', {});
    const updateNsCode = () => {
      if (ns.top === ns.bottom && ns.left === ns.right && ns.top === ns.left) {
        nsCode.textContent = `"nineslice_size": ${ns.top}`;
      } else {
        nsCode.textContent = `"nineslice_size": [${ns.left}, ${ns.top}, ${ns.right}, ${ns.bottom}]`;
      }
    };
    updateNsCode();

    const content = el('div', { className: 'nineslice-editor' },
      el('div', { className: 'nineslice-preview' }, canvas),
      el('div', { className: 'nineslice-controls' },
        createSlider('Top', 'top', texture.height),
        createSlider('Bottom', 'bottom', texture.height),
        createSlider('Left', 'left', texture.width),
        createSlider('Right', 'right', texture.width)
      ),
      el('div', { className: 'nineslice-output' },
        el('label', {}, 'JSON Output:'),
        nsCode
      ),
      el('div', { className: 'nineslice-actions' },
        el('button', {
          className: 'btn primary',
          onclick: () => {
            this.projectManager.updateTextureNineslice(texture.id, { ...ns });
            showToast('Nineslice saved', 'info');
            closeModal();
            this.open(); // Reopen texture manager
          }
        }, 'Save'),
        el('button', {
          className: 'btn',
          onclick: () => {
            closeModal();
            this.open();
          }
        }, 'Cancel')
      )
    );

    const nsObserver = new MutationObserver(updateNsCode);
    nsObserver.observe(content, { subtree: true, attributes: true });

    showModal(`9-Slice: ${texture.name}`, content);
  }

  private drawNineslice(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    ns: NinesliceConfig,
    scale: number,
    w: number,
    h: number
  ): void {
    ctx.clearRect(0, 0, w * scale, h * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w * scale, h * scale);

    // Draw guide lines
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Left line
    ctx.beginPath();
    ctx.moveTo(ns.left * scale + 0.5, 0);
    ctx.lineTo(ns.left * scale + 0.5, h * scale);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo((w - ns.right) * scale + 0.5, 0);
    ctx.lineTo((w - ns.right) * scale + 0.5, h * scale);
    ctx.stroke();

    // Top line
    ctx.beginPath();
    ctx.moveTo(0, ns.top * scale + 0.5);
    ctx.lineTo(w * scale, ns.top * scale + 0.5);
    ctx.stroke();

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(0, (h - ns.bottom) * scale + 0.5);
    ctx.lineTo(w * scale, (h - ns.bottom) * scale + 0.5);
    ctx.stroke();

    ctx.setLineDash([]);

    // Label sections
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    // Corner highlights
    ctx.fillRect(0, 0, ns.left * scale, ns.top * scale);
    ctx.fillRect((w - ns.right) * scale, 0, ns.right * scale, ns.top * scale);
    ctx.fillRect(0, (h - ns.bottom) * scale, ns.left * scale, ns.bottom * scale);
    ctx.fillRect((w - ns.right) * scale, (h - ns.bottom) * scale, ns.right * scale, ns.bottom * scale);

    // Center stretch area
    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.fillRect(
      ns.left * scale,
      ns.top * scale,
      (w - ns.left - ns.right) * scale,
      (h - ns.top - ns.bottom) * scale
    );
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
  }

  private getImageDims(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Load failed'));
      img.src = dataUrl;
    });
  }
}

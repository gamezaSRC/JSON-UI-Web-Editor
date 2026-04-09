import { ProjectManager } from '../core/ProjectManager';
import { EventBus } from '../core/EventBus';
import { ImportExportManager } from '../core/ImportExportManager';
import { TextureManager } from './TextureManager';
import { el, clearElement, showToast } from './DomUtils';

/** Top toolbar - project actions, view toggles, import/export */
export class Toolbar {
  private readonly container: HTMLElement;
  private currentMode: 'visual' | 'code' = 'visual';

  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus,
    private readonly importExport: ImportExportManager,
    private readonly textureManager: TextureManager
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
    this.render();
  }

  render(): void {
    clearElement(this.container);

    this.container.appendChild(
      el('div', { className: 'toolbar-content' },
        // Logo / Title
        el('div', { className: 'toolbar-brand' },
          el('span', { className: 'toolbar-logo' }, '▣'),
          el('span', { className: 'toolbar-title' }, 'JsonUI Editor')
        ),

        // File actions
        el('div', { className: 'toolbar-group' },
          el('button', {
            className: 'toolbar-btn',
            title: 'New Project',
            onclick: () => {
              const name = prompt('Project name:', 'My Project');
              if (name) {
                this.projectManager.newProject(name);
                showToast('New project created', 'info');
              }
            }
          }, 'New'),

          // Import file
          el('label', { className: 'toolbar-btn' },
            'Import File',
            el('input', {
              type: 'file',
              accept: '.json',
              multiple: 'true',
              className: 'hidden-input',
              onchange: (e: Event) => this.handleFileImport(e)
            })
          ),

          // Import folder
          el('label', { className: 'toolbar-btn' },
            'Import Folder',
            el('input', {
              type: 'file',
              webkitdirectory: '',
              className: 'hidden-input',
              onchange: (e: Event) => this.handleFolderImport(e)
            })
          ),

          el('button', {
            className: 'toolbar-btn',
            title: 'Export Project as ZIP',
            onclick: () => this.handleExport()
          }, 'Export ZIP'),
        ),

        // Tools
        el('div', { className: 'toolbar-group' },
          el('button', {
            className: 'toolbar-btn',
            onclick: () => this.textureManager.open()
          }, 'Textures'),
        ),

        // View toggle
        el('div', { className: 'toolbar-group view-toggle' },
          el('button', {
            className: `toolbar-btn${this.currentMode === 'visual' ? ' active' : ''}`,
            onclick: () => this.setMode('visual')
          }, 'Visual'),
          el('button', {
            className: `toolbar-btn${this.currentMode === 'code' ? ' active' : ''}`,
            onclick: () => this.setMode('code')
          }, 'Code'),
        ),
      )
    );
  }

  private setMode(mode: 'visual' | 'code'): void {
    this.currentMode = mode;
    this.events.emit('editor:mode-changed', { mode });
    this.render();
  }

  private async handleFileImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        await this.importExport.importFile(file);
        showToast(`Imported ${file.name}`, 'info');
      } catch (err) {
        showToast(err instanceof Error ? err.message : String(err), 'error');
      }
    }
    input.value = '';
  }

  private async handleFolderImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    showToast('Importing project...', 'info');
    const result = await this.importExport.importFolder(files);

    if (result.errors.length > 0) {
      console.warn('Import errors:', result.errors);
      showToast(`Imported ${result.imported} files with ${result.errors.length} errors (see console)`, 'warning');
    } else {
      showToast(`Imported ${result.imported} files successfully`, 'info');
    }
    input.value = '';
  }

  private async handleExport(): Promise<void> {
    try {
      await this.importExport.exportProject();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }
}

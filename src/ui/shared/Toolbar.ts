import { ProjectManager } from '../../core/ProjectManager';
import { EventBus } from '../../core/EventBus';
import { ImportExportManager } from '../../core/ImportExportManager';
import { TextureManager } from './TextureManager';
import { el, clearElement, showToast } from './DomUtils';
import { t, getLang, setLang, LANGUAGES, onLangChange } from '../../core/i18n';
import type { LangCode } from '../../core/i18n';

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
    this.events.on('preview-base:changed', () => this.render());
    onLangChange(() => this.render());
    this.render();
  }

  render(): void {
    clearElement(this.container);
    const previewBase = this.projectManager.getPreviewBase();
    this.container.appendChild(
      el('div', { className: 'toolbar-content' },
        // Logo / Title
        el('div', { className: 'toolbar-brand' },
          el('span', { className: 'toolbar-logo' }, '▣'),
          el('span', { className: 'toolbar-title' }, t('toolbar.title'))
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
          }, t('toolbar.new')),

          // Import file
          el('label', { className: 'toolbar-btn' },
            t('toolbar.importFile'),
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
            t('toolbar.importFolder'),
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
          }, t('toolbar.export')),
        ),

        // Tools
        el('div', { className: 'toolbar-group' },
          el('button', {
            className: 'toolbar-btn',
            onclick: () => this.textureManager.open()
          }, t('toolbar.textures')),
          el('label', {
            className: `toolbar-btn${previewBase ? ' active' : ''}`,
            title: previewBase?.name ?? t('toolbar.mountVanilla')
          },
            t('toolbar.mountVanilla'),
            el('input', {
              type: 'file',
              webkitdirectory: '',
              className: 'hidden-input',
              onchange: (e: Event) => this.handlePreviewBaseImport(e)
            })
          ),
          previewBase
            ? el('button', {
                className: 'toolbar-btn',
                title: previewBase.name,
                onclick: () => {
                  this.projectManager.clearPreviewBase();
                  showToast(t('toolbar.clearVanillaDone'), 'info');
                }
              }, t('toolbar.clearVanilla'))
            : null,
        ),

        // View toggle
        el('div', { className: 'toolbar-group view-toggle' },
          el('button', {
            className: `toolbar-btn${this.currentMode === 'visual' ? ' active' : ''}`,
            onclick: () => this.setMode('visual')
          }, t('toolbar.visual')),
          el('button', {
            className: `toolbar-btn${this.currentMode === 'code' ? ' active' : ''}`,
            onclick: () => this.setMode('code')
          }, t('toolbar.code')),
        ),

        // Language selector
        el('div', { className: 'toolbar-group' },
          el('select', {
            className: 'toolbar-lang-select',
            onchange: (e: Event) => {
              setLang((e.target as HTMLSelectElement).value as LangCode);
            }
          },
            ...Object.entries(LANGUAGES).map(([code, meta]) =>
              el('option', { value: code, selected: code === getLang() }, `${meta.flag} ${meta.label}`)
            )
          )
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
    } else showToast(`Imported ${result.imported} files successfully`, 'info');
    input.value = '';
  }

  private async handleExport(): Promise<void> {
    try {
      await this.importExport.exportProject();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }
  private async handlePreviewBaseImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    showToast(t('toolbar.mountVanillaLoading'), 'info');
    const result = await this.importExport.importPreviewBase(files);
    if (result.errors.length > 0) {
      console.warn('Preview base import errors:', result.errors);
      showToast(`${t('toolbar.mountVanillaDone')} (${result.files} ui, ${result.textures} tex)`, 'warning');
    } else showToast(`${t('toolbar.mountVanillaDone')} (${result.files} ui, ${result.textures} tex)`, 'info');
    input.value = '';
  }
}
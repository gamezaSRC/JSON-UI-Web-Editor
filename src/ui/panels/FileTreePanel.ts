import { ProjectManager } from '../../core/ProjectManager';
import { EventBus } from '../../core/EventBus';
import { el, clearElement, showToast } from '../shared/DomUtils';
import { t, onLangChange } from '../../core/i18n';

/** Renders the project file tree and control hierarchy in the sidebar */
export class FileTreePanel {
  private readonly container: HTMLElement;
  private selectedFile: string | null = null;
  private selectedControl: string | null = null;
  private expandedFiles = new Set<string>();

  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
    this.events.on('tree:refresh', () => this.render());
    this.events.on('file:selected', (data) => {
      if (data) {
        this.selectedFile = data.filePath;
        this.expandedFiles.add(data.filePath);
        this.render();
      }
    });
    this.events.on('control:selected', (data) => {
      if (data) {
        this.selectedControl = data.controlName;
        this.selectedFile = data.filePath;
        this.render();
      }
    });
    onLangChange(() => this.render());
  }

  /** Render the full tree */
  render(): void {
    clearElement(this.container);
    const header = el('div', { className: 'panel-header' },
      el('span', { className: 'panel-title' }, t('fileTree.title')),
      el('div', { className: 'panel-actions' },
        el('button', {
          className: 'icon-btn',
          title: 'New File',
          onclick: () => this.handleNewFile()
        }, '+'),
      )
    );
    const tree = el('div', { className: 'file-tree' });
    const files = this.projectManager.getFilePaths();
    // group files by directory
    const dirs = new Map<string, string[]>();
    for (const fp of files) {
      const parts = fp.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      if (!dirs.has(dir)) dirs.set(dir, []);
      dirs.get(dir)!.push(fp);
    }
    // render folders and files
    const sortedDirs = Array.from(dirs.keys()).sort();
    for (const dir of sortedDirs) {
      if (dir) {
        tree.appendChild(
          el('div', { className: 'tree-folder' },
            el('span', { className: 'folder-icon' }, '/'),
            el('span', { className: 'folder-name' }, dir)
          )
        );
      }
      const dirFiles = dirs.get(dir)!.sort();
      for (const fp of dirFiles) 
        tree.appendChild(this.renderFileNode(fp));
    }
    const globals = this.projectManager.getGlobalVariables();
    if (Object.keys(globals).length > 0) {
      tree.appendChild(
        el('div', {
          className: `tree-file${this.selectedFile === '_global_variables.json' ? ' selected' : ''}`,
          onclick: () => {
            this.selectedFile = '_global_variables.json';
            this.events.emit('file:selected', { filePath: '_global_variables.json' });
          }
        },
          el('span', { className: 'file-icon' }, 'G'),
          el('span', { className: 'file-name' }, '_global_variables.json')
        )
      );
    }
    this.container.appendChild(header);
    this.container.appendChild(tree);
  }

  private renderFileNode(filePath: string): HTMLElement {
    const fileName = filePath.split('/').pop() ?? filePath;
    const isExpanded = this.expandedFiles.has(filePath);
    const isSelected = this.selectedFile === filePath;
    const fileNode = el('div', { className: 'tree-file-group' });
    const fileHeader = el('div', {
      className: `tree-file${isSelected ? ' selected' : ''}`,
      onclick: () => this.handleFileClick(filePath),
    },
      el('span', {
        className: `tree-expand ${isExpanded ? 'expanded' : ''}`,
        onclick: (e: Event) => {
          e.stopPropagation();
          this.toggleExpand(filePath);
        }
      }, isExpanded ? '▼' : '▶'),
      el('span', { className: 'file-icon' }, '{}'),
      el('span', { className: 'file-name' }, fileName),
      el('button', {
        className: 'icon-btn small',
        title: 'Add Control',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.handleAddControl(filePath);
        }
      }, '+'),
      el('button', {
        className: 'icon-btn small danger',
        title: 'Delete File',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.handleDeleteFile(filePath);
        }
      }, 'x')
    );
    fileNode.appendChild(fileHeader);
    // controls list if expanded
    if (isExpanded) {
      const controls = this.projectManager.getControlNames(filePath);
      const controlsList = el('div', { className: 'tree-controls' });
      for (const ctrlName of controls) {
        const isCtrlSelected = isSelected && this.selectedControl === ctrlName;
        const control = this.projectManager.getControl(filePath, ctrlName);
        const typeBadge = control?.type ? ` [${control.type}]` : '';
        const ctrlNode = el('div', {
          className: `tree-control${isCtrlSelected ? ' selected' : ''}`,
          draggable: 'true',
          'data-control': ctrlName,
          'data-file': filePath,
          onclick: () => {
            this.selectedControl = ctrlName;
            this.selectedFile = filePath;
            this.events.emit('control:selected', { filePath, controlName: ctrlName });
          },
          ondragstart: (e: DragEvent) => {
            e.dataTransfer?.setData('text/plain', JSON.stringify({ file: filePath, control: ctrlName }));
          }
        },
          el('span', { className: 'control-name' }, ctrlName),
          el('span', { className: 'control-type-badge' }, typeBadge),
          el('button', {
            className: 'icon-btn small danger',
            title: 'Delete Control',
            onclick: (e: Event) => {
              e.stopPropagation();
              this.handleDeleteControl(filePath, ctrlName);
            }
          }, 'x')
        );
        // Render nested children of this control
        if (control?.controls && control.controls.length > 0) {
          const childrenContainer = this.renderControlChildren(filePath, ctrlName, control.controls, 1);
          ctrlNode.appendChild(childrenContainer);
        }
        controlsList.appendChild(ctrlNode);
      }
      fileNode.appendChild(controlsList);
    }
    return fileNode;
  }

  private renderControlChildren(
    filePath: string,
    _parentName: string,
    children: Record<string, unknown>[],
    depth: number
  ): HTMLElement {
    const container = el('div', {
      className: 'tree-children',
      style: `padding-left: ${depth * 12}px`,
    });
    for (const child of children) {
      for (const [name, props] of Object.entries(child)) {
        const typedProps = props as Record<string, unknown>;
        const typeStr = typedProps['type'] ? ` [${typedProps['type']}]` : '';
        const childEl = el('div', { className: 'tree-control child' },
          el('span', { className: 'control-name' }, name),
          el('span', { className: 'control-type-badge' }, typeStr)
        );
        if (Array.isArray(typedProps['controls']) && typedProps['controls'].length > 0)
          childEl.appendChild(
            this.renderControlChildren(filePath, name, typedProps['controls'] as Record<string, unknown>[], depth + 1)
          );
        container.appendChild(childEl);
      }
    }
    return container;
  }

  private handleFileClick(filePath: string): void {
    this.selectedFile = filePath;
    this.expandedFiles.add(filePath);
    this.selectedControl = null;
    this.events.emit('file:selected', { filePath });
    this.render();
  }

  private toggleExpand(filePath: string): void {
    if (this.expandedFiles.has(filePath)) {
      this.expandedFiles.delete(filePath);
    } else this.expandedFiles.add(filePath);
    this.render();
  }

  private handleNewFile(): void {
    const name = prompt('File name (e.g., ui/my_screen.json):');
    if (!name) return;
    const normalized = name.endsWith('.json') ? name : name + '.json';
    const namespace = normalized.replace(/\.json$/, '').split('/').pop() ?? 'untitled';
    this.projectManager.addFile(normalized, {
      namespace,
    });
    this.handleFileClick(normalized);
  }

  private handleAddControl(filePath: string): void {
    const name = prompt('Control name:');
    if (!name) return;
    this.projectManager.addControl(filePath, name, { type: 'panel' });
    this.selectedControl = name;
    this.events.emit('control:selected', { filePath, controlName: name });
  }

  private handleDeleteFile(filePath: string): void {
    if (!confirm(`Delete file "${filePath}"?`)) return;
    try {
      this.projectManager.removeFile(filePath);
      if (this.selectedFile === filePath) {
        this.selectedFile = null;
        this.selectedControl = null;
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  private handleDeleteControl(filePath: string, controlName: string): void {
    if (!confirm(`Delete control "${controlName}"?`)) return;
    try {
      this.projectManager.deleteControl(filePath, controlName);
      if (this.selectedControl === controlName) 
        this.selectedControl = null;
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }
}
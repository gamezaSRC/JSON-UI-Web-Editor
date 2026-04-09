/**
 * JsonUI Editor — Minecraft Bedrock JSON UI visual/code editor.
 * @see https://wiki.bedrock.dev/json-ui/json-ui-documentation
 * @see https://learn.microsoft.com/en-us/minecraft/creator/reference/content/jsonuireference/examples/jsonuilist
 */

import { EventBus } from './core/EventBus';
import { ProjectManager } from './core/ProjectManager';
import { ImportExportManager } from './core/ImportExportManager';
import { FileTreePanel } from './ui/FileTreePanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { VisualEditor } from './ui/VisualEditor';
import { CodeEditorPanel } from './ui/CodeEditorPanel';
import { TextureManager } from './ui/TextureManager';
import { Toolbar } from './ui/Toolbar';
import { StatusBar } from './ui/StatusBar';

class JsonUIApp {
  private readonly events = new EventBus();
  private readonly projectManager = new ProjectManager(this.events);
  private readonly importExport = new ImportExportManager(this.projectManager, this.events);
  private readonly textureManager = new TextureManager(this.projectManager, this.events);

  private fileTree!: FileTreePanel;
  private visualEditor!: VisualEditor;
  private codeEditor!: CodeEditorPanel;

  /** Bootstrap the application */
  init(): void {
    // Initialize UI panels
    this.fileTree = new FileTreePanel('file-tree-panel', this.projectManager, this.events);
    new InspectorPanel('inspector-panel', this.projectManager, this.events);
    this.visualEditor = new VisualEditor('visual-editor', this.projectManager, this.events);
    this.codeEditor = new CodeEditorPanel('code-editor', this.projectManager, this.events);
    new Toolbar('toolbar', this.projectManager, this.events, this.importExport, this.textureManager);
    new StatusBar('status-bar', this.projectManager, this.events);

    // Initialize code editor (Monaco)
    this.codeEditor.init();
    this.codeEditor.setVisible(false);

    // Handle view mode switching
    this.events.on('editor:mode-changed', (data) => {
      if (!data) return;
      const visualEl = document.getElementById('visual-editor');
      const codeEl = document.getElementById('code-editor');
      if (!visualEl || !codeEl) return;

      if (data.mode === 'visual') {
        visualEl.classList.add('active');
        codeEl.classList.remove('active');
        this.codeEditor.setVisible(false);
      } else {
        visualEl.classList.remove('active');
        codeEl.classList.add('active');
        this.codeEditor.setVisible(true);
      }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.projectManager.isDirty()) {
        e.preventDefault();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+S — Export
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.importExport.exportProject();
      }
    });

    // Render initial state
    this.fileTree.render();
    this.visualEditor.render();

    // Setup workspace panel resizers
    this.setupWorkspaceResizers();
  }

  /** Make file-tree and inspector panels resizable via drag handles */
  private setupWorkspaceResizers(): void {
    const leftResizer = document.getElementById('workspace-resizer-left');
    const rightResizer = document.getElementById('workspace-resizer-right');
    const fileTree = document.getElementById('file-tree-panel');
    const inspector = document.getElementById('inspector-panel');

    if (leftResizer && fileTree) {
      this.initResizer(leftResizer, fileTree, 'left');
    }
    if (rightResizer && inspector) {
      this.initResizer(rightResizer, inspector, 'right');
    }
  }

  private initResizer(handle: HTMLElement, panel: HTMLElement, side: 'left' | 'right'): void {
    let startX = 0;
    let startW = 0;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const delta = e.clientX - startX;
      const newW = side === 'left' ? startW + delta : startW - delta;
      const min = parseInt(getComputedStyle(panel).minWidth) || 140;
      const max = parseInt(getComputedStyle(panel).maxWidth) || 500;
      panel.style.width = `${Math.max(min, Math.min(max, newW))}px`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startW = panel.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}

// Launch
const app = new JsonUIApp();
app.init();
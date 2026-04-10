import * as monaco from 'monaco-editor';
import { ProjectManager } from '../../core/ProjectManager';
import { EventBus } from '../../core/EventBus';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  },
};

/** Monaco-based code editor for direct JSON editing */
export class CodeEditorPanel {
  private readonly container: HTMLElement;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private currentFile: string | null = null;
  private ignoreChanges = false;
  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
    this.events.on('file:selected', (data) => {
      if (data) {
        this.currentFile = data.filePath;
        this.loadFileContent();
      }
    });
    this.events.on('control:updated', () => {
      if (this.currentFile) this.loadFileContent();
    });
  }

  /** Initialize Monaco editor */
  init(): void {
    // Configure Monaco for JSON with JSON UI awareness
    const jsonLang = monaco.languages.json as any;
    if (jsonLang?.jsonDefaults?.setDiagnosticsOptions) {
      jsonLang.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        trailingCommas: 'ignore',
      });
    }

    this.editor = monaco.editor.create(this.container, {
      language: 'json',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      tabSize: 2,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      folding: true,
      formatOnPaste: true,
      suggest: {
        showWords: true,
      },
    });

    // Handle content changes with debounce
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    this.editor.onDidChangeModelContent(() => {
      if (this.ignoreChanges) return;
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => this.applyChanges(), 800);
    });

    // Format on save (Ctrl+S)
    this.editor.addAction({
      id: 'save-format',
      label: 'Save & Format',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        this.applyChanges();
        this.editor?.getAction('editor.action.formatDocument')?.run();
      },
    });
  }

  /** Show/hide the code editor */
  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
    if (visible && this.editor) {
      this.editor.layout();
    }
  }

  /** Get current visible state */
  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  private loadFileContent(): void {
    if (!this.editor || !this.currentFile) return;
    this.ignoreChanges = true;
    if (this.currentFile === '_global_variables.json') {
      const vars = this.projectManager.getGlobalVariables();
      this.editor.setValue(JSON.stringify(vars, null, '\t'));
    } else {
      const fileDef = this.projectManager.getFile(this.currentFile);
      if (fileDef) {
        this.editor.setValue(this.projectManager.serializeFile(fileDef));
      } else this.editor.setValue('// File not found');
    }
    this.ignoreChanges = false;
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentFile) return;
    const content = this.editor.getValue();
    try {
      if (this.currentFile === '_global_variables.json') {
        const parsed = JSON.parse(content);
        this.projectManager.setGlobalVariables(parsed);
      } else {
        const fileDef = this.projectManager.parseUIFile(content, this.currentFile);
        const existingFile = this.projectManager.getFile(this.currentFile);
        if (existingFile) {
          // Update in-place to preserve references
          const fileObj = existingFile as Record<string, unknown>;
          for (const key of Object.keys(fileObj))
            delete fileObj[key];
          Object.assign(fileObj, fileDef);
        }
        this.events.emit('project:changed', { filePath: this.currentFile });
        this.events.emit('tree:refresh');
        this.events.emit('inspector:refresh');
      }
    } catch (err) {
      // Show inline error marker — don't toast for every keystroke
      if (err instanceof Error && this.editor) {
        const model = this.editor.getModel();
        if (model) {
          // Try to extract line number from JSON parse error
          const lineMatch = err.message.match(/position (\d+)/);
          if (lineMatch) {
            const pos = parseInt(lineMatch[1], 10);
            const position = model.getPositionAt(pos);
            monaco.editor.setModelMarkers(model, 'json-ui', [{
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column + 1,
              message: err.message,
              severity: monaco.MarkerSeverity.Error,
            }]);
          }
        }
      }
    }
  }

  /** Dispose Monaco instance */
  dispose(): void {
    this.editor?.dispose();
  }
}
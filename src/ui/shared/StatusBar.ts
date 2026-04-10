import { EventBus } from '../../core/EventBus';
import { ProjectManager } from '../../core/ProjectManager';
import { UIValidator } from '../../core/UIValidator';
import type { ValidationIssue } from '../../core/UIValidator';
import { el, clearElement } from './DomUtils';
import { onLangChange } from '../../core/i18n';

/** Status bar at the bottom showing project info, validation, and messages */
export class StatusBar {
  private readonly container: HTMLElement;
  private readonly validator: UIValidator;
  private messageTimeout: ReturnType<typeof setTimeout> | null = null;
  private issuesPopup: HTMLElement | null = null;

  constructor(
    containerId: string,
    private readonly projectManager: ProjectManager,
    private readonly events: EventBus
  ) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);
    this.container = container;
    this.validator = new UIValidator();
    this.events.on('status:message', (data) => {
      if (data) this.showMessage(data.text, data.type);
    });
    this.events.on('project:loaded', () => this.render());
    this.events.on('project:changed', () => this.render());
    this.events.on('file:selected', () => this.render());
    this.events.on('tree:refresh', () => this.render());
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.issuesPopup && !this.issuesPopup.contains(e.target as Node)) {
        this.closeIssuesPopup();
      }
    });
    onLangChange(() => this.render());
    this.render();
  }

  render(): void {
    this.closeIssuesPopup();
    clearElement(this.container);
    const project = this.projectManager.getProject();
    const fileCount = project.files.size;
    const textureCount = project.textures.size;
    // Collect all issues
    const allIssues: ValidationIssue[] = [];
    for (const [path, fileDef] of project.files) {
      allIssues.push(...this.validator.validateFile(fileDef as Record<string, unknown>, path));
    }

    const issuesBadge = allIssues.length > 0
      ? el('button', {
          className: 'status-issues status-btn',
          title: 'Click to view issues',
          onclick: (e: Event) => {
            e.stopPropagation();
            this.toggleIssuesPopup(allIssues, e.currentTarget as HTMLElement);
          }
        }, `\u26A0 ${allIssues.length} issue${allIssues.length !== 1 ? 's' : ''}`)
      : el('span', { className: 'status-ok' }, '\u2713 No issues');

    this.container.appendChild(
      el('div', { className: 'status-content' },
        el('span', { className: 'status-project' }, `\uD83D\uDCE6 ${project.name}`),
        el('span', { className: 'status-files' }, `\uD83D\uDCC4 ${fileCount} file${fileCount !== 1 ? 's' : ''}`),
        el('span', { className: 'status-textures' }, `\uD83D\uDDBC ${textureCount} texture${textureCount !== 1 ? 's' : ''}`),
        issuesBadge,
        this.projectManager.isDirty()
          ? el('span', { className: 'status-dirty' }, '\u25CF Unsaved changes')
          : null,
        el('span', { id: 'status-message', className: 'status-message' })
      )
    );
  }

  private toggleIssuesPopup(issues: ValidationIssue[], anchor: HTMLElement): void {
    if (this.issuesPopup) {
      this.closeIssuesPopup();
      return;
    }

    const popup = document.createElement('div');
    popup.className = 'issues-popup';
    const header = document.createElement('div');
    header.className = 'issues-popup-header';
    header.textContent = `Issues (${issues.length})`;
    popup.appendChild(header);
    const list = document.createElement('div');
    list.className = 'issues-popup-list';
    for (const issue of issues) {
      const item = document.createElement('div');
      item.className = `issues-popup-item severity-${issue.severity}`;
      const icon = issue.severity === 'error' ? '\u2716' : issue.severity === 'warning' ? '\u26A0' : '\u2139';
      const pathEl = document.createElement('span');
      pathEl.className = 'issues-path';
      pathEl.textContent = issue.path;
      const msgEl = document.createElement('span');
      msgEl.className = 'issues-message';
      msgEl.textContent = `${icon} ${issue.message}`;
      item.appendChild(msgEl);
      item.appendChild(pathEl);
      if (issue.suggestion) {
        const sugEl = document.createElement('span');
        sugEl.className = 'issues-suggestion';
        sugEl.textContent = `\u21B3 ${issue.suggestion}`;
        item.appendChild(sugEl);
      }
      list.appendChild(item);
    }
    popup.appendChild(list);
    // Position above the anchor button
    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    this.issuesPopup = popup;
  }

  private closeIssuesPopup(): void {
    if (this.issuesPopup) {
      this.issuesPopup.remove();
      this.issuesPopup = null;
    }
  }

  private showMessage(text: string, type: 'info' | 'warning' | 'error'): void {
    const msgEl = document.getElementById('status-message');
    if (!msgEl) {
      this.render();
      return;
    }
    msgEl.textContent = text;
    msgEl.className = `status-message status-${type}`;
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      msgEl.textContent = '';
    }, 5000);
  }
}
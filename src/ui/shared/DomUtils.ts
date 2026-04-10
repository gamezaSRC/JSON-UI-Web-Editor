/** Attribute map for the el() helper */
type ElAttrs = Record<string, string | boolean | number | ((e: never) => void) | undefined | null>;

/** Typesafe DOM helper — creates elements with attributes, events, and children */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: ElAttrs,
  ...children: (HTMLElement | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className' && typeof value === 'string') {
        element.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2), value as EventListener);
      } else if (typeof value === 'boolean') {
        if (value) element.setAttribute(key, '');
        else element.removeAttribute(key);
      } else if (value !== undefined && value !== null) 
        element.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else element.appendChild(child);
  }

  return element;
}

/** Clear all children from an element */
export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/** Query a required element by ID */
export function getRequiredElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) 
    throw new Error(`Required element #${id} not found in DOM`);
  return element as T;
}

/** Show a brief toast notification */
export function showToast(message: string, type: 'info' | 'warning' | 'error' = 'info', duration = 3000): void {
  const existing = document.getElementById('toast-container');
  const container = existing ?? document.createElement('div');
  if (!existing) {
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = el('div', { className: `toast toast-${type}` }, message);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Create a simple modal dialog */
export function showModal(title: string, content: HTMLElement, onClose?: () => void): HTMLElement {
  const overlay = getRequiredElement('modal-overlay');
  clearElement(overlay);
  overlay.classList.remove('hidden');

  const dialog = el('div', { className: 'modal-dialog' },
    el('div', { className: 'modal-header' },
      el('h3', {}, title),
      el('button', { className: 'modal-close', onclick: () => closeModal(onClose) }, '✕')
    ),
    el('div', { className: 'modal-body' }, content)
  );

  overlay.appendChild(dialog);
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal(onClose);
  };

  return dialog;
}

/** Close the modal */
export function closeModal(onClose?: () => void): void {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    clearElement(overlay);
  }
  onClose?.();
}
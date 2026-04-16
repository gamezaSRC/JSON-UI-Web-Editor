/** Event types for the event bus */
export type EventMap = {
  'project:loaded': { projectName: string };
  'project:changed': { filePath: string };
  'project:exported': undefined;
  'file:selected': { filePath: string };
  'file:created': { filePath: string };
  'file:deleted': { filePath: string };
  'file:renamed': { oldPath: string; newPath: string };
  'control:selected': { filePath: string; controlName: string };
  'control:updated': { filePath: string; controlName: string };
  'control:created': { filePath: string; controlName: string };
  'control:deleted': { filePath: string; controlName: string };
  'control:moved': { filePath: string; controlName: string; direction: 'up' | 'down' };
  'texture:added': { textureId: string };
  'texture:removed': { textureId: string };
  'texture:updated': { textureId: string };
  'preview-base:changed': { mounted: boolean; name: string | null; fileCount: number; textureCount: number };
  'editor:mode-changed': { mode: 'visual' | 'code' };
  'app:tab-changed': { tab: 'editor' | 'formbuilder' };
  'inspector:refresh': undefined;
  'tree:refresh': undefined;
  'status:message': { text: string; type: 'info' | 'warning' | 'error' };
};

export type EventKey = keyof EventMap;
type EventHandler<K extends EventKey> = (data: EventMap[K]) => void;

/** Typed event bus for decoupled communication between components */
export class EventBus {
  private readonly listeners = new Map<EventKey, Set<EventHandler<EventKey>>>();

  /** Subscribe to an event */
  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) 
      this.listeners.set(event, new Set());
    const handlers = this.listeners.get(event)!;
    handlers.add(handler as EventHandler<EventKey>);
    return () => handlers.delete(handler as EventHandler<EventKey>);
  }

  /** Emit an event to all subscribers */
  emit<K extends EventKey>(event: K, ...[data]: EventMap[K] extends undefined ? [] : [EventMap[K]]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data as EventMap[EventKey]);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /** Remove all listeners for an event */
  off<K extends EventKey>(event: K): void {
    this.listeners.delete(event);
  }

  /** Remove all listeners */
  clear(): void {
    this.listeners.clear();
  }
}
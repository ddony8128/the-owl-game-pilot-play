export type MafiaPhaseEvent = {
  room: string;
  round: number;
  phase: string;
  updatedAt: string | null;
};

type Listener = (event: MafiaPhaseEvent) => void;
type EventRegistry = Map<string, Set<Listener>>;

const globalRegistry = globalThis as typeof globalThis & {
  __owlMafiaPhaseListeners?: EventRegistry;
};

const registry =
  globalRegistry.__owlMafiaPhaseListeners ??
  (globalRegistry.__owlMafiaPhaseListeners = new Map());

export function subscribeMafiaPhase(room: string, listener: Listener) {
  const listeners = registry.get(room) ?? new Set<Listener>();
  listeners.add(listener);
  registry.set(room, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) registry.delete(room);
  };
}

export function publishMafiaPhase(event: MafiaPhaseEvent) {
  for (const listener of registry.get(event.room) ?? []) listener(event);
}

export type DefensePhaseEvent = {
  room: string;
  round: number;
  updatedAt: string | null;
};

type Listener = (event: DefensePhaseEvent) => void;
type EventRegistry = Map<string, Set<Listener>>;

const globalRegistry = globalThis as typeof globalThis & {
  __owlDefensePhaseListeners?: EventRegistry;
};

const registry =
  globalRegistry.__owlDefensePhaseListeners ??
  (globalRegistry.__owlDefensePhaseListeners = new Map());

export function subscribeDefensePhase(room: string, listener: Listener) {
  const listeners = registry.get(room) ?? new Set<Listener>();
  listeners.add(listener);
  registry.set(room, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) registry.delete(room);
  };
}

export function publishDefensePhase(event: DefensePhaseEvent) {
  for (const listener of registry.get(event.room) ?? []) listener(event);
}

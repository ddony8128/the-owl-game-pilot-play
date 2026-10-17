export const BOARD_BROADCAST_CHANNEL = "owl-game-board-control";

export type BoardBroadcastMessage = {
  room: string;
  kind:
    | "defense-control"
    | "defense-timer"
    | "mafia-summary"
    | "mafia-timer"
    | "video";
};

export function broadcastBoardChange(message: BoardBroadcastMessage) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(BOARD_BROADCAST_CHANNEL);
  channel.postMessage(message);
  channel.close();
}


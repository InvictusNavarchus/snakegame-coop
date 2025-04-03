// src/lib/game/types.ts
export interface Position {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  playerIndex: number; // Added: 0 for host, 1+ for clients
  body: Position[];
  direction: Direction;
  color: string;
  score: number;
  alive: boolean;
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export interface GameState {
  snakes: Snake[];
  food: Position[];
  gridSize: { width: number; height: number };
  gameOver: boolean;
  isPaused: boolean;
  // Consider adding game speed here if you want it configurable/synced
  // speed: number;
}

export interface GameSettings {
  gridSize: { width: number; height: number };
  speed: number; // Game loop delay in ms
  foodCount: number;
  initialSnakeLength: number;
  maxPlayers: number; // Added: Define a max player limit
}

export interface PeerMessage {
  // Added JOIN_ACCEPTED and potentially others if needed
  type: 'STATE_UPDATE' | 'DIRECTION_CHANGE' | 'JOIN_REQUEST' | 'JOIN_ACCEPTED' | 'RESTART';
  data: any;
}

// PeerInfo might be useful if clients need to know about others beyond the game state
// export interface PeerInfo {
//   id: string;
//   playerIndex: number;
//   color: string;
// }

// PlayerInfo now includes index
export interface PlayerInfo {
  id: string;
  isHost: boolean;
  playerIndex: number; // Added: Track the player's index
  color: string;
}
export interface Position {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
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
}

export interface GameSettings {
  gridSize: { width: number; height: number };
  speed: number;
  foodCount: number;
  initialSnakeLength: number;
}

export interface PeerMessage {
  type: 'STATE_UPDATE' | 'DIRECTION_CHANGE' | 'JOIN_REQUEST' | 'JOIN_ACCEPTED' | 'RESTART';
  data: any;
}

export interface PlayerInfo {
  id: string;
  isHost: boolean;
  color: string;
}
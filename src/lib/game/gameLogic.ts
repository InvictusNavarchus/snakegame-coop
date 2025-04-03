import { Direction, type GameState, type Position, type Snake, type GameSettings } from './types';

const DEFAULT_SETTINGS: GameSettings = {
  gridSize: { width: 30, height: 30 },
  speed: 150,
  foodCount: 3,
  initialSnakeLength: 3
};

export function initializeGame(
  playerId: string, 
  settings: Partial<GameSettings> = {}
): GameState {
  const gameSettings = { ...DEFAULT_SETTINGS, ...settings };
  const { gridSize, initialSnakeLength, foodCount } = gameSettings;
  
  // Create initial snake
  const snake: Snake = {
    id: playerId,
    body: generateInitialSnakeBody(gridSize, initialSnakeLength),
    direction: Direction.RIGHT,
    color: 'var(--color-snake1)',
    score: 0,
    alive: true
  };

  // Generate initial food positions
  const food: Position[] = [];
  for (let i = 0; i < foodCount; i++) {
    food.push(generateFood(gridSize, [snake.body]));
  }

  return {
    snakes: [snake],
    food,
    gridSize,
    gameOver: false,
    isPaused: false
  };
}

export function addPlayerToGame(
  gameState: GameState, 
  playerId: string,
  color: string = 'var(--color-snake2)'
): GameState {
  const newState = { ...gameState };
  
  const snake: Snake = {
    id: playerId,
    body: generateInitialSnakeBody(gameState.gridSize, DEFAULT_SETTINGS.initialSnakeLength, true),
    direction: Direction.LEFT,
    color,
    score: 0,
    alive: true
  };
  
  newState.snakes.push(snake);
  return newState;
}

export function updateGame(gameState: GameState): GameState {
  if (gameState.gameOver || gameState.isPaused) return gameState;
  
  const newState = { ...gameState };
  const allSnakeBodies = newState.snakes.map(snake => snake.body);
  
  // Update each snake
  for (let i = 0; i < newState.snakes.length; i++) {
    if (!newState.snakes[i].alive) continue;
    
    const snake = { ...newState.snakes[i] };
    const head = { ...snake.body[0] };
    const nextPos = getNextPosition(head, snake.direction, newState.gridSize);
    
    // Check for collisions with walls or other snakes
    if (checkCollision(nextPos, allSnakeBodies, i)) {
      snake.alive = false;
      newState.snakes[i] = snake;
      continue;
    }
    
    // Check if food is eaten
    const foodIndex = newState.food.findIndex(f => f.x === nextPos.x && f.y === nextPos.y);
    if (foodIndex >= 0) {
      // Eat food
      snake.score += 1;
      newState.food.splice(foodIndex, 1);
      newState.food.push(generateFood(newState.gridSize, allSnakeBodies));
    } else {
      // Remove tail if no food was eaten
      snake.body.pop();
    }
    
    // Add new head
    snake.body.unshift(nextPos);
    newState.snakes[i] = snake;
  }
  
  // Check if game is over
  newState.gameOver = newState.snakes.every(snake => !snake.alive);
  
  return newState;
}

export function changeDirection(gameState: GameState, playerId: string, newDirection: Direction): GameState {
  const newState = { ...gameState };
  const snakeIndex = newState.snakes.findIndex(snake => snake.id === playerId);
  
  if (snakeIndex === -1) return gameState;
  
  const snake = { ...newState.snakes[snakeIndex] };
  const currentDirection = snake.direction;
  
  // Prevent 180-degree turns
  if (
    (currentDirection === Direction.UP && newDirection === Direction.DOWN) ||
    (currentDirection === Direction.DOWN && newDirection === Direction.UP) ||
    (currentDirection === Direction.LEFT && newDirection === Direction.RIGHT) ||
    (currentDirection === Direction.RIGHT && newDirection === Direction.LEFT)
  ) {
    return gameState;
  }
  
  snake.direction = newDirection;
  newState.snakes[snakeIndex] = snake;
  
  return newState;
}

function generateInitialSnakeBody(
  gridSize: { width: number; height: number },
  length: number,
  fromRight: boolean = false
): Position[] {
  const body: Position[] = [];
  const startX = fromRight ? gridSize.width - Math.floor(gridSize.width / 4) : Math.floor(gridSize.width / 4);
  const startY = Math.floor(gridSize.height / 2);
  
  for (let i = 0; i < length; i++) {
    body.push({
      x: fromRight ? startX - i : startX + i,
      y: startY
    });
  }
  
  return body;
}

function generateFood(
  gridSize: { width: number; height: number },
  snakeBodies: Position[][]
): Position {
  const flattenedBodies = snakeBodies.flat();
  let food: Position;
  
  do {
    food = {
      x: Math.floor(Math.random() * gridSize.width),
      y: Math.floor(Math.random() * gridSize.height)
    };
  } while (flattenedBodies.some(pos => pos.x === food.x && pos.y === food.y));
  
  return food;
}

function getNextPosition(
  head: Position,
  direction: Direction,
  gridSize: { width: number; height: number }
): Position {
  const nextPos = { ...head };
  
  switch (direction) {
    case Direction.UP:
      nextPos.y = (nextPos.y - 1 + gridSize.height) % gridSize.height;
      break;
    case Direction.DOWN:
      nextPos.y = (nextPos.y + 1) % gridSize.height;
      break;
    case Direction.LEFT:
      nextPos.x = (nextPos.x - 1 + gridSize.width) % gridSize.width;
      break;
    case Direction.RIGHT:
      nextPos.x = (nextPos.x + 1) % gridSize.width;
      break;
  }
  
  return nextPos;
}

function checkCollision(
  position: Position,
  snakeBodies: Position[][],
  excludeSnakeIndex: number
): boolean {
  // Check collision with any snake body except the head of the current snake
  for (let i = 0; i < snakeBodies.length; i++) {
    const body = snakeBodies[i];
    
    // If checking against self, skip the head (index 0)
    const startIndex = i === excludeSnakeIndex ? 1 : 0;
    
    for (let j = startIndex; j < body.length; j++) {
      if (position.x === body[j].x && position.y === body[j].y) {
        return true;
      }
    }
  }
  
  return false;
}
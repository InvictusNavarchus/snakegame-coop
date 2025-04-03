import { Direction, type GameState, type Position, type Snake, type GameSettings } from './types';
import { logger } from '$lib/utils/logger';

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
  logger.info('game', `Initializing new game for player ${playerId}`);
  const gameSettings = { ...DEFAULT_SETTINGS, ...settings };
  const { gridSize, initialSnakeLength, foodCount } = gameSettings;
  
  logger.debug('game', `Game settings: gridSize=${gridSize.width}x${gridSize.height}, initialSnakeLength=${initialSnakeLength}, foodCount=${foodCount}`);
  
  // Create initial snake
  const snake: Snake = {
    id: playerId,
    body: generateInitialSnakeBody(gridSize, initialSnakeLength),
    direction: Direction.RIGHT,
    color: 'var(--color-snake1)',
    score: 0,
    alive: true
  };
  
  logger.debug('state', `Created snake for player ${playerId} with body length ${snake.body.length}`);

  // Generate initial food positions
  const food: Position[] = [];
  for (let i = 0; i < foodCount; i++) {
    food.push(generateFood(gridSize, [snake.body]));
  }
  
  logger.debug('food', `Generated ${food.length} initial food items`);

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
  logger.info('game', `Adding new player ${playerId} to existing game`);
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
  logger.info('state', `Player ${playerId} added to game. Total players: ${newState.snakes.length}`);
  return newState;
}

export function updateGame(gameState: GameState): GameState {
  if (gameState.gameOver || gameState.isPaused) return gameState;
  
  logger.debug('game', 'Updating game state');
  const newState = { ...gameState };
  const allSnakeBodies = newState.snakes.map(snake => snake.body);
  
  // Update each snake
  for (let i = 0; i < newState.snakes.length; i++) {
    if (!newState.snakes[i].alive) continue;
    
    const snake = { ...newState.snakes[i] };
    const head = { ...snake.body[0] };
    const nextPos = getNextPosition(head, snake.direction, newState.gridSize);
    
    logger.debug('state', `Moving snake ${snake.id} from [${head.x},${head.y}] to [${nextPos.x},${nextPos.y}], direction: ${Direction[snake.direction]}`);
    
    // Check for collisions with walls or other snakes
    if (checkCollision(nextPos, allSnakeBodies, i)) {
      snake.alive = false;
      newState.snakes[i] = snake;
      logger.info('collision', `Snake ${snake.id} collided at position [${nextPos.x},${nextPos.y}]`);
      continue;
    }
    
    // Check if food is eaten
    const foodIndex = newState.food.findIndex(f => f.x === nextPos.x && f.y === nextPos.y);
    if (foodIndex >= 0) {
      // Eat food
      const eatenFood = newState.food[foodIndex];
      snake.score += 1;
      newState.food.splice(foodIndex, 1);
      logger.info('food', `Snake ${snake.id} ate food at [${eatenFood.x},${eatenFood.y}], new score: ${snake.score}`);
      
      // Generate new food
      const newFood = generateFood(newState.gridSize, allSnakeBodies);
      newState.food.push(newFood);
      logger.debug('food', `New food generated at [${newFood.x},${newFood.y}]`);
    } else {
      // Remove tail if no food was eaten
      snake.body.pop();
    }
    
    // Add new head
    snake.body.unshift(nextPos);
    newState.snakes[i] = snake;
  }
  
  // Check if game is over
  const anyAlive = newState.snakes.some(snake => snake.alive);
  newState.gameOver = !anyAlive;
  
  if (newState.gameOver) {
    logger.info('game', 'Game over - all snakes are dead');
  }
  
  return newState;
}

export function changeDirection(gameState: GameState, playerId: string, newDirection: Direction): GameState {
  const newState = { ...gameState };
  const snakeIndex = newState.snakes.findIndex(snake => snake.id === playerId);
  
  if (snakeIndex === -1) {
    logger.warn('state', `Attempted direction change for unknown player ${playerId}`);
    return gameState;
  }
  
  const snake = { ...newState.snakes[snakeIndex] };
  const currentDirection = snake.direction;
  
  logger.debug('input', `Direction change requested for snake ${playerId}: ${Direction[currentDirection]} → ${Direction[newDirection]}`);
  
  // Prevent 180-degree turns
  if (
    (currentDirection === Direction.UP && newDirection === Direction.DOWN) ||
    (currentDirection === Direction.DOWN && newDirection === Direction.UP) ||
    (currentDirection === Direction.LEFT && newDirection === Direction.RIGHT) ||
    (currentDirection === Direction.RIGHT && newDirection === Direction.LEFT)
  ) {
    logger.debug('input', `Invalid 180° turn rejected: ${Direction[currentDirection]} → ${Direction[newDirection]}`);
    return gameState;
  }
  
  snake.direction = newDirection;
  newState.snakes[snakeIndex] = snake;
  logger.debug('state', `Snake ${playerId} direction changed to ${Direction[newDirection]}`);
  
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
  
  logger.debug('state', `Generated snake body at ${fromRight ? 'right' : 'left'} side, start position: [${startX},${startY}], length: ${length}`);
  return body;
}

function generateFood(
  gridSize: { width: number; height: number },
  snakeBodies: Position[][]
): Position {
  const flattenedBodies = snakeBodies.flat();
  let food: Position;
  let attempts = 0;
  
  logger.debug('food', 'Generating new food item');
  
  do {
    food = {
      x: Math.floor(Math.random() * gridSize.width),
      y: Math.floor(Math.random() * gridSize.height)
    };
    attempts++;
    
    if (attempts > 100) {
      logger.warn('food', `Failed to find free space for food after ${attempts} attempts. Grid might be too full.`);
      break;
    }
  } while (flattenedBodies.some(pos => pos.x === food.x && pos.y === food.y));
  
  logger.debug('food', `Food generated at [${food.x},${food.y}] after ${attempts} attempts`);
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
        logger.debug('collision', `Collision detected at [${position.x},${position.y}] with snake ${i}, segment ${j}`);
        return true;
      }
    }
  }
  
  return false;
}
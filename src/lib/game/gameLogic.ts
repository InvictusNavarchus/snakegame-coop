// src/lib/game/gameLogic.ts
import { Direction, type GameState, type Position, type Snake, type GameSettings } from './types';
import { logger } from '$lib/utils/logger';

// Define available colors for snakes (add more if needed)
const SNAKE_COLORS = [
  'var(--color-snake1)', // Host/Player 0
  'var(--color-snake2)', // Player 1
  'var(--color-snake3)', // Player 2
  'var(--color-snake4)'  // Player 3
];

// Define default settings including max players
const DEFAULT_SETTINGS: GameSettings = {
  gridSize: { width: 30, height: 30 },
  speed: 150, // Target update interval in ms
  foodCount: 3,
  initialSnakeLength: 3,
  maxPlayers: SNAKE_COLORS.length // Max players based on defined colors
};

// Helper function to get a unique color based on player index
function getPlayerColor(playerIndex: number): string {
  return SNAKE_COLORS[playerIndex % SNAKE_COLORS.length];
}

// Helper function to determine starting position and direction based on index
function getInitialSnakePlacement(
    playerIndex: number,
    gridSize: { width: number; height: number },
    length: number
): { body: Position[]; direction: Direction } {
    const body: Position[] = [];
    let startX: number, startY: number;
    let direction: Direction;
    const padding = 2; // Distance from edge

    switch (playerIndex) {
        case 0: // Host: Top-left, moving Right
            startX = padding + length -1;
            startY = padding;
            direction = Direction.RIGHT;
            for (let i = 0; i < length; i++) {
                body.push({ x: startX - i, y: startY });
            }
            break;
        case 1: // Player 1: Bottom-right, moving Left
            startX = gridSize.width - 1 - padding - length + 1;
            startY = gridSize.height - 1 - padding;
            direction = Direction.LEFT;
            for (let i = 0; i < length; i++) {
                body.push({ x: startX + i, y: startY });
            }
            break;
        case 2: // Player 2: Top-right, moving Left
            startX = gridSize.width - 1 - padding - length + 1;
            startY = padding;
            direction = Direction.LEFT;
            for (let i = 0; i < length; i++) {
                body.push({ x: startX + i, y: startY });
            }
            break;
        case 3: // Player 3: Bottom-left, moving Right
            startX = padding + length - 1;
            startY = gridSize.height - 1 - padding;
            direction = Direction.RIGHT;
             for (let i = 0; i < length; i++) {
                body.push({ x: startX - i, y: startY });
            }
            break;
        default: // Fallback or additional players - cycle positions
            // Simple fallback: Place near center, moving randomly (can be improved)
             startX = Math.floor(gridSize.width / 2) + (playerIndex % 2 === 0 ? -2 : 2);
             startY = Math.floor(gridSize.height / 2) + (playerIndex % 3 === 0 ? -2 : 2);
             direction = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT][playerIndex % 4];
             body.push({ x: startX, y: startY });
             for (let i = 1; i < length; i++) {
                 // Simplified initial body for fallback
                 body.push({ x: startX, y: startY + i});
             }
             // Ensure head is first element after simple generation
             [body[0], body[body.length -1]] = [body[body.length -1], body[0]];
            logger.warn('game', `Using fallback placement for player index ${playerIndex}`);
            break;
    }

     logger.debug('state', `Generated snake placement for playerIndex ${playerIndex}: start [${body[0].x},${body[0].y}], direction ${Direction[direction]}`);
    return { body, direction };
}


export function initializeGame(
  playerIds: string[], // Pass all player IDs at once
  settings: Partial<GameSettings> = {}
): GameState {
  const gameSettings = { ...DEFAULT_SETTINGS, ...settings };
  const { gridSize, initialSnakeLength, foodCount, maxPlayers } = gameSettings;

  if (playerIds.length === 0) {
      throw new Error("Cannot initialize game with no players.");
  }
  if (playerIds.length > maxPlayers) {
       logger.warn('game', `Attempting to initialize game with ${playerIds.length} players, but max is ${maxPlayers}. Truncating.`);
       playerIds = playerIds.slice(0, maxPlayers);
  }

  logger.info('game', `Initializing new game for players: ${playerIds.join(', ')}`);
  logger.debug('game', `Game settings: gridSize=${gridSize.width}x${gridSize.height}, initialSnakeLength=${initialSnakeLength}, foodCount=${foodCount}`);

  const snakes: Snake[] = [];
  const allBodies: Position[][] = [];

  // Create snakes for all players
  playerIds.forEach((playerId, index) => {
      const placement = getInitialSnakePlacement(index, gridSize, initialSnakeLength);
      const snake: Snake = {
          id: playerId,
          playerIndex: index,
          body: placement.body,
          direction: placement.direction,
          color: getPlayerColor(index),
          score: 0,
          alive: true
      };
      snakes.push(snake);
      allBodies.push(snake.body);
      logger.debug('state', `Created snake for player ${playerId} (index ${index}) with body length ${snake.body.length}`);
  });

  // Generate initial food positions, avoiding all initial snake bodies
  const food: Position[] = [];
  for (let i = 0; i < foodCount; i++) {
      // Pass existing food as well to avoid overlap
      const occupied = [...allBodies.flat(), ...food];
      food.push(generateFood(gridSize, occupied));
  }

  logger.debug('food', `Generated ${food.length} initial food items`);

  return {
      snakes,
      food,
      gridSize,
      gameOver: false,
      isPaused: false
      // speed: gameSettings.speed // Store speed in state if needed
  };
}

export function addPlayerToGame(
  gameState: GameState,
  playerId: string
): GameState | null { // Return null if game is full
  const currentPlayers = gameState.snakes.length;
  if (currentPlayers >= DEFAULT_SETTINGS.maxPlayers) {
      logger.warn('game', `Cannot add player ${playerId}, game is full (${currentPlayers}/${DEFAULT_SETTINGS.maxPlayers}).`);
      return null;
  }

  const playerIndex = currentPlayers; // Next available index
  logger.info('game', `Adding new player ${playerId} (index ${playerIndex}) to existing game`);

  const placement = getInitialSnakePlacement(playerIndex, gameState.gridSize, DEFAULT_SETTINGS.initialSnakeLength);

  // Check for immediate collision with existing snakes/food (unlikely with placement logic but good practice)
  const allOccupied = [...gameState.snakes.map(s => s.body).flat(), ...gameState.food];
  const startPositionOccupied = placement.body.some(pos =>
      allOccupied.some(occupiedPos => occupiedPos.x === pos.x && occupiedPos.y === pos.y)
  );

  if (startPositionOccupied) {
       logger.error('game', `Failed to add player ${playerId}: Generated start position overlaps with existing elements.`);
       // Ideally, retry placement or handle differently. Returning null for now.
       return null;
  }


  const newSnake: Snake = {
      id: playerId,
      playerIndex: playerIndex,
      body: placement.body,
      direction: placement.direction,
      color: getPlayerColor(playerIndex),
      score: 0,
      alive: true
  };

  const newState = {
      ...gameState,
      snakes: [...gameState.snakes, newSnake]
  };

  logger.info('state', `Player ${playerId} added to game. Total players: ${newState.snakes.length}`);
  return newState;
}

export function updateGame(gameState: GameState): GameState {
  if (gameState.gameOver || gameState.isPaused) return gameState;

  // logger.debug('game', 'Updating game state'); // Can be noisy
  let newState = { ...gameState }; // Shallow copy first
  let snakesChanged = false;
  let foodChanged = false;
  const newSnakes: Snake[] = [];
  const allCurrentBodies = newState.snakes.map(snake => snake.body); // Bodies before this update step

  // Update each snake
  for (let i = 0; i < newState.snakes.length; i++) {
    let currentSnake = newState.snakes[i];
    if (!currentSnake.alive) {
        newSnakes.push(currentSnake); // Keep dead snakes in the array
        continue;
    }

    let snake = { ...currentSnake }; // Copy snake for modification
    const head = { ...snake.body[0] };
    const nextPos = getNextPosition(head, snake.direction, newState.gridSize);

    // logger.debug('state', `Moving snake ${snake.id} from [${head.x},${head.y}] to [${nextPos.x},${nextPos.y}], direction: ${Direction[snake.direction]}`);

    // Check for collisions with walls (handled by getNextPosition wrap) or other snakes (including self)
    // Pass all bodies *before* this update cycle to check against stable positions
    if (checkCollision(nextPos, allCurrentBodies, snake.playerIndex)) {
      snake.alive = false;
      snakesChanged = true;
      newSnakes.push(snake);
      logger.info('collision', `Snake ${snake.id} (index ${snake.playerIndex}) collided at position [${nextPos.x},${nextPos.y}]`);
      continue; // Move to next snake
    }

    // Create a mutable copy of the body for this snake
    let newBody = snake.body.map(p => ({...p}));

    // Check if food is eaten
    const foodIndex = newState.food.findIndex(f => f.x === nextPos.x && f.y === nextPos.y);
    if (foodIndex >= 0) {
      // Eat food - grow by *not* removing tail
      const eatenFood = newState.food[foodIndex];
      snake.score += 1;

      // Shallow copy food array before modifying
      if (!foodChanged) newState.food = [...newState.food];

      newState.food.splice(foodIndex, 1); // Remove eaten food

      logger.info('food', `Snake ${snake.id} ate food at [${eatenFood.x},${eatenFood.y}], new score: ${snake.score}`);

      // Generate new food, avoiding all current snake bodies (including the new head position)
      // And existing food
      const allOccupiedNow = [
          ...allCurrentBodies.flat(),
          nextPos, // Include the new head position
          ...newState.food // Include remaining food
      ];
      const newFood = generateFood(newState.gridSize, allOccupiedNow);
      newState.food.push(newFood);
      foodChanged = true;
      logger.debug('food', `New food generated at [${newFood.x},${newFood.y}]`);
    } else {
      // Remove tail if no food was eaten
      newBody.pop();
    }

    // Add new head
    newBody.unshift(nextPos);
    snake.body = newBody; // Update snake object with new body
    snakesChanged = true;
    newSnakes.push(snake); // Add updated snake to the new array
  }

  // If any snake changed, update the snakes array in the state
  if (snakesChanged) {
       newState.snakes = newSnakes;
  }

  // Check if game is over (only if any snake was alive at the start of the tick)
  const wasAnyAlive = gameState.snakes.some(snake => snake.alive);
  if (wasAnyAlive) {
       const isAnyAliveNow = newState.snakes.some(snake => snake.alive);
       newState.gameOver = !isAnyAliveNow;

       if (newState.gameOver) {
           logger.info('game', 'Game over - all previously alive snakes are now dead');
       }
  } else {
      // If no snakes were alive to begin with, game might already be over
      newState.gameOver = gameState.gameOver;
  }


  return newState;
}

export function changeDirection(gameState: GameState, playerId: string, newDirection: Direction): GameState {
  const snakeIndex = gameState.snakes.findIndex(snake => snake.id === playerId);

  if (snakeIndex === -1 || !gameState.snakes[snakeIndex].alive) {
    // logger.warn('state', `Attempted direction change for unknown or dead player ${playerId}`);
    return gameState; // No change
  }

  // Create a shallow copy of the state and the specific snake
  const newState = { ...gameState };
  const snake = { ...newState.snakes[snakeIndex] };
  const currentDirection = snake.direction;

  // logger.debug('input', `Direction change requested for snake ${playerId}: ${Direction[currentDirection]} → ${Direction[newDirection]}`);

  // Prevent 180-degree turns only if the snake has more than one segment
  if (snake.body.length > 1 &&
    ( (currentDirection === Direction.UP && newDirection === Direction.DOWN) ||
      (currentDirection === Direction.DOWN && newDirection === Direction.UP) ||
      (currentDirection === Direction.LEFT && newDirection === Direction.RIGHT) ||
      (currentDirection === Direction.RIGHT && newDirection === Direction.LEFT) )
  ) {
    // logger.debug('input', `Invalid 180° turn rejected: ${Direction[currentDirection]} → ${Direction[newDirection]}`);
    return gameState; // No change
  }

  // If the direction is actually different
  if (snake.direction !== newDirection) {
       snake.direction = newDirection;
       // Create a new snakes array with the updated snake
       const newSnakes = [...newState.snakes];
       newSnakes[snakeIndex] = snake;
       newState.snakes = newSnakes;
       // logger.debug('state', `Snake ${playerId} direction changed to ${Direction[newDirection]}`);
       return newState;
  }

  return gameState; // No change if direction is the same
}


function generateFood(
  gridSize: { width: number; height: number },
  occupiedPositions: Position[] // Pass all currently occupied positions
): Position {
  let food: Position;
  let attempts = 0;
  const maxAttempts = gridSize.width * gridSize.height; // Theoretical max

  // logger.debug('food', 'Generating new food item');

  do {
    food = {
      x: Math.floor(Math.random() * gridSize.width),
      y: Math.floor(Math.random() * gridSize.height)
    };
    attempts++;

    if (attempts > maxAttempts) { // Changed limit to be more reasonable
      logger.error('food', `Failed to find free space for food after ${attempts} attempts. Grid might be full or near full.`);
      // Fallback: return a potentially occupied spot (less ideal, but prevents infinite loop)
      return food;
    }
  // Check against the provided list of occupied positions
  } while (occupiedPositions.some(pos => pos.x === food.x && pos.y === food.y));

  // logger.debug('food', `Food generated at [${food.x},${food.y}] after ${attempts} attempts`);
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
      nextPos.y -= 1;
      break;
    case Direction.DOWN:
      nextPos.y += 1;
      break;
    case Direction.LEFT:
      nextPos.x -= 1;
      break;
    case Direction.RIGHT:
      nextPos.x += 1;
      break;
  }

   // Wrap around grid boundaries
   if (nextPos.x < 0) nextPos.x = gridSize.width - 1;
   if (nextPos.x >= gridSize.width) nextPos.x = 0;
   if (nextPos.y < 0) nextPos.y = gridSize.height - 1;
   if (nextPos.y >= gridSize.height) nextPos.y = 0;

  return nextPos;
}

function checkCollision(
  nextHeadPos: Position,
  allSnakeBodies: Position[][], // Pass all bodies *before* the move
  movingSnakeIndex: number
): boolean {
  // Check collision with any snake body segment
  for (let i = 0; i < allSnakeBodies.length; i++) {
    const body = allSnakeBodies[i];
    // Determine if we are checking against the moving snake's own body
    const isSelf = (i === movingSnakeIndex);

    // If checking self, we can collide with any segment *except the tail*,
    // because the tail will move out of the way *unless* the snake grew this turn.
    // Simpler check: Check against all segments. If it hits the last segment (tail),
    // it's only a collision if the snake didn't just eat. However, checking against
    // the state *before* the move avoids this complexity. We just need to ensure
    // the new head position doesn't overlap with any *existing* segment position.
    // For self-collision, skip checking the head's *current* position (index 0),
    // as the head is moving away from it.
    // Update: It's simpler to check if the nextHeadPos exists anywhere in *any* snake body.

    for (let j = 0; j < body.length; j++) {
        // Special case: Don't check collision with the *head* of the snake that is moving
        // if (isSelf && j === 0) {
        //    continue; // Head moves away from its current spot
        // }
        // Actually, the head is moving *to* nextHeadPos, so we just need to check
        // if nextHeadPos matches *any* existing body segment's position.

        if (nextHeadPos.x === body[j].x && nextHeadPos.y === body[j].y) {
             // logger.debug('collision', `Collision detected at [${nextHeadPos.x},${nextHeadPos.y}] with snake index ${i}, segment ${j}`);
             return true;
         }
    }
  }

  return false;
}
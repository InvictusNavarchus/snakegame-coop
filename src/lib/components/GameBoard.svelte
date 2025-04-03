<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Direction, type GameState, type Position } from '$lib/game/types';
  import { updateGame } from '$lib/game/gameLogic';
  import { playerId } from '$lib/network/peerConnection';
  import { logger } from '$lib/utils/logger';
  
  export let gameState: GameState;
  export let cellSize: number = 20;
  export let onUpdate: (gameState: GameState) => void;
  export let onDirectionChange: (direction: Direction) => void;
  export let gameActive: boolean = false; // New prop to control when game should start
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let gameLoopInterval: number;
  let lastRenderTime = 0;
  
  $: canvasWidth = gameState.gridSize.width * cellSize;
  $: canvasHeight = gameState.gridSize.height * cellSize;
  
  // Watch for changes to gameActive and start/stop the game loop accordingly
  $: if (ctx && gameActive !== undefined) {
    if (gameActive) {
      startGameLoop();
    } else if (gameLoopInterval) {
      logger.info('game', 'Stopping game loop as game is not active');
      clearInterval(gameLoopInterval);
      gameLoopInterval = undefined;
    }
  }
  
  onMount(() => {
    logger.info('render', 'GameBoard mounted, initializing canvas and controls');
    ctx = canvas.getContext('2d')!;
    setupKeyboardControls();
    setupTouchControls();
    
    // Only start rendering, don't start the game loop yet
    requestAnimationFrame(render);
    
    return () => {
      logger.info('render', 'Clearing game loop interval on component cleanup');
      if (gameLoopInterval) clearInterval(gameLoopInterval);
    };
  });
  
  onDestroy(() => {
    if (gameLoopInterval) {
      logger.info('render', 'GameBoard destroyed, cleaning up resources');
      clearInterval(gameLoopInterval);
    }
  });
  
  function startGameLoop() {
    if (gameLoopInterval) {
      logger.debug('game', 'Clearing existing game loop before starting new one');
      clearInterval(gameLoopInterval);
    }
    
    logger.info('game', 'Starting game loop');
    gameLoopInterval = setInterval(() => {
      if (!gameState.gameOver && !gameState.isPaused && gameActive) {
        logger.debug('game', 'Updating game state');
        const updatedState = updateGame(gameState);
        onUpdate(updatedState);
      }
      render();
    }, 150) as unknown as number;
  }
  
  function render() {
    if (!ctx) {
      logger.warn('render', 'Render called but canvas context is not available');
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 0.5;
    
    // Vertical lines
    for (let x = 0; x <= canvasWidth; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= canvasHeight; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
    
    // Draw food
    for (const food of gameState.food) {
      drawFood(food);
    }
    
    // Draw snakes
    for (const snake of gameState.snakes) {
      logger.debug('render', `Drawing snake ${snake.id}, alive: ${snake.alive}, length: ${snake.body.length}`);
      drawSnake(snake.body, snake.color, snake.alive);
    }
    
    // Draw game over overlay only if game was actually active
    if (gameState.gameOver && gameActive) {
      logger.info('game', 'Game over, drawing overlay');
      drawGameOverOverlay();
    }
    
    // If not active yet, request next animation frame for rendering
    if (!gameActive && !gameLoopInterval) {
      requestAnimationFrame(render);
    }
  }
  
  function drawSnake(body: Position[], color: string, alive: boolean) {
    if (!ctx) return;
    
    ctx.fillStyle = alive ? color : '#555555';
    
    // Draw body segments
    for (let i = 1; i < body.length; i++) {
      ctx.fillRect(
        body[i].x * cellSize,
        body[i].y * cellSize,
        cellSize,
        cellSize
      );
    }
    
    // Draw head with rounded corners
    const head = body[0];
    const radius = cellSize / 4;
    
    ctx.beginPath();
    ctx.moveTo(head.x * cellSize + radius, head.y * cellSize);
    ctx.lineTo(head.x * cellSize + cellSize - radius, head.y * cellSize);
    ctx.quadraticCurveTo(head.x * cellSize + cellSize, head.y * cellSize, head.x * cellSize + cellSize, head.y * cellSize + radius);
    ctx.lineTo(head.x * cellSize + cellSize, head.y * cellSize + cellSize - radius);
    ctx.quadraticCurveTo(head.x * cellSize + cellSize, head.y * cellSize + cellSize, head.x * cellSize + cellSize - radius, head.y * cellSize + cellSize);
    ctx.lineTo(head.x * cellSize + radius, head.y * cellSize + cellSize);
    ctx.quadraticCurveTo(head.x * cellSize, head.y * cellSize + cellSize, head.x * cellSize, head.y * cellSize + cellSize - radius);
    ctx.lineTo(head.x * cellSize, head.y * cellSize + radius);
    ctx.quadraticCurveTo(head.x * cellSize, head.y * cellSize, head.x * cellSize + radius, head.y * cellSize);
    ctx.closePath();
    ctx.fill();
    
    // Draw eyes
    const eyeSize = cellSize / 5;
    const eyeOffset = cellSize / 4;
    
    ctx.fillStyle = '#ffffff';
    
    // Left eye
    ctx.beginPath();
    ctx.arc(
      head.x * cellSize + eyeOffset + eyeSize/2,
      head.y * cellSize + eyeOffset + eyeSize/2,
      eyeSize/2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Right eye
    ctx.beginPath();
    ctx.arc(
      head.x * cellSize + cellSize - eyeOffset - eyeSize/2,
      head.y * cellSize + eyeOffset + eyeSize/2,
      eyeSize/2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Pupils
    ctx.fillStyle = '#000000';
    
    // Left pupil
    ctx.beginPath();
    ctx.arc(
      head.x * cellSize + eyeOffset + eyeSize/2,
      head.y * cellSize + eyeOffset + eyeSize/2,
      eyeSize/4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Right pupil
    ctx.beginPath();
    ctx.arc(
      head.x * cellSize + cellSize - eyeOffset - eyeSize/2,
      head.y * cellSize + eyeOffset + eyeSize/2,
      eyeSize/4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  
  function drawFood(food: Position) {
    if (!ctx) return;
    
    const x = food.x * cellSize;
    const y = food.y * cellSize;
    const radius = cellSize / 2;
    
    // Draw pulsating effect
    const pulse = Math.sin(Date.now() / 200) * 0.1 + 0.9;
    const scaledRadius = radius * pulse;
    
    // Draw food with glow effect
    ctx.shadowColor = 'var(--color-food)';
    ctx.shadowBlur = 10 * pulse;
    
    // Main circle
    ctx.fillStyle = 'var(--color-food)';
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(
      x + radius - scaledRadius / 3,
      y + radius - scaledRadius / 3,
      scaledRadius / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  
  function drawGameOverOverlay() {
    if (!ctx) return;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Game over text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', canvasWidth / 2, canvasHeight / 2 - 30);
    
    // Show scores
    let scoresText = gameState.snakes.map(snake => `Snake ${snake.id === $playerId ? '(You)' : ''}: ${snake.score}`).join(' | ');
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText(scoresText, canvasWidth / 2, canvasHeight / 2 + 20);
    
    // Restart prompt
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Press Space to Restart', canvasWidth / 2, canvasHeight / 2 + 60);
  }
  
  function setupKeyboardControls() {
    logger.info('input', 'Setting up keyboard controls');
    window.addEventListener('keydown', (e) => {
      if (gameState.gameOver || gameState.isPaused) {
        if (e.code === 'Space') {
          logger.info('input', 'Space pressed during game over/pause, triggering restart');
          const event = new CustomEvent('restart');
          canvas.dispatchEvent(event);
        }
        return;
      }
      
      let direction: Direction | null = null;
      
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          direction = Direction.UP;
          break;
        case 'ArrowDown':
        case 'KeyS':
          direction = Direction.DOWN;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          direction = Direction.LEFT;
          break;
        case 'ArrowRight':
        case 'KeyD':
          direction = Direction.RIGHT;
          break;
        case 'Space':
          if (gameState.gameOver) {
            logger.info('input', 'Space pressed, requesting game restart');
            const event = new CustomEvent('restart');
            canvas.dispatchEvent(event);
          } else {
            logger.info('input', 'Space pressed, toggling pause state');
            const event = new CustomEvent('pause');
            canvas.dispatchEvent(event);
          }
          e.preventDefault();
          break;
      }
      
      if (direction !== null) {
        logger.debug('input', `Direction change: ${Direction[direction]}`);
        onDirectionChange(direction);
        e.preventDefault();
      }
    });
  }
  
  function setupTouchControls() {
    logger.info('input', 'Setting up touch controls');
    let touchStartX = 0;
    let touchStartY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      logger.debug('input', `Touch start at x:${touchStartX}, y:${touchStartY}`);
      e.preventDefault();
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (gameState.gameOver) {
        logger.info('input', 'Touch end during game over, requesting restart');
        const event = new CustomEvent('restart');
        canvas.dispatchEvent(event);
        return;
      }
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      
      logger.debug('input', `Touch end at x:${touchEndX}, y:${touchEndY}, dx:${dx}, dy:${dy}`);
      
      // Determine swipe direction
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 0) {
          logger.debug('input', 'Swipe RIGHT detected');
          onDirectionChange(Direction.RIGHT);
        } else {
          logger.debug('input', 'Swipe LEFT detected');
          onDirectionChange(Direction.LEFT);
        }
      } else {
        // Vertical swipe
        if (dy > 0) {
          logger.debug('input', 'Swipe DOWN detected');
          onDirectionChange(Direction.DOWN);
        } else {
          logger.debug('input', 'Swipe UP detected');
          onDirectionChange(Direction.UP);
        }
      }
      
      e.preventDefault();
    }, { passive: false });
  }
</script>

<div class="game-container" style="width: {canvasWidth}px; height: {canvasHeight}px;">
  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    on:restart
    on:pause
  ></canvas>
  
  {#if !gameActive}
    <div class="game-waiting-overlay">
      <p>Create or join a game to start playing</p>
    </div>
  {/if}
</div>

<style>
  .game-container {
    position: relative;
    margin: 0 auto;
    border-radius: var(--game-border-radius);
    overflow: hidden;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
    background-color: #1a1a1a;
  }
  
  canvas {
    display: block;
  }
  
  .game-waiting-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 18px;
    text-align: center;
    padding: 20px;
  }
</style>
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Direction, type GameState, type Position } from '$lib/game/types';
  import { updateGame } from '$lib/game/gameLogic';
  import { playerId } from '$lib/network/peerConnection';
  
  export let gameState: GameState;
  export let cellSize: number = 20;
  export let onUpdate: (gameState: GameState) => void;
  export let onDirectionChange: (direction: Direction) => void;
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let gameLoopInterval: number;
  let lastRenderTime = 0;
  
  $: canvasWidth = gameState.gridSize.width * cellSize;
  $: canvasHeight = gameState.gridSize.height * cellSize;
  
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    setupKeyboardControls();
    setupTouchControls();
    startGameLoop();
    
    return () => {
      clearInterval(gameLoopInterval);
    };
  });
  
  onDestroy(() => {
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
    }
  });
  
  function startGameLoop() {
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
    }
    
    gameLoopInterval = setInterval(() => {
      if (!gameState.gameOver && !gameState.isPaused) {
        const updatedState = updateGame(gameState);
        onUpdate(updatedState);
      }
      render();
    }, 150) as unknown as number;
  }
  
  function render() {
    if (!ctx) return;
    
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
      drawSnake(snake.body, snake.color, snake.alive);
    }
    
    // Draw game over overlay
    if (gameState.gameOver) {
      drawGameOverOverlay();
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
    window.addEventListener('keydown', (e) => {
      if (gameState.gameOver || gameState.isPaused) {
        if (e.code === 'Space') {
          const event = new CustomEvent('restart');
          canvas.dispatchEvent(event);
        }
        return;
      }
      
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          onDirectionChange(Direction.UP);
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          onDirectionChange(Direction.DOWN);
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          onDirectionChange(Direction.LEFT);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          onDirectionChange(Direction.RIGHT);
          e.preventDefault();
          break;
        case 'Space':
          if (gameState.gameOver) {
            const event = new CustomEvent('restart');
            canvas.dispatchEvent(event);
          } else {
            const event = new CustomEvent('pause');
            canvas.dispatchEvent(event);
          }
          e.preventDefault();
          break;
      }
    });
  }
  
  function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (gameState.gameOver) {
        const event = new CustomEvent('restart');
        canvas.dispatchEvent(event);
        return;
      }
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      
      // Determine swipe direction
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > 0) {
          onDirectionChange(Direction.RIGHT);
        } else {
          onDirectionChange(Direction.LEFT);
        }
      } else {
        // Vertical swipe
        if (dy > 0) {
          onDirectionChange(Direction.DOWN);
        } else {
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
</style>
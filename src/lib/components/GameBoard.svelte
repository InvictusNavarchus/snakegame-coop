<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { Direction, type GameState, type Position, type Snake } from '$lib/game/types';
  import { updateGame } from '$lib/game/gameLogic';
  import { playerId, playerInfo } from '$lib/network/peerConnection'; // Import playerInfo
  import { logger } from '$lib/utils/logger';

  export let gameState: GameState;
  export let cellSize: number = 20;
  export let onUpdate: (gameState: GameState) => void; // Host uses this to get updated state
  export let onDirectionChange: (direction: Direction) => void; // Sends direction change to network/logic
  export let gameActive: boolean = false; // Controls if the game logic runs

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  let animationFrameId: number;
  let lastUpdateTime = 0;
  let gameTickRate = 150; // ms per game logic update (can be from gameState.speed if added)

  let touchStartX = 0;
  let touchStartY = 0;
  let hasInteracted = false; // Track first interaction for game start/resume on mobile

  // Reactive calculation for canvas dimensions
  $: canvasWidth = gameState.gridSize.width * cellSize;
  $: canvasHeight = gameState.gridSize.height * cellSize;

  // Recalculate dimensions and redraw if cellSize or gridSize changes
  $: if (canvas && (cellSize || gameState.gridSize)) {
      // No need to request animation frame here, the main loop handles drawing
      // requestAnimationFrame(render); // Redraw immediately if dimensions change
      // Ensure canvas attributes are updated if needed (handled by bind:width/height)
  }

  // Main loop using requestAnimationFrame
  function gameLoop(timestamp: number) {
      animationFrameId = requestAnimationFrame(gameLoop);

      if (!ctx) return;

      // Calculate time delta for smooth updates (optional, using fixed tick rate here)
      const deltaTime = timestamp - lastUpdateTime;

      // --- Game Logic Update ---
      // Only update logic if game is active, not paused, and enough time has passed
      // Crucially, only the HOST should run updateGame
      if ($playerInfo?.isHost && gameActive && !gameState.isPaused && deltaTime >= gameTickRate) {
          lastUpdateTime = timestamp; // Could also do timestamp - (deltaTime % gameTickRate) for accuracy
          logger.debug('game', 'Host updating game state');
          const updatedState = updateGame(gameState);
          // Host emits the authoritative state
          onUpdate(updatedState);
          // NOTE: The host's gameState prop will update reactively via the parent
      }

      // --- Rendering ---
      // Always render the current state received via props
      render();
  }

  onMount(() => {
    logger.info('render', 'GameBoard mounted, initializing canvas and controls');
    const context = canvas.getContext('2d');
    if (!context) {
        logger.error('render', 'Failed to get 2D context');
        return;
    }
    ctx = context;

    // Use default game tick rate for now
    // If gameState had speed: gameTickRate = gameState.speed || 150;

    setupInputListeners();

    // Start the animation loop
    lastUpdateTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      logger.info('render', 'GameBoard unmounting, cleaning up loop and listeners');
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      removeInputListeners();
    };
  });

  // Separate rendering logic
  function render() {
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'; // Use a variable?
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Optional: Draw grid lines (can be performance intensive)
    drawGrid();

    // Draw food
    gameState.food.forEach(drawFood);

    // Draw snakes
    gameState.snakes.forEach(snake => {
        // logger.debug('render', `Drawing snake ${snake.id}, alive: ${snake.alive}, length: ${snake.body.length}`);
        drawSnake(snake);
    });

    // Draw overlays based on state
    if (gameState.gameOver && gameActive) {
        drawGameOverOverlay();
    } else if (gameState.isPaused && gameActive) {
        drawPausedOverlay();
    } else if (!gameActive) {
        // This overlay is now handled by the parent +page.svelte
        // drawWaitingOverlay();
    }
  }

  function drawGrid() {
      ctx.strokeStyle = '#2a2a2a'; // Use a variable?
      ctx.lineWidth = 0.5;

      for (let x = 0; x <= canvasWidth; x += cellSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasHeight);
          ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += cellSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasWidth, y);
          ctx.stroke();
      }
  }

 function drawSnake(snake: Snake) {
    if (!ctx || snake.body.length === 0) return;

    const { body, color, alive, id } = snake;
    ctx.fillStyle = alive ? color : '#555555'; // Use gray for dead snakes

    // Draw body segments (rectangles)
    for (let i = 1; i < body.length; i++) {
      ctx.fillRect(
        body[i].x * cellSize,
        body[i].y * cellSize,
        cellSize,
        cellSize
      );
    }

    // Draw head (more distinct)
    const head = body[0];
    const headX = head.x * cellSize;
    const headY = head.y * cellSize;
    const radius = cellSize / 4;

    // Rounded rectangle for head
    ctx.beginPath();
    ctx.moveTo(headX + radius, headY);
    ctx.lineTo(headX + cellSize - radius, headY);
    ctx.quadraticCurveTo(headX + cellSize, headY, headX + cellSize, headY + radius);
    ctx.lineTo(headX + cellSize, headY + cellSize - radius);
    ctx.quadraticCurveTo(headX + cellSize, headY + cellSize, headX + cellSize - radius, headY + cellSize);
    ctx.lineTo(headX + radius, headY + cellSize);
    ctx.quadraticCurveTo(headX, headY + cellSize, headX, headY + cellSize - radius);
    ctx.lineTo(headX, headY + radius);
    ctx.quadraticCurveTo(headX, headY, headX + radius, headY);
    ctx.closePath();
    ctx.fill();

    // Add subtle border to head if it's the player's own snake
    if (id === $playerId && alive) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw eyes (optional, simplified)
    if (alive) {
        const eyeSize = Math.max(2, cellSize / 6);
        const eyeOffsetX = cellSize / 3.5;
        const eyeOffsetY = cellSize / 4;

        ctx.fillStyle = '#ffffff';
        // Left Eye
        ctx.beginPath();
        ctx.arc(headX + eyeOffsetX, headY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        // Right Eye
        ctx.beginPath();
        ctx.arc(headX + cellSize - eyeOffsetX, headY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

         // Pupils (optional, adds directionality)
         ctx.fillStyle = '#000000';
         let pupilOffsetX = 0;
         let pupilOffsetY = 0;
         // Adjust pupil based on direction (simple version)
         // switch (snake.direction) {
         //    case Direction.UP: pupilOffsetY = -eyeSize / 3; break;
         //    case Direction.DOWN: pupilOffsetY = eyeSize / 3; break;
         //    case Direction.LEFT: pupilOffsetX = -eyeSize / 3; break;
         //    case Direction.RIGHT: pupilOffsetX = eyeSize / 3; break;
         // }
         // ctx.beginPath();
         // ctx.arc(headX + eyeOffsetX + pupilOffsetX, headY + eyeOffsetY + pupilOffsetY, eyeSize / 2, 0, Math.PI * 2);
         // ctx.fill();
         // ctx.beginPath();
         // ctx.arc(headX + cellSize - eyeOffsetX + pupilOffsetX, headY + eyeOffsetY + pupilOffsetY, eyeSize / 2, 0, Math.PI * 2);
         // ctx.fill();
    }
  }

  function drawFood(food: Position) {
    if (!ctx) return;

    const x = food.x * cellSize;
    const y = food.y * cellSize;
    const radius = cellSize / 2.5; // Slightly smaller than cell

    // Pulsating effect for food
    const pulseFactor = Math.sin(Date.now() / 250) * 0.1 + 0.95;
    const currentRadius = radius * pulseFactor;

    // Draw food item (e.g., simple circle)
    ctx.fillStyle = 'var(--color-food)'; // Use CSS variable
    ctx.shadowColor = 'var(--color-food)';
    ctx.shadowBlur = 8 * pulseFactor;

    ctx.beginPath();
    ctx.arc(x + cellSize / 2, y + cellSize / 2, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

     // Simple highlight
     ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
     ctx.beginPath();
     ctx.arc(x + cellSize / 2 - currentRadius * 0.3, y + cellSize / 2 - currentRadius * 0.3, currentRadius * 0.4, 0, Math.PI * 2);
     ctx.fill();
  }

  // --- Overlay Functions ---
  function drawOverlayBackground() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  function drawOverlayText(text: string, yOffset: number = 0, size: number = 40) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 + yOffset);
  }

  function drawGameOverOverlay() {
    drawOverlayBackground();
    drawOverlayText('Game Over', -30, 40);

    // Show final scores
    let scoresText = gameState.snakes
        .map(snake => `P${snake.playerIndex} (${snake.id === $playerId ? 'You' : snake.id.substring(0,4)}): ${snake.score}`)
        .join(' | ');
    drawOverlayText(scoresText, 20, 18);

    // Restart prompt - Only host sees restart directly, clients request
    if ($playerInfo?.isHost) {
        drawOverlayText('Press Space or Tap to Restart', 60, 16);
    } else {
         drawOverlayText('Waiting for host to restart...', 60, 16);
    }
  }

  function drawPausedOverlay() {
     drawOverlayBackground();
     drawOverlayText('Paused', -20, 40);
     // Pause prompt - Only host sees resume directly
     if ($playerInfo?.isHost) {
         drawOverlayText('Press Space or Tap to Resume', 30, 16);
     } else {
          drawOverlayText('Game paused by host', 30, 16);
     }
  }

//   function drawWaitingOverlay() { // Handled by parent now
//      drawOverlayBackground();
//      drawOverlayText('Waiting for connection...', 0, 24);
//   }

  // --- Input Handling ---
  function handleKeyDown(e: KeyboardEvent) {
      if (!gameActive) return; // Ignore input if game isn't active
       hasInteracted = true; // Mark interaction

      let direction: Direction | null = null;
      let action: 'pause' | 'restart' | null = null;

      // Handle Pause/Restart first
      if (e.code === 'Space') {
          e.preventDefault();
          if (gameState.gameOver) {
              action = 'restart';
          } else {
              action = 'pause';
          }
      }
      // Handle Directions only if not paused/over (unless restarting)
      else if (!gameState.isPaused && !gameState.gameOver) {
          switch (e.code) {
              case 'ArrowUp': case 'KeyW': direction = Direction.UP; break;
              case 'ArrowDown': case 'KeyS': direction = Direction.DOWN; break;
              case 'ArrowLeft': case 'KeyA': direction = Direction.LEFT; break;
              case 'ArrowRight': case 'KeyD': direction = Direction.RIGHT; break;
          }
          if (direction) e.preventDefault();
      }

      // --- Dispatch actions ---
      if (action === 'pause') {
          logger.info('input', 'Pause/Resume action triggered (keyboard)');
          // Dispatch pause event ONLY if this player is the host
          if ($playerInfo?.isHost) {
             canvas.dispatchEvent(new CustomEvent('pause'));
          } else {
              logger.warn('input', 'Client attempted to pause game via keyboard.');
              // Optionally show a message that only host can pause
          }
      } else if (action === 'restart') {
          logger.info('input', 'Restart action triggered (keyboard)');
           // Dispatch restart event (host handles directly, client sends request)
          canvas.dispatchEvent(new CustomEvent('restart'));
      } else if (direction !== null) {
          // logger.debug('input', `Direction change: ${Direction[direction]}`);
          onDirectionChange(direction); // Let parent handle network logic
      }
  }

  // Touch Controls
 function handleTouchStart(e: TouchEvent) {
    if (!gameActive || e.touches.length === 0) return;
    // Only prevent default if we intend to handle the touch sequence for swipes
    // e.preventDefault(); // Be careful with this, might block scrolling elsewhere

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    // Don't set hasInteracted here, wait for touchend to confirm intent
 }

 function handleTouchEnd(e: TouchEvent) {
     if (!gameActive || e.changedTouches.length === 0) return;
     // e.preventDefault(); // Prevent default actions like click simulation

     const touchEndX = e.changedTouches[0].clientX;
     const touchEndY = e.changedTouches[0].clientY;

     const dx = touchEndX - touchStartX;
     const dy = touchEndY - touchStartY;
     const absDx = Math.abs(dx);
     const absDy = Math.abs(dy);
     const swipeThreshold = 20; // Minimum distance for a swipe

      // Check for tap (minimal movement) first for pause/restart
     if (absDx < swipeThreshold && absDy < swipeThreshold) {
          if (!hasInteracted) {
              hasInteracted = true; // First tap might just start game/focus
              logger.debug('input', 'First tap detected');
              return;
          }

          if (gameState.gameOver) {
               logger.info('input', 'Restart action triggered (tap)');
               canvas.dispatchEvent(new CustomEvent('restart'));
          } else if ($playerInfo?.isHost) { // Only host can pause via tap
               logger.info('input', 'Pause/Resume action triggered (tap)');
               canvas.dispatchEvent(new CustomEvent('pause'));
          }
          return; // Don't process as swipe if it was a tap
     }

     // Process swipes only if game is running
     if (gameState.isPaused || gameState.gameOver) return;

     let direction: Direction | null = null;
     if (absDx > absDy) { // Horizontal swipe
         direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
     } else { // Vertical swipe
         direction = dy > 0 ? Direction.DOWN : Direction.UP;
     }

     if (direction !== null) {
         hasInteracted = true; // Swiping counts as interaction
         // logger.debug('input', `Swipe ${Direction[direction]} detected`);
         onDirectionChange(direction);
     }
 }


  // Add/Remove Listeners
  function setupInputListeners() {
      window.addEventListener('keydown', handleKeyDown);
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false }); // Need active for preventDefault potentially
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  }
  function removeInputListeners() {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
  }


</script>

<div class="game-container" style="--canvas-width: {canvasWidth}px; --canvas-height: {canvasHeight}px;">
  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
    on:pause
    on:restart
  ></canvas>

  </div>

<style>
  .game-container {
    position: relative;
    /* Use CSS variables for dynamic sizing */
    width: var(--canvas-width);
    height: var(--canvas-height);
    max-width: 100%; /* Ensure it doesn't overflow container */
    max-height: 75vh; /* Limit height */
    aspect-ratio: 1 / 1; /* Maintain square aspect ratio based on width */
    margin: 10px auto; /* Center and add margin */
    border-radius: var(--game-border-radius);
    overflow: hidden;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4); /* Enhanced shadow */
    background-color: #1a1a1a; /* Background behind canvas */
    touch-action: none; /* Prevent browser default touch actions like scroll/zoom */
  }

  canvas {
    display: block;
    width: 100%; /* Scale canvas visually */
    height: 100%;
    image-rendering: pixelated; /* Optional: for crisp pixels if using low res */
    image-rendering: crisp-edges; /* Broader support */
  }

  /* Waiting overlay handled by parent now */
  /* .game-waiting-overlay { ... } */

   @media (max-width: 600px) {
       .game-container {
           max-height: 60vh; /* Adjust height limit on small screens */
       }
   }
</style>
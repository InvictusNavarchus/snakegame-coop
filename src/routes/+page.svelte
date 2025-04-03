<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Direction, type GameState } from '$lib/game/types';
  import { initializeGame, addPlayerToGame, changeDirection } from '$lib/game/gameLogic';
  import GameBoard from '$lib/components/GameBoard.svelte';
  import Scoreboard from '$lib/components/Scoreboard.svelte';
  import GameControls from '$lib/components/GameControls.svelte';
  import ConnectionPanel from '$lib/components/ConnectionPanel.svelte';
  import { 
    playerId, 
    playerInfo,
    connectionStatus, 
    onMessage, 
    broadcastGameState, 
    broadcastDirectionChange,
    broadcastGameRestart,
    cleanupConnections
  } from '$lib/network/peerConnection';
  
  let gameState: GameState;
  let ready = false;
  let cellSize = 20;
  
  // Responsive cell size based on viewport
  function updateCellSize() {
    const width = window.innerWidth;
    if (width < 480) {
      cellSize = 14;
    } else if (width < 768) {
      cellSize = 16;
    } else {
      cellSize = 20;
    }
  }
  
  onMount(() => {
    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    
    // Initialize the game with a default state
    gameState = initializeGame($playerId);
    ready = true;
    
    // Set up message handlers for peer-to-peer communication
    onMessage((message, peerId) => {
      switch (message.type) {
        case 'STATE_UPDATE':
          // Update the game state from the host
          if (!$playerInfo?.isHost) {
            gameState = message.data;
          }
          break;
          
        case 'DIRECTION_CHANGE':
          // Update direction of a specific snake
          if ($playerInfo?.isHost) {
            const { id, direction } = message.data;
            gameState = changeDirection(gameState, id, direction);
            broadcastGameState(gameState);
          }
          break;
          
        case 'JOIN_REQUEST':
          // Add a new player to the game
          if ($playerInfo?.isHost) {
            gameState = addPlayerToGame(gameState, peerId);
            broadcastGameState(gameState);
          }
          break;
          
        case 'RESTART':
          // Restart the game
          if ($playerInfo?.isHost) {
            handleRestart();
          }
          break;
      }
    });
    
    return () => {
      window.removeEventListener('resize', updateCellSize);
      cleanupConnections();
    };
  });
  
  onDestroy(() => {
    cleanupConnections();
  });
  
  function handleGameUpdate(updatedState: GameState) {
    gameState = updatedState;
    
    // If we're the host, broadcast the updated state to all peers
    if ($playerInfo?.isHost) {
      broadcastGameState(gameState);
    }
  }
  
  function handleDirectionChange(direction: Direction) {
    if (!gameState || gameState.gameOver || gameState.isPaused) return;
    
    // Update our own snake's direction
    gameState = changeDirection(gameState, $playerId, direction);
    
    // If we're the host, broadcast the updated state
    if ($playerInfo?.isHost) {
      broadcastGameState(gameState);
    } else {
      // Otherwise, send the direction change to the host
      broadcastDirectionChange(direction);
    }
  }
  
  function handlePause() {
    if (!gameState || gameState.gameOver) return;
    
    gameState = {
      ...gameState,
      isPaused: !gameState.isPaused
    };
    
    // If we're the host, broadcast the updated state
    if ($playerInfo?.isHost) {
      broadcastGameState(gameState);
    }
  }
  
  function handleRestart() {
    // Create a new game state
    if ($playerInfo?.isHost) {
      gameState = initializeGame($playerId);
      
      // Add all connected peers as players
      /* This would ideally be done with a list of peers,
         but for simplicity, we're assuming just one other player */
      if ($connectionStatus === 'connected' && $playerInfo?.isHost) {
        // We could add all connected peers here
      }
      
      broadcastGameState(gameState);
    } else {
      // If we're not the host, request a restart from the host
      broadcastGameRestart();
    }
  }
</script>

<svelte:head>
  <title>Co-op Snake Game</title>
  <meta name="description" content="A cooperative snake game with peer-to-peer multiplayer">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="game-page">
  <header>
    <h1>Co-op Snake</h1>
    <p class="subtitle">A peer-to-peer multiplayer snake game</p>
  </header>
  
  {#if ready && gameState}
    {#if $connectionStatus !== 'connected'}
      <ConnectionPanel />
    {/if}
    
    <Scoreboard snakes={gameState.snakes} />
    
    <GameBoard 
      {gameState}
      {cellSize}
      onUpdate={handleGameUpdate}
      onDirectionChange={handleDirectionChange}
      on:restart={() => handleRestart()}
      on:pause={() => handlePause()}
    />
    
    <GameControls 
      onPause={handlePause}
      onRestart={handleRestart}
      isPaused={gameState.isPaused}
      gameOver={gameState.gameOver}
    />
    
    <div class="instructions">
      <h3>How to Play</h3>
      <div class="instruction-grid">
        <div class="instruction-item">
          <div class="instruction-icon">⌨️</div>
          <div class="instruction-text">
            <strong>Keyboard:</strong> Use arrow keys or WASD to control your snake
          </div>
        </div>
        <div class="instruction-item">
          <div class="instruction-icon">👆</div>
          <div class="instruction-text">
            <strong>Mobile:</strong> Swipe in any direction to move
          </div>
        </div>
        <div class="instruction-item">
          <div class="instruction-icon">🎮</div>
          <div class="instruction-text">
            <strong>Goal:</strong> Eat food to grow longer and score points
          </div>
        </div>
        <div class="instruction-item">
          <div class="instruction-icon">🤝</div>
          <div class="instruction-text">
            <strong>Multiplayer:</strong> Share your code with friends to play together
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading game...</p>
    </div>
  {/if}
  
  <footer>
    <p>Built with SvelteKit and WebRTC | <a href="https://github.com/InvictusNavarchus" target="_blank" rel="noopener noreferrer">GitHub</a></p>
  </footer>
</div>

<style>
  .game-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  header {
    text-align: center;
    margin-bottom: 30px;
  }
  
  h1 {
    font-size: 3rem;
    margin: 0;
    background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
  
  .subtitle {
    font-size: 1.2rem;
    opacity: 0.8;
    margin-top: 8px;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .instructions {
    margin: 40px auto;
    max-width: 800px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 24px;
  }
  
  .instructions h3 {
    text-align: center;
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.5rem;
  }
  
  .instruction-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }
  
  .instruction-item {
    display: flex;
    align-items: center;
    padding: 15px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }
  
  .instruction-icon {
    font-size: 24px;
    margin-right: 15px;
  }
  
  .instruction-text {
    font-size: 14px;
    line-height: 1.4;
  }
  
  footer {
    margin-top: auto;
    text-align: center;
    padding: 20px 0;
    font-size: 0.9rem;
    opacity: 0.6;
  }
  
  footer a {
    color: var(--color-text);
    text-decoration: underline;
  }
  
  footer a:hover {
    color: var(--color-primary);
  }
  
  @media (max-width: 768px) {
    h1 {
      font-size: 2.4rem;
    }
    
    .subtitle {
      font-size: 1rem;
    }
    
    .instructions {
      padding: 16px;
    }
  }
</style>
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { Direction, type GameState, type PlayerInfo } from '$lib/game/types';
  import { initializeGame, addPlayerToGame, changeDirection } from '$lib/game/gameLogic';
  import GameBoard from '$lib/components/GameBoard.svelte';
  import Scoreboard from '$lib/components/Scoreboard.svelte';
  import GameControls from '$lib/components/GameControls.svelte';
  import ConnectionPanel from '$lib/components/ConnectionPanel.svelte';
  import {
    playerId,
    playerInfo,
    connectionStatus,
    peers, // Use peers store to get connected player IDs for restart
    onMessage,
    broadcastGameState,
    // broadcastDirectionChange, // Replaced by sendDirectionChange
    // broadcastGameRestart, // Replaced by sendGameRestartRequest
    sendDirectionChange, // Client sends direction change
    sendGameRestartRequest, // Client sends restart request
    sendToClient, // Host uses this to send JOIN_ACCEPTED
    cleanupConnections
  } from '$lib/network/peerConnection';
  import { logger } from '$lib/utils/logger'; // Import logger

  let gameState: GameState | null = null; // Initialize as null until ready
  let gameReady = false; // Is the game logic and UI ready?
  let gameActive = false; // Is the game running (connected and not waiting)?
  let cellSize = 20;

  // Responsive cell size based on viewport
  function calculateCellSize() {
    const width = window.innerWidth;
    if (width < 480) return 12;
    if (width < 768) return 16;
    return 20;
  }
  function updateCellSize() {
      cellSize = calculateCellSize();
  }

  let unsubscribeFromMessages: (() => void) | null = null;

  onMount(() => {
    logger.info('system', 'Game page mounted');
    updateCellSize();
    window.addEventListener('resize', updateCellSize);

    // Initial game state (placeholder until connected/hosting)
    // We only create the *real* game state when hosting or receiving the first state update.
    // Create a minimal default state for rendering before connection.
    gameState = initializeGame(['placeholder_id']); // Use placeholder ID
    gameReady = true; // UI elements can render now

    // Subscribe to connection status changes
    const unsubscribeStatus = connectionStatus.subscribe(status => {
        logger.info('system', `Connection status changed: ${status}`);
        // Game becomes active only when connected and we have player info
        gameActive = status === 'connected' && !!get(playerInfo);

        if (status === 'disconnected' || status === 'error') {
             // Reset game state or show message when disconnected?
             // Maybe keep last state visible but inactive.
             gameActive = false;
             // Reset playerInfo if status indicates a full disconnect
             if (status === 'disconnected') playerInfo.set(null);
        }
    });

     // Subscribe to player info changes
     const unsubscribePlayerInfo = playerInfo.subscribe(info => {
         gameActive = get(connectionStatus) === 'connected' && !!info;
         if (!info && get(connectionStatus) === 'disconnected') {
             // If player info is cleared AND disconnected, reset placeholder state
             gameState = initializeGame(['placeholder_id']);
         }
     });


    // Set up message handlers for peer-to-peer communication
    unsubscribeFromMessages = onMessage((message, peerId) => {
      logger.debug('network', `Received message type ${message.type} from ${peerId}`);
      if (!gameState && message.type !== 'STATE_UPDATE' && message.type !== 'JOIN_ACCEPTED') {
          logger.warn('network', `Received message ${message.type} but game state is not initialized.`);
          return; // Ignore messages if state isn't ready, except initial state
      }

      const currentInfo = get(playerInfo);

      switch (message.type) {
        case 'STATE_UPDATE':
          // Client: Update game state ONLY from the host
          if (!currentInfo?.isHost) {
             // logger.debug('network', 'Client received state update');
             gameState = message.data as GameState;
          } else {
              // logger.warn('network', 'Host received unexpected STATE_UPDATE');
          }
          break;

        case 'DIRECTION_CHANGE':
          // Host: Update direction of the specific snake that sent the message
          if (currentInfo?.isHost && gameState) {
            const { id, direction } = message.data;
            logger.debug('network', `Host processing direction change for ${id} to ${direction}`);
            const newState = changeDirection(gameState, id, direction);
            if (newState !== gameState) { // Check if direction actually changed
                gameState = newState;
                // Host broadcasts the updated state AFTER processing the change
                broadcastGameState(gameState);
            }
          }
          break;

        case 'JOIN_REQUEST':
          // Host: Add new player if possible, send acceptance back, and broadcast new state
          if (currentInfo?.isHost && gameState) {
            const { id: joiningPlayerId } = message.data;
            logger.info('network', `Host received JOIN_REQUEST from ${joiningPlayerId} (peerId: ${peerId})`);
            const newState = addPlayerToGame(gameState, joiningPlayerId);
            if (newState) {
                 gameState = newState;
                 const addedSnake = gameState.snakes.find(s => s.id === joiningPlayerId);
                 if (addedSnake) {
                     // Send JOIN_ACCEPTED back to the specific client with their info
                     const joiningPlayerInfo: PlayerInfo = {
                         id: joiningPlayerId,
                         isHost: false,
                         playerIndex: addedSnake.playerIndex,
                         color: addedSnake.color
                     };
                     sendToClient(peerId, { type: 'JOIN_ACCEPTED', data: joiningPlayerInfo });
                     logger.info('network', `Sent JOIN_ACCEPTED to ${joiningPlayerId}`);
                 }
                 // Broadcast the new state to everyone (including the new player)
                 broadcastGameState(gameState);
            } else {
                 logger.warn('network', `Host could not add player ${joiningPlayerId} (game full or error).`);
                 // TODO: Send a 'JOIN_REJECTED' message back?
                 // sendToClient(peerId, { type: 'JOIN_REJECTED', data: { reason: 'Game full' } });
            }
          }
          break;

        // case 'JOIN_ACCEPTED': // Client handles this directly in peerConnection.ts now
        //   break;

        case 'RESTART':
          // Host: Handle restart request from a client
          if (currentInfo?.isHost && gameState) {
             logger.info('network', `Host received RESTART request from client ${peerId}`);
             handleRestart(); // Trigger host restart logic
          }
          break;

         // Handle disconnect message generated by peerConnection.ts
         case 'PEER_DISCONNECT' as any: // Cast type as it's internally generated
           if (currentInfo?.isHost && gameState) {
               const { id: disconnectedPeerId } = message.data; // Assume data contains { id: peerId }
               logger.info('game', `Handling disconnect for peer ${disconnectedPeerId}`);
               // Find the snake associated with the disconnected peer and mark as dead or remove?
               // For simplicity, let's just mark them as dead.
               const snakeIndex = gameState.snakes.findIndex(s => s.id === disconnectedPeerId);
               if (snakeIndex > -1 && gameState.snakes[snakeIndex].alive) {
                   const newSnakes = [...gameState.snakes];
                   newSnakes[snakeIndex] = { ...newSnakes[snakeIndex], alive: false };
                   gameState = { ...gameState, snakes: newSnakes };
                   logger.info('game', `Marked snake ${disconnectedPeerId} as dead due to disconnect.`);
                   // Broadcast the updated state showing the player as dead
                   broadcastGameState(gameState);
               }
           }
           break;

        default:
          logger.warn('network', `Unhandled message type: ${message.type}`);
      }
    });

    // Cleanup logic
    return () => {
      logger.info('system', 'Game page unmounting');
      window.removeEventListener('resize', updateCellSize);
      unsubscribeStatus();
      unsubscribePlayerInfo();
      if (unsubscribeFromMessages) unsubscribeFromMessages();
      cleanupConnections(); // Ensure connections are closed on unmount
    };
  }); // End onMount

  onDestroy(() => {
    // Just in case onMount cleanup didn't run (e.g., error during mount)
    cleanupConnections();
  });

  // --- Game Action Handlers ---

  // Called ONLY by HOST when game state is updated locally by GameBoard loop
  function handleHostGameUpdate(updatedState: GameState) {
      // Update local state for host reactivity
      gameState = updatedState;
      // Host broadcasts the authoritative state
      // Debounce this? Broadcasting on every tick might be heavy.
      // For now, broadcast every update.
      broadcastGameState(updatedState);
  }

  // Called by GameBoard when player inputs a direction change
  function handleDirectionChange(direction: Direction) {
      if (!gameState || gameState.gameOver || gameState.isPaused || !gameActive) return;

      const currentInfo = get(playerInfo);
      if (!currentInfo) return;

      // Update local state immediately for responsiveness (prediction)
      gameState = changeDirection(gameState, currentInfo.id, direction);

      // If host, state is already updated locally, will be broadcast by update loop
      // If client, send the direction change request to the host
      if (!currentInfo.isHost) {
          sendDirectionChange(direction);
      }
  }

  // Called by GameBoard or GameControls for Pause/Resume
  function handlePause() {
      if (!gameState || gameState.gameOver || !gameActive) return;

      const currentInfo = get(playerInfo);
      if (!currentInfo?.isHost) {
           logger.warn('input', 'Client attempted to trigger pause action.');
           return; // Only host can pause
       }

      // Toggle pause state
      gameState = {
          ...gameState,
          isPaused: !gameState.isPaused
      };

      // Host broadcasts the new paused state
      broadcastGameState(gameState);
  }

  // Called by GameBoard or GameControls for Restart
  function handleRestart() {
       if (!gameActive && get(connectionStatus) !== 'connected') return; // Don't restart if not connected

       const currentInfo = get(playerInfo);
       if (!currentInfo) return;

       if (currentInfo.isHost) {
           logger.info('game', 'Host initiating game restart.');
           // Get current connected peer IDs (these are the clients)
           const connectedPeerIds = get(peers).map(p => p.id);
           // Combine host ID with client IDs for the new game initialization
           const allPlayerIds = [currentInfo.id, ...connectedPeerIds];

           // Create a new game state with all current players
           gameState = initializeGame(allPlayerIds);
           logger.info('game', `Restarted game with players: ${allPlayerIds.join(', ')}`);

           // Broadcast the fresh game state to all clients
           broadcastGameState(gameState);
       } else {
           // Client sends a restart request to the host
           logger.info('game', 'Client sending restart request to host.');
           sendGameRestartRequest();
       }
  }

</script>

<svelte:head>
  <title>Co-op Snake Game</title>
  <meta name="description" content="A peer-to-peer multiplayer snake game for LAN/VPN">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="game-page">
  <header>
    <h1>Co-op Snake</h1>
    <p class="subtitle">Peer-to-peer multiplayer snake (LAN/VPN Required)</p>
  </header>

  {#if !gameReady}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading game assets...</p>
    </div>
  {:else if !gameState}
     <div class="loading">
       <p>Error: Game state failed to initialize.</p>
     </div>
  {:else}
    {#if $connectionStatus !== 'connected'}
      <ConnectionPanel />
    {/if}

    <Scoreboard snakes={gameState.snakes} />

    <div class="game-area">
        {#if $connectionStatus === 'connected' && gameActive}
           <GameBoard
             {gameState}
             {cellSize}
             {gameActive}
             onUpdate={handleHostGameUpdate}
             onDirectionChange={handleDirectionChange}
             on:restart={handleRestart}
             on:pause={handlePause}
           />
        {:else if $connectionStatus === 'connecting'}
            <div class="game-placeholder">Connecting...</div>
        {:else if $connectionStatus === 'error'}
             <div class="game-placeholder error">Connection Error. Check Panel.</div>
        {:else if !gameActive}
             <div class="game-placeholder">Host or Join a game to start.</div>
        {:else}
             <div class="game-placeholder">Waiting to start...</div>
        {/if}
    </div>


    <GameControls
      onPause={handlePause}
      onRestart={handleRestart}
      isPaused={gameState.isPaused}
      gameOver={gameState.gameOver}
    />

    <div class="instructions">
       <h3>How to Play ({$playerInfo?.isHost ? 'Host' : 'Client'})</h3>
      <div class="instruction-grid">
        <div class="instruction-item">
          <div class="instruction-icon">⌨️</div>
          <div class="instruction-text">
            <strong>Keyboard:</strong> Use Arrow keys or WASD to move. Space to Pause/Resume (Host) or Restart (Game Over).
          </div>
        </div>
        <div class="instruction-item">
          <div class="instruction-icon">👆</div>
          <div class="instruction-text">
            <strong>Mobile:</strong> Swipe to move. Tap to Pause/Resume (Host) or Restart (Game Over).
          </div>
        </div>
        <div class="instruction-item">
          <div class="instruction-icon">🍎</div>
          <div class="instruction-text">
            <strong>Goal:</strong> Eat food (<span style="color:var(--color-food)">●</span>) to grow and score points. Don't crash!
          </div>
        </div>
         <div class="instruction-item">
           <div class="instruction-icon">🌐</div>
           <div class="instruction-text">
             <strong>Network:</strong> Requires players on the same Wi-Fi or using a VPN (like ZeroTier). Host shares their Local IP.
           </div>
         </div>
      </div>
    </div>
  {/if}
  <!-- End of gameReady / gameState check -->

  <footer>
    <p>Built with SvelteKit | Requires Direct Connection (LAN/VPN)</p>
     <p><a href="https://github.com/InvictusNavarchus/invictusnavarchus-snakegame-coop" target="_blank" rel="noopener noreferrer">View on GitHub</a></p>
  </footer>
</div>

<style>
  .game-page {
    display: flex;
    flex-direction: column;
    align-items: center; /* Center content horizontally */
    min-height: 100vh;
    padding: 20px 15px; /* Adjust padding */
    max-width: 100%; /* Allow full width */
    box-sizing: border-box;
  }

  header {
    text-align: center;
    margin-bottom: 20px; /* Reduced margin */
    width: 100%;
  }

  h1 {
    font-size: clamp(2rem, 6vw, 3rem); /* Responsive font size */
    margin: 0;
    background: linear-gradient(45deg, var(--color-primary), var(--color-secondary));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3)); /* Subtle shadow */
  }

  .subtitle {
    font-size: clamp(0.9rem, 2.5vw, 1.1rem); /* Responsive font size */
    opacity: 0.7; /* Reduced opacity */
    margin-top: 5px; /* Reduced margin */
    color: var(--color-text);
  }

  .loading, .game-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px; /* Ensure space */
      width: 100%;
      max-width: 600px; /* Limit width */
      color: var(--color-text);
      opacity: 0.8;
      text-align: center;
      padding: 20px;
      background-color: rgba(255, 255, 255, 0.03);
      border-radius: var(--game-border-radius);
      margin: 20px 0;
   }
   .game-placeholder.error {
       color: #ff8a80; /* Match error message color */
       background-color: rgba(255, 59, 48, 0.1);
       border: 1px solid rgba(255, 59, 48, 0.2);
   }

  .spinner {
    width: 40px; /* Smaller spinner */
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 15px; /* Reduced margin */
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

   .game-area {
       width: 100%;
       display: flex;
       justify-content: center;
       align-items: center;
       /* Let GameBoard handle its own sizing/margins */
   }

  .instructions {
    margin: 30px auto; /* Adjusted margin */
    width: 100%;
    max-width: 800px; /* Limit width */
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 20px; /* Adjusted padding */
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .instructions h3 {
    text-align: center;
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.3rem; /* Adjusted size */
    color: var(--color-text);
     opacity: 0.9;
  }

  .instruction-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); /* Adjust minmax */
    gap: 15px; /* Reduced gap */
  }

  .instruction-item {
    display: flex;
    align-items: flex-start; /* Align items top */
    padding: 12px; /* Adjusted padding */
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
     min-height: 60px; /* Ensure min height */
  }

  .instruction-icon {
    font-size: 1.5rem; /* Adjusted size */
    margin-right: 12px; /* Adjusted margin */
    margin-top: 2px; /* Align better */
     opacity: 0.8;
  }

  .instruction-text {
    font-size: 0.85rem; /* Adjusted size */
    line-height: 1.5; /* Improved line height */
    color: var(--color-text);
     opacity: 0.9;
  }
   .instruction-text strong {
       color: var(--color-primary);
       font-weight: 600;
   }

  footer {
    margin-top: 30px; /* Adjusted margin */
    text-align: center;
    padding: 20px 0;
    font-size: 0.85rem; /* Adjusted size */
    opacity: 0.6;
     width: 100%;
     color: var(--color-text);
  }

  footer a {
    color: var(--color-secondary); /* Use secondary color for links */
    text-decoration: none;
     font-weight: 500;
     transition: color 0.2s;
  }

  footer a:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }

  @media (max-width: 768px) {
      header { margin-bottom: 15px;}
      .instructions { padding: 15px; margin-top: 20px;}
      .instruction-grid { gap: 10px;}
      .instruction-item { padding: 10px;}
      .instruction-icon { font-size: 1.3rem; margin-right: 10px;}
      .instruction-text { font-size: 0.8rem;}
      footer { margin-top: 20px; font-size: 0.8rem;}
  }
</style>
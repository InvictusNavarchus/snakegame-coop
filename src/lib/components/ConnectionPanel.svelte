<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { 
    initializeHost,
    connectToHost,
    playerId, 
    connectionStatus, 
    peers, 
    peerError, 
    gameIpAddress,
    localIpAddress
  } from '$lib/network/peerConnection';
  import { logger } from '$lib/utils/logger';
  
  let hostIp = '';
  let port = '8080';
  let copied = false;
  let connecting = false;
  let connectionErrorDetails = '';
  let isHost = false;  // Add this variable to track if current player is a host
  
  // Create a dispatcher to emit events to parent components
  const dispatch = createEventDispatcher();
  
  $: if ($connectionStatus === 'connected') {
    // Dispatch event when connection status changes to connected
    dispatch('gameReady', { ready: true });
  }
  
  onMount(() => {
    // Just log when component is mounted, but don't auto-create game
    logger.info('network', 'ConnectionPanel mounted');
  });
  
  async function handleHostGame() {
    connecting = true;
    logger.info('network', 'Creating new game session as host');
    try {
      const id = await initializeHost();
      isHost = true;  // Set the host status when successfully hosting a game
      logger.info('network', `Game hosted with ID: ${id}`);
    } catch (err) {
      logger.error('network', 'Failed to host game:', err);
      console.error('Failed to host game:', err);
    } finally {
      connecting = false;
    }
  }
  
  function getConnectionErrorMessage(error: Error): string {
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('Failed to connect')) {
      return `Could not connect to the host at ${hostIp}:${port}. 
      
      Please check:
      - The host is running the game and is hosting
      - You're on the same network or using a service like ZeroTier
      - The IP address and port are correct
      - Any firewalls are configured to allow the connection`;
    }
    
    return errorMsg;
  }
  
  async function handleJoinGame() {
    if (!hostIp.trim()) {
      logger.warn('network', 'Join game attempted with empty host IP');
      return;
    }
    
    connecting = true;
    connectionErrorDetails = '';
    logger.info('network', `Attempting to join game at IP: ${hostIp.trim()}:${port}`);
    try {
      await connectToHost(hostIp.trim(), port);
      logger.info('network', 'Successfully connected to host');
    } catch (err) {
      logger.error('network', 'Failed to join game:', err);
      console.error('Failed to join game:', err);
      // Set more detailed error message
      connectionErrorDetails = getConnectionErrorMessage(err);
    } finally {
      connecting = false;
    }
  }
  
  function copyIpAddress() {
    if (!$localIpAddress) {
      logger.warn('network', 'Attempted to copy empty IP address');
      return;
    }
    
    logger.debug('network', 'Copying IP address to clipboard');
    navigator.clipboard.writeText($localIpAddress)
      .then(() => {
        copied = true;
        logger.debug('network', 'IP address copied successfully');
        setTimeout(() => {
          copied = false;
        }, 2000);
      })
      .catch(err => {
        logger.error('network', 'Failed to copy IP address:', err);
        console.error('Failed to copy:', err);
      });
  }
</script>

<div class="connection-panel">
  {#if $connectionStatus === 'connected' && $localIpAddress && isHost}
    <div class="connected-container">
      <h3>Game Hosted Successfully</h3>
      <p>Share your IP address with friends to play together:</p>
      
      <div class="invite-code-container">
        <div class="invite-code">{$localIpAddress}:{port}</div>
        <button class="copy-button" on:click={copyIpAddress}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      
      <div class="network-note">
        <h4>Network Note</h4>
        <p>Players must be on the same network or using a VPN solution like ZeroTier to connect directly.</p>
      </div>
      
      {#if $peers.length > 0}
        <div class="connected-players">
          <h4>Connected Players ({$peers.length})</h4>
          <ul>
            {#each $peers as peer}
              <li>{peer.id}</li>
            {/each}
          </ul>
        </div>
      {:else}
        <p class="waiting-message">Waiting for players to join...</p>
      {/if}
    </div>
  {:else if $connectionStatus === 'connected'}
    <div class="connected-container">
      <h3>Connected to Game</h3>
      <p>You're ready to play!</p>
    </div>
  {:else}
    <div class="connection-options">
      <h3>Join or Host a Game</h3>
      
      <div class="option-container">
        <h4>Host a New Game</h4>
        <button 
          class="action-button create" 
          on:click={handleHostGame}
          disabled={connecting}
        >
          {connecting ? 'Starting...' : 'Host Game'}
        </button>
      </div>
      
      <div class="divider">OR</div>
      
      <div class="option-container">
        <h4>Join with Host's IP Address</h4>
        <div class="join-controls">
          <div class="ip-input-container">
            <input 
              type="text" 
              bind:value={hostIp} 
              placeholder="Host IP address"
              disabled={connecting}
            />
            <input 
              type="text" 
              bind:value={port} 
              placeholder="Port"
              class="port-input"
              disabled={connecting}
            />
          </div>
          <button 
            class="action-button join" 
            on:click={handleJoinGame}
            disabled={!hostIp.trim() || connecting}
          >
            {connecting ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      </div>
      
      <div class="network-note">
        <h4>Network Requirements</h4>
        <p>Players must be on the same network or using a service like ZeroTier to create a virtual LAN. Enter the host's ZeroTier IP address when connecting.</p>
      </div>
      
      {#if $peerError || connectionErrorDetails}
        <div class="error-message">
          <h4>Connection Error</h4>
          <p>{connectionErrorDetails || $peerError}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .connection-panel {
    background-color: rgba(20, 20, 20, 0.8);
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    margin: 0 auto 30px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  
  h3 {
    color: var(--color-text);
    margin-top: 0;
    font-size: 24px;
    text-align: center;
  }
  
  h4 {
    color: var(--color-text);
    opacity: 0.8;
    font-size: 18px;
    margin-bottom: 12px;
  }
  
  .option-container {
    margin-bottom: 24px;
  }
  
  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 30px 0;
    color: var(--color-text);
    opacity: 0.5;
  }
  
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .divider::before {
    margin-right: 15px;
  }
  
  .divider::after {
    margin-left: 15px;
  }
  
  .action-button {
    display: inline-block;
    padding: 12px 20px;
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .action-button:active {
    transform: translateY(0);
  }
  
  .action-button.create {
    background-color: var(--color-primary);
    width: 100%;
  }
  
  .action-button.join {
    background-color: var(--color-secondary);
  }
  
  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  .join-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .ip-input-container {
    display: flex;
    gap: 8px;
  }
  
  input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
    font-family: inherit;
    font-size: 16px;
  }
  
  .port-input {
    flex: 0 0 80px;
  }
  
  input:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 2px rgba(48, 79, 254, 0.2);
  }
  
  .invite-code-container {
    display: flex;
    margin: 20px 0;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .invite-code {
    flex: 1;
    padding: 12px 16px;
    font-family: monospace;
    font-size: 18px;
    color: var(--color-accent);
    overflow-x: auto;
    white-space: nowrap;
  }
  
  .copy-button {
    padding: 12px 20px;
    background-color: rgba(255, 255, 255, 0.1);
    border: none;
    color: var(--color-text);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .copy-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
  
  .waiting-message {
    text-align: center;
    color: var(--color-text);
    opacity: 0.7;
    margin: 20px 0;
    font-style: italic;
  }
  
  .connected-players {
    margin-top: 20px;
  }
  
  .connected-players h4 {
    margin-bottom: 10px;
  }
  
  .connected-players ul {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 16px;
    list-style-type: none;
    margin: 0;
  }
  
  .connected-players li {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .connected-players li:last-child {
    border-bottom: none;
  }
  
  .error-message {
    margin-top: 20px;
    padding: 12px 16px;
    background-color: rgba(255, 59, 48, 0.1);
    border-left: 4px solid #ff3b30;
    border-radius: 4px;
    color: #ff3b30;
    white-space: pre-line;
    line-height: 1.5;
  }
  
  .error-message h4 {
    color: #ff3b30;
    margin-top: 0;
    margin-bottom: 8px;
  }
  
  .network-note {
    margin-top: 20px;
    padding: 12px 16px;
    background-color: rgba(48, 79, 254, 0.1);
    border-left: 4px solid var(--color-secondary);
    border-radius: 4px;
    line-height: 1.5;
  }
  
  .network-note h4 {
    color: var(--color-secondary);
    margin-top: 0;
    margin-bottom: 8px;
  }
  
  @media (max-width: 600px) {
    .connection-panel {
      padding: 16px;
    }
    
    .ip-input-container {
      flex-direction: column;
    }
    
    .invite-code {
      font-size: 16px;
    }
  }
</style>
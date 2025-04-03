<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    initializePeer, 
    connectToPeer, 
    playerId, 
    connectionStatus, 
    peers, 
    peerError, 
    gameInviteCode 
  } from '$lib/network/peerConnection';
  import { logger } from '$lib/utils/logger';
  
  let inviteCode = '';
  let copied = false;
  let connecting = false;
  
  onMount(() => {
    // Auto-initialize peer on mount
    logger.info('network', 'ConnectionPanel mounted, auto-initializing peer');
    handleCreateGame();
  });
  
  async function handleCreateGame() {
    connecting = true;
    logger.info('network', 'Creating new game session');
    try {
      const id = await initializePeer();
      gameInviteCode.set(id);
      logger.info('network', `Game created with invite code: ${id}`);
    } catch (err) {
      logger.error('network', 'Failed to create game:', err);
      console.error('Failed to create game:', err);
    } finally {
      connecting = false;
    }
  }
  
  async function handleJoinGame() {
    if (!inviteCode.trim()) {
      logger.warn('network', 'Join game attempted with empty invite code');
      return;
    }
    
    connecting = true;
    logger.info('network', `Attempting to join game with code: ${inviteCode.trim()}`);
    try {
      await connectToPeer(inviteCode.trim());
      logger.info('network', 'Successfully connected to peer');
    } catch (err) {
      logger.error('network', 'Failed to join game:', err);
      console.error('Failed to join game:', err);
    } finally {
      connecting = false;
    }
  }
  
  function copyInviteCode() {
    if (!$gameInviteCode) {
      logger.warn('network', 'Attempted to copy empty invite code');
      return;
    }
    
    logger.debug('network', 'Copying invite code to clipboard');
    navigator.clipboard.writeText($gameInviteCode)
      .then(() => {
        copied = true;
        logger.debug('network', 'Invite code copied successfully');
        setTimeout(() => {
          copied = false;
        }, 2000);
      })
      .catch(err => {
        logger.error('network', 'Failed to copy invite code:', err);
        console.error('Failed to copy:', err);
      });
  }
</script>

<div class="connection-panel">
  {#if $connectionStatus === 'connected' && $gameInviteCode}
    <div class="connected-container">
      <h3>Invite a Friend</h3>
      <p>Share this code with a friend to play together:</p>
      
      <div class="invite-code-container">
        <div class="invite-code">{$gameInviteCode}</div>
        <button class="copy-button" on:click={copyInviteCode}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
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
      <h3>Join or Create a Game</h3>
      
      <div class="option-container">
        <h4>Create a New Game</h4>
        <button 
          class="action-button create" 
          on:click={handleCreateGame}
          disabled={connecting}
        >
          {connecting ? 'Creating...' : 'Create Game'}
        </button>
      </div>
      
      <div class="divider">OR</div>
      
      <div class="option-container">
        <h4>Join with an Invite Code</h4>
        <div class="join-controls">
          <input 
            type="text" 
            bind:value={inviteCode} 
            placeholder="Paste invite code here"
            disabled={connecting}
          />
          <button 
            class="action-button join" 
            on:click={handleJoinGame}
            disabled={!inviteCode.trim() || connecting}
          >
            {connecting ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      </div>
      
      {#if $peerError}
        <div class="error-message">
          Error: {$peerError}
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
    gap: 10px;
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
  }
  
  @media (max-width: 600px) {
    .connection-panel {
      padding: 16px;
    }
    
    .join-controls {
      flex-direction: column;
    }
    
    .invite-code {
      font-size: 16px;
    }
  }
</style>
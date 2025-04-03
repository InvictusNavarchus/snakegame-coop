<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store'; // Import get
  import {
    initializeHost,
    connectToHost,
    playerId,
    connectionStatus,
    peers, // Use peers store to show connected players
    peerError,
    localIpAddress, // Used for host display guidance
    playerInfo, // To check if host
  } from '$lib/network/peerConnection';
  import { logger } from '$lib/utils/logger';

  let hostIpInput = ''; // Input field for joining
  let hostPortInput: number = 8080; // Default port
  let copied = false;
  let connecting = false;
  let connectionErrorDetails = '';

  // Create a dispatcher to emit events to parent components
  const dispatch = createEventDispatcher();

  // $: console.log("Connection Status:", $connectionStatus); // Debugging
  // $: console.log("Player Info:", $playerInfo); // Debugging
  // $: console.log("Peers:", $peers); // Debugging

  // No need to dispatch 'gameReady' here, the main page logic will handle state changes

  onMount(() => {
    logger.info('network', 'ConnectionPanel mounted');
    // Reset error on mount
    peerError.set(null);
    connectionErrorDetails = '';
  });

  async function handleHostGame() {
    connecting = true;
    connectionErrorDetails = '';
    peerError.set(null);
    logger.info('network', 'Creating new game session as host');
    try {
      const id = await initializeHost(hostPortInput); // Pass port if needed
      logger.info('network', `Game hosted successfully with ID: ${id}.`);
      // Connection status is set to 'connected' within initializeHost
    } catch (err) {
      logger.error('network', 'Failed to host game:', err);
      connectionErrorDetails = `Failed to host game: ${err instanceof Error ? err.message : String(err)}`;
      connectionStatus.set('error'); // Set error status
    } finally {
      connecting = false;
    }
  }

  // Improved error message handling
  function getConnectionErrorMessage(error: Error | string | Event): string {
     const errorMsg = error instanceof Error ? error.message : String(error);

     if (errorMsg.includes('WebSocket connection error')) {
         return `Could not connect to the host at ${hostIpInput}:${hostPortInput}.

         Please check:
         - Host is running the game & successfully hosted.
         - You entered the correct Host LAN/ZeroTier IP address.
         - You are on the same Wi-Fi network or ZeroTier network as the host.
         - Any firewalls (on host or client) allow connections on port ${hostPortInput}.`;
     }
     if (errorMsg.includes('Connection closed')) {
         return `Connection to host was closed. The host might have left or there was a network issue.`;
     }
     if (errorMsg.includes('Failed to connect')) { // Generic fetch/WebSocket error before open
         return `Failed to establish connection to ${hostIpInput}:${hostPortInput}. Verify IP, Port, Network, and Firewall settings.`;
     }
     // Add more specific PeerJS errors if you were using it

     // Default fallback
     return errorMsg || 'An unknown connection error occurred.';
  }

  async function handleJoinGame() {
    if (!hostIpInput.trim() || !hostPortInput) {
      logger.warn('network', 'Join game attempted with empty host IP or port');
      connectionErrorDetails = 'Please enter both Host IP and Port.';
      return;
    }

    connecting = true;
    connectionErrorDetails = '';
    peerError.set(null);
    logger.info('network', `Attempting to join game at IP: ${hostIpInput.trim()}:${hostPortInput}`);
    try {
      await connectToHost(hostIpInput.trim(), hostPortInput);
      logger.info('network', 'Successfully initiated connection to host (waiting for acceptance/state)');
      // Connection status is set within connectToHost
    } catch (err) {
      logger.error('network', 'Failed to join game:', err);
      // Use the reactive peerError store if set, otherwise format the error
      const storeError = get(peerError);
      connectionErrorDetails = storeError ? getConnectionErrorMessage(storeError) : getConnectionErrorMessage(err as Error);
       if (get(connectionStatus) !== 'error') {
          connectionStatus.set('error'); // Ensure status reflects error
       }
    } finally {
      connecting = false;
    }
  }

  function copyIpAddress() {
    // We don't have a reliable IP to copy automatically. Guide the user.
    alert("Please manually check and copy your computer's Local Network IP (e.g., 192.168.x.x) or your ZeroTier IP (e.g., 10.x.x.x) to share with friends.");
    // You could add links or platform-specific instructions here.
  }

  // Clear errors when user starts typing again
  $: if (hostIpInput || hostPortInput) {
      connectionErrorDetails = '';
      if (get(connectionStatus) === 'error') {
          // Optionally reset status if user retries, or keep 'error' until success
          // connectionStatus.set('disconnected');
      }
  }
</script>

<div class="connection-panel">
  {#if $playerInfo?.isHost && $connectionStatus === 'connected'}
    <div class="connected-container">
      <h3>Game Hosted Successfully!</h3>
      <p>Ask friends on your <strong>same Wi-Fi or ZeroTier network</strong> to join using:</p>

      <div class="invite-code-container">
        <div class="invite-code">
          Your IP: <span class="ip-placeholder">[Your Local/VPN IP]</span> Port: <span class="port-value">{$hostPortInput || 8080}</span>
        </div>
        <button class="copy-button" on:click={copyIpAddress} title="Show instructions to find IP">
          How to find IP?
        </button>
      </div>

      <div class="network-note">
        <h4>How to find your IP:</h4>
        <ul>
          <li><strong>Windows:</strong> Open Command Prompt (cmd), type `ipconfig`, look for "IPv4 Address" under your Wi-Fi or Ethernet adapter.</li>
          <li><strong>Mac:</strong> Go to System Preferences > Network, select your connection (Wi-Fi/Ethernet), it will show your IP address.</li>
          <li><strong>Linux:</strong> Open Terminal, type `ip addr` or `hostname -I`.</li>
          <li><strong>ZeroTier:</strong> Open the ZeroTier application, your ZeroTier IP is listed there (often starts with 10.).</li>
        </ul>
      </div>

       {#if $peers.length > 0}
         <div class="connected-players">
           <h4>Connected Players ({$peers.length})</h4>
           <ul>
             {#each $peers as peer (peer.id)}
               <li>Peer {peer.id.substring(0,6)}...</li> {#if peer.playerInfo} ({peer.playerInfo.id}) {/if}
             {/each}
           </ul>
         </div>
       {:else}
         <p class="waiting-message">Waiting for players to join...</p>
       {/if}
    </div>

  {:else if !$playerInfo?.isHost && $connectionStatus === 'connected'}
    <div class="connected-container">
      <h3>Connected to Host</h3>
      <p>Waiting for game to start or continue...</p>
       {#if $playerInfo}
         <p>You are player index: {$playerInfo.playerIndex}</p>
       {/if}
    </div>

  {:else}
    <div class="connection-options">
      <h3>Join or Host a Game</h3>

      <div class="option-container">
        <h4>Host a New Game</h4>
         <div class="ip-input-container">
              <label for="host-port">Port to host on:</label>
              <input
                  id="host-port"
                  type="number"
                  bind:value={hostPortInput}
                  placeholder="Port (e.g., 8080)"
                  class="port-input"
                  min="1024"
                  max="65535"
                  disabled={connecting}
              />
          </div>
        <button
          class="action-button create"
          on:click={handleHostGame}
          disabled={connecting || !hostPortInput}
        >
          {#if connecting && !$playerInfo?.isHost}Starting...{:else}Host Game{/if}
        </button>
      </div>

      <div class="divider">OR</div>

      <div class="option-container">
        <h4>Join with Host's IP Address</h4>
        <div class="join-controls">
          <div class="ip-input-container">
            <input
              type="text"
              bind:value={hostIpInput}
              placeholder="Host's Local or ZeroTier IP"
              disabled={connecting}
            />
            <input
              type="number"
              bind:value={hostPortInput}
              placeholder="Port (e.g., 8080)"
              class="port-input"
              min="1024"
              max="65535"
              disabled={connecting}
            />
          </div>
          <button
            class="action-button join"
            on:click={handleJoinGame}
            disabled={!hostIpInput.trim() || !hostPortInput || connecting}
          >
            {#if connecting && $playerInfo?.isHost}Joining...{:else}Join Game{/if}
          </button>
        </div>
      </div>

       <div class="network-note">
           <h4>Network Requirements</h4>
           <p>All players MUST be on the <strong>same Wi-Fi network</strong> or connected via a <strong>VPN/Virtual LAN service</strong> like ZeroTier, Hamachi, or Tailscale.</p>
           <p>If hosting, ensure your firewall allows incoming connections on the chosen port ({hostPortInput || 'default'}).</p>
       </div>

      {#if connectionErrorDetails || $peerError}
        <div class="error-message">
          <h4>Connection Error</h4>
          <p>{connectionErrorDetails || getConnectionErrorMessage($peerError || 'Unknown error')}</p>
        </div>
      {/if}
       {#if $connectionStatus === 'connecting'}
         <div class="connecting-indicator">Connecting...</div>
       {/if}
    </div>
  {/if}
</div>

<style>
  /* Basic Styles (keep existing ones) */
  .connection-panel {
    background-color: rgba(20, 20, 20, 0.8);
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    margin: 20px auto 30px; /* Added top margin */
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    color: var(--color-text);
  }

  h3 {
    color: var(--color-text);
    margin-top: 0;
    font-size: 1.5rem; /* Adjusted */
    text-align: center;
    margin-bottom: 20px; /* Added */
  }

  h4 {
    color: var(--color-text);
    opacity: 0.9; /* Increased */
    font-size: 1.1rem; /* Adjusted */
    margin-bottom: 12px;
     border-bottom: 1px solid rgba(255, 255, 255, 0.1); /* Added */
     padding-bottom: 8px; /* Added */
  }

   label {
       display: block;
       margin-bottom: 5px;
       font-size: 0.9rem;
       opacity: 0.8;
   }

  .option-container {
    margin-bottom: 24px;
     padding: 16px;
     background-color: rgba(255, 255, 255, 0.03);
     border-radius: 8px;
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 30px 0;
    color: var(--color-text);
    opacity: 0.5;
    font-weight: bold;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .divider::before { margin-right: 15px; }
  .divider::after { margin-left: 15px; }

  .action-button {
    display: inline-block;
    width: 100%; /* Make buttons full width */
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 1rem; /* Adjusted */
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }
   .action-button:not(:disabled):hover {
       transform: translateY(-2px);
       box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
   }
   .action-button:not(:disabled):active { transform: translateY(0); }

  .action-button.create { background-color: var(--color-primary); color: white; margin-top: 10px;}
  .action-button.join { background-color: var(--color-secondary); color: white; }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
     background-color: #555; /* Clearer disabled state */
  }

  .join-controls { display: flex; flex-direction: column; gap: 15px; } /* Increased gap */
  .ip-input-container { display: flex; gap: 10px; flex-wrap: wrap;} /* Wrap on small screens */

  input[type="text"], input[type="number"] {
    flex: 1 1 180px; /* Allow wrapping */
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem; /* Adjusted */
     min-width: 100px; /* Ensure minimum width */
  }
  .port-input { flex: 0 1 100px; /* Fixed width for port */ min-width: 80px;}
  input:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 2px rgba(48, 79, 254, 0.3); /* Adjusted focus */
  }
   input:disabled { background-color: rgba(255, 255, 255, 0.02); opacity: 0.7; }


  /* Host connected view styles */
   .connected-container p { margin-bottom: 15px; line-height: 1.5;}
   .invite-code-container {
       display: flex;
       align-items: center;
       margin: 20px 0;
       background-color: rgba(0, 0, 0, 0.2);
       border-radius: 8px;
       overflow: hidden;
       border: 1px solid rgba(255, 255, 255, 0.1);
       padding: 8px; /* Add padding */
   }
   .invite-code {
       flex: 1;
       padding: 8px 12px; /* Adjust padding */
       font-family: monospace;
       font-size: 0.95rem; /* Adjust size */
       color: var(--color-text); /* Normal text color */
       overflow-x: auto;
       white-space: nowrap;
   }
   .ip-placeholder, .port-value {
       color: var(--color-accent); /* Highlight the important parts */
       font-weight: bold;
   }
   .copy-button {
       padding: 8px 15px; /* Adjust padding */
       background-color: rgba(255, 255, 255, 0.1);
       border: none;
       color: var(--color-text);
       font-weight: 500; /* Adjust weight */
       font-size: 0.9rem; /* Adjust size */
       cursor: pointer;
       transition: background-color 0.2s;
       border-radius: 5px; /* Added radius */
       margin-left: 10px; /* Spacing */
       white-space: nowrap;
   }
   .copy-button:hover { background-color: rgba(255, 255, 255, 0.2); }

  .waiting-message, .connecting-indicator {
    text-align: center;
    color: var(--color-text);
    opacity: 0.7;
    margin: 20px 0;
    font-style: italic;
  }
   .connecting-indicator {
       font-weight: bold;
       color: var(--color-primary);
   }

  .connected-players { margin-top: 20px; }
  .connected-players h4 { margin-bottom: 10px; }
  .connected-players ul {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px 16px;
    list-style-type: none;
    margin: 0;
    max-height: 150px; /* Limit height */
    overflow-y: auto; /* Add scroll */
  }
  .connected-players li {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
     font-size: 0.9rem;
  }
  .connected-players li:last-child { border-bottom: none; }

  .error-message {
    margin-top: 20px;
    padding: 12px 16px;
    background-color: rgba(255, 59, 48, 0.15); /* Slightly stronger bg */
    border-left: 4px solid #ff3b30;
    border-radius: 4px;
    color: #ff8a80; /* Lighter red for better readability */
    white-space: pre-line;
    line-height: 1.5;
  }
  .error-message h4 {
    color: #ff3b30;
    margin-top: 0;
    margin-bottom: 8px;
     border: none; /* Remove border from h4 inside error */
     padding-bottom: 0;
  }

   .network-note {
       margin-top: 20px;
       padding: 12px 16px;
       background-color: rgba(48, 79, 254, 0.1);
       border-left: 4px solid var(--color-secondary);
       border-radius: 4px;
       line-height: 1.5;
       font-size: 0.9rem; /* Smaller font size */
   }
   .network-note h4 {
       color: var(--color-secondary);
       margin-top: 0;
       margin-bottom: 8px;
       border: none; /* Remove border */
       padding-bottom: 0;
       font-size: 1rem; /* Reset size */
   }
   .network-note ul {
       list-style-type: disc;
       padding-left: 20px;
       margin-top: 8px;
       opacity: 0.9;
   }
   .network-note li { margin-bottom: 4px;}


  @media (max-width: 600px) {
    .connection-panel { padding: 16px; max-width: 95%;} /* Adjust width */
    h3 {font-size: 1.3rem;}
    h4 {font-size: 1rem;}
    .ip-input-container { flex-direction: column; }
    .port-input { flex: 1 1 auto; min-width: 80px;} /* Allow port to take full width if needed */
    input[type="text"], input[type="number"] { font-size: 0.9rem; }
    .invite-code { font-size: 0.85rem; }
    .copy-button { font-size: 0.8rem; padding: 6px 10px; }
    .network-note { font-size: 0.85rem;}
  }
</style>
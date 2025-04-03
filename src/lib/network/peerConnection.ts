// src/lib/network/peerConnection.ts
import { writable, get, type Writable } from 'svelte/store'; // Import get
import type { PeerMessage, GameState, PlayerInfo, Direction } from '$lib/game/types';
import { nanoid } from 'nanoid';
import { logger } from '$lib/utils/logger'; // Import logger

// Represents a connection to one peer (client or host)
interface PeerConnection {
  id: string; // Can be host IP for clients, or generated ID for host's connections
  conn: WebSocket;
  playerInfo?: PlayerInfo; // Store player info associated with this connection if available
}

export const playerId: Writable<string> = writable(''); // This client's unique ID
export const playerInfo: Writable<PlayerInfo | null> = writable(null); // This client's role/info
export const connectionStatus: Writable<'disconnected' | 'connecting' | 'connected' | 'error'> = writable('disconnected');
export const peers: Writable<PeerConnection[]> = writable([]); // List of active connections
export const peerError: Writable<string | null> = writable(null);
// export const gameIpAddress: Writable<string | null> = writable(null); // Maybe less useful now
export const localIpAddress: Writable<string | null> = writable(null); // Keep for host display guidance

// --- Host Specific State ---
// Simulate WebSocket server behavior within the host browser
let webSocketServer: WebSocketServer | null = null; // Use a simple class to manage host connections
let hostConnections: Map<string, WebSocket> = new Map(); // Map peerId -> WebSocket connection

// --- WebSocket Server Simulation (for Host) ---
class WebSocketServer {
    private connections: Map<string, WebSocket> = new Map();
    private onConnectionCallback: (ws: WebSocket, id: string) => void;
    private onMessageCallback: (message: PeerMessage, peerId: string) => void;
    private onCloseCallback: (peerId: string) => void;
    private onErrorCallback: (error: Event, peerId: string) => void;

    constructor(
        onConnection: (ws: WebSocket, id: string) => void,
        onMessage: (message: PeerMessage, peerId: string) => void,
        onClose: (peerId: string) => void,
        onError: (error: Event, peerId: string) => void
    ) {
        this.onConnectionCallback = onConnection;
        this.onMessageCallback = onMessage;
        this.onCloseCallback = onClose;
        this.onErrorCallback = onError;

        // THIS IS THE CORE SIMULATION FLAW:
        // In a real scenario, you'd use `new WebSocket.Server({ port })`.
        // Here, we just prepare to handle connections *initiated by clients*.
        // We rely on the *browser's* ability to accept incoming connections,
        // which only works in specific network setups (LAN/VPN) and requires
        // the client to know the host's direct IP.
        logger.info('network', "WebSocketServer simulation initialized (listening implicitly).");
    }

    // Method called externally when a client successfully connects *to* this host
    addConnection(peerId: string, ws: WebSocket) {
        logger.info('network', `Host: New connection added from peer ${peerId}`);
        this.connections.set(peerId, ws);
        this.setupWebSocketListeners(peerId, ws);
        this.onConnectionCallback(ws, peerId); // Notify application logic
    }

    private setupWebSocketListeners(peerId: string, ws: WebSocket) {
         ws.onmessage = (event) => {
             try {
                 const message: PeerMessage = JSON.parse(event.data as string);
                 logger.debug('network', `Host received message from ${peerId}:`, message);
                 this.onMessageCallback(message, peerId);
             } catch (e) {
                  logger.error('network', `Host failed to parse message from ${peerId}:`, event.data, e);
             }
         };

         ws.onclose = () => {
             logger.info('network', `Host: Connection closed by peer ${peerId}`);
             this.connections.delete(peerId);
             this.onCloseCallback(peerId);
         };

         ws.onerror = (error) => {
              logger.error('network', `Host: WebSocket error for peer ${peerId}:`, error);
              this.connections.delete(peerId); // Assume connection is lost
              this.onErrorCallback(error, peerId);
              this.onCloseCallback(peerId); // Trigger close handling too
         };
    }

    getConnection(peerId: string): WebSocket | undefined {
        return this.connections.get(peerId);
    }

    getAllConnections(): Map<string, WebSocket> {
        return this.connections;
    }

    broadcast(message: PeerMessage, excludeId?: string) {
         const msgString = JSON.stringify(message);
         logger.debug('network', `Host broadcasting message (excluding ${excludeId || 'none'}):`, message);
         this.connections.forEach((ws, id) => {
             if (id !== excludeId && ws.readyState === WebSocket.OPEN) {
                 try {
                     ws.send(msgString);
                 } catch (e) {
                      logger.error('network', `Host failed to send broadcast to ${id}:`, e);
                 }
             }
         });
    }

     sendTo(peerId: string, message: PeerMessage) {
        const ws = this.connections.get(peerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                logger.debug('network', `Host sent message to ${peerId}:`, message);
            } catch (e) {
                 logger.error('network', `Host failed to send message to ${peerId}:`, e);
            }
        } else {
             logger.warn('network', `Host could not send message to ${peerId}: WebSocket not found or not open.`);
        }
     }

    closeAll() {
         logger.info('network', 'Host closing all connections.');
         this.connections.forEach((ws, id) => {
             ws.close();
             this.onCloseCallback(id); // Manually trigger close handling
         });
         this.connections.clear();
    }
}

// --- Client Specific State ---
let clientWebSocket: WebSocket | null = null; // Connection *to* the host

// --- Shared Logic ---
const messageCallbacks: ((message: PeerMessage, peerId: string) => void)[] = [];

// Initialize host (Acts as Server)
export async function initializeHost(port: number = 8080): Promise<string> {
  peerError.set(null);
  connectionStatus.set('connecting');
  cleanupConnections(); // Ensure clean state

  const id = nanoid(10);
  playerId.set(id);
  localIpAddress.set("Your LAN or ZeroTier IP"); // Guide user

  // Set up host player info (always index 0)
  const hostInfo: PlayerInfo = {
    id: id,
    isHost: true,
    playerIndex: 0, // Host is always player 0
    color: 'var(--color-snake1)' // Host color
  };
  playerInfo.set(hostInfo);

  // --- Server Simulation Setup ---
  webSocketServer = new WebSocketServer(
      // onConnection: Handled implicitly by client connections succeeding
      (ws, peerId) => {
          // When a client connects, add them to the peers list for UI display
          const newPeer: PeerConnection = { id: peerId, conn: ws };
          peers.update(p => [...p, newPeer]);
          // Potentially send JOIN_ACCEPTED or initial state here?
          // The JOIN_REQUEST handler in +page.svelte handles adding to game state.
      },
      // onMessage: Route message to registered callbacks
      (message, peerId) => {
          messageCallbacks.forEach(callback => callback(message, peerId));
      },
      // onClose: Remove peer from UI list
      (peerId) => {
          peers.update(p => p.filter(peer => peer.id !== peerId));
          // Optionally notify game logic about player disconnect
          messageCallbacks.forEach(callback => callback({ type: 'PEER_DISCONNECT', data: { id: peerId } } as any, peerId));
      },
      // onError: Set error state, potentially remove peer
      (error, peerId) => {
          peerError.set(`Connection error with peer ${peerId}`);
          peers.update(p => p.filter(peer => peer.id !== peerId));
           // Optionally notify game logic
           messageCallbacks.forEach(callback => callback({ type: 'PEER_DISCONNECT', data: { id: peerId } } as any, peerId));
      }
  );

  // This part is tricky because the browser isn't *really* listening.
  // We rely on the client `new WebSocket(...)` succeeding.
  // We immediately set status to connected for the host.
  connectionStatus.set('connected');
  logger.info('network', `Host initialized with ID ${id}. Waiting for connections on port ${port} (via direct IP).`);

  // We still need a way for the WebSocketServer instance to know about incoming connections.
  // This will happen in `connectToHost` for the *client*, and the *host* needs
  // a global listener or mechanism if it were a real server.
  // WORKAROUND: We'll rely on the client connection logic to implicitly "connect" to the host.

  // Initialize peers store with just the host initially (or empty)
  peers.set([]);

  return id;
}


// Connect to a host (Client Action)
export async function connectToHost(hostIp: string, port: number = 8080): Promise<void> {
  if (get(connectionStatus) === 'connected' || get(connectionStatus) === 'connecting') {
      logger.warn('network', 'Already connected or connecting.');
      return;
  }

  peerError.set(null);
  connectionStatus.set('connecting');
  cleanupConnections(); // Ensure clean state

  let id = get(playerId);
  if (!id) {
    id = nanoid(10);
    playerId.set(id);
  }
  // Player info is set upon JOIN_ACCEPTED from host

  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${hostIp}:${port}`;
    logger.info('network', `Client ${id}: Attempting to connect to host at ${wsUrl}`);
    clientWebSocket = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      clientWebSocket!.onopen = () => {
        logger.info('network', `Client ${id}: WebSocket connection opened with host ${hostIp}`);

        // Add host to peers list (for client UI)
        const hostPeer: PeerConnection = { id: hostIp, conn: clientWebSocket! };
        peers.set([hostPeer]); // Client only connects to host

        connectionStatus.set('connected');

        // Send join request immediately
        sendToHost({
          type: 'JOIN_REQUEST',
          data: { id: get(playerId) } // Send our generated ID
        });

        resolve();
      };

      clientWebSocket!.onmessage = (event) => {
          try {
             const message: PeerMessage = JSON.parse(event.data as string);
             logger.debug('network', `Client ${id} received message from host ${hostIp}:`, message);
             // Handle JOIN_ACCEPTED specifically here to set PlayerInfo
             if (message.type === 'JOIN_ACCEPTED') {
                 playerInfo.set(message.data as PlayerInfo);
                 logger.info('network', `Client ${id} joined game as player index ${message.data.playerIndex}`);
             }
             // Route all messages (including JOIN_ACCEPTED) to callbacks
             messageCallbacks.forEach(callback => callback(message, hostIp)); // Peer ID is the host's IP for client
          } catch(e) {
               logger.error('network', `Client ${id} failed to parse message from host:`, event.data, e);
          }
      };

      clientWebSocket!.onerror = (err) => {
        logger.error('network', `Client ${id}: WebSocket connection error to ${hostIp}:`, err);
        peerError.set(`Connection error: Could not connect to ${hostIp}:${port}. Ensure host is running, IP is correct, and you're on the same LAN/VPN.`);
        connectionStatus.set('error');
        clientWebSocket = null;
        peers.set([]);
        reject(new Error(`WebSocket connection error: ${err.type}`)); // Pass specific error if possible
      };

      clientWebSocket!.onclose = () => {
         logger.info('network', `Client ${id}: WebSocket connection closed by host ${hostIp}`);
         if (get(connectionStatus) !== 'error') { // Don't reset error message if closed due to error
             peerError.set("Connection closed by host.");
         }
         connectionStatus.set('disconnected');
         clientWebSocket = null;
         peers.set([]);
         playerInfo.set(null); // Reset player info on disconnect
         // Notify callbacks about disconnect
         messageCallbacks.forEach(callback => callback({ type: 'PEER_DISCONNECT', data: { id: hostIp } } as any, hostIp));
      };
    });

  } catch (err) {
    logger.error('network', `Client ${id}: Failed to initiate connection to host ${hostIp}:`, err);
    peerError.set(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    connectionStatus.set('error');
    cleanupConnections();
    throw err;
  }
}


// Send a message (direction depends on host/client)
export function sendMessage(message: PeerMessage): void {
    const info = get(playerInfo);
    if (!info) {
        logger.error('network', "Cannot send message: player info not available.");
        return;
    }

    if (info.isHost) {
        // Host broadcasts to all connected clients
        webSocketServer?.broadcast(message, get(playerId)); // Don't broadcast to self
    } else {
        // Client sends only to the host
        sendToHost(message);
    }
}

// Send specifically to the host (Client only)
function sendToHost(message: PeerMessage): void {
    if (clientWebSocket && clientWebSocket.readyState === WebSocket.OPEN) {
        try {
            clientWebSocket.send(JSON.stringify(message));
             logger.debug('network', `Client ${get(playerId)} sent message to host:`, message);
        } catch (err) {
             logger.error('network', `Client ${get(playerId)} failed to send message to host:`, err);
        }
    } else {
        logger.warn('network', `Client ${get(playerId)} cannot send message: Not connected to host.`);
    }
}

// Host sends specifically to one client
export function sendToClient(peerId: string, message: PeerMessage): void {
    const info = get(playerInfo);
     if (!info?.isHost) {
        logger.error('network', "Only host can send direct messages to clients.");
        return;
    }
    webSocketServer?.sendTo(peerId, message);
}


// Broadcast game state (Host only)
export function broadcastGameState(gameState: GameState): void {
  const info = get(playerInfo);
  if (info?.isHost) {
       logger.debug('network', 'Host broadcasting game state');
       webSocketServer?.broadcast({
           type: 'STATE_UPDATE',
           data: gameState
       });
  } else {
       logger.warn('network', 'Attempted to broadcast game state as non-host.');
  }
}

// Send direction change (Client to Host)
export function sendDirectionChange(direction: Direction): void {
   const info = get(playerInfo);
   if (!info?.isHost) {
       logger.debug('network', `Client ${get(playerId)} sending direction change: ${direction}`);
       sendToHost({
           type: 'DIRECTION_CHANGE',
           data: {
               id: get(playerId), // Include sender ID
               direction
           }
       });
   } else {
        logger.warn('network', 'Host attempted to send direction change via client method.');
   }
}

// Send game restart request (Client to Host)
export function sendGameRestartRequest(): void {
   const info = get(playerInfo);
   if (!info?.isHost) {
       logger.debug('network', `Client ${get(playerId)} sending restart request`);
       sendToHost({
           type: 'RESTART',
           data: {} // Could include requester ID if needed
       });
   } else {
       logger.warn('network', 'Host attempted to send restart request via client method.');
   }
}


// Register a callback for incoming messages
export function onMessage(callback: (message: PeerMessage, peerId: string) => void): () => void {
  messageCallbacks.push(callback);
  // Return an unsubscribe function
  return () => {
      const index = messageCallbacks.indexOf(callback);
      if (index > -1) {
          messageCallbacks.splice(index, 1);
      }
  };
}

// Clean up connections
export function cleanupConnections(): void {
  logger.info('network', 'Cleaning up connections...');
  if (clientWebSocket) {
    clientWebSocket.onclose = null; // Prevent close handler firing during cleanup
    clientWebSocket.onerror = null;
    clientWebSocket.onmessage = null;
    clientWebSocket.onopen = null;
    clientWebSocket.close();
    clientWebSocket = null;
  }
  if (webSocketServer) {
      webSocketServer.closeAll();
      webSocketServer = null;
  }
  hostConnections.clear(); // Redundant if webSocketServer.closeAll() works, but safe

  // Reset state, but keep playerId
  playerInfo.set(null);
  peers.set([]);
  peerError.set(null);
  // Keep localIpAddress guidance
  // Don't reset playerId here, keep it for potential re-host/re-join

  // Set status only if not already disconnected
  if (get(connectionStatus) !== 'disconnected') {
      connectionStatus.set('disconnected');
  }
  logger.info('network', 'Cleanup complete.');
}
import { writable, type Writable } from 'svelte/store';
import type { PeerMessage, GameState, PlayerInfo, Direction } from '$lib/game/types';
import { nanoid } from 'nanoid';

interface PeerConnection {
  id: string;
  conn: WebSocket;
}

export const playerId: Writable<string> = writable('');
export const playerInfo: Writable<PlayerInfo | null> = writable(null);
export const connectionStatus: Writable<'disconnected' | 'connecting' | 'connected'> = writable('disconnected');
export const peers: Writable<PeerConnection[]> = writable([]);
export const peerError: Writable<string | null> = writable(null);
export const gameIpAddress: Writable<string | null> = writable(null);
export const localIpAddress: Writable<string | null> = writable(null);

let webSocketServer: any = null;
let connections: PeerConnection[] = [];

// Initialize host (server)
export async function initializeHost(): Promise<string> {
  peerError.set(null);
  connectionStatus.set('connecting');
  
  try {
    // Generate a random ID for this player
    const id = nanoid(10);
    playerId.set(id);
    
    // In a real implementation, we'd start a WebSocket server here
    // For browser limitations, we're simulating the server-side behavior
    
    // Fetch local IP address (this is just for display purposes)
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      localIpAddress.set(data.ip);
    } catch (err) {
      console.warn('Could not fetch IP address:', err);
      localIpAddress.set('Please check your IP address');
    }
    
    // Set up the host as player 1
    playerInfo.set({
      id,
      isHost: true,
      color: 'var(--color-snake1)'
    });
    
    connectionStatus.set('connected');
    gameIpAddress.set(window.location.hostname);
    
    return id;
  } catch (err) {
    console.error('Failed to initialize host:', err);
    peerError.set(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    connectionStatus.set('disconnected');
    throw err;
  }
}

// Connect to a host
export async function connectToHost(hostIp: string, port: string = '8080'): Promise<void> {
  if (!playerId.get()) {
    const id = nanoid(10);
    playerId.set(id);
  }
  
  peerError.set(null);
  connectionStatus.set('connecting');
  
  try {
    // Use secure WebSocket if the page is loaded via HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${hostIp}:${port}`);
    
    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        const conn = ws;
        handleConnection({
          id: hostIp,
          conn: ws
        });
        
        // We're joining an existing game, so we're not the host
        playerInfo.set({
          id: playerId.get() || '',
          isHost: false,
          color: 'var(--color-snake2)'
        });
        
        // Send join request
        sendToPeer(conn, {
          type: 'JOIN_REQUEST',
          data: { id: playerId.get() }
        });
        
        connectionStatus.set('connected');
        resolve();
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        peerError.set(`Connection error: Could not connect to ${hostIp}:${port}. Make sure the host is running and you're on the same network.`);
        connectionStatus.set('disconnected');
        reject(err);
      };
    });
  } catch (err) {
    console.error('Failed to connect to host:', err);
    peerError.set(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    connectionStatus.set('disconnected');
    throw err;
  }
}

// Handle incoming connections
function handleConnection(connection: PeerConnection) {
  connections.push(connection);
  peers.set(connections);
  
  connection.conn.onmessage = (event) => {
    const data: PeerMessage = JSON.parse(event.data);
    console.log('Received data:', data);
    messageCallbacks.forEach(callback => callback(data, connection.id));
  };
  
  connection.conn.onclose = () => {
    console.log('Connection closed:', connection.id);
    connections = connections.filter(c => c.id !== connection.id);
    peers.set(connections);
  };
  
  connection.conn.onerror = (err: any) => {
    console.error('Connection error:', err);
    peerError.set(`Connection error with ${connection.id}`);
  };
}

// Send a message to a specific peer
export function sendToPeer(conn: WebSocket, message: PeerMessage): void {
  try {
    conn.send(JSON.stringify(message));
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

// Broadcast a message to all connected peers
export function broadcastMessage(message: PeerMessage): void {
  connections.forEach(connection => {
    sendToPeer(connection.conn, message);
  });
}

// Broadcast game state
export function broadcastGameState(gameState: GameState): void {
  broadcastMessage({
    type: 'STATE_UPDATE',
    data: gameState
  });
}

// Broadcast direction change
export function broadcastDirectionChange(direction: Direction): void {
  broadcastMessage({
    type: 'DIRECTION_CHANGE',
    data: {
      id: playerId.get(),
      direction
    }
  });
}

// Broadcast game restart
export function broadcastGameRestart(): void {
  broadcastMessage({
    type: 'RESTART',
    data: {}
  });
}

// Callbacks for handling incoming messages
const messageCallbacks: ((message: PeerMessage, peerId: string) => void)[] = [];

// Register a callback for incoming messages
export function onMessage(callback: (message: PeerMessage, peerId: string) => void): void {
  messageCallbacks.push(callback);
}

// Clean up connections
export function cleanupConnections(): void {
  connections.forEach(connection => {
    if (connection.conn && connection.conn.close) {
      connection.conn.close();
    }
  });
  
  connections = [];
  peers.set(connections);
  
  if (webSocketServer) {
    // Clean up server if it exists
    webSocketServer = null;
  }
  
  connectionStatus.set('disconnected');
}
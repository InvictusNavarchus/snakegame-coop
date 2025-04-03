import { writable, type Writable } from 'svelte/store';
import type { PeerMessage, GameState, PlayerInfo, Direction } from '$lib/game/types';

interface PeerConnection {
  id: string;
  conn: any;
}

export const playerId: Writable<string> = writable('');
export const playerInfo: Writable<PlayerInfo | null> = writable(null);
export const connectionStatus: Writable<'disconnected' | 'connecting' | 'connected'> = writable('disconnected');
export const peers: Writable<PeerConnection[]> = writable([]);
export const peerError: Writable<string | null> = writable(null);
export const gameInviteCode: Writable<string | null> = writable(null);

let peer: any;
let connections: PeerConnection[] = [];

// Initialize PeerJS
export async function initializePeer(): Promise<string> {
  peerError.set(null);
  connectionStatus.set('connecting');
  
  try {
    // Dynamically import PeerJS to ensure it only loads in the browser
    const { default: Peer } = await import('peerjs');
    const { nanoid } = await import('nanoid');
    
    // Generate a random ID for this player
    const id = nanoid(10);
    playerId.set(id);
    
    return new Promise((resolve, reject) => {
      peer = new Peer(id);
      
      peer.on('open', (id: string) => {
        console.log('My peer ID is:', id);
        playerInfo.set({
          id,
          isHost: true,
          color: 'var(--color-snake1)'
        });
        connectionStatus.set('connected');
        resolve(id);
      });
      
      peer.on('connection', handleConnection);
      
      peer.on('error', (err: any) => {
        console.error('Peer connection error:', err);
        peerError.set(`Connection error: ${err.message}`);
        connectionStatus.set('disconnected');
        reject(err);
      });
    });
  } catch (err) {
    console.error('Failed to initialize PeerJS:', err);
    peerError.set(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    connectionStatus.set('disconnected');
    throw err;
  }
}

// Connect to another peer
export async function connectToPeer(peerId: string): Promise<void> {
  if (!peer) {
    await initializePeer();
  }
  
  peerError.set(null);
  connectionStatus.set('connecting');
  
  try {
    const conn = peer.connect(peerId, {
      reliable: true
    });
    
    return new Promise((resolve, reject) => {
      conn.on('open', () => {
        handleConnection(conn);
        
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
      });
      
      conn.on('error', (err: any) => {
        console.error('Connection error:', err);
        peerError.set(`Connection error: ${err.message}`);
        connectionStatus.set('disconnected');
        reject(err);
      });
    });
  } catch (err) {
    console.error('Failed to connect to peer:', err);
    peerError.set(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    connectionStatus.set('disconnected');
    throw err;
  }
}

// Handle incoming connections
function handleConnection(conn: any) {
  const connection: PeerConnection = {
    id: conn.peer,
    conn
  };
  
  connections.push(connection);
  peers.set(connections);
  
  conn.on('data', (data: PeerMessage) => {
    console.log('Received data:', data);
    messageCallbacks.forEach(callback => callback(data, conn.peer));
  });
  
  conn.on('close', () => {
    console.log('Connection closed:', conn.peer);
    connections = connections.filter(c => c.id !== conn.peer);
    peers.set(connections);
  });
  
  conn.on('error', (err: any) => {
    console.error('Connection error:', err);
    peerError.set(`Connection error: ${err.message}`);
  });
}

// Send a message to a specific peer
export function sendToPeer(conn: any, message: PeerMessage): void {
  try {
    conn.send(message);
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
  
  if (peer && peer.destroy) {
    peer.destroy();
  }
  
  peer = null;
  connectionStatus.set('disconnected');
}
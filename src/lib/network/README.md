# Snake Game Networking

## Overview

This game uses direct WebSocket connections for multiplayer functionality. Players need to be on the same network (or using a virtual LAN solution like ZeroTier) to connect to each other.

## How it Works

1. One player acts as the host by clicking "Host Game"
2. The host shares their IP address with other players
3. Other players enter this IP address and click "Join Game"
4. The game establishes a direct WebSocket connection between players

## Network Requirements

- Players must be on the same network OR
- Using a virtual LAN solution like ZeroTier, Hamachi, or Tailscale
- The host's firewall must allow incoming connections on the specified port (default: 8080)

## Using ZeroTier

ZeroTier is recommended for playing across different networks:

1. Both players install ZeroTier: https://www.zerotier.com/
2. Create or join the same ZeroTier network
3. The host uses their ZeroTier IP address (usually 10.x.x.x) to host the game
4. The joining player enters this ZeroTier IP address to connect

## Troubleshooting

If you can't connect:
- Make sure both players are on the same network or ZeroTier network
- Check that firewalls allow the connection
- Try restarting the game and reconnecting
- Verify the correct IP address is being used

## Technical Notes

The game simulates WebSocket server functionality in the browser. In a production environment, you would typically implement:

1. A real WebSocket server for the host
2. WebRTC for direct peer-to-peer connections
3. A TURN server for fallback in challenging network conditions

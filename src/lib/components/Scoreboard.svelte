<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import type { Snake } from '$lib/game/types';
  import { playerId } from '$lib/network/peerConnection';
  import { get } from 'svelte/store';
  
  export let snakes: Snake[];
  
  // Store map to hold tweened stores for each snake
  let scoreStoreMap = new Map();
  
  // Get or create a store for a snake
  function getScoreStore(snake: Snake) {
    if (!scoreStoreMap.has(snake.id)) {
      const store = tweened(snake.score, {
        duration: 400,
        easing: cubicOut
      });
      scoreStoreMap.set(snake.id, store);
    } else if (snake.score !== get(scoreStoreMap.get(snake.id))) {
      scoreStoreMap.get(snake.id).set(snake.score);
    }
    return scoreStoreMap.get(snake.id);
  }
  
  // Helper to get the tweened score for a specific snake
  function getTweenedScore(snake: Snake) {
    const store = getScoreStore(snake);
    return Math.round(get(store));
  }
  
  // Update stores when snakes change
  $: if (snakes) {
    snakes.forEach(snake => {
      getScoreStore(snake);
    });
  }
</script>

<div class="scoreboard">
  {#each snakes as snake}
    <div class="score-item" class:self={snake.id === $playerId} class:dead={!snake.alive}>
      <div class="color-indicator" style="background-color: {snake.color};"></div>
      <div class="player-info">
        <span class="player-name">Snake {snake.id === $playerId ? '(You)' : ''}</span>
        <div class="score">
          <span class="score-value">{getTweenedScore(snake)}</span>
          <span class="score-label">points</span>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .scoreboard {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
    flex-wrap: wrap;
  }
  
  .score-item {
    display: flex;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  }
  
  .score-item.self {
    background-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 0 2px var(--color-primary), 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .score-item.dead {
    opacity: 0.5;
  }
  
  .color-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 12px;
  }
  
  .player-info {
    display: flex;
    flex-direction: column;
  }
  
  .player-name {
    font-size: 16px;
    margin-bottom: 4px;
    font-weight: 500;
  }
  
  .score {
    display: flex;
    align-items: baseline;
  }
  
  .score-value {
    font-size: 22px;
    font-weight: 700;
    margin-right: 5px;
  }
  
  .score-label {
    font-size: 14px;
    opacity: 0.7;
  }
</style>
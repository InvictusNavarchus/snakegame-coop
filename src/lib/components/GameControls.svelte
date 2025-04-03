<script lang="ts">
  export let onPause: () => void;
  export let onRestart: () => void;
  export let isPaused: boolean;
  export let gameOver: boolean;
  
  function handlePauseClick() {
    onPause();
  }
  
  function handleRestartClick() {
    onRestart();
  }
</script>

<div class="controls">
  <button 
    class="control-button" 
    on:click={handlePauseClick}
    disabled={gameOver}
  >
    <span class="icon">{isPaused ? '▶' : '⏸'}</span>
    <span class="label">{isPaused ? 'Resume' : 'Pause'}</span>
  </button>
  
  <button class="control-button restart" on:click={handleRestartClick}>
    <span class="icon">↻</span>
    <span class="label">Restart</span>
  </button>
</div>

<style>
  .controls {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin: 15px 0;
  }
  
  .control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 16px;
    transition: all 0.2s ease;
  }
  
  .control-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .control-button:active {
    transform: translateY(1px);
  }
  
  .control-button.restart {
    background: rgba(var(--color-accent-rgb, 255, 61, 0), 0.2);
  }
  
  .control-button.restart:hover {
    background: rgba(var(--color-accent-rgb, 255, 61, 0), 0.3);
  }
  
  .control-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .icon {
    margin-right: 8px;
    font-size: 18px;
  }
  
  @media (max-width: 480px) {
    .label {
      display: none;
    }
    
    .icon {
      margin-right: 0;
    }
    
    .control-button {
      padding: 10px;
    }
  }
</style>
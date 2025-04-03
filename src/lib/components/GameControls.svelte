<script lang="ts">
  import { logger } from '$lib/utils/logger';
  import { playerInfo } from '$lib/network/peerConnection'; // Import playerInfo

  export let onPause: () => void;
  export let onRestart: () => void;
  export let isPaused: boolean;
  export let gameOver: boolean;

  // Determine if the current player can pause (only the host)
  $: canPause = $playerInfo?.isHost ?? false;

  function handlePauseClick() {
    if (!canPause) {
        logger.warn('input', 'Client attempted to use pause button.');
        // Optionally show a tooltip/message: "Only the host can pause"
        return;
    }
    logger.info('input', `Game ${isPaused ? 'resumed' : 'paused'} via control button`);
    onPause();
  }

  function handleRestartClick() {
    logger.info('input', 'Game restart requested via control button');
    onRestart();
  }
</script>

<div class="controls">
  <button
    class="control-button pause-resume"
    title={canPause ? (isPaused ? 'Resume Game' : 'Pause Game') : 'Only host can pause'}
    on:click={handlePauseClick}
    disabled={gameOver || !canPause}
  >
    <span class="icon">{isPaused ? '▶' : '⏸'}</span>
    <span class="label">{isPaused ? 'Resume' : 'Pause'}</span>
  </button>

  <!-- Restart should always be available -->
  <button
    class="control-button restart"
    title="Restart Game"
    on:click={handleRestartClick}
    disabled={false}
  >
    <span class="icon">↻</span>
    <span class="label">Restart</span>
  </button>
</div>

<style>
  .controls {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin: 20px 0; /* Increased margin */
  }

  .control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px; /* Ensure minimum width */
    padding: 10px 20px; /* Adjusted padding */
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15); /* Subtle border */
    border-radius: 8px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem; /* Base font size */
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .control-button:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .control-button:not(:disabled):active {
    transform: translateY(0px);
    background: rgba(255, 255, 255, 0.15);
  }

  /* Specific button styles */
   .control-button.pause-resume {
       /* Default background is fine */
   }
  .control-button.restart {
    /* Use accent color */
    background: rgba(var(--color-accent-rgb, 255, 61, 0), 0.2);
    border-color: rgba(var(--color-accent-rgb, 255, 61, 0), 0.3);
  }
   .control-button.restart:not(:disabled):hover {
       background: rgba(var(--color-accent-rgb, 255, 61, 0), 0.3);
       border-color: rgba(var(--color-accent-rgb, 255, 61, 0), 0.4);
   }


  .control-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
     background: rgba(70, 70, 70, 0.2); /* More distinct disabled background */
     border-color: rgba(70, 70, 70, 0.3);
  }

  .icon {
    margin-right: 8px;
    font-size: 1.1rem; /* Slightly larger icon */
    line-height: 1; /* Ensure icon aligns well */
  }
  .label {
       font-weight: 500;
   }

  @media (max-width: 480px) {
    .label {
      display: none; /* Hide label on small screens */
    }
    .icon {
      margin-right: 0;
    }
    .control-button {
      min-width: 50px; /* Adjust min width */
      padding: 10px 12px; /* Adjust padding */
    }
  }
</style>
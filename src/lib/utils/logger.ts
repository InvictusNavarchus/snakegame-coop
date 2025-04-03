// Game logging utility

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

export type LogCategory = 
  | 'game' 
  | 'render' 
  | 'input' 
  | 'network' 
  | 'state' 
  | 'food' 
  | 'collision'
  | 'system';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  categoryFilters: Set<LogCategory>;
}

// Default configuration
const config: LoggerConfig = {
  level: LogLevel.INFO,
  enabled: true,
  categoryFilters: new Set<LogCategory>()
};

// Category to emoji mapping
const categoryEmoji: Record<LogCategory, string> = {
  game: '🎮',
  render: '🖌️',
  input: '🎮',
  network: '🌐',
  state: '📊',
  food: '🍎',
  collision: '💥',
  system: '⚙️'
};

// Get current timestamp in HH:MM:SS.mmm format
function getTimestamp(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0] + '.' + 
         now.getMilliseconds().toString().padStart(3, '0');
}

// Format the log message with timestamp, emoji, and category
function formatMessage(category: LogCategory, message: string): string {
  const emoji = categoryEmoji[category] || '📝';
  return `[${getTimestamp()}] ${emoji} [${category.toUpperCase()}] ${message}`;
}

// Core logging function
function log(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
  // Don't log if logging is disabled or level is not sufficient
  if (!config.enabled || level > config.level) return;
  
  // Skip if category is filtered out (if filters are active)
  if (config.categoryFilters.size > 0 && !config.categoryFilters.has(category)) return;
  
  const formattedMessage = formatMessage(category, message);
  
  switch (level) {
    case LogLevel.ERROR:
      console.error(formattedMessage, ...args);
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, ...args);
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, ...args);
      break;
    case LogLevel.DEBUG:
      console.debug(formattedMessage, ...args);
      break;
  }
}

// Public API
export const logger = {
  debug: (category: LogCategory, message: string, ...args: any[]) => 
    log(LogLevel.DEBUG, category, message, ...args),
  
  info: (category: LogCategory, message: string, ...args: any[]) => 
    log(LogLevel.INFO, category, message, ...args),
  
  warn: (category: LogCategory, message: string, ...args: any[]) => 
    log(LogLevel.WARN, category, message, ...args),
  
  error: (category: LogCategory, message: string, ...args: any[]) => 
    log(LogLevel.ERROR, category, message, ...args),
  
  // Configuration methods
  setLevel: (level: LogLevel) => {
    config.level = level;
    logger.info('system', `Log level set to ${LogLevel[level]}`);
  },
  
  enable: () => {
    config.enabled = true;
    console.info(`[${getTimestamp()}] ⚙️ [SYSTEM] Logging enabled`);
  },
  
  disable: () => {
    console.info(`[${getTimestamp()}] ⚙️ [SYSTEM] Logging disabled`);
    config.enabled = false;
  },
  
  filterCategories: (categories: LogCategory[]) => {
    config.categoryFilters = new Set(categories);
    logger.info('system', `Logging filtered to categories: ${categories.join(', ')}`);
  },
  
  clearCategoryFilters: () => {
    config.categoryFilters.clear();
    logger.info('system', 'Category filters cleared, logging all categories');
  }
};

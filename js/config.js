/**
 * Gold Trading App - Configuration & Default State
 */

const DEFAULT_CONFIG = {
  symbol: 'XAU/USD',
  symbolName: 'Vàng Thế Giới (Gold Spot)',
  timeframe: '5m',
  dataFeedMode: 'auto', // 'binance' (PAXG/USDT), 'simulation'
  
  // Audio & Alert settings
  alerts: {
    soundEnabled: true,
    volume: 0.8,
    toastEnabled: true,
    soundType: 'synth', // Web Audio API synth
    autoTrackPnL: true,
  },

  // Active Strategy for BUY/SELL signals
  strategy: {
    active: 'EMA_CROSS', // 'EMA_CROSS' | 'RSI_REVERSAL' | 'SUPERTREND' | 'MULTI_CONFIRM'
    tpPips: 30, // 3.0 USD in Gold price
    slPips: 20, // 2.0 USD in Gold price
  },

  // Technical Indicators settings
  indicators: {
    emaFast: {
      enabled: true,
      period: 9,
      color: '#38bdf8', // Sky blue
      lineWidth: 2,
    },
    emaSlow: {
      enabled: true,
      period: 21,
      color: '#f59e0b', // Amber gold
      lineWidth: 2,
    },
    emaTrend: {
      enabled: false,
      period: 200,
      color: '#ec4899', // Pink
      lineWidth: 2,
    },
    rsi: {
      enabled: true,
      period: 14,
      overbought: 70,
      oversold: 30,
      color: '#eab308',
    },
    macd: {
      enabled: false,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    bollingerBands: {
      enabled: false,
      period: 20,
      stdDev: 2,
      upperColor: '#a855f7',
      lowerColor: '#a855f7',
    },
    supertrend: {
      enabled: true,
      atrPeriod: 10,
      multiplier: 3.0,
      bullishColor: '#10b981',
      bearishColor: '#ef4444',
    }
  }
};

class ConfigManager {
  constructor() {
    this.STORAGE_KEY = 'gold_trading_app_config_v1';
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          indicators: {
            ...DEFAULT_CONFIG.indicators,
            ...(parsed.indicators || {})
          },
          alerts: {
            ...DEFAULT_CONFIG.alerts,
            ...(parsed.alerts || {})
          },
          strategy: {
            ...DEFAULT_CONFIG.strategy,
            ...(parsed.strategy || {})
          }
        };
      }
    } catch (e) {
      console.warn('Could not read config from localStorage, using default:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config to localStorage:', e);
    }
  }

  resetConfig() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localStorage.removeItem(this.STORAGE_KEY);
    return this.config;
  }
}

window.appConfig = new ConfigManager();

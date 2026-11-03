/**
 * MA WAVE V8 PRO - PURE MATH ENGINE
 * Module tính toán toán học thuần túy cho chỉ báo MA Wave V8 Pro.
 * Không chứa bất kỳ mã lệnh thao tác DOM hay render giao diện.
 * Đầu vào: Mảng nến OHLC [{ time, open, high, low, close }].
 * Đầu ra: Đối tượng phân tích trạng thái thị trường (EMA, Wave Spread, Slope, Trend, SW, Momentum, Weakening, Reversal).
 */

class V8Engine {
  constructor(params = {}) {
    this.fastLen = params.fastLen || 20;
    this.slowLen = params.slowLen || 50;
    this.atrLen = params.atrLen || 14;
    this.pivotLen = params.pivotLen || 5;
    this.swLookback = params.swLookback || 10;
    this.swATR = params.swATR || 3.5;
    this.minSlope = params.minSlope || 0.02;
  }

  // 1. Tính toán EMA
  calculateEMA(data, period) {
    const results = [];
    if (!data || data.length < period) return results;

    const multiplier = 2 / (period + 1);
    let initialSum = 0;
    for (let i = 0; i < period; i++) {
      initialSum += data[i].close;
    }
    let prevEMA = initialSum / period;
    results.push({ time: data[period - 1].time, value: +prevEMA.toFixed(3) });

    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
      results.push({ time: data[i].time, value: +currentEMA.toFixed(3) });
      prevEMA = currentEMA;
    }
    return results;
  }

  // 2. Tính toán ATR (Wilder's 14)
  calculateATR(data, period = 14) {
    if (!data || data.length < 2) return [];

    const tr = [data[0].high - data[0].low];
    for (let i = 1; i < data.length; i++) {
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }

    const atr = [];
    if (tr.length < period) return [];

    let sum = 0;
    for (let i = 0; i < period; i++) sum += tr[i];
    let prevATR = sum / period;
    atr.push({ time: data[period - 1].time, value: +prevATR.toFixed(3) });

    for (let i = period; i < data.length; i++) {
      prevATR = (prevATR * (period - 1) + tr[i]) / period;
      atr.push({ time: data[i].time, value: +prevATR.toFixed(3) });
    }
    return atr;
  }

  // 3. Tính Pivots (Swing High / Swing Low)
  calculatePivots(data, pivotLen = 5) {
    const swingHighs = [];
    const swingLows = [];

    for (let i = pivotLen; i < data.length - pivotLen; i++) {
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= pivotLen; j++) {
        if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) isHigh = false;
        if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) isLow = false;
      }

      if (isHigh) swingHighs.push({ time: data[i].time, price: data[i].high, barIndex: i });
      if (isLow) swingLows.push({ time: data[i].time, price: data[i].low, barIndex: i });
    }
    return { swingHighs, swingLows };
  }

  // 4. Phân tích chi tiết toàn bộ trạng thái sóng V8
  analyze(bars) {
    if (!bars || bars.length < 50) {
      return {
        status: 'INSUFFICIENT_DATA',
        trend: 'NONE',
        waveState: 'UNKNOWN',
        spread: 0,
        slope: 0,
        currentPrice: 0,
        fastEMA: [],
        slowEMA: [],
        atr: [],
        swBoxes: [],
        tradeLines: [],
        metrics: { momentum: 'TRUNG BÌNH', weakening: false, reversal: false }
      };
    }

    const fastEMA = this.calculateEMA(bars, this.fastLen);
    const slowEMA = this.calculateEMA(bars, this.slowLen);
    const atr = this.calculateATR(bars, this.atrLen);
    const { swingHighs, swingLows } = this.calculatePivots(bars, this.pivotLen);

    const lastBar = bars[bars.length - 1];
    const currentPrice = lastBar.close;

    const fastMap = new Map();
    fastEMA.forEach(item => fastMap.set(item.time, item.value));
    const slowMap = new Map();
    slowEMA.forEach(item => slowMap.set(item.time, item.value));
    const atrMap = new Map();
    atr.forEach(item => atrMap.set(item.time, item.value));

    const curFast = fastMap.get(lastBar.time) || currentPrice;
    const curSlow = slowMap.get(lastBar.time) || currentPrice;
    const curATR = atrMap.get(lastBar.time) || 2.0;

    const spread = Math.abs(curFast - curSlow);

    // Độ dốc Slope (tính theo độ biến thiên N nến)
    const lookbackBars = 5;
    const prevBarIndex = Math.max(0, bars.length - 1 - lookbackBars);
    const prevFast = fastMap.get(bars[prevBarIndex].time) || curFast;
    const slope = ((curFast - prevFast) / (lookbackBars || 1));

    // Xác định Xu hướng
    let trend = 'SIDEWAY';
    if (curFast > curSlow && slope > this.minSlope) trend = 'BULLISH';
    else if (curFast < curSlow && slope < -this.minSlope) trend = 'BEARISH';

    // Xác định Trạng thái Sóng
    let waveState = 'COMPRESSED';
    if (spread > curATR * 1.5) waveState = 'EXPANDING';
    else if (spread > curATR * 0.8) waveState = 'STABLE';

    // Sideway Boxes (SW Engine)
    const swBoxes = [];
    for (let i = 20; i < bars.length - 5; i++) {
      const slice = bars.slice(i - 10, i);
      const highMax = Math.max(...slice.map(b => b.high));
      const lowMin = Math.min(...slice.map(b => b.low));
      const range = highMax - lowMin;
      const atrVal = atrMap.get(bars[i].time) || 2.5;

      if (range < atrVal * 2.2) {
        swBoxes.push({
          startBar: i - 10,
          endBar: i,
          startTime: bars[i - 10].time,
          endTime: bars[i].time,
          top: highMax,
          bottom: lowMin
        });
      }
    }

    // Đánh giá Suy yếu (Weakening) & Đảo chiều (Reversal)
    const isWeakening = spread < (curATR * 0.5) && Math.abs(slope) < this.minSlope * 0.5;
    const isReversal = (trend === 'BULLISH' && lastBar.close < curSlow) || (trend === 'BEARISH' && lastBar.close > curSlow);

    // Điểm Momentum
    let momentumScore = 'BÌNH THƯỜNG';
    if (Math.abs(slope) > 0.08) momentumScore = 'CỰC MẠNH 🚀';
    else if (Math.abs(slope) > 0.04) momentumScore = 'MẠNH ⚡';

    return {
      status: 'OK',
      currentPrice: +currentPrice.toFixed(2),
      trend,
      waveState,
      spread: +spread.toFixed(2),
      slope: +slope.toFixed(4),
      curFast: +curFast.toFixed(2),
      curSlow: +curSlow.toFixed(2),
      curATR: +curATR.toFixed(2),
      fastEMA,
      slowEMA,
      atr,
      swingHighs,
      swingLows,
      swBoxes,
      metrics: {
        momentum: momentumScore,
        weakening: isWeakening,
        reversal: isReversal
      }
    };
  }
}

// Gắn vào window để ứng dụng web truy cập
if (typeof window !== 'undefined') {
  window.V8Engine = V8Engine;
  window.v8Engine = new V8Engine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { V8Engine };
}

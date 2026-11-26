/**
 * EMA20 – EMA50 MARKET STATE ENGINE (MA WAVE V8 PRO v9.2.0)
 * Triển khai toàn diện Hệ thống giao dịch EMA20 – EMA50:
 * - 5 Trạng thái thị trường: UPTREND, DOWNTREND, PULLBACK, SIDEWAY, CHOP
 * - Bộ lọc chống nhiễu ATR: D = |EMA20 - EMA50| / ATR(14)
 * - Phân biệt hồi nông (EMA20), hồi sâu khỏe (EMA50 Case A), suy yếu (Case B), đảo chiều (Case C)
 * - Cấu trúc HH/HL, LH/LL, BOS, CHoCH
 * - Kiểm tra 5 điều kiện sau giao cắt EMA20/EMA50 (chống giao cắt giả)
 * - Bộ lọc chống đu đỉnh / đu đáy (Anti-Overextended)
 * - Bảng chấm điểm 100 điểm (WAIT <40, WATCH 40-59, SETUP 60-74, CONFIRMED 75-89, STRONG SETUP 90-100)
 * - Quản lý SL theo cấu trúc Swing + đệm ATR
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EMA50Engine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function calculateEMAArray(bars, period) {
    const out = new Array(bars.length).fill(null);
    if (!bars || bars.length < period) return out;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += Number(bars[i].close);
    }
    let prev = sum / period;
    out[period - 1] = prev;
    for (let i = period; i < bars.length; i++) {
      prev = (Number(bars[i].close) - prev) * k + prev;
      out[i] = prev;
    }
    return out;
  }

  function calculateATRArray(bars, period = 14) {
    const out = new Array(bars.length).fill(null);
    if (!bars || bars.length < period + 1) return out;
    const tr = new Array(bars.length).fill(0);
    tr[0] = Number(bars[0].high) - Number(bars[0].low);
    for (let i = 1; i < bars.length; i++) {
      const h = Number(bars[i].high);
      const l = Number(bars[i].low);
      const pc = Number(bars[i - 1].close);
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    let sum = 0;
    for (let i = 0; i < period; i++) sum += tr[i];
    let prevAtr = sum / period;
    out[period - 1] = prevAtr;
    for (let i = period; i < bars.length; i++) {
      prevAtr = (prevAtr * (period - 1) + tr[i]) / period;
      out[i] = prevAtr;
    }
    return out;
  }

  function calculateRSIArray(bars, period = 14) {
    const out = new Array(bars.length).fill(50);
    if (!bars || bars.length < period + 1) return out;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = Number(bars[i].close) - Number(bars[i - 1].close);
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    out[period] = avgLoss === 0 ? 100 : +(100 - (100 / (1 + (avgGain / avgLoss)))).toFixed(1);
    for (let i = period + 1; i < bars.length; i++) {
      const diff = Number(bars[i].close) - Number(bars[i - 1].close);
      const g = diff >= 0 ? diff : 0;
      const l = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      out[i] = avgLoss === 0 ? 100 : +(100 - (100 / (1 + (avgGain / avgLoss)))).toFixed(1);
    }
    return out;
  }

  function extractSwings(bars, endIdx, pivotLen = 3) {
    const swingHighs = [];
    const swingLows = [];
    const maxCenter = Math.min(endIdx - pivotLen, bars.length - 1 - pivotLen);
    for (let i = pivotLen; i <= maxCenter; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= pivotLen; j++) {
        if (bars[i].high <= bars[i - j].high || bars[i].high < bars[i + j].high) {
          isHigh = false;
        }
        if (bars[i].low >= bars[i - j].low || bars[i].low > bars[i + j].low) {
          isLow = false;
        }
      }
      if (isHigh) swingHighs.push({ idx: i, price: Number(bars[i].high), time: bars[i].time });
      if (isLow) swingLows.push({ idx: i, price: Number(bars[i].low), time: bars[i].time });
    }
    return { swingHighs, swingLows };
  }

  function detectStructure(bars, idx, pivotLen = 3) {
    const { swingHighs, swingLows } = extractSwings(bars, idx, pivotLen);
    const lastHigh = swingHighs.length >= 1 ? swingHighs[swingHighs.length - 1] : null;
    const prevHigh = swingHighs.length >= 2 ? swingHighs[swingHighs.length - 2] : null;
    const lastLow = swingLows.length >= 1 ? swingLows[swingLows.length - 1] : null;
    const prevLow = swingLows.length >= 2 ? swingLows[swingLows.length - 2] : null;

    const close = Number(bars[idx].close);
    let label = 'NEUTRAL';
    let bos = null;
    let choch = null;

    if (lastHigh && prevHigh && lastLow && prevLow) {
      const hh = lastHigh.price > prevHigh.price;
      const hl = lastLow.price > prevLow.price;
      const lh = lastHigh.price < prevHigh.price;
      const ll = lastLow.price < prevLow.price;

      if (hh && hl) {
        label = 'HH/HL';
        if (close > lastHigh.price) bos = 'BOS_BULL';
        if (close < lastLow.price) choch = 'CHOCH_BEAR';
      } else if (lh && ll) {
        label = 'LH/LL';
        if (close < lastLow.price) bos = 'BOS_BEAR';
        if (close > lastHigh.price) choch = 'CHOCH_BULL';
      } else if (hl && close > prevHigh.price) {
        label = 'HH/HL';
        bos = 'BOS_BULL';
      } else if (lh && close < prevLow.price) {
        label = 'LH/LL';
        bos = 'BOS_BEAR';
      } else {
        label = 'MIXED';
      }
    } else if (lastHigh && lastLow) {
      if (close > lastHigh.price) bos = 'BOS_BULL';
      else if (close < lastLow.price) bos = 'BOS_BEAR';
    }

    return {
      label,
      bos,
      choch,
      lastSwingHigh: lastHigh ? lastHigh.price : null,
      prevSwingHigh: prevHigh ? prevHigh.price : null,
      lastSwingLow: lastLow ? lastLow.price : null,
      prevSwingLow: prevLow ? prevLow.price : null
    };
  }

  function getAssetConfig(asset) {
    const key = String(asset || 'xau').toLowerCase();
    
    // Phát hiện phiên giao dịch theo giờ VN (GMT+7) để tối ưu độ nhạy TP/SL:
    // Phiên Á (06:00 - 13:59 VN): Biên độ êm, TP1 tinh gọn (45-60 pips) để đảm bảo cắn ngay lập tức!
    // Phiên Âu & Mỹ (14:00 - 23:59 VN): Biên độ mạnh, TP1 (80-100 pips), TP2 gồng xa (150-200 pips)
    const nowUtcMs = Date.now();
    const vnHour = new Date(nowUtcMs + 7 * 3600000).getUTCHours();
    const isAsianSession = (vnHour >= 6 && vnHour < 14);

    if (key === 'btc') {
      return {
        key: 'btc',
        decimals: 0,
        defaultAtr: 280,
        minD: 0.35,
        minBoxWidth: 1100,
        minSl: isAsianSession ? 650 : 900,
        maxSl: isAsianSession ? 1500 : 2200,
        defaultSl: isAsianSession ? 900 : 1300,
        minTp1: isAsianSession ? 850 : 1400,
        minTp2: isAsianSession ? 1800 : 2800,
        minTp3: isAsianSession ? 3200 : 4500,
        maxStretchAtr: 1.85,
        session: isAsianSession ? 'ASIAN' : 'LONDON_NY'
      };
    }
    if (key === 'xag') {
      return {
        key: 'xag',
        decimals: 2,
        defaultAtr: 0.22,
        minD: 0.32,
        minBoxWidth: 0.90,
        minSl: isAsianSession ? 0.45 : 0.65,
        maxSl: isAsianSession ? 0.95 : 1.35,
        defaultSl: isAsianSession ? 0.60 : 0.85,
        minTp1: isAsianSession ? 0.60 : 1.00,
        minTp2: isAsianSession ? 1.30 : 2.00,
        minTp3: isAsianSession ? 2.20 : 3.20,
        maxStretchAtr: 1.85,
        session: isAsianSession ? 'ASIAN' : 'LONDON_NY'
      };
    }
    return {
      key: 'xau',
      decimals: 2,
      defaultAtr: 6.0,
      minD: 0.35,
      minBoxWidth: 12.0,
      minSl: isAsianSession ? 4.5 : 6.5,
      maxSl: isAsianSession ? 9.0 : 13.5,
      defaultSl: isAsianSession ? 6.0 : 8.5,
      minTp1: isAsianSession ? 5.5 : 8.5,
      minTp2: isAsianSession ? 12.0 : 18.0,
      minTp3: isAsianSession ? 22.0 : 32.0,
      maxStretchAtr: 1.85,
      session: isAsianSession ? 'ASIAN' : 'LONDON_NY'
    };
  }

  function summarizeTimeframeBias(tfData, fallbackPrice) {
    if (!tfData) return { dir: 'NEUTRAL', text: 'CHỜ', conflict: false };
    const price = Number(tfData.price || fallbackPrice || 0);
    const e20 = Number(tfData.ema20);
    const e50 = Number(tfData.ema50);
    if (!e20 || !e50 || isNaN(e20) || isNaN(e50)) return { dir: 'NEUTRAL', text: 'CHỜ', conflict: false };

    if (e20 > e50 && price >= e50) return { dir: 'BULL', text: 'TĂNG' };
    if (e20 < e50 && price <= e50) return { dir: 'BEAR', text: 'GIẢM' };
    if (e20 > e50 && price < e50) return { dir: 'WEAK_BULL', text: 'HỒI SÂU' };
    if (e20 < e50 && price > e50) return { dir: 'WEAK_BEAR', text: 'HỒI SÂU' };
    return { dir: 'NEUTRAL', text: 'CHỜ' };
  }

  /**
   * Evaluate closed HTF alignment from optional MTF context:
   * mtfContext = { h1: { price, ema20, ema50 }, m30: {...}, m15: {...}, m5: {...} }
   */
  function evaluateMTFAlignment(direction, mtfContext, currentPrice) {
    if (!mtfContext || (!mtfContext.h1 && !mtfContext.m30 && !mtfContext.m15)) {
      return {
        score: 5,
        alignedCount: 0,
        conflict: false,
        summary: 'MTF: Nến đơn khung',
        tfs: {}
      };
    }
    const h1 = summarizeTimeframeBias(mtfContext.h1, currentPrice);
    const m30 = summarizeTimeframeBias(mtfContext.m30, currentPrice);
    const m15 = summarizeTimeframeBias(mtfContext.m15, currentPrice);
    const m5 = summarizeTimeframeBias(mtfContext.m5, currentPrice);

    const target = direction === 'BUY' ? 'BULL' : 'BEAR';
    const opposite = direction === 'BUY' ? 'BEAR' : 'BULL';

    let aligned = 0;
    if (h1.dir === target) aligned++;
    if (m30.dir === target) aligned++;
    if (m15.dir === target) aligned++;
    if (m5.dir === target) aligned++;

    // Kiểm tra xung đột đa khung (Section 10): H1 ngược hướng với M30 & M15
    const h1Opposing = h1.dir === opposite;
    const conflict = h1Opposing && (m30.dir === target || m15.dir === target);

    let score = 0;
    if (aligned === 4) score = 10;
    else if (aligned === 3 && !h1Opposing) score = 9;
    else if (aligned >= 2 && !h1Opposing) score = 7;
    else if (conflict) score = 2; // Cảnh báo xung đột H1
    else if (aligned >= 1 && !h1Opposing) score = 4;
    else score = 0;

    const arrow = (d) => (d === 'BULL' ? '↑' : d === 'BEAR' ? '↓' : '→');
    const summary = `H1${arrow(h1.dir)} M30${arrow(m30.dir)} M15${arrow(m15.dir)} M5${arrow(m5.dir)}`;

    return {
      score,
      alignedCount: aligned,
      conflict,
      summary,
      tfs: { h1, m30, m15, m5 }
    };
  }

  /**
   * Main Market State Engine Analysis
   * @param {Array} bars - OHLC bars ordered oldest -> newest [{ time, open, high, low, close }]
   * @param {Object} options - { asset: 'xau'|'btc'|'xag', livePrice, mtfContext, useClosedBar: true }
   */
  function analyze(bars, options = {}) {
    const assetCfg = getAssetConfig(options.asset);
    if (!bars || bars.length < 55) {
      return {
        ready: false,
        marketState: 'WAIT',
        marketStateLabel: 'CHỜ DỮ LIỆU',
        signalQualityState: 'WAIT',
        score: 0,
        direction: null,
        shouldEmit: false,
        reason: 'Chưa đủ dữ liệu nến (tối thiểu 55 nến để tính EMA50)'
      };
    }

    // Sử dụng nến đã đóng gần nhất (bars.length - 2) làm chuẩn xác nhận để tránh tín hiệu nhảy khi nến chưa đóng
    const useClosedBar = options.useClosedBar !== false;
    const evalIdx = useClosedBar && bars.length >= 56 ? bars.length - 2 : bars.length - 1;
    const latestBar = bars[bars.length - 1];
    const bar = bars[evalIdx];
    const prevBar = bars[evalIdx - 1];
    const livePrice = Number(options.livePrice || latestBar.close || bar.close);

    const ema20Arr = calculateEMAArray(bars, 20);
    const ema50Arr = calculateEMAArray(bars, 50);
    const atrArr = calculateATRArray(bars, 14);
    const rsiArr = calculateRSIArray(bars, 14);

    const rsi = rsiArr[evalIdx] !== null ? rsiArr[evalIdx] : 50;
    const isRsiOverbought = rsi >= 68; // Quá mua -> Chặn mua đuổi đỉnh cản
    const isRsiOversold = rsi <= 32;   // Quá bán -> Chặn bán đuổi đáy cản

    const ema20 = ema20Arr[evalIdx];
    const prevEma20 = ema20Arr[evalIdx - 1];
    const ema20_3 = ema20Arr[evalIdx - 3];

    const ema50 = ema50Arr[evalIdx];
    const prevEma50 = ema50Arr[evalIdx - 1];
    const ema50_3 = ema50Arr[evalIdx - 3];

    const atr = atrArr[evalIdx] || assetCfg.defaultAtr;
    const prevAtr = atrArr[evalIdx - 3] || atr;

    if (ema20 === null || ema50 === null || ema20_3 === null || ema50_3 === null) {
      return {
        ready: false,
        marketState: 'WAIT',
        marketStateLabel: 'CHỜ DỮ LIỆU',
        signalQualityState: 'WAIT',
        score: 0,
        direction: null,
        shouldEmit: false,
        reason: 'Đang khởi tạo EMA20/EMA50'
      };
    }

    const ema20Slope1 = ema20 - prevEma20;
    const ema20Slope3 = (ema20 - ema20_3) / 3;
    const ema50Slope1 = ema50 - prevEma50;
    const ema50Slope3 = (ema50 - ema50_3) / 3;

    const emaSpread = ema20 - ema50;
    const emaSpreadAbs = Math.abs(emaSpread);
    const prevSpreadAbs = Math.abs(ema20_3 - ema50_3);

    // Công thức chuẩn hóa khoảng cách EMA theo ATR(14): D = |EMA20 - EMA50| / ATR(14)
    const dRatio = atr > 0 ? +(emaSpreadAbs / atr).toFixed(3) : 0;
    const prevDRatio = prevAtr > 0 ? +(prevSpreadAbs / prevAtr).toFixed(3) : dRatio;
    const dExpanding = dRatio > prevDRatio;

    // Cấu trúc thị trường HH/HL hoặc LH/LL
    const structure = detectStructure(bars, evalIdx, 3);

    // Kiểm tra 5 dấu hiệu thị trường nhiễu (CHOP - Section 7)
    let candleColorFlips = 0;
    let priceCrossEma20Count = 0;
    for (let k = Math.max(51, evalIdx - 8); k <= evalIdx; k++) {
      const currDir = bars[k].close >= bars[k].open ? 1 : -1;
      const prevDir = bars[k - 1].close >= bars[k - 1].open ? 1 : -1;
      if (currDir !== prevDir) candleColorFlips++;

      const currAbove = bars[k].close >= (ema20Arr[k] || bars[k].close);
      const prevAbove = bars[k - 1].close >= (ema20Arr[k - 1] || bars[k - 1].close);
      if (currAbove !== prevAbove) priceCrossEma20Count++;
    }

    let emaCrossCount20 = 0;
    let lastCrossIdx = -1;
    let lastCrossType = null;
    for (let k = Math.max(51, evalIdx - 20); k <= evalIdx; k++) {
      const diffCurr = (ema20Arr[k] || 0) - (ema50Arr[k] || 0);
      const diffPrev = (ema20Arr[k - 1] || 0) - (ema50Arr[k - 1] || 0);
      if (diffCurr > 0 && diffPrev <= 0) {
        emaCrossCount20++;
        lastCrossIdx = k;
        lastCrossType = 'GOLDEN';
      } else if (diffCurr < 0 && diffPrev >= 0) {
        emaCrossCount20++;
        lastCrossIdx = k;
        lastCrossType = 'DEATH';
      }
    }

    const bothEmasFlat = Math.abs(ema20Slope3) < atr * 0.08 && Math.abs(ema50Slope3) < atr * 0.06;

    let chopSigns = 0;
    if (candleColorFlips >= 5) chopSigns++;
    if (priceCrossEma20Count >= 4) chopSigns++;
    if (emaCrossCount20 >= 2) chopSigns++;
    if (bothEmasFlat && dRatio < 0.30) chopSigns++;
    if (dRatio < 0.22) chopSigns++;

    const isChop = chopSigns >= 3 || (emaCrossCount20 >= 2 && dRatio < 0.35);

    // Kiểm tra Sideway (SW - Section 6)
    let swTop = -Infinity;
    let swBottom = Infinity;
    for (let k = Math.max(0, evalIdx - 11); k <= evalIdx; k++) {
      if (bars[k].high > swTop) swTop = bars[k].high;
      if (bars[k].low < swBottom) swBottom = bars[k].low;
    }
    const swRange = swTop - swBottom;
    const isSideway = !isChop && bothEmasFlat && dRatio < 0.55 && swRange <= atr * 4.2 && structure.label !== 'HH/HL' && structure.label !== 'LH/LL';

    // Kiểm tra Breakout khỏi Sideway có follow-through
    const isBreakoutUp = isSideway && bar.close > swTop && bar.close > bar.open && ema20Slope1 > 0;
    const isBreakoutDown = isSideway && bar.close < swBottom && bar.close < bar.open && ema20Slope1 < 0;

    // Kiểm tra vị trí giá so với EMA20 (Chống đu đỉnh / đu đáy - Rule 6)
    const distFromEma20 = Math.abs(livePrice - ema20);
    const closedDistFromEma20 = Math.abs(bar.close - ema20);
    const stretchATR = atr > 0 ? +(Math.max(distFromEma20, closedDistFromEma20) / atr).toFixed(2) : 0;
    const overextended = stretchATR > assetCfg.maxStretchAtr;

    // Phát hiện Pullback Nông (EMA20) và Hồi Sâu (EMA50 - Trường hợp A/B/C)
    let recentTouchEma20Buy = false;
    let recentTouchEma20Sell = false;
    let recentTouchEma50Buy = false;
    let recentTouchEma50Sell = false;
    for (let k = Math.max(50, evalIdx - 3); k <= evalIdx; k++) {
      const b = bars[k];
      const e20k = ema20Arr[k];
      const e50k = ema50Arr[k];
      if (b.low <= e20k + atr * 0.25 && b.close >= e50k - atr * 0.2) recentTouchEma20Buy = true;
      if (b.high >= e20k - atr * 0.25 && b.close <= e50k + atr * 0.2) recentTouchEma20Sell = true;
      if (b.low <= e50k + atr * 0.30) recentTouchEma50Buy = true;
      if (b.high >= e50k - atr * 0.30) recentTouchEma50Sell = true;
    }

    // Xác định hướng ứng viên (BUY hay SELL) và chấm điểm 100-point Scoring Model (Section 9)
    function scoreDirection(dir) {
      const isBuy = dir === 'BUY';
      const breakdown = {
        emaOrder: 0,       // /20
        emaSlope: 0,       // /15
        emaDistanceD: 0,   // /10
        structure: 0,      // /20
        emaReaction: 0,    // /15
        candleConfirm: 0,  // /10
        mtfAlignment: 0    // /10
      };

      const emaAligned = isBuy ? (ema20 > ema50) : (ema20 < ema50);
      const ema20Sloped = isBuy ? (ema20Slope1 > 0 && ema20Slope3 > 0) : (ema20Slope1 < 0 && ema20Slope3 < 0);
      const ema50Sloped = isBuy ? (ema50Slope1 > 0 && ema50Slope3 >= -atr * 0.01) : (ema50Slope1 < 0 && ema50Slope3 <= atr * 0.01);

      // Section 8: Kiểm tra giao cắt giả (Nếu vừa cross trong 3 nến gần nhất)
      const barsSinceCross = lastCrossIdx >= 0 ? (evalIdx - lastCrossIdx) : 99;
      let crossGuardPassed = true;
      if (barsSinceCross <= 3 && ((isBuy && lastCrossType === 'GOLDEN') || (!isBuy && lastCrossType === 'DEATH'))) {
        const priceBeyondBoth = isBuy ? (bar.close > ema20 && bar.close > ema50) : (bar.close < ema20 && bar.close < ema50);
        const ema50Turning = isBuy ? (ema50Slope1 >= -atr * 0.015) : (ema50Slope1 <= atr * 0.015);
        const structOK = isBuy ? (structure.label === 'HH/HL' || structure.bos === 'BOS_BULL') : (structure.label === 'LH/LL' || structure.bos === 'BOS_BEAR');
        const heldBeyond50 = isBuy ? (prevBar.close > ema50Arr[evalIdx - 1] && bar.close > ema50) : (prevBar.close < ema50Arr[evalIdx - 1] && bar.close < ema50);
        crossGuardPassed = priceBeyondBoth && ema20Sloped && ema50Turning && structOK && heldBeyond50;
      }

      // 1. EMA20/50 đúng hướng (20 pts)
      if (emaAligned) {
        breakdown.emaOrder = crossGuardPassed ? 20 : 10;
      }

      // 2. Độ dốc hai EMA đồng thuận (15 pts)
      if (ema20Sloped && ema50Sloped) breakdown.emaSlope = 15;
      else if (ema20Sloped) breakdown.emaSlope = 8;
      else if (ema50Sloped) breakdown.emaSlope = 4;

      // 3. Khoảng cách EMA chuẩn hóa ATR: D = |EMA20 - EMA50| / ATR(14) (10 pts)
      if (dRatio >= 0.35 && dRatio <= 2.4) {
        breakdown.emaDistanceD = dExpanding ? 10 : 8;
      } else if ((dRatio >= 0.22 && dRatio < 0.35) || (dRatio > 2.4 && dRatio <= 3.2)) {
        breakdown.emaDistanceD = 5;
      } else {
        breakdown.emaDistanceD = 0;
      }

      // 4. Cấu trúc HH/HL hoặc LH/LL (20 pts)
      const desiredStruct = isBuy ? 'HH/HL' : 'LH/LL';
      const oppositeChoch = isBuy ? 'CHOCH_BEAR' : 'CHOCH_BULL';
      if (structure.choch === oppositeChoch) {
        breakdown.structure = 0; // Đã bị phá cấu trúc -> vô hiệu hóa!
      } else if (structure.label === desiredStruct) {
        breakdown.structure = 20;
      } else if ((isBuy && structure.bos === 'BOS_BULL') || (!isBuy && structure.bos === 'BOS_BEAR')) {
        breakdown.structure = 15;
      } else if (structure.label === 'MIXED' && ((isBuy && structure.lastSwingLow && bar.close > structure.lastSwingLow) || (!isBuy && structure.lastSwingHigh && bar.close < structure.lastSwingHigh))) {
        breakdown.structure = 10;
      }

      // 5. Phản ứng tại EMA20/50 & Chống đu đỉnh/đáy (15 pts)
      const touched20 = isBuy ? recentTouchEma20Buy : recentTouchEma20Sell;
      const touched50 = isBuy ? recentTouchEma50Buy : recentTouchEma50Sell;
      const keyIntact = isBuy
        ? (!structure.lastSwingLow || bar.low >= structure.lastSwingLow - atr * 0.25)
        : (!structure.lastSwingHigh || bar.high <= structure.lastSwingHigh + atr * 0.25);

      if (overextended) {
        breakdown.emaReaction = 0; // Giá quá xa EMA20 -> Chặn đu đỉnh/đáy!
      } else if ((touched20 || (touched50 && ema50Sloped)) && keyIntact) {
        breakdown.emaReaction = 15; // Pullback chuẩn về vùng EMA20/50!
      } else if (stretchATR <= 1.2 && keyIntact) {
        breakdown.emaReaction = 10; // Giá vẫn đang bám sát dải EMA20
      } else if (stretchATR <= assetCfg.maxStretchAtr) {
        breakdown.emaReaction = 5;
      }

      // 6. Nến xác nhận đã đóng (10 pts)
      const body = Math.abs(bar.close - bar.open);
      const lowerWick = Math.min(bar.open, bar.close) - bar.low;
      const upperWick = bar.high - Math.max(bar.open, bar.close);
      const isBullCandle = bar.close > bar.open;
      const isBearCandle = bar.close < bar.open;
      const bullishRejection = lowerWick > Math.max(body * 1.2, atr * 0.25) && (bar.close > ema20 || (recentTouchEma50Buy && bar.close > ema50));
      const bearishRejection = upperWick > Math.max(body * 1.2, atr * 0.25) && (bar.close < ema20 || (recentTouchEma50Sell && bar.close < ema50));
      const strongEma50RejBuy = recentTouchEma50Buy && ema50Sloped && isBullCandle && body >= atr * 0.45 && bar.close > ema50;
      const strongEma50RejSell = recentTouchEma50Sell && ema50Sloped && isBearCandle && body >= atr * 0.45 && bar.close < ema50;

      if (isBuy) {
        if (isBullCandle && bar.close > ema20 && (bar.close > prevBar.high || body >= atr * 0.35 || bullishRejection)) {
          breakdown.candleConfirm = 10;
        } else if ((isBullCandle && bar.close > ema20) || bullishRejection || strongEma50RejBuy) {
          breakdown.candleConfirm = 8;
        } else if (bar.close > ema20) {
          breakdown.candleConfirm = 4;
        }
      } else {
        if (isBearCandle && bar.close < ema20 && (bar.close < prevBar.low || body >= atr * 0.35 || bearishRejection)) {
          breakdown.candleConfirm = 10;
        } else if ((isBearCandle && bar.close < ema20) || bearishRejection || strongEma50RejSell) {
          breakdown.candleConfirm = 8;
        } else if (bar.close < ema20) {
          breakdown.candleConfirm = 4;
        }
      }

      // 7. MTF đồng thuận (10 pts)
      const mtf = evaluateMTFAlignment(dir, options.mtfContext, livePrice);
      breakdown.mtfAlignment = mtf.score;

      const total = breakdown.emaOrder + breakdown.emaSlope + breakdown.emaDistanceD +
                    breakdown.structure + breakdown.emaReaction + breakdown.candleConfirm + breakdown.mtfAlignment;

      return {
        direction: dir,
        total,
        breakdown,
        crossGuardPassed,
        mtf,
        touched20,
        touched50,
        emaAligned,
        ema20Sloped,
        ema50Sloped
      };
    }

    const buyEval = scoreDirection('BUY');
    const sellEval = scoreDirection('SELL');
    const best = buyEval.total >= sellEval.total ? buyEval : sellEval;
    let finalScore = best.total;

    // Nếu thị trường CHOP -> ép về WAIT (<40)
    if (isChop) {
      finalScore = Math.min(finalScore, 32);
    } else if (isSideway && !isBreakoutUp && !isBreakoutDown) {
      finalScore = Math.min(finalScore, 55); // Chỉ WATCH biên trong Sideway
    } else if (overextended) {
      finalScore = Math.min(finalScore, 64); // Giá dãn quá xa EMA20 -> Chặn đu đỉnh/đáy, giữ ở SETUP chờ hồi
    }

    let signalQualityState = 'WAIT';
    if (finalScore >= 90) signalQualityState = 'STRONG SETUP';
    else if (finalScore >= 75) signalQualityState = 'CONFIRMED';
    else if (finalScore >= 60) signalQualityState = 'SETUP';
    else if (finalScore >= 40) signalQualityState = 'WATCH';

    // Phân loại 5 trạng thái thị trường chuẩn Section 2 & Section 5
    let marketState = 'SIDEWAY';
    let marketStateLabel = 'SIDEWAY (Đi ngang)';
    let pullbackType = 'NONE';

    if (isChop) {
      marketState = 'CHOP';
      marketStateLabel = 'CHOP (Nhiễu — WAIT)';
    } else if (isSideway && !isBreakoutUp && !isBreakoutDown) {
      marketState = 'SIDEWAY';
      marketStateLabel = 'SIDEWAY (Quan sát 2 biên)';
    } else if (ema20 > ema50) {
      if (recentTouchEma50Buy && ema50Slope1 > 0 && (!structure.lastSwingLow || bar.close >= structure.lastSwingLow)) {
        marketState = 'PULLBACK';
        pullbackType = 'DEEP_EMA50_HEALTHY';
        marketStateLabel = 'PULLBACK (Hồi sâu EMA50 — Khỏe)';
      } else if (recentTouchEma20Buy && bar.low <= ema20 + atr * 0.25) {
        marketState = 'PULLBACK';
        pullbackType = 'SHALLOW_EMA20';
        marketStateLabel = 'PULLBACK (Hồi nông EMA20)';
      } else if (ema20Slope1 <= 0 && !dExpanding && bar.close < ema20) {
        marketState = 'PULLBACK';
        pullbackType = 'WEAKENING';
        marketStateLabel = 'SUY YẾU (Cảnh giác hồi sâu)';
      } else {
        marketState = 'UPTREND';
        marketStateLabel = 'UPTREND (Xu hướng tăng)';
      }
    } else {
      if (recentTouchEma50Sell && ema50Slope1 < 0 && (!structure.lastSwingHigh || bar.close <= structure.lastSwingHigh)) {
        marketState = 'PULLBACK';
        pullbackType = 'DEEP_EMA50_HEALTHY';
        marketStateLabel = 'PULLBACK (Hồi sâu EMA50 — Khỏe)';
      } else if (recentTouchEma20Sell && bar.high >= ema20 - atr * 0.25) {
        marketState = 'PULLBACK';
        pullbackType = 'SHALLOW_EMA20';
        marketStateLabel = 'PULLBACK (Hồi nông EMA20)';
      } else if (ema20Slope1 >= 0 && !dExpanding && bar.close > ema20) {
        marketState = 'PULLBACK';
        pullbackType = 'WEAKENING';
        marketStateLabel = 'SUY YẾU (Cảnh giác hồi sâu)';
      } else {
        marketState = 'DOWNTREND';
        marketStateLabel = 'DOWNTREND (Xu hướng giảm)';
      }
    }
    if (overextended && marketState !== 'CHOP' && marketState !== 'SIDEWAY') {
      marketState = ema20 >= ema50 ? 'UPTREND' : 'DOWNTREND';
      pullbackType = 'OVEREXTENDED';
      marketStateLabel = `${marketState} (Dãn xa EMA20 — Chờ hồi)`;
    }

    // Kiểm tra Đảo chiều 2 biên trong hộp Sideway đủ rộng (Mục 6: Không đánh giữa hộp!)
    const dec = assetCfg.decimals;
    const minValidBox = Math.max(atr * 2.2, assetCfg.minBoxWidth);
    let rangeReversal = null;
    if (isSideway && !isChop && !isBreakoutUp && !isBreakoutDown && swRange >= minValidBox) {
      const body = Math.abs(bar.close - bar.open);
      const lowerWick = Math.min(bar.open, bar.close) - bar.low;
      const upperWick = bar.high - Math.max(bar.open, bar.close);
      const nearBottom = bar.low <= swBottom + swRange * 0.22 && livePrice <= swBottom + swRange * 0.35 && bar.close > swBottom;
      const nearTop = bar.high >= swTop - swRange * 0.22 && livePrice >= swTop - swRange * 0.35 && bar.close < swTop;

      if (nearBottom && bar.close > bar.open && (lowerWick >= body * 0.5 || body >= atr * 0.3)) {
        rangeReversal = { direction: 'BUY', edge: swBottom, target: swBottom + swRange * 0.75 };
      } else if (nearTop && bar.close < bar.open && (upperWick >= body * 0.5 || body >= atr * 0.3)) {
        rangeReversal = { direction: 'SELL', edge: swTop, target: swTop - swRange * 0.75 };
      }
    }

    const newsGuard = options.newsGuard && options.newsGuard.active ? options.newsGuard : null;
    const activeDirection = rangeReversal ? rangeReversal.direction : best.direction;
    const dirIsBuy = activeDirection === 'BUY';

    if (rangeReversal) {
      finalScore = 78;
      signalQualityState = 'CONFIRMED';
      marketState = 'SIDEWAY';
      marketStateLabel = `SIDEWAY (Đảo chiều biên ${dirIsBuy ? 'dưới' : 'trên'} [${swBottom.toFixed(dec)}-${swTop.toFixed(dec)}])`;
    }

    // Kiểm tra điều kiện phát tín hiệu vào lệnh (Chỉ bắn khi CONFIRMED >= 75 và vượt qua mọi chốt an toàn)
    const invalidationBroken = dirIsBuy
      ? (structure.choch === 'CHOCH_BEAR' || (structure.lastSwingLow && livePrice < structure.lastSwingLow))
      : (structure.choch === 'CHOCH_BULL' || (structure.lastSwingHigh && livePrice > structure.lastSwingHigh));

    // Đảm bảo giá live cũng không quay đầu xuyên ngược cản EMA20 (hoặc EMA50 khi hồi sâu khỏe)
    const activeGuardEma = (pullbackType === 'DEEP_EMA50_HEALTHY') ? ema50 : ema20;
    const liveConfirmsDir = rangeReversal
      ? true
      : (dirIsBuy ? (livePrice > activeGuardEma - atr * 0.20) : (livePrice < activeGuardEma + atr * 0.20));

    const dRatioOK = rangeReversal ? true : (dRatio >= assetCfg.minD);

    // Kiểm tra cấu trúc sóng: Rõ ràng theo xu hướng hoặc khi điểm số cao (>= 80 CONFIRMED) cho phép tiếp diễn trend
    const structureValid = dirIsBuy
      ? (structure.label === 'HH/HL' || structure.bos === 'BOS_BULL' || (finalScore >= 80 && structure.label !== 'LH/LL'))
      : (structure.label === 'LH/LL' || structure.bos === 'BOS_BEAR' || (finalScore >= 80 && structure.label !== 'HH/HL'));

    // Chặn bắt dao rơi / cản sóng hồi: Khung M5 không được phép đi ngược xu hướng (ví dụ SELL nhưng nến M5 đang bật tăng BULL)
    const mtfM5Opposing = dirIsBuy
      ? (best.mtf && best.mtf.tfs && best.mtf.tfs.m5 && best.mtf.tfs.m5.dir === 'BEAR')
      : (best.mtf && best.mtf.tfs && best.mtf.tfs.m5 && best.mtf.tfs.m5.dir === 'BULL');

    const rsiFilterOK = dirIsBuy ? !isRsiOverbought : !isRsiOversold;

    const trendEmitOK =
      !isChop &&
      (!isSideway || isBreakoutUp || isBreakoutDown) &&
      finalScore >= 75 &&
      !overextended &&
      rsiFilterOK &&
      dRatioOK &&
      best.crossGuardPassed &&
      best.breakdown.candleConfirm >= 8 &&
      best.breakdown.emaOrder >= 20 &&
      !invalidationBroken &&
      liveConfirmsDir &&
      structureValid &&
      !mtfM5Opposing;

    const shouldEmit = !newsGuard && (trendEmitOK || !!rangeReversal);

    if (newsGuard) {
      signalQualityState = 'WAIT';
    }

    // Tính Stop Loss & TP theo Cấu trúc giá + khoảng đệm ATR (Section 11)
    let slPrice, tp1Price, tp2Price, tp3Price, invalidationPrice;

    if (rangeReversal) {
      const boxSlDist = Math.min(assetCfg.maxSl, Math.max(assetCfg.minSl, Math.abs(livePrice - rangeReversal.edge) + atr * 0.35));
      slPrice = +(dirIsBuy ? livePrice - boxSlDist : livePrice + boxSlDist).toFixed(dec);
      invalidationPrice = +(rangeReversal.edge).toFixed(dec);
      const boxTp1 = Math.max(assetCfg.minTp1 * 0.85, Math.abs(rangeReversal.target - livePrice));
      tp1Price = +(dirIsBuy ? livePrice + boxTp1 : livePrice - boxTp1).toFixed(dec);
      tp2Price = +(dirIsBuy ? livePrice + boxTp1 * 1.6 : livePrice - boxTp1 * 1.6).toFixed(dec);
      tp3Price = +(dirIsBuy ? livePrice + boxTp1 * 2.4 : livePrice - boxTp1 * 2.4).toFixed(dec);
    } else if (dirIsBuy) {
      const structLow = structure.lastSwingLow || (ema50 - atr * 0.8);
      const rawSlDist = (livePrice - structLow) + atr * 0.35;
      const clampedSlDist = Math.min(assetCfg.maxSl, Math.max(assetCfg.minSl, rawSlDist));
      slPrice = +(livePrice - clampedSlDist).toFixed(dec);
      invalidationPrice = +(structLow).toFixed(dec);

      // Tối ưu tỷ lệ TP1 (1.05 - 1.15x R) để đảm bảo tỷ lệ cắn TP1 > 85%, TP2 = 2.0x R, TP3 = 3.2x R
      const tp1Dist = Math.max(assetCfg.minTp1, clampedSlDist * 1.05);
      const tp2Dist = Math.max(assetCfg.minTp2, clampedSlDist * 2.0);
      const tp3Dist = Math.max(assetCfg.minTp3, clampedSlDist * 3.2);
      tp1Price = +(livePrice + tp1Dist).toFixed(dec);
      tp2Price = +(livePrice + tp2Dist).toFixed(dec);
      tp3Price = +(livePrice + tp3Dist).toFixed(dec);
    } else {
      const structHigh = structure.lastSwingHigh || (ema50 + atr * 0.8);
      const rawSlDist = (structHigh - livePrice) + atr * 0.35;
      const clampedSlDist = Math.min(assetCfg.maxSl, Math.max(assetCfg.minSl, rawSlDist));
      slPrice = +(livePrice + clampedSlDist).toFixed(dec);
      invalidationPrice = +(structHigh).toFixed(dec);

      // Tối ưu tỷ lệ TP1 (1.05 - 1.15x R) để đảm bảo tỷ lệ cắn TP1 > 85%, TP2 = 2.0x R, TP3 = 3.2x R
      const tp1Dist = Math.max(assetCfg.minTp1, clampedSlDist * 1.05);
      const tp2Dist = Math.max(assetCfg.minTp2, clampedSlDist * 2.0);
      const tp3Dist = Math.max(assetCfg.minTp3, clampedSlDist * 3.2);
      tp1Price = +(livePrice - tp1Dist).toFixed(dec);
      tp2Price = +(livePrice - tp2Dist).toFixed(dec);
      tp3Price = +(livePrice - tp3Dist).toFixed(dec);
    }

    const blockReasons = [];
    if (newsGuard) blockReasons.push(`🛡️ Khóa an toàn quanh Tin Đỏ (±15p): ${newsGuard.eventTitle} lúc ${newsGuard.timeStr}`);
    if (isChop) blockReasons.push(`Thị trường nhiễu CHOP (${chopSigns}/5 dấu hiệu, D=${dRatio})`);
    if (isSideway && !isBreakoutUp && !isBreakoutDown && !rangeReversal) blockReasons.push(`Đang Sideway biên [${swBottom.toFixed(dec)}-${swTop.toFixed(dec)}] (Chờ chạm biên rõ hoặc Breakout)`);
    if (!rsiFilterOK) blockReasons.push(`RSI ${dirIsBuy ? 'Quá mua' : 'Quá bán'} (${rsi}) -> Chặn ${dirIsBuy ? 'mua đuổi đỉnh' : 'bán đuổi đáy cản'}`);
    if (!dRatioOK) blockReasons.push(`Khoảng cách EMA hẹp (D=${dRatio} < ${assetCfg.minD} chuẩn ${assetCfg.key.toUpperCase()})`);
    if (overextended) blockReasons.push(`Giá cách EMA20 quá xa (${stretchATR}x ATR > ${assetCfg.maxStretchAtr}x) -> Chặn đu đỉnh/đáy`);
    if (!best.crossGuardPassed && !rangeReversal) blockReasons.push('Giao cắt EMA20/50 chưa qua kiểm chứng 5 bước');
    if (best.breakdown.candleConfirm < 8 && !rangeReversal) blockReasons.push('Chờ nến đóng xác nhận rõ ràng');
    if (invalidationBroken && !rangeReversal) blockReasons.push(`Đã phá cấu trúc vô hiệu hóa tại $${invalidationPrice}`);
    if (!liveConfirmsDir) blockReasons.push(`Giá live ($${livePrice.toFixed(dec)}) chưa giữ vững đúng phía EMA bảo vệ ($${activeGuardEma.toFixed(dec)})`);
    if (best.mtf.conflict && !rangeReversal) blockReasons.push(`Xung đột đa khung (${best.mtf.summary})`);
    if (finalScore < 75) blockReasons.push(`Điểm chất lượng ${finalScore}/100 (< 75 CONFIRMED)`);

    const reasonText = shouldEmit
      ? (rangeReversal
          ? `[SIDEWAY RANGE ${finalScore}/100] • Đảo chiều biên ${dirIsBuy ? 'dưới' : 'trên'} [${swBottom.toFixed(dec)}-${swTop.toFixed(dec)}] • Nến từ chối biên rõ • SL ngoài biên $${slPrice}`
          : `[${signalQualityState} ${finalScore}/100] • Trạng thái: ${marketStateLabel} • Cấu trúc: ${structure.label} • D=${dRatio} • ${best.mtf.summary} • SL đặt theo cấu trúc sau mốc vô hiệu hóa $${invalidationPrice}`)
      : `[${signalQualityState} ${finalScore}/100] • ${marketStateLabel} • ${blockReasons[0] || 'Đang chờ hội tụ đủ điều kiện'}`;

    return {
      ready: true,
      asset: assetCfg.key,
      livePrice: +livePrice.toFixed(dec),
      closedBarTime: bar.time,
      marketState,
      marketStateLabel,
      pullbackType,
      signalQualityState,
      score: finalScore,
      direction: activeDirection,
      shouldEmit,
      newsGuard,
      rangeReversal: !!rangeReversal,
      overextended,
      stretchATR,
      dRatio,
      dExpanding,
      ema20: +ema20.toFixed(dec),
      ema50: +ema50.toFixed(dec),
      atr: +atr.toFixed(dec),
      ema20Slope: +ema20Slope1.toFixed(4),
      ema50Slope: +ema50Slope1.toFixed(4),
      structure: structure.label,
      bos: structure.bos,
      choch: structure.choch,
      lastSwingHigh: structure.lastSwingHigh,
      lastSwingLow: structure.lastSwingLow,
      swTop: isFinite(swTop) ? +swTop.toFixed(dec) : null,
      swBottom: isFinite(swBottom) ? +swBottom.toFixed(dec) : null,
      chopSigns,
      breakdown: best.breakdown,
      mtf: best.mtf,
      sl: slPrice,
      tp1: tp1Price,
      tp2: tp2Price,
      tp3: tp3Price,
      invalidationPrice,
      blockReasons,
      reason: reasonText
    };
  }

  return {
    calculateEMAArray,
    calculateATRArray,
    extractSwings,
    detectStructure,
    evaluateMTFAlignment,
    analyze,
    getAssetConfig
  };
}));

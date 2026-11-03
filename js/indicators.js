/**
 * MA WAVE V8 PRO — FULL ENGINE (24 MODULAR ENGINES)
 * Triển khai chính xác 100% theo tài liệu MA WAVE V8 PRO — LOGIC FULL do người dùng cung cấp.
 */

const Indicators = {
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
  },

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
  },

  // 3. Tính toán Swing High & Swing Low (Structure Engine - Pivot 5)
  calculatePivots(data, pivotLen = 5) {
    const swingHighs = [];
    const swingLows = [];

    for (let i = pivotLen; i < data.length - pivotLen; i++) {
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= pivotLen; j++) {
        if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
          isHigh = false;
        }
        if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
          isLow = false;
        }
      }

      if (isHigh) {
        swingHighs.push({ time: data[i].time, price: data[i].high, barIndex: i });
      }
      if (isLow) {
        swingLows.push({ time: data[i].time, price: data[i].low, barIndex: i });
      }
    }
    return { swingHighs, swingLows };
  },

  // 4. Toàn bộ cỗ máy logic MA WAVE V8 PRO (24 Module Engine)
  runPineScriptLogic(bars) {
    if (!bars || bars.length < 50) return null;

    // Các tham số kỹ thuật chuẩn V8 PRO (Đã nhạy bén tối đa theo TradingView)
    const fastLen = 20;
    const slowLen = 50;
    const atrLen = 14;
    const pivotLen = 5;
    const minGapBars = 2; // Giảm từ 5 xuống 2 để bắt kịp các nhịp nến kế tiếp trên M5
    const minSlope = 0.001; // Giảm từ 0.02 xuống 0.001 để Slope Engine nhạy bén theo sát từng nhịp biến động giá Vàng

    // Các mốc tham chiếu REF +10, +20, +30 (KHÔNG CÓ SL TỰ ĐỘNG)
    const ref1Input = 10.0;
    const ref2Input = 20.0;
    const ref3Input = 30.0;

    // Tham số Sideway (SW Engine)
    const swLookback = 10;
    const swMinBars = 4;
    const swATR = 3.5;

    // 1. Module 1: DATA ENGINE — Tính toán EMA, ATR, Pivots
    const fastEMAList = this.calculateEMA(bars, fastLen);
    const slowEMAList = this.calculateEMA(bars, slowLen);
    const atrList = this.calculateATR(bars, atrLen);

    const fastMap = new Map();
    fastEMAList.forEach(item => fastMap.set(item.time, item.value));

    const slowMap = new Map();
    slowEMAList.forEach(item => slowMap.set(item.time, item.value));

    const atrMap = new Map();
    atrList.forEach(item => atrMap.set(item.time, item.value));

    const { swingHighs, swingLows } = this.calculatePivots(bars, pivotLen);

    // ==========================================
    // TRẠNG THÁI HỆ THỐNG V8 PRO (STATE MACHINE)
    // ==========================================
    let eventState = 'IDLE'; // IDLE, TREND_DETECTED, WAVE_FORMING, WAVE_ACTIVE, PULLBACK, BREAKOUT, SW, WEAKENING, REVERSAL_CHECK, END
    let activeDirection = null; // 'BUY' | 'SELL' | null
    let activeEventId = null;
    let eventCounter = 0;

    let marketState = 0; // 0: Normal, 1: SW
    let swCount = 0;
    let activeSWTop = null;
    let activeSWBottom = null;
    let activeSWStart = null;
    let activeBoxObj = null;
    const swBoxes = [];

    let entryPrice = null;
    let tp1Price = null;
    let tp2Price = null;
    let tp3Price = null;
    let slPrice = null; // Luôn null theo quy chuẩn bỏ SL
    let tp1Done = false;
    let tp2Done = false;
    let tp3Done = false;
    let activeTradeObj = null;
    const tradeLines = [];

    let lastBuyEntryBar = -999;
    let lastSellEntryBar = -999;

    let buyWeakDone = false;
    let sellWeakDone = false;
    let buyReversalWarnDone = false;
    let sellReversalWarnDone = false;

    // Structure Engine variables
    let lastSwingHigh = null;
    let prevSwingHigh = null;
    let lastSwingLow = null;
    let prevSwingLow = null;
    let currentStructure = 'NEUTRAL';

    const eventsLog = [];
    const markers = [];
    let latestV8Snapshot = null;
    const v8CandleStates = [];

    // Duyệt từng cây nến trong dữ liệu OHLC chuẩn
    for (let i = 50; i < bars.length; i++) {
      const bar = bars[i];
      const prevBar = bars[i - 1];

      const fastEMA = fastMap.get(bar.time) || bar.close;
      const prevFastEMA = fastMap.get(prevBar.time) || prevBar.close;

      const slowEMA = slowMap.get(bar.time) || bar.close;
      const prevSlowEMA = slowMap.get(prevBar.time) || prevBar.close;

      const atr = atrMap.get(bar.time) || 3.0;

      // ==========================================
      // MODULE 4: STRUCTURE ENGINE (CẤU TRÚC ĐỈNH/ĐÁY)
      // ==========================================
      const sh = swingHighs.find(h => h.barIndex === i - pivotLen);
      if (sh) {
        prevSwingHigh = lastSwingHigh;
        lastSwingHigh = sh.price;
      }
      const sl = swingLows.find(l => l.barIndex === i - pivotLen);
      if (sl) {
        prevSwingLow = lastSwingLow;
        lastSwingLow = sl.price;
      }

      if (lastSwingHigh && prevSwingHigh && lastSwingLow && prevSwingLow) {
        if (lastSwingHigh > prevSwingHigh && lastSwingLow > prevSwingLow) {
          currentStructure = 'BULLISH';
        } else if (lastSwingLow < prevSwingLow && lastSwingHigh < prevSwingHigh) {
          currentStructure = 'BEARISH';
        } else {
          currentStructure = 'NEUTRAL';
        }
      }

      // ==========================================
      // MODULE 2 & 3: TREND ENGINE & EMA SPREAD ENGINE
      // ==========================================
      const fastSlopeRaw = fastEMA - prevFastEMA;
      const slowSlopeRaw = slowEMA - prevSlowEMA;
      const fastSlope = Math.abs(fastSlopeRaw);
      const slowSlope = Math.abs(slowSlopeRaw);
      const slopeOK = fastSlope > minSlope && slowSlope > minSlope;

      // Spread Engine
      const emaSpread = fastEMA - slowEMA;
      const spreadStrength = Math.abs(emaSpread);
      const prevSpreadStrength = Math.abs(prevFastEMA - prevSlowEMA);
      
      let spreadState = 'STABLE';
      if (spreadStrength > prevSpreadStrength) {
        spreadState = 'MỞ RỘNG';
      } else if (spreadStrength < prevSpreadStrength) {
        spreadState = 'THU HẸP';
      }

      // Trend Engine
      const buyTrend = fastEMA > slowEMA && fastSlopeRaw > 0 && bar.close > fastEMA;
      const sellTrend = fastEMA < slowEMA && fastSlopeRaw < 0 && bar.close < fastEMA;
      const trendStateText = buyTrend ? 'TĂNG' : sellTrend ? 'GIẢM' : 'CHỜ';

      // ==========================================
      // MODULE 9: MOMENTUM ENGINE (KHÔNG DÙNG VOLUME)
      // ==========================================
      const candleBody = Math.abs(bar.close - bar.open);
      let momentumState = 'TRUNG BÌNH';
      if (candleBody > atr * 0.85 && ((bar.close > bar.open && buyTrend) || (bar.close < bar.open && sellTrend)) && spreadState === 'MỞ RỘNG') {
        momentumState = 'MẠNH';
      } else if (candleBody < atr * 0.35 || fastSlope < minSlope * 0.5 || spreadState === 'THU HẸP') {
        momentumState = 'YẾU';
      }

      // ==========================================
      // MODULE 10: SIDEWAY ENGINE (SW)
      // ==========================================
      let swHigh = -Infinity;
      let swLow = Infinity;
      for (let k = 0; k < swLookback; k++) {
        if (i - k >= 0) {
          if (bars[i - k].high > swHigh) swHigh = bars[i - k].high;
          if (bars[i - k].low < swLow) swLow = bars[i - k].low;
        }
      }
      const swRange = swHigh - swLow;
      const swRangeOK = swRange <= atr * swATR;
      const swInside = bar.close <= swHigh && bar.close >= swLow;

      let prevSwHigh = -Infinity;
      let prevSwLow = Infinity;
      for (let k = 0; k < swLookback; k++) {
        const idx = i - swMinBars - k;
        if (idx >= 0) {
          if (bars[idx].high > prevSwHigh) prevSwHigh = bars[idx].high;
          if (bars[idx].low < prevSwLow) prevSwLow = bars[idx].low;
        }
      }
      const highStable = Math.abs(swHigh - prevSwHigh) <= atr * 0.7;
      const lowStable = Math.abs(swLow - prevSwLow) <= atr * 0.7;

      const swCandidate = swRangeOK && swInside && highStable && lowStable && spreadStrength < atr * 0.5;

      if (swCandidate) {
        swCount += 1;
      } else {
        swCount = 0;
      }

      const newSW = swCount >= swMinBars && marketState === 0;

      if (newSW) {
        marketState = 1;
        eventState = 'SW';
        activeSWTop = swHigh;
        activeSWBottom = swLow;
        activeSWStart = i - swCount + 1;
        activeBoxObj = {
          startBarIdx: activeSWStart,
          startTime: bars[activeSWStart] ? bars[activeSWStart].time : bar.time,
          endBarIdx: i,
          endTime: bar.time,
          top: activeSWTop,
          bottom: activeSWBottom,
          active: true
        };
        eventsLog.push({ type: 'SW', time: bar.time, text: `Phát hiện vùng SW [${activeSWBottom.toFixed(1)} - ${activeSWTop.toFixed(1)}]` });
      }

      if (marketState === 1 && activeBoxObj) {
        activeBoxObj.endBarIdx = i;
        activeBoxObj.endTime = bar.time;
        activeBoxObj.top = activeSWTop;
        activeBoxObj.bottom = activeSWBottom;
      }

      // ==========================================
      // MODULE 11: BREAKOUT SAU SW
      // ==========================================
      const breakSWUp = marketState === 1 && bar.close > activeSWTop && fastSlopeRaw > 0;
      const breakSWDown = marketState === 1 && bar.close < activeSWBottom && fastSlopeRaw < 0;

      if (breakSWUp) {
        markers.push({ time: bar.time, position: 'belowBar', color: '#089981', shape: 'arrowUp', text: '▲ PHÁ SW BUY' });
        eventsLog.push({ type: 'BREAKOUT_UP', time: bar.time, text: 'Phá biên SW hướng lên (Breakout Tăng)' });
        if (activeBoxObj) {
          activeBoxObj.active = false;
          activeBoxObj.endBarIdx = i;
          activeBoxObj.endTime = bar.time;
          swBoxes.push({ ...activeBoxObj });
          activeBoxObj = null;
        }
        marketState = 0;
        swCount = 0;
        activeSWTop = null;
        activeSWBottom = null;
      } else if (breakSWDown) {
        markers.push({ time: bar.time, position: 'aboveBar', color: '#f23645', shape: 'arrowDown', text: '▼ PHÁ SW SELL' });
        eventsLog.push({ type: 'BREAKOUT_DOWN', time: bar.time, text: 'Phá biên SW hướng xuống (Breakout Giảm)' });
        if (activeBoxObj) {
          activeBoxObj.active = false;
          activeBoxObj.endBarIdx = i;
          activeBoxObj.endTime = bar.time;
          swBoxes.push({ ...activeBoxObj });
          activeBoxObj = null;
        }
        marketState = 0;
        swCount = 0;
        activeSWTop = null;
        activeSWBottom = null;
      }

      const normalMarket = marketState === 0;

      // ==========================================
      // MODULE 5, 6, 7, 8: WAVE, PULLBACK, BREAK & CONTINUATION ENGINES
      // ==========================================
      const buyPullback = normalMarket && buyTrend && bar.low <= fastEMA && bar.close >= fastEMA * 0.998;
      const sellPullback = normalMarket && sellTrend && bar.high >= fastEMA && bar.close <= fastEMA * 1.002;

      const buyBreak = normalMarket && buyTrend && lastSwingHigh !== null && bar.close > lastSwingHigh;
      const sellBreak = normalMarket && sellTrend && lastSwingLow !== null && bar.close < lastSwingLow;

      const buyContinuation = normalMarket && buyTrend && bar.close > fastEMA && bar.close > bar.open && bar.close > prevBar.close;
      const sellContinuation = normalMarket && sellTrend && bar.close < fastEMA && bar.close < bar.open && bar.close < prevBar.close;

      const buySetup = (buyPullback || buyBreak || buyContinuation || breakSWUp) && slopeOK;
      const sellSetup = (sellPullback || sellBreak || sellContinuation || breakSWDown) && slopeOK;

      const buyConfirm = bar.close > bar.open && bar.close > fastEMA;
      const sellConfirm = bar.close < bar.open && bar.close < fastEMA;

      // Anti-Signal Spam & Cooldown (Cho phép nhịp tín hiệu liên tiếp khi bứt phá sóng như TradingView)
      const buyGapOK = (i - lastBuyEntryBar >= minGapBars);
      const sellGapOK = (i - lastSellEntryBar >= minGapBars);

      const buySignal = buySetup && buyConfirm && buyGapOK;
      const sellSignal = sellSetup && sellConfirm && sellGapOK;

      // Module 16 & 17: SIGNAL EVENT & REF +10/+20/+30
      if (buySignal) {
        if (activeTradeObj) {
          activeTradeObj.endBarIdx = i;
          activeTradeObj.endTime = bar.time;
          tradeLines.push({ ...activeTradeObj });
        }

        eventCounter++;
        activeEventId = `V8-${eventCounter.toString().padStart(5, '0')}`;
        activeDirection = 'BUY';
        eventState = 'WAVE_ACTIVE';

        entryPrice = bar.close;
        tp1Price = entryPrice + ref1Input;
        tp2Price = entryPrice + ref2Input;
        tp3Price = entryPrice + ref3Input;
        slPrice = null; // Tuyệt đối KHÔNG có SL
        tp1Done = false;
        tp2Done = false;
        tp3Done = false;
        lastBuyEntryBar = i;
        buyWeakDone = false;
        buyReversalWarnDone = false;

        activeTradeObj = {
          eventId: activeEventId,
          type: 'BUY',
          startBarIdx: i,
          startTime: bar.time,
          endBarIdx: i,
          endTime: bar.time,
          entryPrice,
          tp1Price,
          tp2Price,
          tp3Price,
          slPrice: null,
          tp1Done: false,
          tp2Done: false,
          tp3Done: false,
          active: true
        };

        const setupType = buyPullback ? 'Pullback' : buyBreak ? 'Break' : 'Continuation';
        markers.push({
          time: bar.time,
          position: 'belowBar',
          color: '#089981',
          shape: 'arrowUp',
          text: `BUY ENTRY ${entryPrice.toFixed(1)}`
        });
        eventsLog.push({ type: 'BUY_ENTRY', time: bar.time, text: `Event #${activeEventId}: Khởi tạo Wave Tăng tại $${entryPrice.toFixed(1)} [${setupType}]` });
      }

      if (sellSignal) {
        if (activeTradeObj) {
          activeTradeObj.endBarIdx = i;
          activeTradeObj.endTime = bar.time;
          tradeLines.push({ ...activeTradeObj });
        }

        eventCounter++;
        activeEventId = `V8-${eventCounter.toString().padStart(5, '0')}`;
        activeDirection = 'SELL';
        eventState = 'WAVE_ACTIVE';

        entryPrice = bar.close;
        tp1Price = entryPrice - ref1Input;
        tp2Price = entryPrice - ref2Input;
        tp3Price = entryPrice - ref3Input;
        slPrice = null; // Tuyệt đối KHÔNG có SL
        tp1Done = false;
        tp2Done = false;
        tp3Done = false;
        lastSellEntryBar = i;
        sellWeakDone = false;
        sellReversalWarnDone = false;

        activeTradeObj = {
          eventId: activeEventId,
          type: 'SELL',
          startBarIdx: i,
          startTime: bar.time,
          endBarIdx: i,
          endTime: bar.time,
          entryPrice,
          tp1Price,
          tp2Price,
          tp3Price,
          slPrice: null,
          tp1Done: false,
          tp2Done: false,
          tp3Done: false,
          active: true
        };

        const setupType = sellPullback ? 'Pullback' : sellBreak ? 'Break' : 'Continuation';
        markers.push({
          time: bar.time,
          position: 'aboveBar',
          color: '#f23645',
          shape: 'arrowDown',
          text: `SELL ENTRY ${entryPrice.toFixed(1)}`
        });
        eventsLog.push({ type: 'SELL_ENTRY', time: bar.time, text: `Event #${activeEventId}: Khởi tạo Wave Giảm tại $${entryPrice.toFixed(1)} [${setupType}]` });
      }

      if (activeTradeObj) {
        activeTradeObj.endBarIdx = i;
        activeTradeObj.endTime = bar.time;
      }

      // Theo dõi mốc tham chiếu REF +10 / +20 / +30
      if (activeDirection === 'BUY') {
        if (!tp1Done && bar.high >= tp1Price) {
          tp1Done = true;
          if (activeTradeObj) activeTradeObj.tp1Done = true;
          markers.push({ time: bar.time, position: 'aboveBar', color: '#089981', shape: 'square', text: 'TP1 -10 ✓' });
          eventsLog.push({ type: 'REF1', time: bar.time, text: 'Wave Tăng đạt mốc tham chiếu REF +10' });
        }
        if (!tp2Done && bar.high >= tp2Price) {
          tp2Done = true;
          if (activeTradeObj) activeTradeObj.tp2Done = true;
          markers.push({ time: bar.time, position: 'aboveBar', color: '#089981', shape: 'square', text: 'TP2 -20 ✓' });
          eventsLog.push({ type: 'REF2', time: bar.time, text: 'Wave Tăng đạt mốc tham chiếu REF +20' });
        }
        if (!tp3Done && bar.high >= tp3Price) {
          tp3Done = true;
          if (activeTradeObj) activeTradeObj.tp3Done = true;
          markers.push({ time: bar.time, position: 'aboveBar', color: '#089981', shape: 'square', text: 'TP3 -30 ✓' });
          eventsLog.push({ type: 'REF3', time: bar.time, text: 'Wave Tăng đạt mốc tham chiếu REF +30' });
        }
      } else if (activeDirection === 'SELL') {
        if (!tp1Done && bar.low <= tp1Price) {
          tp1Done = true;
          if (activeTradeObj) activeTradeObj.tp1Done = true;
          markers.push({ time: bar.time, position: 'belowBar', color: '#f23645', shape: 'square', text: 'TP1 -10 ✓' });
          eventsLog.push({ type: 'REF1', time: bar.time, text: 'Wave Giảm đạt mốc tham chiếu REF -10' });
        }
        if (!tp2Done && bar.low <= tp2Price) {
          tp2Done = true;
          if (activeTradeObj) activeTradeObj.tp2Done = true;
          markers.push({ time: bar.time, position: 'belowBar', color: '#f23645', shape: 'square', text: 'TP2 -20 ✓' });
          eventsLog.push({ type: 'REF2', time: bar.time, text: 'Wave Giảm đạt mốc tham chiếu REF -20' });
        }
        if (!tp3Done && bar.low <= tp3Price) {
          tp3Done = true;
          if (activeTradeObj) activeTradeObj.tp3Done = true;
          markers.push({ time: bar.time, position: 'belowBar', color: '#f23645', shape: 'square', text: 'TP3 -30 ✓' });
          eventsLog.push({ type: 'REF3', time: bar.time, text: 'Wave Giảm đạt mốc tham chiếu REF -30' });
        }
      }

      // ==========================================
      // MODULE 12 & 13: WEAKENING & REVERSAL SCORE ENGINE
      // ==========================================
      const buyWeak = activeDirection === 'BUY' && fastSlopeRaw < 0 && spreadState === 'THU HẸP';
      const sellWeak = activeDirection === 'SELL' && fastSlopeRaw > 0 && spreadState === 'THU HẸP';

      let isWeakening = false;
      if (buyWeak && !buyWeakDone) {
        buyWeakDone = true;
        isWeakening = true;
        eventState = 'WEAKENING';
        markers.push({ time: bar.time, position: 'aboveBar', color: '#eab308', shape: 'circle', text: '⚠️ BUY SUY YẾU / BUY END' });
        eventsLog.push({ type: 'WEAKENING', time: bar.time, text: 'Wave Tăng suy yếu: EMA phẳng, spread thu hẹp' });
      }
      if (sellWeak && !sellWeakDone) {
        sellWeakDone = true;
        isWeakening = true;
        eventState = 'WEAKENING';
        markers.push({ time: bar.time, position: 'belowBar', color: '#eab308', shape: 'circle', text: '⚠️ SELL SUY YẾU / SELL END' });
        eventsLog.push({ type: 'WEAKENING', time: bar.time, text: 'Wave Giảm suy yếu: EMA phẳng, spread thu hẹp' });
      }

      // Reversal Score Engine (Hệ thống điểm đảo chiều V8)
      let reversalScore = 0;
      if (activeDirection === 'BUY') {
        if (lastSwingLow && bar.close < lastSwingLow) reversalScore += 2; // Phá cấu trúc swing low (+2)
        if (fastSlopeRaw < 0) reversalScore += 1; // EMA slope chuyển âm (+1)
        if (spreadState === 'THU HẸP') reversalScore += 1; // Spread thu hẹp (+1)
        if (momentumState === 'YẾU') reversalScore += 1; // Momentum yếu (+1)
        if (bar.close < bar.open) reversalScore += 1; // Nến xác nhận giảm (+1)
      } else if (activeDirection === 'SELL') {
        if (lastSwingHigh && bar.close > lastSwingHigh) reversalScore += 2; // Phá cấu trúc swing high (+2)
        if (fastSlopeRaw > 0) reversalScore += 1; // EMA slope chuyển dương (+1)
        if (spreadState === 'THU HẸP') reversalScore += 1; // Spread thu hẹp (+1)
        if (momentumState === 'YẾU') reversalScore += 1; // Momentum yếu (+1)
        if (bar.close > bar.open) reversalScore += 1; // Nến xác nhận tăng (+1)
      }

      let reversalStatus = 'CHƯA XÁC NHẬN';
      if (reversalScore >= 4) {
        reversalStatus = 'ĐẢO CHIỀU XÁC NHẬN';
      } else if (reversalScore >= 2) {
        reversalStatus = 'CẢNH BÁO ĐẢO CHIỀU';
      }

      if (reversalStatus === 'CẢNH BÁO ĐẢO CHIỀU' && ((activeDirection === 'BUY' && !buyReversalWarnDone) || (activeDirection === 'SELL' && !sellReversalWarnDone))) {
        if (activeDirection === 'BUY') buyReversalWarnDone = true;
        if (activeDirection === 'SELL') sellReversalWarnDone = true;
        eventState = 'REVERSAL_CHECK';
        markers.push({ time: bar.time, position: activeDirection === 'BUY' ? 'aboveBar' : 'belowBar', color: '#f97316', shape: 'circle', text: '⚠️ CẢNH BÁO ĐẢO CHIỀU' });
        eventsLog.push({ type: 'REVERSAL_WARN', time: bar.time, text: `Cảnh báo đảo chiều (${activeDirection}): Momentum giảm, Reversal Score=${reversalScore}` });
      }

      // ==========================================
      // MODULE 14: END ENGINE (KẾT THÚC WAVE EVENT — KHÔNG PHẢI SL)
      // ==========================================
      const buyEnd = activeDirection === 'BUY' && (bar.close < fastEMA || reversalStatus === 'ĐẢO CHIỀU XÁC NHẬN');
      const sellEnd = activeDirection === 'SELL' && (bar.close > fastEMA || reversalStatus === 'ĐẢO CHIỀU XÁC NHẬN');

      if (buyEnd) {
        eventState = 'END';
        markers.push({ time: bar.time, position: 'aboveBar', color: '#f97316', shape: 'circle', text: '⏹ WAVE TĂNG END' });
        eventsLog.push({ type: 'WAVE_END', time: bar.time, text: `Event #${activeEventId}: Wave Tăng kết thúc (Giá đóng dưới EMA20)` });

        if (reversalStatus === 'ĐẢO CHIỀU XÁC NHẬN') {
          markers.push({ time: bar.time, position: 'aboveBar', color: '#f23645', shape: 'arrowDown', text: '🛑 ĐẢO CHIỀU GIẢM XÁC NHẬN' });
          eventsLog.push({ type: 'REVERSAL_CONFIRMED', time: bar.time, text: 'Đảo chiều Giảm xác nhận (Reversal Score >= 4)' });
        }

        if (activeTradeObj) {
          activeTradeObj.active = false;
          activeTradeObj.endBarIdx = i;
          activeTradeObj.endTime = bar.time;
          tradeLines.push({ ...activeTradeObj });
          activeTradeObj = null;
        }
        activeDirection = null;
        eventState = 'IDLE';
      }

      if (sellEnd) {
        eventState = 'END';
        markers.push({ time: bar.time, position: 'belowBar', color: '#f97316', shape: 'circle', text: '⏹ WAVE GIẢM END' });
        eventsLog.push({ type: 'WAVE_END', time: bar.time, text: `Event #${activeEventId}: Wave Giảm kết thúc (Giá đóng trên EMA20)` });

        if (reversalStatus === 'ĐẢO CHIỀU XÁC NHẬN') {
          markers.push({ time: bar.time, position: 'belowBar', color: '#089981', shape: 'arrowUp', text: '🛑 ĐẢO CHIỀU TĂNG XÁC NHẬN' });
          eventsLog.push({ type: 'REVERSAL_CONFIRMED', time: bar.time, text: 'Đảo chiều Tăng xác nhận (Reversal Score >= 4)' });
        }

        if (activeTradeObj) {
          activeTradeObj.active = false;
          activeTradeObj.endBarIdx = i;
          activeTradeObj.endTime = bar.time;
          tradeLines.push({ ...activeTradeObj });
          activeTradeObj = null;
        }
        activeDirection = null;
        eventState = 'IDLE';
      }

      // ==========================================
      // MODULE 24: V8_STATE OUTPUT CHO MỖI CANDLE
      // ==========================================
      const waveStatusText = activeDirection === 'BUY' ? 'WAVE TĂNG' : activeDirection === 'SELL' ? 'WAVE GIẢM' : 'CHỜ';

      const candleV8State = {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        fastEMA: +fastEMA.toFixed(2),
        slowEMA: +slowEMA.toFixed(2),
        atr: +atr.toFixed(2),
        fastSlope: +fastSlope.toFixed(3),
        slowSlope: +slowSlope.toFixed(3),
        spread: +spreadStrength.toFixed(2),
        spreadState,
        structure: currentStructure,
        trend: trendStateText,
        wave: waveStatusText,
        momentum: momentumState,
        swState: marketState === 1 ? 'ĐANG SW' : 'KHÔNG SW',
        weakeningState: (buyWeakDone || sellWeakDone) ? 'CÓ' : 'KHÔNG',
        reversalState: reversalStatus,
        eventState,
        eventId: activeEventId,
        signalPrice: entryPrice,
        ref1: tp1Price,
        ref2: tp2Price,
        ref3: tp3Price
      };
      v8CandleStates.push(candleV8State);

      // Snapshot cho nến cuối cùng
      if (i === bars.length - 1) {
        const finalTrendText = buyTrend ? 'TREND TĂNG' : sellTrend ? 'TREND GIẢM' : 'CHỜ';
        markers.push({
          time: bar.time,
          position: buyTrend ? 'belowBar' : 'aboveBar',
          color: buyTrend ? '#089981' : sellTrend ? '#f23645' : '#eab308',
          shape: buyTrend ? 'arrowUp' : 'arrowDown',
          text: finalTrendText
        });

        if (activeBoxObj) {
          activeBoxObj.endBarIdx = i;
          activeBoxObj.endTime = bar.time;
          swBoxes.push({ ...activeBoxObj });
        }
        if (activeTradeObj) {
          activeTradeObj.endBarIdx = i;
          activeTradeObj.endTime = bar.time;
          tradeLines.push({ ...activeTradeObj });
        }

        let waveStrength = 'CHỜ';
        if (activeDirection === 'BUY' || activeDirection === 'SELL') {
          waveStrength = isWeakening ? 'SUY YẾU' : momentumState === 'MẠNH' && spreadState === 'MỞ RỘNG' ? 'MẠNH' : 'BÌNH THƯỜNG';
        }

        latestV8Snapshot = {
          buySignal: !!buySignal,
          sellSignal: !!sellSignal,
          barTime: bar.time,
          // 8 Thông số cốt lõi Dashboard V8 PRO (Module 20)
          trend: trendStateText,
          wave: waveStrength,
          spread: spreadState,
          spreadValue: +spreadStrength.toFixed(2),
          structure: currentStructure,
          momentum: momentumState,
          sw: marketState === 1 ? 'ĐANG SW' : 'KHÔNG SW',
          swRange: swRange.toFixed(1),
          weakening: (buyWeakDone || sellWeakDone) ? 'CÓ' : 'KHÔNG',
          reversal: reversalStatus,
          endState: activeDirection === null ? 'KẾT THÚC' : 'CHƯA',

          // Chi tiết kỹ thuật
          fastEMA: +fastEMA.toFixed(2),
          slowEMA: +slowEMA.toFixed(2),
          fastSlope: +fastSlope.toFixed(3),
          entryPrice,
          tp1Price,
          tp2Price,
          tp3Price,
          slPrice: null, // Tuyệt đối KHÔNG có SL
          tp1Done,
          tp2Done,
          tp3Done,
          currentPrice: bar.close,
          tradeState: marketState === 1 ? 'SW' : activeDirection === 'BUY' ? 'BUY' : activeDirection === 'SELL' ? 'SELL' : 'WAIT'
        };
      }
    }

    return {
      snapshot: latestV8Snapshot,
      markers,
      fastEMAList,
      slowEMAList,
      swBoxes,
      tradeLines,
      eventsLog,
      v8CandleStates
    };
  }
};

window.Indicators = Indicators;

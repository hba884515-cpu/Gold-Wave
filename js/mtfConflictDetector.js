/**
 * ============================================================================
 * MODULE 05: MULTI-TIMEFRAME (MTF) CONFLICT DETECTOR CHO MA WAVE V8 PRO WEB
 * ============================================================================
 * 
 * Mục tiêu:
 * - Module độc lập phân tích sự đồng thuận và xung đột giữa các khung thời gian (MTF).
 * - Phát hiện tín hiệu ngắn hạn đi ngược xu hướng trung hạn hoặc dài hạn.
 * - Cung cấp bức tranh toàn cảnh đa khung thời gian minh bạch, khách quan.
 * 
 * Nguyên tắc an toàn & Kiến trúc:
 * 1. 100% READ-ONLY OBSERVER (Mặc định OBSERVE_ONLY).
 * 2. Tuyệt đối KHÔNG can thiệp, trì hoãn hoặc sửa đổi tín hiệu BUY/SELL của Legacy Core V8.
 * 3. Không tạo dữ liệu giả hoặc suy đoán dữ liệu timeframe bị thiếu.
 * 4. Không dùng dữ liệu tương lai (No Lookahead Bias).
 * 5. Phân định rõ ràng giữa nến Đã Đóng (CONFIRMED) và nến Realtime (LIVE / PROVISIONAL).
 * 6. Không đồng nhất MTF Alignment Score với xác suất thắng hay đảm bảo giá tiếp tục chạy.
 */

class MTFConflictDetector {
  constructor(config = {}) {
    this.config = {
      mode: 'OBSERVE_ONLY',
      enabled: true,

      // Danh sách timeframe được phân tích mặc định (theo thứ tự từ ngắn hạn đến dài hạn)
      activeTimeframes: ['5m', '15m', '30m', '1h'],

      // Phân bổ vai trò của từng timeframe
      roleMap: {
        '5m': 'SHORT_TERM',
        '15m': 'MID_TERM',
        '30m': 'MID_TERM',
        '1h': 'HIGHER_TF',
        '4h': 'HIGHER_TF',
        '1d': 'HIGHER_TF'
      },

      // Trọng số tính MTF Alignment Score (tổng chuẩn hóa = 1.0)
      weights: {
        '5m': 0.15,
        '15m': 0.30,
        '30m': 0.25,
        '1h': 0.30,
        '4h': 0.30,
        '1d': 0.30
      },

      // Số nến tối thiểu cần thiết để phân tích một timeframe
      minCandleCount: 50,

      // Ngưỡng thời gian (giây) để xác định dữ liệu bị cũ (STALE)
      staleThresholdSec: {
        '5m': 900,        // > 15 phút không có nến mới
        '15m': 2700,      // > 45 phút
        '30m': 5400,      // > 90 phút
        '1h': 10800,      // > 3 giờ
        '4h': 43200,      // > 12 giờ
        '1d': 172800      // > 48 giờ
      },

      ...config
    };

    // Chu kỳ giây tương ứng của từng timeframe
    this.tfSeconds = {
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '35m': 2100,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    };
  }

  /**
   * Bật / Tắt module (Chế độ Observe)
   */
  setEnabled(enabled) {
    this.config.enabled = !!enabled;
    return this.config.enabled;
  }

  toggle() {
    this.config.enabled = !this.config.enabled;
    return this.config.enabled;
  }

  /**
   * Cho phép cấu hình vai trò và trọng số timeframe
   */
  setConfig(newConfig) {
    if (newConfig && typeof newConfig === 'object') {
      this.config = {
        ...this.config,
        ...newConfig,
        roleMap: { ...this.config.roleMap, ...(newConfig.roleMap || {}) },
        weights: { ...this.config.weights, ...(newConfig.weights || {}) }
      };
    }
    return this.config;
  }

  /**
   * Phương thức tính toán EMA nội bộ (nếu Indicators chưa nạp)
   */
  _calcEMA(data, period) {
    if (typeof window !== 'undefined' && window.Indicators && typeof window.Indicators.calculateEMA === 'function') {
      return window.Indicators.calculateEMA(data, period);
    }
    const results = [];
    if (!data || data.length < period) return results;
    const multiplier = 2 / (period + 1);
    let initialSum = 0;
    for (let i = 0; i < period; i++) initialSum += data[i].close;
    let prevEMA = initialSum / period;
    results.push({ time: data[period - 1].time, value: +prevEMA.toFixed(3) });
    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
      results.push({ time: data[i].time, value: +currentEMA.toFixed(3) });
      prevEMA = currentEMA;
    }
    return results;
  }

  /**
   * Phương thức tính toán ATR nội bộ (nếu Indicators chưa nạp)
   */
  _calcATR(data, period = 14) {
    if (typeof window !== 'undefined' && window.Indicators && typeof window.Indicators.calculateATR === 'function') {
      return window.Indicators.calculateATR(data, period);
    }
    if (!data || data.length < 2) return [];
    const tr = [data[0].high - data[0].low];
    for (let i = 1; i < data.length; i++) {
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
    if (tr.length < period) return [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += tr[i];
    let prevATR = sum / period;
    const atr = [{ time: data[period - 1].time, value: +prevATR.toFixed(3) }];
    for (let i = period; i < data.length; i++) {
      prevATR = (prevATR * (period - 1) + tr[i]) / period;
      atr.push({ time: data[i].time, value: +prevATR.toFixed(3) });
    }
    return atr;
  }

  /**
   * Phân tích độc lập 1 Timeframe cụ thể
   */
  analyzeTimeframe(bars, tf, options = {}) {
    const role = this.config.roleMap[tf] || 'MID_TERM';
    const nowSec = Math.floor(Date.now() / 1000);
    const tfSec = this.tfSeconds[tf] || 900;
    const staleLimit = this.config.staleThresholdSec[tf] || (tfSec * 3);

    // 1. Kiểm tra tính hợp lệ của dữ liệu
    if (!bars || !Array.isArray(bars) || bars.length < this.config.minCandleCount) {
      return {
        tf,
        role,
        trendState: 'UNKNOWN',
        ema20Direction: 'FLAT',
        ema50Direction: 'FLAT',
        pricePosition: 'UNKNOWN',
        spread: 0,
        spread_ATR: 0,
        spreadStatus: 'STABLE',
        momentum: 'NEUTRAL',
        structure: 'UNKNOWN',
        dataStatus: 'INCOMPLETE',
        lastBarTime: null,
        close: 0,
        ema20: 0,
        ema50: 0,
        atr: 0,
        isBarClosed: false,
        valid: false
      };
    }

    const lastIdx = bars.length - 1;
    const lastBar = bars[lastIdx];
    const prevBar = bars[lastIdx - 1];

    // Kiểm tra tính mới của dữ liệu (Stale Check)
    let isStale = false;
    if (options.checkStale !== false && lastBar.time && (nowSec - lastBar.time > staleLimit)) {
      isStale = true;
    }

    // Xác định nến đã đóng hay đang chạy
    let isBarClosed = false;
    if (options.isBarClosed !== undefined) {
      isBarClosed = !!options.isBarClosed;
    } else {
      isBarClosed = (nowSec - lastBar.time) >= tfSec;
    }

    const dataStatus = isStale ? 'STALE' : (isBarClosed ? 'CLOSED' : 'LIVE');

    // 2. Tính toán EMA20, EMA50 và ATR
    const ema20Arr = this._calcEMA(bars, 20);
    const ema50Arr = this._calcEMA(bars, 50);
    const atrArr = this._calcATR(bars, 14);

    if (!ema20Arr.length || !ema50Arr.length || !atrArr.length) {
      return {
        tf,
        role,
        trendState: 'UNKNOWN',
        ema20Direction: 'FLAT',
        ema50Direction: 'FLAT',
        pricePosition: 'UNKNOWN',
        spread: 0,
        spread_ATR: 0,
        spreadStatus: 'STABLE',
        momentum: 'NEUTRAL',
        structure: 'UNKNOWN',
        dataStatus: 'INCOMPLETE',
        lastBarTime: lastBar.time,
        close: lastBar.close,
        ema20: 0,
        ema50: 0,
        atr: 0,
        isBarClosed,
        valid: false
      };
    }

    const currentPrice = options.livePrice && !isNaN(options.livePrice) ? options.livePrice : lastBar.close;
    const ema20 = ema20Arr[ema20Arr.length - 1].value;
    const ema50 = ema50Arr[ema50Arr.length - 1].value;
    const atr = Math.max(0.01, atrArr[atrArr.length - 1].value);

    // 3. Phân tích Độ dốc (Slope) & Hướng của EMA
    const lookback = Math.min(3, ema20Arr.length - 1);
    const prevEMA20 = ema20Arr[ema20Arr.length - 1 - lookback].value;
    const prevEMA50 = ema50Arr[ema50Arr.length - 1 - lookback].value;

    const slopeEMA20 = (ema20 - prevEMA20) / lookback;
    const slopeEMA50 = (ema50 - prevEMA50) / lookback;
    const slopeThreshold = +(atr * 0.04).toFixed(3);

    const ema20Direction = slopeEMA20 > slopeThreshold ? 'RISING' : (slopeEMA20 < -slopeThreshold ? 'FALLING' : 'FLAT');
    const ema50Direction = slopeEMA50 > slopeThreshold ? 'RISING' : (slopeEMA50 < -slopeThreshold ? 'FALLING' : 'FLAT');

    // 4. Vị trí giá tương quan với EMA
    let pricePosition = 'BETWEEN_EMA';
    if (currentPrice > ema20 && currentPrice > ema50) {
      pricePosition = 'ABOVE_BOTH';
    } else if (currentPrice < ema20 && currentPrice < ema50) {
      pricePosition = 'BELOW_BOTH';
    }

    // 5. Khoảng cách EMA Spread (EMA20 - EMA50)
    const spread = +(ema20 - ema50).toFixed(3);
    const spread_ATR = +(Math.abs(spread) / atr).toFixed(2);
    const prevSpread = +(prevEMA20 - prevEMA50).toFixed(3);
    let spreadStatus = 'STABLE';
    if (Math.abs(spread) > Math.abs(prevSpread) + (atr * 0.05)) {
      spreadStatus = 'EXPANDING';
    } else if (Math.abs(spread) < Math.abs(prevSpread) - (atr * 0.05)) {
      spreadStatus = 'CONTRACTING';
    }

    // 6. Phân tích Động lượng (Momentum) gần nhất
    let momentum = 'NEUTRAL';
    const recentBars = bars.slice(-3);
    let greenCount = 0;
    let redCount = 0;
    recentBars.forEach(b => {
      if (b.close > b.open) greenCount++;
      else if (b.close < b.open) redCount++;
    });
    if (greenCount >= 2 && currentPrice > ema20) {
      momentum = 'BULLISH';
    } else if (redCount >= 2 && currentPrice < ema20) {
      momentum = 'BEARISH';
    }

    // 7. Cấu trúc thị trường (Market Structure Swing High / Low)
    let structure = 'NEUTRAL';
    const checkBars = bars.slice(-20);
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    checkBars.forEach(b => {
      if (b.high > highestHigh) highestHigh = b.high;
      if (b.low < lowestLow) lowestLow = b.low;
    });

    const halfWindow = Math.floor(checkBars.length / 2);
    const firstHalf = checkBars.slice(0, halfWindow);
    const secondHalf = checkBars.slice(halfWindow);

    let high1 = Math.max(...firstHalf.map(b => b.high));
    let low1 = Math.min(...firstHalf.map(b => b.low));
    let high2 = Math.max(...secondHalf.map(b => b.high));
    let low2 = Math.min(...secondHalf.map(b => b.low));

    if (high2 > high1 && low2 > low1) {
      structure = 'HH_HL'; // Higher High / Higher Low
    } else if (high2 < high1 && low2 < low1) {
      structure = 'LH_LL'; // Lower High / Lower Low
    } else {
      structure = 'MIXED';
    }

    // 8. Xác định Trạng thái Xu hướng (Trend State: UP, DOWN, SIDEWAY, TRANSITION)
    let trendState = 'SIDEWAY';

    // Điều kiện cần cho xu hướng rõ ràng: MA Spread tối thiểu 0.20x ATR hoặc độ dốc rõ rệt
    const hasClearSpread = spread_ATR >= 0.20;

    if (hasClearSpread && pricePosition === 'ABOVE_BOTH' && ema20 >= ema50 && (ema20Direction === 'RISING' || structure === 'HH_HL')) {
      trendState = 'UP';
    } else if (hasClearSpread && pricePosition === 'BELOW_BOTH' && ema20 <= ema50 && (ema20Direction === 'FALLING' || structure === 'LH_LL')) {
      trendState = 'DOWN';
    } else if (pricePosition === 'BETWEEN_EMA' || spreadStatus === 'CONTRACTING') {
      // Đang cắt lộn xộn hoặc đổi pha
      if ((ema20 > ema50 && currentPrice < ema20) || (ema20 < ema50 && currentPrice > ema20)) {
        trendState = 'TRANSITION';
      } else {
        trendState = 'SIDEWAY';
      }
    } else if (ema20Direction === 'FLAT' && ema50Direction === 'FLAT') {
      trendState = 'SIDEWAY';
    } else if (hasClearSpread && currentPrice > ema20 && ema20Direction === 'RISING') {
      trendState = 'UP';
    } else if (hasClearSpread && currentPrice < ema20 && ema20Direction === 'FALLING') {
      trendState = 'DOWN';
    } else {
      trendState = 'SIDEWAY';
    }

    return {
      tf,
      role,
      trendState,
      ema20Direction,
      ema50Direction,
      pricePosition,
      spread,
      spread_ATR,
      spreadStatus,
      momentum,
      structure,
      dataStatus,
      lastBarTime: lastBar.time,
      close: currentPrice,
      ema20,
      ema50,
      atr,
      isBarClosed,
      valid: true
    };
  }

  /**
   * Phân tích tổng thể Đa Khung Thời Gian (Multi-Timeframe Conflict & Alignment)
   * 
   * @param {Object} timeframeDataMap - Map chứa chuỗi nến của các timeframe: { '5m': [...], '15m': [...], '30m': [...], '1h': [...] }
   * @param {Object} options - Tùy chọn cấu hình, livePrice, asset, isBarClosedMap
   */
  analyze(timeframeDataMap, options = {}) {
    if (!this.config.enabled) {
      return {
        status: 'DISABLED',
        alignmentStatus: 'DISABLED',
        alignmentScore: 0,
        warning: 'NONE',
        conflicts: [],
        tfResults: {},
        shortTermTrend: 'UNKNOWN',
        midTermTrend: 'UNKNOWN',
        higherTFTrend: 'UNKNOWN',
        reason: 'Module MTF Conflict Detector đang tạm tắt.',
        objectiveAdvice: 'Bật module để theo dõi sự đồng thuận và cảnh báo xung đột đa khung thời gian.',
        mode: this.config.mode
      };
    }

    const tfList = options.activeTimeframes || this.config.activeTimeframes;
    const tfResults = {};
    const conflicts = [];
    let hasIncompleteData = false;
    let hasStaleData = false;

    // 1. Phân tích từng timeframe riêng biệt
    tfList.forEach(tf => {
      let bars = null;
      if (timeframeDataMap && timeframeDataMap[tf]) {
        bars = timeframeDataMap[tf];
      } else if (typeof window !== 'undefined' && window.marketDataStore && typeof window.marketDataStore.getBars === 'function') {
        bars = window.marketDataStore.getBars(tf);
      }

      const tfOpts = {
        livePrice: options.livePrice,
        checkStale: options.checkStale,
        isBarClosed: options.isBarClosedMap ? options.isBarClosedMap[tf] : undefined
      };

      const res = this.analyzeTimeframe(bars, tf, tfOpts);
      tfResults[tf] = res;

      if (!res.valid || res.trendState === 'UNKNOWN') {
        hasIncompleteData = true;
      }
      if (res.dataStatus === 'STALE') {
        hasStaleData = true;
      }
    });

    // 2. Trích xuất xu hướng theo nhóm vai trò
    const shortTfs = tfList.filter(t => this.config.roleMap[t] === 'SHORT_TERM');
    const midTfs = tfList.filter(t => this.config.roleMap[t] === 'MID_TERM');
    const htfTfs = tfList.filter(t => this.config.roleMap[t] === 'HIGHER_TF');

    const getGroupTrend = (tfs) => {
      if (!tfs.length) return 'UNKNOWN';
      const validResults = tfs.map(t => tfResults[t]).filter(r => r && r.valid);
      if (!validResults.length) return 'UNKNOWN';
      
      const upCount = validResults.filter(r => r.trendState === 'UP').length;
      const downCount = validResults.filter(r => r.trendState === 'DOWN').length;
      const transCount = validResults.filter(r => r.trendState === 'TRANSITION').length;

      if (upCount === validResults.length) return 'UP';
      if (downCount === validResults.length) return 'DOWN';
      if (upCount > downCount && upCount >= Math.ceil(validResults.length / 2)) return 'UP';
      if (downCount > upCount && downCount >= Math.ceil(validResults.length / 2)) return 'DOWN';
      if (transCount > 0) return 'TRANSITION';
      return 'SIDEWAY';
    };

    const shortTermTrend = getGroupTrend(shortTfs);
    const midTermTrend = getGroupTrend(midTfs);
    const higherTFTrend = getGroupTrend(htfTfs);

    // 3. PHÁT HIỆN 5 LOẠI XUNG ĐỘT (CONFLICTS)
    const validResults = Object.values(tfResults).filter(r => r && r.valid);
    
    // a. Direction Conflict (Xung đột hướng)
    // Xung đột trực tiếp M5 vs M15
    if (tfResults['5m'] && tfResults['15m'] && tfResults['5m'].valid && tfResults['15m'].valid) {
      if ((tfResults['5m'].trendState === 'UP' && tfResults['15m'].trendState === 'DOWN') ||
          (tfResults['5m'].trendState === 'DOWN' && tfResults['15m'].trendState === 'UP')) {
        conflicts.push({
          type: 'DIRECTION_CONFLICT',
          code: 'M5_VS_M15_CONFLICT',
          tf1: '5m',
          tf2: '15m',
          desc: `M5 (${tfResults['5m'].trendState}) đang đi ngược hướng trực tiếp với M15 (${tfResults['15m'].trendState}).`
        });
      }
    }

    // Xung đột Ngắn hạn vs Khung lớn (Short-Term vs Higher-TF)
    if (shortTermTrend !== 'UNKNOWN' && higherTFTrend !== 'UNKNOWN') {
      if ((shortTermTrend === 'UP' && higherTFTrend === 'DOWN') ||
          (shortTermTrend === 'DOWN' && higherTFTrend === 'UP')) {
        conflicts.push({
          type: 'DIRECTION_CONFLICT',
          code: 'SHORT_VS_HIGHER_TF_CONFLICT',
          tf1: shortTfs.join(','),
          tf2: htfTfs.join(','),
          desc: `Khung ngắn hạn (${shortTermTrend}) đang đối đầu trực tiếp xu hướng khung lớn (${higherTFTrend}). Nguy cơ là nhịp hồi ngắn hoặc sóng bẫy.`
        });
      }
    }

    // b. Trend Strength Conflict (Xung đột sức mạnh/động lượng)
    tfList.forEach(t1 => {
      const r1 = tfResults[t1];
      if (!r1 || !r1.valid) return;
      tfList.forEach(t2 => {
        if (t1 >= t2) return;
        const r2 = tfResults[t2];
        if (!r2 || !r2.valid) return;

        if (r1.trendState === r2.trendState && r1.trendState !== 'SIDEWAY') {
          if (r1.spreadStatus === 'EXPANDING' && r2.spreadStatus === 'CONTRACTING') {
            conflicts.push({
              type: 'STRENGTH_CONFLICT',
              code: 'SPREAD_DIVERGENCE',
              tf1: t1,
              tf2: t2,
              desc: `${t1} đang mở rộng đà (Expanding) nhưng ${t2} đang co hẹp khoảng cách MA (Contracting).`
            });
          }
        }
      });
    });

    // c. Structure Conflict (Xung đột cấu trúc đỉnh đáy)
    if (tfResults['5m'] && tfResults['1h'] && tfResults['5m'].valid && tfResults['1h'].valid) {
      if (tfResults['5m'].structure === 'HH_HL' && tfResults['1h'].structure === 'LH_LL') {
        conflicts.push({
          type: 'STRUCTURE_CONFLICT',
          code: 'M5_HHHL_VS_H1_LHLL',
          tf1: '5m',
          tf2: '1h',
          desc: 'M5 duy trì đỉnh đáy tăng (HH/HL) trong khi H1 vẫn nằm trong cấu trúc giảm dài hạn (LH/LL).'
        });
      } else if (tfResults['5m'].structure === 'LH_LL' && tfResults['1h'].structure === 'HH_HL') {
        conflicts.push({
          type: 'STRUCTURE_CONFLICT',
          code: 'M5_LHLL_VS_H1_HHHL',
          tf1: '5m',
          tf2: '1h',
          desc: 'M5 phá vỡ đỉnh đáy giảm (LH/LL) trong khi H1 vẫn bảo toàn cấu trúc tăng lớn (HH/HL).'
        });
      }
    }

    // d. Transition Conflict (Xung đột đổi pha hoặc 1 khung chuyển hướng trước)
    const transitionTfs = tfList.filter(t => tfResults[t] && tfResults[t].valid && tfResults[t].trendState === 'TRANSITION');
    const hasSingleLead = (validResults.filter(r => r.trendState === 'UP').length === 1 && validResults.filter(r => r.trendState === 'SIDEWAY').length === validResults.length - 1) ||
                          (validResults.filter(r => r.trendState === 'DOWN').length === 1 && validResults.filter(r => r.trendState === 'SIDEWAY').length === validResults.length - 1);

    if (transitionTfs.length > 0 || hasSingleLead) {
      const leadingTf = transitionTfs.length > 0 ? transitionTfs.join(',') : (validResults.find(r => r.trendState === 'UP' || r.trendState === 'DOWN')?.tf || 'LEAD');
      conflicts.push({
        type: 'TRANSITION_CONFLICT',
        code: 'MTF_TRANSITION_WARNING',
        tf1: leadingTf,
        tf2: 'OTHERS',
        desc: `Khung ${leadingTf} đã bắt đầu chuyển hướng trước trong khi các khung thời gian khác vẫn đang đi ngang hoặc chưa xác nhận.`
      });
    }

    // e. Data Conflict (Xung đột tính đồng bộ dữ liệu)
    if (hasStaleData) {
      conflicts.push({
        type: 'DATA_CONFLICT',
        code: 'MTF_DATA_STALE',
        tf1: 'STALE_DATA',
        tf2: 'ALL',
        desc: 'Một hoặc nhiều timeframe có dữ liệu cũ chưa đồng bộ nến mới nhất.'
      });
    }
    if (hasIncompleteData) {
      conflicts.push({
        type: 'DATA_CONFLICT',
        code: 'MTF_INCOMPLETE_DATA',
        tf1: 'MISSING_DATA',
        tf2: 'ALL',
        desc: 'Thiếu dữ liệu nến cần thiết ở một số khung thời gian.'
      });
    }

    // 4. PHÂN LOẠI TRẠNG THÁI MTF TỔNG HỢP (ALIGNMENT STATUS)
    let alignmentStatus = 'MTF_NEUTRAL';

    if (hasIncompleteData && validResults.length < 2) {
      alignmentStatus = 'MTF_UNKNOWN';
    } else {
      const upCount = validResults.filter(r => r.trendState === 'UP').length;
      const downCount = validResults.filter(r => r.trendState === 'DOWN').length;
      const sidewayCount = validResults.filter(r => r.trendState === 'SIDEWAY').length;
      const transCount = validResults.filter(r => r.trendState === 'TRANSITION').length;
      const totalValid = validResults.length;

      const hasDirectionConflict = conflicts.some(c => c.code === 'SHORT_VS_HIGHER_TF_CONFLICT' || c.code === 'M5_VS_M15_CONFLICT');

      if (upCount === totalValid) {
        alignmentStatus = 'FULL_BULLISH_ALIGNMENT';
      } else if (downCount === totalValid) {
        alignmentStatus = 'FULL_BEARISH_ALIGNMENT';
      } else if (hasDirectionConflict) {
        alignmentStatus = 'MTF_CONFLICT';
      } else if (transCount > 0 || hasSingleLead) {
        alignmentStatus = 'MTF_TRANSITION';
      } else if (upCount >= Math.ceil(totalValid * 0.6) && downCount === 0) {
        alignmentStatus = 'PARTIAL_BULLISH_ALIGNMENT';
      } else if (downCount >= Math.ceil(totalValid * 0.6) && upCount === 0) {
        alignmentStatus = 'PARTIAL_BEARISH_ALIGNMENT';
      } else if (sidewayCount >= Math.ceil(totalValid * 0.5)) {
        alignmentStatus = 'MTF_NEUTRAL';
      } else {
        alignmentStatus = 'MTF_CONFLICT';
      }
    }

    // 5. TÍNH ĐIỂM ĐỒNG THUẬN MTF ALIGNMENT SCORE (0 - 100)
    // Cách tính minh bạch:
    // Tổng điểm đồng thuận dựa trên trọng số của từng khung cùng hướng với xu hướng áp đảo.
    let alignmentScore = 50;
    let dominantTrend = 'NEUTRAL';

    if (alignmentStatus !== 'MTF_UNKNOWN' && validResults.length > 0) {
      let upScore = 0;
      let downScore = 0;
      let totalWeight = 0;

      validResults.forEach(r => {
        const w = this.config.weights[r.tf] || 0.25;
        totalWeight += w;
        if (r.trendState === 'UP') upScore += w;
        else if (r.trendState === 'DOWN') downScore += w;
        else if (r.trendState === 'SIDEWAY') {
          upScore += w * 0.4;
          downScore += w * 0.4;
        } else if (r.trendState === 'TRANSITION') {
          upScore += w * 0.3;
          downScore += w * 0.3;
        }
      });

      if (totalWeight > 0) {
        const upRatio = upScore / totalWeight;
        const downRatio = downScore / totalWeight;

        if (upRatio >= downRatio) {
          dominantTrend = 'UP';
          alignmentScore = Math.round(upRatio * 100);
        } else {
          dominantTrend = 'DOWN';
          alignmentScore = Math.round(downRatio * 100);
        }
      }

      // Trừ điểm phạt nếu có xung đột đối đầu trực tiếp Ngắn hạn vs Khung lớn
      if (conflicts.some(c => c.code === 'SHORT_VS_HIGHER_TF_CONFLICT')) {
        alignmentScore = Math.max(15, alignmentScore - 40);
      } else if (conflicts.some(c => c.code === 'M5_VS_M15_CONFLICT')) {
        alignmentScore = Math.max(25, alignmentScore - 25);
      }
    } else {
      alignmentScore = 0;
    }

    // 6. XÁC ĐỊNH CẢNH BÁO CHỦ ĐẠO (PRIMARY WARNING)
    let warning = 'NONE';
    if (hasIncompleteData) {
      warning = 'MTF_INCOMPLETE_DATA';
    } else if (hasStaleData) {
      warning = 'MTF_DATA_STALE';
    } else if (conflicts.some(c => c.code === 'SHORT_VS_HIGHER_TF_CONFLICT')) {
      warning = 'SHORT_VS_HIGHER_TF_CONFLICT';
    } else if (conflicts.some(c => c.code === 'M5_VS_M15_CONFLICT')) {
      warning = 'M5_VS_M15_CONFLICT';
    } else if (alignmentStatus === 'FULL_BULLISH_ALIGNMENT') {
      warning = 'BULLISH_MTF_ALIGNMENT';
    } else if (alignmentStatus === 'FULL_BEARISH_ALIGNMENT') {
      warning = 'BEARISH_MTF_ALIGNMENT';
    } else if (alignmentStatus === 'MTF_TRANSITION') {
      warning = 'MTF_TRANSITION_WARNING';
    }

    // 7. DIỄN GIẢI NGUYÊN NHÂN (REASON)
    let reason = '';
    if (alignmentStatus === 'FULL_BULLISH_ALIGNMENT') {
      reason = 'Tất cả các khung thời gian (5M, 15M, 30M, 1H) đều đồng thuận xu hướng TĂNG mạnh. Giá nằm trên EMA20/EMA50 và các đường MA đều dốc lên.';
    } else if (alignmentStatus === 'FULL_BEARISH_ALIGNMENT') {
      reason = 'Tất cả các khung thời gian (5M, 15M, 30M, 1H) đều đồng thuận xu hướng GIẢM dứt khoát. Giá nằm dưới EMA20/EMA50 và các đường MA dốc xuống.';
    } else if (alignmentStatus === 'MTF_CONFLICT') {
      const conflictList = conflicts.map(c => c.desc).join(' ');
      reason = `Xung đột đa khung thời gian xuất hiện. ${conflictList}`;
    } else if (alignmentStatus === 'PARTIAL_BULLISH_ALIGNMENT') {
      reason = 'Phần lớn các khung thời gian nghiêng về xu hướng TĂNG, tuy nhiên vẫn còn khung đang đi ngang hoặc điều chỉnh nhẹ.';
    } else if (alignmentStatus === 'PARTIAL_BEARISH_ALIGNMENT') {
      reason = 'Phần lớn các khung thời gian nghiêng về xu hướng GIẢM, tuy nhiên vẫn còn khung đang đi ngang hoặc hồi phục kỹ thuật.';
    } else if (alignmentStatus === 'MTF_TRANSITION') {
      reason = 'Thị trường đang trong pha chuyển giao xu hướng (Transition). Một số khung thời gian đã bẻ gãy EMA nhưng khung lớn chưa xác nhận.';
    } else if (alignmentStatus === 'MTF_NEUTRAL') {
      reason = 'Các khung thời gian chủ yếu dao động đi ngang quanh các đường MA Wave, không có sự bứt phá xu hướng rõ ràng.';
    } else {
      reason = 'Dữ liệu đa khung thời gian chưa đầy đủ hoặc không đồng bộ để xác định trạng thái MTF.';
    }

    // 8. KHUYẾN NGHỊ KHÁCH QUAN (OBJECTIVE ADVICE)
    let objectiveAdvice = '';
    if (alignmentStatus === 'FULL_BULLISH_ALIGNMENT') {
      objectiveAdvice = 'Bối cảnh đa khung đồng thuận TĂNG là môi trường thuận lợi nhất cho các lệnh BUY thuận sóng. Tuy nhiên, MTF Alignment không phải lời hứa giá tiếp tục tăng, cần chú ý kiểm tra Overextended trước khi vào lệnh.';
    } else if (alignmentStatus === 'FULL_BEARISH_ALIGNMENT') {
      objectiveAdvice = 'Bối cảnh đa khung đồng thuận GIẢM hỗ trợ mạnh cho các vị thế SELL thuận sóng. Cần kiên nhẫn chờ hồi về MA để có vị thế đẹp, tránh bán đuổi ở vùng quá bán.';
    } else if (alignmentStatus === 'MTF_CONFLICT') {
      objectiveAdvice = 'Khi có xung đột MTF (khung nhỏ ngược khung lớn), rủi ro dính bẫy giá hoặc sóng hồi ngắn là rất cao. Khuyến nghị ưu tiên tuân theo cấu trúc khung lớn (HTF) hoặc đứng ngoài quan sát.';
    } else if (alignmentStatus === 'MTF_TRANSITION') {
      objectiveAdvice = 'Thị trường đang đổi pha, động lượng chưa rõ ràng. Nên kiên nhẫn đợi các nến đóng của khung trung hạn (M15, M30) xác nhận trước khi hành động.';
    } else {
      objectiveAdvice = 'Luôn quản trị rủi ro nghiêm ngặt, tuân thủ SL/TP cố định và không bao giờ giao dịch tất tay dựa trên sự đồng thuận đơn lẻ.';
    }

    // 9. Nến HTF Đang Chạy vs Nến Đã Đóng (Confirmed vs Provisional)
    const htfResult = tfResults['1h'] || tfResults['4h'];
    const isHTFClosed = htfResult ? htfResult.isBarClosed : true;
    const confirmationLevel = isHTFClosed ? 'CONFIRMED' : 'PROVISIONAL_LIVE';

    return {
      status: this.config.enabled ? alignmentStatus : 'DISABLED',
      alignmentStatus,
      alignmentScore,
      dominantTrend,
      warning,
      confirmationLevel,
      isHTFClosed,
      conflicts,
      tfResults,
      shortTermTrend,
      midTermTrend,
      higherTFTrend,
      hasIncompleteData,
      hasStaleData,
      reason,
      objectiveAdvice,
      mode: this.config.mode,
      timestamp: Date.now()
    };
  }
}

// Khởi tạo Singleton toàn cục trên window
if (typeof window !== 'undefined') {
  window.mtfConflictDetector = new MTFConflictDetector();
}

// Hỗ trợ xuất CommonJS cho môi trường Node.js kiểm thử tự động
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MTFConflictDetector;
}

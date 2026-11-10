/**
 * MA WAVE V8 PRO — MODULE 02: TREND EXHAUSTION DETECTOR
 * ========================================================
 * Module độc lập phát hiện xu hướng BUY hoặc SELL đang suy yếu,
 * nhằm cảnh báo sớm khả năng sóng mất động lượng (Momentum Loss,
 * Structure Weakening, EMA Slope/Spread Contraction).
 *
 * NGUYÊN TẮC BẮT BUỘC:
 * 1. Độc lập 100%, chỉ đọc dữ liệu (Read-Only Observer).
 * 2. Mặc định chế độ OBSERVE_ONLY.
 * 3. Tuyệt đối KHÔNG can thiệp, trì hoãn hoặc sửa đổi tín hiệu Legacy Core V8.
 * 4. WEAKENING KHÔNG ĐỒNG NGHĨA REVERSAL (Không phán đoán chắc chắn đảo chiều).
 * 5. Điểm số Exhaustion Score là thước đo độ hụt hơi động lượng, KHÔNG phải xác suất đảo chiều.
 * 6. Xử lý an toàn khi thiếu dữ liệu hoặc ATR = 0.
 */

class TrendExhaustionDetector {
  constructor(customConfig = {}) {
    this.config = {
      enabled: true,
      mode: 'OBSERVE_ONLY', // Luôn mặc định OBSERVE_ONLY
      // Trọng số cho Exhaustion Score (Tổng 100%)
      weights: {
        slope: 25,         // EMA Slope Weakening: max 25 pts
        spread: 20,        // EMA Spread Contraction: max 20 pts
        momentum: 20,      // Momentum Weakening: max 20 pts
        structure: 25,     // Structure Weakening: max 25 pts
        followThrough: 10  // Follow-through Weakening: max 10 pts
      },
      // Ngưỡng phân loại trạng thái Exhaustion
      thresholds: {
        earlyWeakening: 30,  // Score >= 30 -> EARLY_WEAKENING
        weakening: 50,       // Score >= 50 -> WEAKENING
        severeWeakening: 75  // Score >= 75 -> SEVERE_WEAKENING
      },
      minSlopeThreshold: 0.001,
      ...customConfig
    };

    this.lastAnalysis = null;
  }

  /**
   * Cập nhật cấu hình module tại runtime
   */
  configure(newConfig = {}) {
    if (newConfig.weights) {
      this.config.weights = { ...this.config.weights, ...newConfig.weights };
      delete newConfig.weights;
    }
    if (newConfig.thresholds) {
      this.config.thresholds = { ...this.config.thresholds, ...newConfig.thresholds };
      delete newConfig.thresholds;
    }
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }

  /**
   * Bật/tắt module
   */
  setEnabled(isEnabled) {
    this.config.enabled = !!isEnabled;
    return this.config.enabled;
  }

  /**
   * Phân tích độ suy yếu xu hướng (Trend Exhaustion Analysis)
   * @param {Array} bars - Mảng nến OHLC [{ time, open, high, low, close }]
   * @param {Object} options - { timeframe, isBarClosed, asset, livePrice }
   * @returns {Object} Kết quả phân tích chi tiết
   */
  analyze(bars, options = {}) {
    if (!this.config.enabled) {
      return {
        status: 'DISABLED',
        trend: 'UNKNOWN',
        exhaustionScore: 0,
        warning: 'NONE',
        reason: 'Module Trend Exhaustion Detector đang tạm tắt.',
        timestamp: Date.now()
      };
    }

    const tf = options.timeframe || '15m';
    const isBarClosed = options.isBarClosed !== undefined ? options.isBarClosed : false;
    const asset = (options.asset || 'XAU').toUpperCase();

    // 1. KIỂM TRA DỮ LIỆU ĐẦU VÀO
    if (!bars || !Array.isArray(bars) || bars.length < 50) {
      return this._buildUnknownResult('Thiếu dữ liệu nến (cần tối thiểu 50 nến để phân tích cấu trúc, EMA & ATR).', tf, asset, isBarClosed);
    }

    try {
      const barCount = bars.length;
      const targetBar = bars[barCount - 1];
      const prevBar = bars[barCount - 2];

      if (!targetBar || typeof targetBar.close !== 'number' || isNaN(targetBar.close)) {
        return this._buildUnknownResult('Nến hiện tại không hợp lệ hoặc thiếu giá Close.', tf, asset, isBarClosed);
      }

      // Giá phân tích: ưu tiên livePrice nếu truyền vào, ngược lại dùng close của nến cuối
      const currentPrice = (typeof options.livePrice === 'number' && !isNaN(options.livePrice) && options.livePrice > 0)
        ? options.livePrice
        : targetBar.close;

      // 2. TÍNH TOÁN EMA20, EMA50 VÀ ATR14
      const ema20List = this._calcEMA(bars, 20);
      const ema50List = this._calcEMA(bars, 50);
      const atrList = this._calcATR(bars, 14);

      if (!ema20List || ema20List.length < 5 || !ema50List || ema50List.length < 5 || !atrList || atrList.length === 0) {
        return this._buildUnknownResult('Không thể tính toán chuỗi EMA20/EMA50 hoặc ATR.', tf, asset, isBarClosed);
      }

      const currentATR = atrList[atrList.length - 1].value;
      if (!currentATR || isNaN(currentATR) || currentATR <= 0) {
        return this._buildUnknownResult('Giá trị ATR bằng 0 hoặc không hợp lệ, không thể chuẩn hóa biến động.', tf, asset, isBarClosed);
      }

      // Lấy 4 điểm EMA20 & EMA50 gần nhất để đánh giá gia tốc độ dốc
      const e20_0 = ema20List[ema20List.length - 1].value;
      const e20_1 = ema20List[ema20List.length - 2].value;
      const e20_2 = ema20List[ema20List.length - 3].value;
      const e20_3 = ema20List[ema20List.length - 4].value;

      const e50_0 = ema50List[ema50List.length - 1].value;
      const e50_1 = ema50List[ema50List.length - 2].value;
      const e50_2 = ema50List[ema50List.length - 3].value;

      // 3. XÁC ĐỊNH XU HƯỚNG HIỆN TẠI (CURRENT TREND DIRECTION)
      // Dựa trên tương quan EMA20 và EMA50 cùng độ mở dải sóng so với ATR
      const slope20_0 = e20_0 - e20_1;
      const slope20_1 = e20_1 - e20_2;
      const slope20_2 = e20_2 - e20_3;

      const slope50_0 = e50_0 - e50_1;

      const spreadVal = e20_0 - e50_0;
      const minTrendSpread = Math.max(0.3, currentATR * 0.35); // Tối thiểu 0.35x ATR để xác nhận dải sóng có xu hướng

      let currentTrend = 'SIDEWAY';
      if (spreadVal >= minTrendSpread && (slope20_0 > -this.config.minSlopeThreshold || slope50_0 > 0)) {
        currentTrend = 'UP';
      } else if (spreadVal <= -minTrendSpread && (slope20_0 < this.config.minSlopeThreshold || slope50_0 < 0)) {
        currentTrend = 'DOWN';
      } else {
        currentTrend = 'SIDEWAY';
      }

      // 4. PHÂN TÍCH 5 YẾU TỐ SUY YẾU (EXHAUSTION FACTORS)

      // --- YẾU TỐ 1: EMA SLOPE WEAKENING (Độ dốc EMA20 giảm dần / mất hướng) ---
      let slopeScore = 0;
      let slopeStatus = 'HEALTHY'; // 'HEALTHY' | 'DECELERATING' | 'FLAT' | 'REVERSING'
      let slopeReason = '';

      if (currentTrend === 'UP') {
        if (slope20_0 < slope20_1 && slope20_1 < slope20_2) {
          // Độ dốc giảm tốc liên tiếp 2 nến
          slopeScore = (slope20_0 <= this.config.minSlopeThreshold) ? this.config.weights.slope : Math.round(this.config.weights.slope * 0.6);
          slopeStatus = (slope20_0 <= this.config.minSlopeThreshold) ? 'FLAT' : 'DECELERATING';
          slopeReason = slopeStatus === 'FLAT' ? 'EMA20 bẹt ngang, mất động lượng dốc lên' : 'Độ dốc EMA20 đang giảm tốc dần';
        } else if (slope20_0 < 0) {
          slopeScore = this.config.weights.slope;
          slopeStatus = 'REVERSING';
          slopeReason = 'EMA20 uốn cong xuống dưới';
        } else if (slope20_0 < slope20_1) {
          slopeScore = Math.round(this.config.weights.slope * 0.4);
          slopeStatus = 'DECELERATING';
          slopeReason = 'Độ dốc EMA20 hơi chững lại';
        } else {
          slopeStatus = 'HEALTHY';
          slopeReason = 'Độ dốc EMA20 dốc lên khỏe';
        }
      } else if (currentTrend === 'DOWN') {
        const absSlope0 = Math.abs(slope20_0);
        const absSlope1 = Math.abs(slope20_1);
        const absSlope2 = Math.abs(slope20_2);

        if (absSlope0 < absSlope1 && absSlope1 < absSlope2) {
          slopeScore = (absSlope0 <= this.config.minSlopeThreshold) ? this.config.weights.slope : Math.round(this.config.weights.slope * 0.6);
          slopeStatus = (absSlope0 <= this.config.minSlopeThreshold) ? 'FLAT' : 'DECELERATING';
          slopeReason = slopeStatus === 'FLAT' ? 'EMA20 bẹt ngang, lực đè dốc xuống yếu đi' : 'Độ dốc giảm của EMA20 đang chững lại';
        } else if (slope20_0 > 0) {
          slopeScore = this.config.weights.slope;
          slopeStatus = 'REVERSING';
          slopeReason = 'EMA20 uốn cong lên trên';
        } else if (absSlope0 < absSlope1) {
          slopeScore = Math.round(this.config.weights.slope * 0.4);
          slopeStatus = 'DECELERATING';
          slopeReason = 'Độ dốc giảm của EMA20 hơi chững lại';
        } else {
          slopeStatus = 'HEALTHY';
          slopeReason = 'Độ dốc EMA20 dốc xuống dứt khoát';
        }
      } else {
        slopeStatus = 'FLAT';
        slopeScore = Math.round(this.config.weights.slope * 0.5);
        slopeReason = 'Thị trường đi ngang, EMA20 và EMA50 song song bẹt';
      }

      // --- YẾU TỐ 2: EMA SPREAD CONTRACTION (Khoảng cách EMA20–EMA50 thu hẹp) ---
      const spread0 = Math.abs(e20_0 - e50_0);
      const spread1 = Math.abs(e20_1 - e50_1);
      const spread2 = Math.abs(e20_2 - e50_2);

      let spreadScore = 0;
      let spreadStatus = 'EXPANDING'; // 'EXPANDING' | 'STABLE' | 'CONTRACTING' | 'TIGHT'
      let spreadReason = '';

      const spread_ATR = +(spread0 / currentATR).toFixed(2);

      if (spread0 < spread1 && spread1 < spread2) {
        // Thu hẹp liên tiếp 2 nến
        spreadScore = this.config.weights.spread;
        spreadStatus = 'CONTRACTING';
        spreadReason = `Khoảng cách EMA thu hẹp liên tiếp (${spread_ATR}x ATR), hai đường MA đang hội tụ`;
      } else if (spread0 < spread1) {
        // Thu hẹp 1 nến
        spreadScore = Math.round(this.config.weights.spread * 0.5);
        spreadStatus = 'CONTRACTING';
        spreadReason = `Khoảng cách EMA bắt đầu thu hẹp (${spread_ATR}x ATR)`;
      } else if (spread_ATR < 0.5) {
        spreadScore = Math.round(this.config.weights.spread * 0.6);
        spreadStatus = 'TIGHT';
        spreadReason = `Dải EMA quá hẹp (<0.5x ATR), không có độ mở sóng`;
      } else {
        spreadStatus = 'EXPANDING';
        spreadReason = `Dải EMA mở rộng khỏe (${spread_ATR}x ATR)`;
      }

      // --- YẾU TỐ 3: MOMENTUM WEAKENING (Động lượng suy giảm) ---
      let momentumScore = 0;
      let momentumStatus = 'STRONG'; // 'STRONG' | 'DECLINING' | 'WEAK'
      let momentumReason = '';

      // Đánh giá 3 nến gần nhất: thân nến và bóng nến
      const b0 = bars[barCount - 1];
      const b1 = bars[barCount - 2];
      const b2 = bars[barCount - 3];

      const body0 = Math.abs(b0.close - b0.open);
      const body1 = Math.abs(b1.close - b1.open);
      const body2 = Math.abs(b2.close - b2.open);

      const range0 = b0.high - b0.low || 0.001;
      const upperWick0 = b0.high - Math.max(b0.open, b0.close);
      const lowerWick0 = Math.min(b0.open, b0.close) - b0.low;

      // Rate of Change (ROC 5 nến gần nhất so với ATR)
      const lookbackROC = Math.min(5, barCount - 1);
      const pastBar = bars[barCount - 1 - lookbackROC];
      const priceChange5 = Math.abs(b0.close - pastBar.close);
      const rocNormalized = priceChange5 / currentATR;

      if (currentTrend === 'UP') {
        const hasRejectionWick = (upperWick0 / range0) >= 0.45; // Bóng trên dài > 45% nến
        const isBodyShrinking = body0 < body1 && body1 < body2; // Thân nến co hẹp liên tiếp

        if (hasRejectionWick && isBodyShrinking) {
          momentumScore = this.config.weights.momentum;
          momentumStatus = 'WEAK';
          momentumReason = 'Nến có râu trên dài từ chối giá cao & thân nến tăng co hẹp liên tiếp';
        } else if (hasRejectionWick) {
          momentumScore = Math.round(this.config.weights.momentum * 0.7);
          momentumStatus = 'DECLINING';
          momentumReason = 'Áp lực bán chốt lời xuất hiện (râu nến trên dài > 45%)';
        } else if (isBodyShrinking) {
          momentumScore = Math.round(this.config.weights.momentum * 0.6);
          momentumStatus = 'DECLINING';
          momentumReason = 'Biên độ thân nến tăng thu nhỏ dần qua 3 nến';
        } else if (body0 < currentATR * 0.3) {
          momentumScore = Math.round(this.config.weights.momentum * 0.4);
          momentumStatus = 'DECLINING';
          momentumReason = 'Thân nến nhỏ (<0.3x ATR), lực đẩy yếu';
        } else {
          momentumStatus = 'STRONG';
          momentumReason = 'Thân nến tăng rõ ràng, động lượng tốt';
        }
      } else if (currentTrend === 'DOWN') {
        const hasRejectionWick = (lowerWick0 / range0) >= 0.45; // Bóng dưới dài > 45% nến
        const isBodyShrinking = body0 < body1 && body1 < body2;

        if (hasRejectionWick && isBodyShrinking) {
          momentumScore = this.config.weights.momentum;
          momentumStatus = 'WEAK';
          momentumReason = 'Nến có râu dưới dài đỡ giá & thân nến giảm co hẹp liên tiếp';
        } else if (hasRejectionWick) {
          momentumScore = Math.round(this.config.weights.momentum * 0.7);
          momentumStatus = 'DECLINING';
          momentumReason = 'Lực cầu bắt đáy xuất hiện (râu nến dưới dài > 45%)';
        } else if (isBodyShrinking) {
          momentumScore = Math.round(this.config.weights.momentum * 0.6);
          momentumStatus = 'DECLINING';
          momentumReason = 'Biên độ thân nến giảm thu nhỏ dần qua 3 nến';
        } else if (body0 < currentATR * 0.3) {
          momentumScore = Math.round(this.config.weights.momentum * 0.4);
          momentumStatus = 'DECLINING';
          momentumReason = 'Thân nến nhỏ (<0.3x ATR), lực ép bán yếu';
        } else {
          momentumStatus = 'STRONG';
          momentumReason = 'Thân nến giảm dứt khoát, động lượng tốt';
        }
      } else {
        momentumStatus = 'WEAK';
        momentumScore = Math.round(this.config.weights.momentum * 0.5);
        momentumReason = 'Thị trường tích lũy không có động lượng xu hướng rõ nét';
      }

      // --- YẾU TỐ 4: STRUCTURE WEAKENING (Cấu trúc HH/HL hoặc LH/LL) ---
      let structureScore = 0;
      let structureStatus = 'INTACT'; // 'INTACT' | 'WARNING' | 'BROKEN'
      let structureReason = '';

      const pivots = this._calcPivots(bars, 3);
      const swingHighs = pivots.swingHighs;
      const swingLows = pivots.swingLows;

      // Tìm thêm đáy thấp nhất và đỉnh cao nhất của 15 nến gần nhất (trừ nến hiện tại)
      const recentLookback = Math.min(15, barCount - 2);
      let recentMinLow = Infinity;
      let recentMaxHigh = -Infinity;
      for (let k = 1; k <= recentLookback; k++) {
        const b = bars[barCount - 1 - k];
        if (b.low < recentMinLow) recentMinLow = b.low;
        if (b.high > recentMaxHigh) recentMaxHigh = b.high;
      }

      if (swingHighs.length >= 1 && swingLows.length >= 1) {
        const lastSH = swingHighs[swingHighs.length - 1].price;
        const lastSL = swingLows[swingLows.length - 1].price;
        const prevSH = swingHighs.length >= 2 ? swingHighs[swingHighs.length - 2].price : lastSH;
        const prevSL = swingLows.length >= 2 ? swingLows[swingLows.length - 2].price : lastSL;

        if (currentTrend === 'UP') {
          const failedHH = swingHighs.length >= 2 && lastSH <= prevSH;
          const brokeSL = currentPrice < lastSL || currentPrice < recentMinLow;

          if (failedHH && brokeSL) {
            structureScore = this.config.weights.structure;
            structureStatus = 'BROKEN';
            structureReason = `Phá vỡ cấu trúc: Giá thủng đáy hỗ trợ gần nhất ($${Math.min(lastSL, recentMinLow).toFixed(2)}) và tạo đỉnh thấp hơn (LH)`;
          } else if (brokeSL) {
            structureScore = Math.round(this.config.weights.structure * 0.8);
            structureStatus = 'WARNING';
            structureReason = `Cảnh báo cấu trúc: Giá thủng đáy hỗ trợ gần nhất ($${Math.min(lastSL, recentMinLow).toFixed(2)})`;
          } else if (failedHH) {
            structureScore = Math.round(this.config.weights.structure * 0.6);
            structureStatus = 'WARNING';
            structureReason = `Cảnh báo cấu trúc: Không tạo được đỉnh cao hơn ($${lastSH.toFixed(2)} <= $${prevSH.toFixed(2)})`;
          } else {
            structureStatus = 'INTACT';
            structureReason = `Cấu trúc TĂNG nguyên vẹn (HH & HL duy trì trên dải hỗ trợ $${lastSL.toFixed(2)})`;
          }
        } else if (currentTrend === 'DOWN') {
          const failedLL = swingLows.length >= 2 && lastSL >= prevSL;
          const brokeSH = currentPrice > lastSH || currentPrice > recentMaxHigh;

          if (failedLL && brokeSH) {
            structureScore = this.config.weights.structure;
            structureStatus = 'BROKEN';
            structureReason = `Phá vỡ cấu trúc: Giá vượt đỉnh kháng cự gần nhất ($${Math.max(lastSH, recentMaxHigh).toFixed(2)}) và tạo đáy cao hơn (HL)`;
          } else if (brokeSH) {
            structureScore = Math.round(this.config.weights.structure * 0.8);
            structureStatus = 'WARNING';
            structureReason = `Cảnh báo cấu trúc: Giá vượt qua đỉnh kháng cự gần nhất ($${Math.max(lastSH, recentMaxHigh).toFixed(2)})`;
          } else if (failedLL) {
            structureScore = Math.round(this.config.weights.structure * 0.6);
            structureStatus = 'WARNING';
            structureReason = `Cảnh báo cấu trúc: Không tạo được đáy thấp hơn ($${lastSL.toFixed(2)} >= $${prevSL.toFixed(2)})`;
          } else {
            structureStatus = 'INTACT';
            structureReason = `Cấu trúc GIẢM nguyên vẹn (LH & LL duy trì dưới cản $${lastSH.toFixed(2)})`;
          }
        } else {
          structureStatus = 'WARNING';
          structureScore = Math.round(this.config.weights.structure * 0.5);
          structureReason = 'Cấu trúc đỉnh đáy đan xen, thị trường đi ngang';
        }
      } else {
        // Nếu số mốc swing pivot ít hơn 1, dựa trên recentMinLow / recentMaxHigh
        if (currentPrice < recentMinLow) {
          structureScore = Math.round(this.config.weights.structure * 0.8);
          structureStatus = 'WARNING';
          structureReason = `Giá đột ngột xuyên thủng đáy hỗ trợ gần nhất ($${recentMinLow.toFixed(2)})`;
        } else if (currentPrice > recentMaxHigh) {
          structureScore = Math.round(this.config.weights.structure * 0.8);
          structureStatus = 'WARNING';
          structureReason = `Giá đột ngột bứt phá vượt đỉnh kháng cự gần nhất ($${recentMaxHigh.toFixed(2)})`;
        } else {
          structureStatus = 'INTACT';
          structureReason = 'Cấu trúc duy trì ổn định';
        }
      }

      // --- YẾU TỐ 5: FOLLOW-THROUGH WEAKENING (Đà tiếp diễn suy yếu) ---
      let followThroughScore = 0;
      let followThroughStatus = 'HEALTHY'; // 'HEALTHY' | 'STALLED' | 'FAILED'
      let followThroughReason = '';

      // Kiểm tra 2 nến gần nhất so với nến đẩy trước đó
      if (barCount >= 4) {
        const impulseBar = bars[barCount - 3];
        const subBar1 = bars[barCount - 2];
        const subBar2 = bars[barCount - 1];

        const impulseRange = impulseBar.high - impulseBar.low;
        const isImpulse = impulseRange >= currentATR * 0.8;

        if (isImpulse) {
          if (currentTrend === 'UP' && impulseBar.close > impulseBar.open) {
            // Sau nến đẩy tăng, nến tiếp theo không bứt phá mà thoái lui
            if (subBar2.close < impulseBar.open + impulseRange * 0.3) {
              followThroughScore = this.config.weights.followThrough;
              followThroughStatus = 'FAILED';
              followThroughReason = 'Nến đẩy tăng bị thoái lui sâu (>70% biên độ nến đẩy)';
            } else if (subBar2.close <= impulseBar.close) {
              followThroughScore = Math.round(this.config.weights.followThrough * 0.6);
              followThroughStatus = 'STALLED';
              followThroughReason = 'Giá chững lại sau nến đẩy tăng, thiếu lực tiếp diễn';
            } else {
              followThroughStatus = 'HEALTHY';
              followThroughReason = 'Đà tiếp diễn theo sau nến đẩy tăng vẫn duy trì';
            }
          } else if (currentTrend === 'DOWN' && impulseBar.close < impulseBar.open) {
            if (subBar2.close > impulseBar.open - impulseRange * 0.3) {
              followThroughScore = this.config.weights.followThrough;
              followThroughStatus = 'FAILED';
              followThroughReason = 'Nến đẩy giảm bị rút chân ngược sâu (>70% biên độ)';
            } else if (subBar2.close >= impulseBar.close) {
              followThroughScore = Math.round(this.config.weights.followThrough * 0.6);
              followThroughStatus = 'STALLED';
              followThroughReason = 'Giá chững lại sau nến đẩy giảm, thiếu lực ép bán tiếp theo';
            } else {
              followThroughStatus = 'HEALTHY';
              followThroughReason = 'Đà tiếp diễn theo sau nến đẩy giảm vẫn duy trì';
            }
          }
        }
      }

      // 5. TỔNG HỢP EXHAUSTION SCORE (0 - 100)
      const totalScore = Math.min(100, Math.max(0, slopeScore + spreadScore + momentumScore + structureScore + followThroughScore));

      // 6. PHÂN LOẠI TRẠNG THÁI (STATUS CLASSIFICATION)
      const th = this.config.thresholds;
      let status = 'NORMAL';

      if (totalScore >= th.severeWeakening) {
        status = 'SEVERE_WEAKENING';
      } else if (totalScore >= th.weakening) {
        status = 'WEAKENING';
      } else if (totalScore >= th.earlyWeakening) {
        status = 'EARLY_WEAKENING';
      } else {
        status = 'NORMAL';
      }

      // 7. PHÂN BIỆT CẢNH BÁO RIÊNG (WARNING CATEGORY)
      let warning = 'NONE';
      if (status === 'SEVERE_WEAKENING') {
        warning = 'TREND_EXHAUSTION_WARNING';
      } else if (structureStatus === 'BROKEN' || structureStatus === 'WARNING') {
        warning = 'STRUCTURE_WARNING';
      } else if (momentumStatus === 'WEAK' || momentumStatus === 'DECLINING') {
        warning = 'MOMENTUM_LOSS';
      } else if (status === 'WEAKENING' || status === 'EARLY_WEAKENING') {
        warning = currentTrend === 'UP' ? 'BUY_WAVE_WEAKENING' : currentTrend === 'DOWN' ? 'SELL_WAVE_WEAKENING' : 'SIDEWAY_CONSOLIDATION';
      }

      // 8. TỔNG HỢP NGUYÊN NHÂN VÀ LỜI KHUYÊN KHÁCH QUAN
      let primaryReason = '';
      if (status === 'SEVERE_WEAKENING') {
        primaryReason = `Nhiều yếu tố kỹ thuật đồng loạt suy yếu (Điểm suy yếu: ${totalScore}/100). ${slopeReason}. ${spreadReason}. ${structureReason}.`;
      } else if (status === 'WEAKENING') {
        primaryReason = `Động lượng sóng đang yếu đi rõ rệt (${totalScore}/100). ${slopeReason}. ${momentumReason}.`;
      } else if (status === 'EARLY_WEAKENING') {
        primaryReason = `Xuất hiện một số tín hiệu suy yếu ban đầu (${totalScore}/100). ${slopeReason}. ${spreadReason}.`;
      } else {
        primaryReason = `Xu hướng ${currentTrend} đang duy trì trạng thái ổn định (${totalScore}/100). Các yếu tố động lượng và cấu trúc đều khỏe.`;
      }

      const confirmationNote = isBarClosed
        ? 'Dữ liệu nến đã đóng — Trạng thái suy yếu đã được xác nhận (Confirmed).'
        : 'Cảnh báo realtime trên nến đang hình thành — Có thể thay đổi khi nến đóng.';

      const objectiveAdvice = (status === 'NORMAL')
        ? 'Sóng xu hướng đang có động lượng tốt, có thể duy trì chiến lược thuận xu hướng.'
        : 'LƯU Ý QUAN TRỌNG: Trạng thái SUY YẾU (Weakening) phản ánh sóng hiện tại đang mất lực đẩy ngắn hạn, KHÔNG đồng nghĩa thị trường sẽ đảo chiều (Reversal). Giá có thể đi ngang (Sideway) tích lũy để tiếp tục xu hướng. Không nên vội vã bắt đỉnh/đáy ngược xu hướng.';

      const result = {
        status, // 'NORMAL' | 'EARLY_WEAKENING' | 'WEAKENING' | 'SEVERE_WEAKENING' | 'UNKNOWN'
        currentTrend, // 'UP' | 'DOWN' | 'SIDEWAY'
        exhaustionScore: totalScore,
        warning, // 'NONE' | 'BUY_WAVE_WEAKENING' | 'SELL_WAVE_WEAKENING' | 'MOMENTUM_LOSS' | 'STRUCTURE_WARNING' | 'TREND_EXHAUSTION_WARNING'
        factors: {
          slope: { score: slopeScore, status: slopeStatus, reason: slopeReason },
          spread: { score: spreadScore, status: spreadStatus, spread_ATR, reason: spreadReason },
          momentum: { score: momentumScore, status: momentumStatus, reason: momentumReason },
          structure: { score: structureScore, status: structureStatus, reason: structureReason },
          followThrough: { score: followThroughScore, status: followThroughStatus, reason: followThroughReason }
        },
        atr: +currentATR.toFixed(2),
        isBarClosed: !!isBarClosed,
        timeframe: tf,
        asset,
        reason: primaryReason,
        confirmationNote,
        objectiveAdvice,
        timestamp: Date.now(),
        mode: this.config.mode
      };

      this.lastAnalysis = result;
      return result;

    } catch (err) {
      return this._buildUnknownResult(`Lỗi phân tích: ${err.message}`, tf, asset, isBarClosed);
    }
  }

  /**
   * Tạo đối tượng kết quả trạng thái UNKNOWN an toàn
   */
  _buildUnknownResult(reasonMessage, tf, asset, isBarClosed) {
    const res = {
      status: 'UNKNOWN',
      currentTrend: 'UNKNOWN',
      exhaustionScore: 0,
      warning: 'NONE',
      factors: {
        slope: { score: 0, status: 'UNKNOWN', reason: reasonMessage },
        spread: { score: 0, status: 'UNKNOWN', spread_ATR: 0, reason: reasonMessage },
        momentum: { score: 0, status: 'UNKNOWN', reason: reasonMessage },
        structure: { score: 0, status: 'UNKNOWN', reason: reasonMessage },
        followThrough: { score: 0, status: 'UNKNOWN', reason: reasonMessage }
      },
      atr: null,
      isBarClosed: !!isBarClosed,
      timeframe: tf || '15m',
      asset: asset || 'XAU',
      reason: reasonMessage,
      confirmationNote: 'Chưa đủ điều kiện dữ liệu để kết luận trạng thái.',
      objectiveAdvice: 'Đang theo dõi và chờ dữ liệu nến đồng bộ từ máy chủ.',
      timestamp: Date.now(),
      mode: this.config.mode
    };
    this.lastAnalysis = res;
    return res;
  }

  /**
   * Hàm tính toán EMA độc lập
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
   * Hàm tính toán Wilder's ATR 14 độc lập
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
    const atr = [];
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

  /**
   * Hàm tính toán Pivots (Swing High / Swing Low) độc lập
   */
  _calcPivots(data, pivotLen = 3) {
    if (typeof window !== 'undefined' && window.Indicators && typeof window.Indicators.calculatePivots === 'function') {
      return window.Indicators.calculatePivots(data, pivotLen);
    }
    const swingHighs = [];
    const swingLows = [];
    if (!data || data.length < pivotLen * 2 + 1) return { swingHighs, swingLows };

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
}

// Khởi tạo Singleton Instance sẵn sàng cho Web Client
if (typeof window !== 'undefined') {
  window.TrendExhaustionDetector = TrendExhaustionDetector;
  window.trendExhaustionDetector = new TrendExhaustionDetector();
}

// Export cho Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TrendExhaustionDetector };
}

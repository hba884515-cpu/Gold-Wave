/**
 * MA WAVE V8 PRO — MODULE 03: PULLBACK QUALITY DETECTOR
 * ========================================================
 * Module độc lập đánh giá chất lượng nhịp Pullback trong xu hướng tăng/giảm.
 * Phân biệt pullback bình thường (Healthy), pullback sâu (Deep), pullback yếu (Weak),
 * pullback có rủi ro thay đổi cấu trúc (At Risk) và khả năng đảo chiều (Possible Reversal).
 *
 * NGUYÊN TẮC BẮT BUỘC:
 * 1. Độc lập 100%, chỉ đọc dữ liệu (Read-Only Observer).
 * 2. Mặc định chế độ OBSERVE_ONLY.
 * 3. Tuyệt đối KHÔNG can thiệp, trì hoãn hoặc sửa đổi tín hiệu Legacy Core V8.
 * 4. Không tự động sinh hoặc hủy lệnh BUY/SELL.
 * 5. Pullback sâu KHÔNG đồng nghĩa đảo chiều; Pullback yếu KHÔNG đồng nghĩa xu hướng kết thúc.
 * 6. Xử lý an toàn khi thiếu dữ liệu hoặc ATR = 0.
 * 7. Phân biệt rõ wick break và candle-close break.
 */

class PullbackQualityDetector {
  constructor(customConfig = {}) {
    this.config = {
      enabled: true,
      mode: 'OBSERVE_ONLY', // Mặc định OBSERVE_ONLY
      // Trọng số cho Pullback Quality Score (Tổng 100 điểm)
      weights: {
        depth: 20,       // Độ sâu nhịp hồi hợp lý (vùng EMA20): max 20đ
        speed: 20,       // Tốc độ hồi từ tốn, có trật tự: max 20đ
        momentum: 20,    // Động lượng nến hồi giảm dần: max 20đ
        emaReaction: 20, // Phản ứng hỗ trợ/kháng cự tại MA: max 20đ
        structure: 20    // Bảo toàn cấu trúc Swing Level (HL/LH): max 20đ
      },
      minTrendSpreadRatio: 0.35, // Độ chênh EMA20-EMA50 tối thiểu so với ATR để xác nhận xu hướng gốc
      minSlopeThreshold: 0.001,
      ...customConfig
    };

    this.lastAnalysis = null;
  }

  /**
   * Cập nhật cấu hình runtime
   */
  configure(newConfig = {}) {
    if (newConfig.weights) {
      this.config.weights = { ...this.config.weights, ...newConfig.weights };
      delete newConfig.weights;
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
   * Phân tích chất lượng nhịp hồi Pullback
   * @param {Array} bars - Mảng nến OHLC [{ time, open, high, low, close }]
   * @param {Object} options - { timeframe, isBarClosed, asset, livePrice }
   * @returns {Object} Kết quả phân tích chi tiết
   */
  analyze(bars, options = {}) {
    if (!this.config.enabled) {
      return {
        status: 'DISABLED',
        originalTrend: 'UNKNOWN',
        qualityScore: 0,
        warning: 'NONE',
        reason: 'Module Pullback Quality Detector đang tạm tắt.',
        timestamp: Date.now()
      };
    }

    const tf = options.timeframe || '15m';
    const isBarClosed = options.isBarClosed !== undefined ? options.isBarClosed : false;
    const asset = (options.asset || 'XAU').toUpperCase();

    // 1. KIỂM TRA DỮ LIỆU ĐẦU VÀO
    if (!bars || !Array.isArray(bars) || bars.length < 50) {
      return this._buildUnknownResult('Thiếu dữ liệu nến (cần tối thiểu 50 nến để phân tích EMA, Swing & ATR).', tf, asset, isBarClosed);
    }

    try {
      const barCount = bars.length;
      const targetBar = bars[barCount - 1];
      const prevBar = bars[barCount - 2];

      if (!targetBar || typeof targetBar.close !== 'number' || isNaN(targetBar.close)) {
        return this._buildUnknownResult('Nến hiện tại không hợp lệ hoặc thiếu giá Close.', tf, asset, isBarClosed);
      }

      const currentPrice = (typeof options.livePrice === 'number' && !isNaN(options.livePrice) && options.livePrice > 0)
        ? options.livePrice
        : targetBar.close;

      // 2. TÍNH TOÁN EMA20, EMA50 VÀ ATR14
      const ema20List = this._calcEMA(bars, 20);
      const ema50List = this._calcEMA(bars, 50);
      const atrList = this._calcATR(bars, 14);

      if (!ema20List || ema20List.length < 5 || !ema50List || ema50List.length < 5 || !atrList || atrList.length === 0) {
        return this._buildUnknownResult('Không thể tính toán EMA20/EMA50 hoặc ATR.', tf, asset, isBarClosed);
      }

      const currentATR = atrList[atrList.length - 1].value;
      if (!currentATR || isNaN(currentATR) || currentATR <= 0) {
        return this._buildUnknownResult('Giá trị ATR bằng 0 hoặc không hợp lệ, không thể chuẩn hóa biến động.', tf, asset, isBarClosed);
      }

      const e20_0 = ema20List[ema20List.length - 1].value;
      const e20_1 = ema20List[ema20List.length - 2].value;
      const e50_0 = ema50List[ema50List.length - 1].value;
      const e50_1 = ema50List[ema50List.length - 2].value;

      const slope20 = e20_0 - e20_1;
      const slope50 = e50_0 - e50_1;
      const spreadVal = e20_0 - e50_0;
      const minTrendSpread = Math.max(0.3, currentATR * this.config.minTrendSpreadRatio);

      // Lấy thêm dữ liệu slope trước nhịp hồi (lookback 4 nến) để xác nhận xu hướng gốc
      const preIdx50 = Math.max(0, ema50List.length - 4);
      const preIdx50_prev = Math.max(0, preIdx50 - 1);
      const slope50_pre = ema50List[preIdx50].value - ema50List[preIdx50_prev].value;

      // 3. XÁC ĐỊNH XU HƯỚNG GỐC (ORIGINAL TREND)
      let originalTrend = 'NO_CLEAR_TREND';
      if (spreadVal >= minTrendSpread && (slope50 > -currentATR * 0.15 || slope50_pre > 0 || slope20 > 0)) {
        originalTrend = 'UPTREND';
      } else if (spreadVal <= -minTrendSpread && (slope50 < currentATR * 0.15 || slope50_pre < 0 || slope20 < 0)) {
        originalTrend = 'DOWNTREND';
      } else {
        originalTrend = 'NO_CLEAR_TREND';
      }

      if (originalTrend === 'NO_CLEAR_TREND') {
        const res = this._buildUnknownResult('Xu hướng gốc không rõ ràng (EMA20 & EMA50 đi ngang, biên độ nén hẹp). Không xác định nhịp Pullback khi thị trường Sideway.', tf, asset, isBarClosed);
        res.originalTrend = 'NO_CLEAR_TREND';
        res.status = 'NO_PULLBACK';
        return res;
      }

      // 4. PHÂN TÍCH CHI TIẾT NHỊP PULLBACK

      // A. Tìm Đỉnh/Đáy tham chiếu của sóng đẩy gần nhất (Extreme Swing Point)
      // Tìm trong phạm vi 15 nến gần đây
      const lookback = Math.min(20, barCount - 2);
      let swingPeak = -Infinity;
      let swingPeakIndex = -1;
      let swingTrough = Infinity;
      let swingTroughIndex = -1;

      for (let k = 1; k <= lookback; k++) {
        const idx = barCount - 1 - k;
        const b = bars[idx];
        if (b.high > swingPeak) {
          swingPeak = b.high;
          swingPeakIndex = idx;
        }
        if (b.low < swingTrough) {
          swingTrough = b.low;
          swingTroughIndex = idx;
        }
      }

      // B. Tính Pullback Depth (Độ sâu nhịp hồi)
      let pullbackDistance = 0;
      let pullbackDirection = 'NONE';
      let pullbackBarsCount = 0;

      if (originalTrend === 'UPTREND') {
        pullbackDistance = Math.max(0, swingPeak - currentPrice);
        pullbackDirection = 'RETRACEMENT_DOWN';
        pullbackBarsCount = Math.max(1, (barCount - 1) - swingPeakIndex);
      } else if (originalTrend === 'DOWNTREND') {
        pullbackDistance = Math.max(0, currentPrice - swingTrough);
        pullbackDirection = 'RETRACEMENT_UP';
        pullbackBarsCount = Math.max(1, (barCount - 1) - swingTroughIndex);
      }

      const depth_ATR = +(pullbackDistance / currentATR).toFixed(2);

      // Nếu độ sâu quá nhỏ (< 0.4x ATR), thị trường vẫn đang trong sóng đẩy, chưa có Pullback
      if (depth_ATR < 0.4) {
        return {
          status: 'NO_PULLBACK',
          originalTrend,
          pullbackDirection: 'NONE',
          depth_ATR,
          pullbackDistance: +pullbackDistance.toFixed(2),
          qualityScore: 100,
          warning: 'NONE',
          depthStatus: 'IMPULSE_EXPANDING',
          speedStatus: 'NORMAL',
          emaReaction: 'ABOVE_EMA',
          momentumStatus: 'STRONG',
          structureStatus: 'INTACT',
          recoveryStatus: 'NOT_NEEDED',
          isBarClosed: !!isBarClosed,
          timeframe: tf,
          asset,
          reason: `Giá đang tiếp diễn sóng đẩy mạnh mẽ, chưa xuất hiện nhịp điều chỉnh đáng kể (Hồi ${depth_ATR}x ATR).`,
          confirmationNote: isBarClosed ? 'Dữ liệu nến đã đóng — Trạng thái đã được xác nhận (Confirmed).' : 'Cảnh báo realtime trên nến đang hình thành — Có thể thay đổi khi nến đóng.',
          objectiveAdvice: 'Xu hướng chính đang tiếp diễn mạnh. Kiên nhẫn chờ nhịp hồi rõ ràng trước khi xem xét vị thế mới.',
          timestamp: Date.now(),
          mode: this.config.mode
        };
      }

      // C. ĐÁNH GIÁ 5 YẾU TỐ CHẤT LƯỢNG (FACTORS)

      // 1. PULLBACK DEPTH (Độ sâu) - Max 20đ
      let depthScore = 0;
      let depthStatus = 'MODERATE'; // 'SHALLOW' | 'MODERATE' | 'DEEP' | 'EXCESSIVE'
      let depthReason = '';

      if (depth_ATR <= 1.2) {
        depthScore = 18;
        depthStatus = 'SHALLOW';
        depthReason = `Hồi nông (${depth_ATR}x ATR), xu hướng chính rất mạnh`;
      } else if (depth_ATR <= 2.2) {
        depthScore = 20; // Lý tưởng nhất (về vùng EMA20)
        depthStatus = 'MODERATE';
        depthReason = `Hồi chuẩn biên độ vàng (${depth_ATR}x ATR), tiệm cận dải EMA20`;
      } else if (depth_ATR <= 3.2) {
        depthScore = 12;
        depthStatus = 'DEEP';
        depthReason = `Hồi sâu (${depth_ATR}x ATR), áp sát dải EMA50`;
      } else {
        depthScore = 5;
        depthStatus = 'EXCESSIVE';
        depthReason = `Hồi quá sâu (${depth_ATR}x ATR), đe dọa cấu trúc sóng`;
      }

      // 2. PULLBACK SPEED (Tốc độ) - Max 20đ
      let speedScore = 0;
      let speedStatus = 'ORDERLY'; // 'ORDERLY' | 'FAST' | 'VIOLENT'
      let speedReason = '';
      const speedRatio = depth_ATR / pullbackBarsCount;

      if (speedRatio <= 0.6 && pullbackBarsCount >= 2) {
        speedScore = 20;
        speedStatus = 'ORDERLY';
        speedReason = `Hồi từ tốn, có trật tự qua ${pullbackBarsCount} nến (${speedRatio.toFixed(2)}x ATR/nến)`;
      } else if (speedRatio <= 1.2 || depth_ATR <= 1.2) {
        speedScore = 14;
        speedStatus = 'FAST';
        speedReason = `Hồi tương đối nhanh qua ${pullbackBarsCount} nến`;
      } else {
        speedScore = 6;
        speedStatus = 'VIOLENT';
        speedReason = `Hồi dốc đột ngột (${speedRatio.toFixed(2)}x ATR/nến), áp lực ngược sóng mạnh`;
      }

      // 3. MOMENTUM DURING PULLBACK - Max 20đ
      let momentumScore = 0;
      let momentumStatus = 'WEAK_RETRACEMENT'; // 'WEAK_RETRACEMENT' | 'MODERATE' | 'STRONG_COUNTER'
      let momentumReason = '';

      const b0 = bars[barCount - 1];
      const b1 = bars[barCount - 2];
      const body0 = Math.abs(b0.close - b0.open);
      const body1 = Math.abs(b1.close - b1.open);

      if (originalTrend === 'UPTREND') {
        const isBearishExploding = (b0.close < b0.open) && (body0 > currentATR * 1.0);
        if (isBearishExploding) {
          momentumScore = 5;
          momentumStatus = 'STRONG_COUNTER';
          momentumReason = 'Nến giảm có thân lớn đột biến, lực bán áp đảo trong nhịp hồi';
        } else if (body0 <= body1 && body0 < currentATR * 0.6) {
          momentumScore = 20;
          momentumStatus = 'WEAK_RETRACEMENT';
          momentumReason = 'Động lượng nến giảm co hẹp dần, áp lực bán cạn kiệt';
        } else {
          momentumScore = 12;
          momentumStatus = 'MODERATE';
          momentumReason = 'Động lượng nến hồi ở mức trung bình';
        }
      } else {
        const isBullishExploding = (b0.close > b0.open) && (body0 > currentATR * 1.0);
        if (isBullishExploding) {
          momentumScore = 5;
          momentumStatus = 'STRONG_COUNTER';
          momentumReason = 'Nến tăng có thân lớn đột biến, lực mua áp đảo trong nhịp hồi';
        } else if (body0 <= body1 && body0 < currentATR * 0.6) {
          momentumScore = 20;
          momentumStatus = 'WEAK_RETRACEMENT';
          momentumReason = 'Động lượng nến tăng co hẹp dần, lực cầu hồi cạn kiệt';
        } else {
          momentumScore = 12;
          momentumStatus = 'MODERATE';
          momentumReason = 'Động lượng nến hồi ở mức trung bình';
        }
      }

      // 4. EMA REACTION (Phản ứng tại MA) - Max 20đ
      let emaScore = 0;
      let emaReaction = 'TESTING_EMA20';
      let emaReason = '';

      const distEMA20 = currentPrice - e20_0;
      const distEMA50 = currentPrice - e50_0;

      if (originalTrend === 'UPTREND') {
        if (currentPrice >= e20_0) {
          emaScore = 20;
          emaReaction = 'EMA20_SUPPORT';
          emaReason = `Giá giữ vững trên dải hỗ trợ EMA20 (+$${distEMA20.toFixed(2)})`;
        } else if (targetBar.low < e20_0 && currentPrice >= e20_0 - currentATR * 0.25) {
          emaScore = 18;
          emaReaction = 'EMA20_WICK_REJECTION';
          emaReason = 'Giá nhúng qua EMA20 trong phiên nhưng rút chân tôn trọng hỗ trợ';
        } else if (currentPrice >= e50_0) {
          emaScore = 12;
          emaReaction = 'EMA50_SUPPORT';
          emaReason = `Giá điều chỉnh xuyên EMA20 và đang tựa trên dải hỗ trợ EMA50 (+$${distEMA50.toFixed(2)})`;
        } else {
          emaScore = 4;
          emaReaction = 'EMA50_BROKEN';
          emaReason = `Giá đóng nến dưới cả hai đường EMA20 và EMA50 (-$${Math.abs(distEMA50).toFixed(2)})`;
        }
      } else {
        if (currentPrice <= e20_0) {
          emaScore = 20;
          emaReaction = 'EMA20_RESISTANCE';
          emaReason = `Giá duy trì dưới dải kháng cự EMA20 (-$${Math.abs(distEMA20).toFixed(2)})`;
        } else if (targetBar.high > e20_0 && currentPrice <= e20_0 + currentATR * 0.25) {
          emaScore = 18;
          emaReaction = 'EMA20_WICK_REJECTION';
          emaReason = 'Giá nhô qua EMA20 trong phiên nhưng rụt cổ tôn trọng kháng cự';
        } else if (currentPrice <= e50_0) {
          emaScore = 12;
          emaReaction = 'EMA50_RESISTANCE';
          emaReason = `Giá hồi vượt EMA20 và đang chạm dải cản EMA50`;
        } else {
          emaScore = 4;
          emaReaction = 'EMA50_BROKEN';
          emaReason = `Giá đóng nến vượt qua cả hai đường EMA20 và EMA50`;
        }
      }

      // 5. STRUCTURE PRESERVATION (Bảo toàn cấu trúc & Phân biệt Wick vs Close Break) - Max 20đ
      let structureScore = 0;
      let structureStatus = 'INTACT'; // 'INTACT' | 'WICK_TEST' | 'CLOSE_BREAK'
      let structureReason = '';

      // Tìm Swing Low quan trọng (trong Uptrend) hoặc Swing High quan trọng (trong Downtrend)
      const pivots = this._calcPivots(bars, 3);
      const swingLows = pivots.swingLows;
      const swingHighs = pivots.swingHighs;

      let keyLevel = 0;

      if (originalTrend === 'UPTREND') {
        keyLevel = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : (swingTrough !== Infinity ? swingTrough : e50_0 - currentATR);
        
        if (currentPrice > keyLevel && targetBar.low > keyLevel) {
          structureScore = 20;
          structureStatus = 'INTACT';
          structureReason = `Đáy cấu trúc Higher Low ($${keyLevel.toFixed(2)}) được bảo toàn nguyên vẹn`;
        } else if (targetBar.low <= keyLevel && currentPrice > keyLevel) {
          structureScore = 14;
          structureStatus = 'WICK_TEST';
          structureReason = `Râu nến quét qua đáy HL ($${keyLevel.toFixed(2)}) (Wick Test / Quét thanh khoản) nhưng đóng nến vẫn giữ trên hỗ trợ`;
        } else {
          structureScore = 3;
          structureStatus = 'CLOSE_BREAK';
          structureReason = `Giá đóng nến phá vỡ đáy Higher Low quan trọng ($${keyLevel.toFixed(2)}) (Candle-Close Break)`;
        }
      } else {
        keyLevel = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : (swingPeak !== -Infinity ? swingPeak : e50_0 + currentATR);

        if (currentPrice < keyLevel && targetBar.high < keyLevel) {
          structureScore = 20;
          structureStatus = 'INTACT';
          structureReason = `Đỉnh cấu trúc Lower High ($${keyLevel.toFixed(2)}) được bảo toàn nguyên vẹn`;
        } else if (targetBar.high >= keyLevel && currentPrice < keyLevel) {
          structureScore = 14;
          structureStatus = 'WICK_TEST';
          structureReason = `Râu nến quét qua đỉnh LH ($${keyLevel.toFixed(2)}) (Wick Test) nhưng đóng nến vẫn duy trì dưới cản`;
        } else {
          structureScore = 3;
          structureStatus = 'CLOSE_BREAK';
          structureReason = `Giá đóng nến phá vỡ đỉnh Lower High quan trọng ($${keyLevel.toFixed(2)}) (Candle-Close Break)`;
        }
      }

      // 6. RECOVERY / RESUMPTION STATUS (Dấu hiệu phục hồi)
      let recoveryStatus = 'WAITING'; // 'CONFIRMED' | 'IN_PROGRESS' | 'WAITING'
      let recoveryReason = '';

      if (originalTrend === 'UPTREND') {
        const isBullishCandle = targetBar.close > targetBar.open;
        const hasLowerWick = (Math.min(targetBar.open, targetBar.close) - targetBar.low) >= (targetBar.high - targetBar.low) * 0.35;
        const engulfedPrev = targetBar.close > prevBar.high;

        if (engulfedPrev && isBullishCandle) {
          recoveryStatus = 'CONFIRMED';
          recoveryReason = 'Nến tăng mạnh nuốt trọn nến trước, xác nhận kết thúc nhịp hồi';
        } else if (hasLowerWick || (isBullishCandle && currentPrice >= e20_0)) {
          recoveryStatus = 'IN_PROGRESS';
          recoveryReason = 'Xuất hiện nến rút chân tăng tại hỗ trợ, tín hiệu phục hồi đang hình thành';
        } else {
          recoveryStatus = 'WAITING';
          recoveryReason = 'Chưa có nến phục hồi rõ nét, đang quan sát phản ứng tại hỗ trợ';
        }
      } else {
        const isBearishCandle = targetBar.close < targetBar.open;
        const hasUpperWick = (targetBar.high - Math.max(targetBar.open, targetBar.close)) >= (targetBar.high - targetBar.low) * 0.35;
        const engulfedPrev = targetBar.close < prevBar.low;

        if (engulfedPrev && isBearishCandle) {
          recoveryStatus = 'CONFIRMED';
          recoveryReason = 'Nến giảm mạnh nuốt trọn nến trước, xác nhận kết thúc nhịp hồi';
        } else if (hasUpperWick || (isBearishCandle && currentPrice <= e20_0)) {
          recoveryStatus = 'IN_PROGRESS';
          recoveryReason = 'Xuất hiện nến rụt cổ tại kháng cự, tín hiệu ép bán đang hình thành';
        } else {
          recoveryStatus = 'WAITING';
          recoveryReason = 'Chưa có nến ép bán rõ nét, đang quan sát phản ứng tại cản';
        }
      }

      // D. TỔNG HỢP QUALITY SCORE (0 - 100 điểm)
      const totalScore = Math.min(100, Math.max(0, depthScore + speedScore + momentumScore + emaScore + structureScore));

      // E. PHÂN LOẠI TRẠNG THÁI PULLBACK (STATUS)
      let status = 'HEALTHY_PULLBACK';
      let warning = 'NONE';

      if (structureStatus === 'CLOSE_BREAK') {
        status = 'POSSIBLE_REVERSAL';
        warning = 'POSSIBLE_TREND_CHANGE';
      } else if (structureStatus === 'WICK_TEST' || emaReaction === 'EMA50_BROKEN') {
        status = 'PULLBACK_AT_RISK';
        warning = 'PULLBACK_STRUCTURE_RISK';
      } else if (momentumStatus === 'STRONG_COUNTER' || speedStatus === 'VIOLENT') {
        status = 'WEAK_PULLBACK';
        warning = 'PULLBACK_MOMENTUM_WARNING';
      } else if ((depthStatus === 'DEEP' || depthStatus === 'EXCESSIVE') && ((originalTrend === 'UPTREND' && currentPrice < e20_0) || (originalTrend === 'DOWNTREND' && currentPrice > e20_0))) {
        status = 'DEEP_PULLBACK';
        warning = 'DEEP_PULLBACK_WARNING';
      } else {
        status = 'HEALTHY_PULLBACK';
        warning = originalTrend === 'UPTREND' ? 'HEALTHY_BUY_PULLBACK' : 'HEALTHY_SELL_PULLBACK';
      }

      // F. TỔNG HỢP LÝ DO & LỜI KHUYÊN KHÁCH QUAN
      let primaryReason = '';
      if (status === 'HEALTHY_PULLBACK') {
        primaryReason = `Nhịp hồi chất lượng cao (Điểm: ${totalScore}/100). ${depthReason}. ${emaReason}. ${structureReason}.`;
      } else if (status === 'DEEP_PULLBACK') {
        primaryReason = `Nhịp hồi sâu (Điểm: ${totalScore}/100). ${depthReason}. Cấu trúc chính vẫn được bảo toàn nhưng cần chú ý phản ứng quanh EMA50.`;
      } else if (status === 'WEAK_PULLBACK') {
        primaryReason = `Nhịp hồi có đặc điểm bất thường (${totalScore}/100). ${speedReason}. ${momentumReason}.`;
      } else if (status === 'PULLBACK_AT_RISK') {
        primaryReason = `Nhịp hồi tiềm ẩn rủi ro (${totalScore}/100). ${structureReason}. Cần theo dõi chặt chẽ nến đóng.`;
      } else {
        primaryReason = `Cảnh báo cấu trúc (${totalScore}/100). ${structureReason}. ${emaReason}. Cần nến xác nhận trước khi kết luận xu hướng.`;
      }

      const confirmationNote = isBarClosed
        ? 'Dữ liệu nến đã đóng — Trạng thái đã được xác nhận (Confirmed).'
        : 'Cảnh báo realtime trên nến đang hình thành — Có thể thay đổi khi nến đóng.';

      const objectiveAdvice = (status === 'HEALTHY_PULLBACK')
        ? 'Nhịp hồi đang diễn ra chuẩn mực theo sóng MA Wave. Kiên nhẫn chờ nến phục hồi (Recovery) xác nhận để vào lệnh thuận xu hướng.'
        : 'LƯU Ý QUAN TRỌNG: Pullback sâu hoặc có rủi ro cấu trúc KHÔNG đồng nghĩa chắc chắn xu hướng đã đảo chiều. Tuyệt đối không bắt đỉnh/đáy hấp tấp khi chưa có nến xác nhận.';

      const result = {
        status, // 'NO_PULLBACK' | 'HEALTHY_PULLBACK' | 'DEEP_PULLBACK' | 'WEAK_PULLBACK' | 'PULLBACK_AT_RISK' | 'POSSIBLE_REVERSAL' | 'UNKNOWN'
        originalTrend, // 'UPTREND' | 'DOWNTREND' | 'NO_CLEAR_TREND'
        pullbackDirection, // 'RETRACEMENT_DOWN' | 'RETRACEMENT_UP' | 'NONE'
        depth_ATR,
        pullbackDistance: +pullbackDistance.toFixed(2),
        qualityScore: totalScore,
        warning,
        depthStatus,
        speedStatus,
        emaReaction,
        momentumStatus,
        structureStatus,
        recoveryStatus,
        keyLevel: +keyLevel.toFixed(2),
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
   * Tạo kết quả UNKNOWN an toàn
   */
  _buildUnknownResult(reasonMessage, tf, asset, isBarClosed) {
    const res = {
      status: 'UNKNOWN',
      originalTrend: 'UNKNOWN',
      pullbackDirection: 'NONE',
      depth_ATR: 0,
      pullbackDistance: 0,
      qualityScore: 0,
      warning: 'NONE',
      depthStatus: 'UNKNOWN',
      speedStatus: 'UNKNOWN',
      emaReaction: 'UNKNOWN',
      momentumStatus: 'UNKNOWN',
      structureStatus: 'UNKNOWN',
      recoveryStatus: 'UNKNOWN',
      keyLevel: 0,
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
   * Tính toán EMA độc lập
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
   * Tính toán Wilder's ATR 14 độc lập
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
   * Tính toán Swing Highs / Swing Lows độc lập
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
  window.PullbackQualityDetector = PullbackQualityDetector;
  window.pullbackQualityDetector = new PullbackQualityDetector();
}

// Export cho Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PullbackQualityDetector };
}

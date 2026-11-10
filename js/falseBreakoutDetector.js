/**
 * ============================================================================
 * MODULE 04: FALSE BREAKOUT DETECTOR CHO MA WAVE V8 PRO WEB
 * ============================================================================
 * 
 * Mục tiêu:
 * - Module độc lập chuyên biệt phát hiện Breakout giả (False Breakout) và Breakout
 *   có nguy cơ thất bại (Failed Breakout).
 * - Phân biệt chính xác:
 *   1. Wick Breakout (Phá vỡ bằng râu nến nhưng đóng cửa bên trong).
 *   2. Close Breakout (Phá vỡ được xác nhận bằng giá đóng cửa vượt vùng).
 *   3. Breakout Strength & Follow-through (Động lượng, khoảng cách/ATR, tỷ lệ thân nến).
 *   4. Breakout Retest (Kiểm tra phản ứng retest thành công vs retest gãy).
 *   5. Failed Breakout (Breakout thất bại quay trở lại range cũ).
 * 
 * Nguyên tắc an toàn:
 * - 100% READ-ONLY OBSERVER (Mặc định OBSERVE_ONLY).
 * - Tuyệt đối không can thiệp, trì hoãn hoặc sửa đổi tín hiệu BUY/SELL của Legacy Core V8.
 * - Không sử dụng dữ liệu tương lai (No Lookahead Bias).
 * - Không dùng Pivot chưa xác nhận như Pivot đã xác nhận (Chống Repaint).
 * - Xử lý an toàn khi thiếu dữ liệu, ATR = 0, hoặc thị trường Sideway không có vùng Breakout rõ ràng.
 */

class FalseBreakoutDetector {
  constructor(config = {}) {
    this.config = {
      mode: 'OBSERVE_ONLY',
      enabled: true,
      pivotLen: 3,                 // Số nến hai bên để xác nhận Pivot Swing High/Low
      zoneWidthATR: 0.15,          // Độ rộng vùng đệm Breakout (Buffer Zone = 0.15x ATR)
      minCloseDistanceATR: 0.25,   // Ngưỡng Close vượt vùng tối thiểu để xác nhận Close Breakout
      failedBackInsideATR: 0.10,   // Ngưỡng giá quay lại sâu bên trong range để xác nhận Thất Bại
      minCandleCount: 50,          // Số nến tối thiểu để phân tích
      ...config
    };

    // Lưu trữ cache breakout gần nhất để chống spam cảnh báo trùng lặp
    this.lastBreakoutEvent = {
      levelId: null,
      levelPrice: 0,
      direction: 'NONE',
      type: 'NONE',
      time: null,
      status: 'NO_BREAKOUT'
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
   * Phân tích hành vi Breakout trên chuỗi nến
   * @param {Array} bars - Danh sách nến [{time, open, high, low, close, volume}]
   * @param {Object} options - { timeframe, isBarClosed, asset, livePrice }
   * @returns {Object} Kết quả phân tích Breakout chi tiết
   */
  analyze(bars, options = {}) {
    const tf = options.timeframe || '15m';
    const isBarClosed = options.isBarClosed !== undefined ? options.isBarClosed : false;
    const asset = options.asset || 'xau';
    const livePrice = options.livePrice || 0;

    // 1. Kiểm tra cấu hình Bật/Tắt
    if (!this.config.enabled) {
      return {
        status: 'DISABLED',
        breakoutDirection: 'NONE',
        breakoutLevel: 0,
        currentClose: livePrice,
        breakoutType: 'NONE',
        breakoutDistance_ATR: 0,
        breakoutStrength: 'NONE',
        followThroughStatus: 'NONE',
        retestStatus: 'NONE',
        qualityScore: 0,
        failureRisk: 'NONE',
        warning: 'NONE',
        reason: 'Module 04: False Breakout Detector đang TẮT (Chế độ tạm dừng).',
        isBarClosed: !!isBarClosed,
        timeframe: tf,
        asset,
        timestamp: Date.now(),
        mode: this.config.mode
      };
    }

    // 2. Kiểm tra tính hợp lệ của dữ liệu đầu vào
    if (!bars || !Array.isArray(bars) || bars.length < this.config.minCandleCount) {
      return this._buildUnknownResult(`Dữ liệu nến không đủ (${bars ? bars.length : 0}/${this.config.minCandleCount} nến) để xác định vùng Swing Breakout tin cậy.`, tf, asset, isBarClosed);
    }

    // Clone mảng nến để tránh sửa đổi dữ liệu gốc
    const data = bars.map(b => ({ ...b }));
    const barCount = data.length;
    const targetBar = data[barCount - 1];
    const prevBar = data[barCount - 2];
    const currentPrice = livePrice > 0 ? livePrice : targetBar.close;

    // 3. Tính toán các chỉ báo phụ trợ (ATR & EMA) độc lập
    const atrList = this._calcATR(data, 14);
    if (!atrList || atrList.length === 0) {
      return this._buildUnknownResult('Không thể tính toán ATR(14) từ dữ liệu nến.', tf, asset, isBarClosed);
    }
    const currentATR = atrList[atrList.length - 1].value;
    if (!currentATR || currentATR <= 0 || isNaN(currentATR)) {
      return this._buildUnknownResult('Giá trị ATR bằng 0 hoặc không hợp lệ, không thể chuẩn hóa biến động vùng Breakout.', tf, asset, isBarClosed);
    }

    const ema20List = this._calcEMA(data, 20);
    const ema50List = this._calcEMA(data, 50);
    const e20 = ema20List.length > 0 ? ema20List[ema20List.length - 1].value : currentPrice;
    const e50 = ema50List.length > 0 ? ema50List[ema50List.length - 1].value : currentPrice;

    // Xác định xu hướng bối cảnh MA Wave
    const isUptrendContext = e20 > e50 && currentPrice >= e50;
    const isDowntrendContext = e20 < e50 && currentPrice <= e50;

    // 4. XÁC ĐỊNH VÙNG BREAKOUT (SWING HIGH / SWING LOW ĐÃ XÁC NHẬN)
    // Lưu ý: Tuyệt đối không dùng nến hiện tại hoặc nến sát đuôi để tạo pivot (chống repaint)
    const confirmedBars = data.slice(0, barCount - 1);
    const pivots = this._calcConfirmedPivots(confirmedBars, this.config.pivotLen);
    const swingHighs = pivots.swingHighs;
    const swingLows = pivots.swingLows;

    if (swingHighs.length === 0 && swingLows.length === 0) {
      return {
        status: 'NO_BREAKOUT',
        breakoutDirection: 'NONE',
        breakoutLevel: 0,
        currentClose: +currentPrice.toFixed(2),
        breakoutType: 'NONE',
        breakoutDistance_ATR: 0,
        breakoutStrength: 'NONE',
        followThroughStatus: 'NONE',
        retestStatus: 'NONE',
        qualityScore: 50,
        failureRisk: 'LOW',
        warning: 'NONE',
        reason: 'Chưa hình thành vùng đỉnh/đáy Swing Pivot có ý nghĩa để quan sát phá vỡ.',
        confirmationNote: isBarClosed ? 'Dữ liệu nến đã đóng (Confirmed)' : 'Nến realtime đang chạy',
        objectiveAdvice: 'Thị trường chưa có vùng cản hoặc hỗ trợ Swing xác nhận. Kiên nhẫn theo dõi diễn biến giá.',
        isBarClosed: !!isBarClosed,
        timeframe: tf,
        asset,
        timestamp: Date.now(),
        mode: this.config.mode
      };
    }

    // Lấy Swing High gần nhất (Kháng cự) và Swing Low gần nhất (Hỗ trợ)
    const latestSwingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
    const latestSwingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;

    // Vùng đệm phá vỡ (Buffer Zone)
    const zoneBuffer = currentATR * this.config.zoneWidthATR;

    // 5. PHÂN TÍCH TƯƠNG TÁC CỦA NẾN HIỆN TẠI VỚI VÙNG SWING HIGH (BULLISH BREAKOUT)
    let bullBreakout = null;
    if (latestSwingHigh) {
      const resLevel = latestSwingHigh.price;
      const resZoneTop = resLevel + zoneBuffer;
      const resZoneBottom = resLevel - zoneBuffer;

      const wickPenetrated = targetBar.high > resZoneTop;
      const closeAbove = currentPrice > resZoneTop;
      const closeInside = currentPrice <= resZoneTop;
      const prevCloseAbove = prevBar.close > resZoneTop;

      if (wickPenetrated || closeAbove || prevCloseAbove) {
        bullBreakout = {
          direction: 'BULLISH',
          levelPrice: resLevel,
          zoneTop: resZoneTop,
          zoneBottom: resZoneBottom,
          wickPenetrated,
          closeAbove,
          closeInside,
          prevCloseAbove,
          distance: currentPrice - resLevel,
          distance_ATR: +((currentPrice - resLevel) / currentATR).toFixed(2),
          swingBarIndex: latestSwingHigh.barIndex
        };
      }
    }

    // 6. PHÂN TÍCH TƯƠNG TÁC CỦA NẾN HIỆN TẠI VỚI VÙNG SWING LOW (BEARISH BREAKOUT)
    let bearBreakout = null;
    if (latestSwingLow) {
      const supLevel = latestSwingLow.price;
      const supZoneBottom = supLevel - zoneBuffer;
      const supZoneTop = supLevel + zoneBuffer;

      const wickPenetrated = targetBar.low < supZoneBottom;
      const closeBelow = currentPrice < supZoneBottom;
      const closeInside = currentPrice >= supZoneBottom;
      const prevCloseBelow = prevBar.close < supZoneBottom;

      if (wickPenetrated || closeBelow || prevCloseBelow) {
        bearBreakout = {
          direction: 'BEARISH',
          levelPrice: supLevel,
          zoneTop: supZoneTop,
          zoneBottom: supZoneBottom,
          wickPenetrated,
          closeBelow,
          closeInside,
          prevCloseBelow,
          distance: supLevel - currentPrice,
          distance_ATR: +((supLevel - currentPrice) / currentATR).toFixed(2),
          swingBarIndex: latestSwingLow.barIndex
        };
      }
    }

    // Chọn sự kiện Breakout ưu tiên (nếu có cả 2 thì chọn sự kiện có biên độ đột biến lớn hơn)
    let bo = null;
    if (bullBreakout && bearBreakout) {
      bo = bullBreakout.distance_ATR >= bearBreakout.distance_ATR ? bullBreakout : bearBreakout;
    } else {
      bo = bullBreakout || bearBreakout;
    }

    // Nếu không có hành vi xuyên thủng hoặc nến đóng vượt vùng
    if (!bo) {
      return {
        status: 'NO_BREAKOUT',
        breakoutDirection: 'NONE',
        breakoutLevel: latestSwingHigh ? +latestSwingHigh.price.toFixed(2) : (latestSwingLow ? +latestSwingLow.price.toFixed(2) : 0),
        currentClose: +currentPrice.toFixed(2),
        breakoutType: 'NONE',
        breakoutDistance_ATR: 0,
        breakoutStrength: 'NONE',
        followThroughStatus: 'NONE',
        retestStatus: 'NONE',
        qualityScore: 50,
        failureRisk: 'LOW',
        warning: 'NONE',
        reason: 'Giá đang dao động bên trong biên độ an toàn giữa Kháng cự và Hỗ trợ Swing.',
        confirmationNote: isBarClosed ? 'Dữ liệu nến đã đóng (Confirmed)' : 'Nến realtime đang chạy',
        objectiveAdvice: 'Chưa có hành vi phá vỡ cản hay hỗ trợ. Theo dõi phản ứng khi giá tiếp cận biên.',
        isBarClosed: !!isBarClosed,
        timeframe: tf,
        asset,
        timestamp: Date.now(),
        mode: this.config.mode
      };
    }

    // 7. ĐÁNH GIÁ CHI TIẾT SỰ KIỆN BREAKOUT ĐÃ CHỌN
    const direction = bo.direction; // 'BULLISH' | 'BEARISH'
    const levelPrice = +bo.levelPrice.toFixed(2);
    const distance_ATR = bo.distance_ATR;

    // A. Phân tích loại Breakout (Wick vs Close)
    let breakoutType = 'NONE';
    const candleRange = Math.max(0.01, targetBar.high - targetBar.low);
    const bodySize = Math.abs(targetBar.close - targetBar.open);
    const bodyRatio = +(bodySize / candleRange).toFixed(2); // Tỷ lệ thân nến (0.00 - 1.00)

    // B. Đánh giá Sức Mạnh Phá Vỡ (Breakout Strength)
    let breakoutStrength = 'MODERATE';
    let strengthScore = 20;

    if (direction === 'BULLISH') {
      const upperWick = targetBar.high - Math.max(targetBar.open, targetBar.close);
      const isLargeUpperWick = upperWick > candleRange * 0.45;

      if (bo.wickPenetrated && bo.closeInside) {
        breakoutType = 'WICK_BREAKOUT';
      } else if (bo.closeAbove) {
        breakoutType = 'CLOSE_BREAKOUT';
      }

      if (breakoutType === 'CLOSE_BREAKOUT') {
        if (bodyRatio >= 0.60 && distance_ATR >= 0.5 && !isLargeUpperWick) {
          breakoutStrength = 'STRONG';
          strengthScore = 30;
        } else if (bodyRatio < 0.35 || isLargeUpperWick || distance_ATR < 0.20) {
          breakoutStrength = 'WEAK';
          strengthScore = 10;
        } else {
          breakoutStrength = 'MODERATE';
          strengthScore = 20;
        }
      }
    } else { // BEARISH
      const lowerWick = Math.min(targetBar.open, targetBar.close) - targetBar.low;
      const isLargeLowerWick = lowerWick > candleRange * 0.45;

      if (bo.wickPenetrated && bo.closeInside) {
        breakoutType = 'WICK_BREAKOUT';
      } else if (bo.closeBelow) {
        breakoutType = 'CLOSE_BREAKOUT';
      }

      if (breakoutType === 'CLOSE_BREAKOUT') {
        if (bodyRatio >= 0.60 && distance_ATR >= 0.5 && !isLargeLowerWick) {
          breakoutStrength = 'STRONG';
          strengthScore = 30;
        } else if (bodyRatio < 0.35 || isLargeLowerWick || distance_ATR < 0.20) {
          breakoutStrength = 'WEAK';
          strengthScore = 10;
        } else {
          breakoutStrength = 'MODERATE';
          strengthScore = 20;
        }
      }
    }

    // C. Đánh giá Follow-through & Retest (Nhìn lại 1-3 nến trước)
    let followThroughStatus = 'NONE';
    let retestStatus = 'NONE';
    let isFailedConfirmed = false;
    let isFailedWarning = false;

    if (direction === 'BULLISH') {
      // Trường hợp 1: Nến trước đã đóng nến vượt cản (Close Breakout), nhưng nến hiện tại rơi trở lại range
      if (bo.prevCloseAbove && bo.closeInside) {
        isFailedConfirmed = true;
      }
      // Trường hợp 2: Breakout giả bằng râu nến (Wick Breakout / Bull Trap)
      else if (breakoutType === 'WICK_BREAKOUT') {
        isFailedWarning = true;
      }
      // Trường hợp 3: Nến hiện tại duy trì trên vùng breakout
      else if (bo.closeAbove) {
        // Chỉ xét Retest / Follow-through khi nến TRƯỚC ĐÓ đã đóng cửa breakout
        if (bo.prevCloseAbove) {
          if (targetBar.low < bo.zoneBottom) {
            retestStatus = 'RETEST_FAILED';
            isFailedWarning = true;
          } else if (targetBar.low <= bo.zoneTop && currentPrice > bo.zoneTop) {
            retestStatus = 'RETEST_HOLDING';
          } else if (currentPrice > prevBar.high) {
            followThroughStatus = 'EXPANDING';
          } else {
            followThroughStatus = 'MAINTAINED';
          }
        } else {
          // Nến hiện tại là nến bứt phá đầu tiên
          followThroughStatus = 'INITIAL_BREAK';
        }
      }
    } else { // BEARISH
      // Trường hợp 1: Nến trước đã phá hỗ trợ, nhưng nến hiện tại bật ngược lại vào trong range
      if (bo.prevCloseBelow && bo.closeInside) {
        isFailedConfirmed = true;
      }
      // Trường hợp 2: Breakout giả bằng râu nến (Bear Trap)
      else if (breakoutType === 'WICK_BREAKOUT') {
        isFailedWarning = true;
      }
      // Trường hợp 3: Nến hiện tại duy trì dưới vùng hỗ trợ
      else if (bo.closeBelow) {
        // Chỉ xét Retest / Follow-through khi nến TRƯỚC ĐÓ đã đóng cửa breakout
        if (bo.prevCloseBelow) {
          if (targetBar.high > bo.zoneTop) {
            retestStatus = 'RETEST_FAILED';
            isFailedWarning = true;
          } else if (targetBar.high >= bo.zoneBottom && currentPrice < bo.zoneBottom) {
            retestStatus = 'RETEST_HOLDING';
          } else if (currentPrice < prevBar.low) {
            followThroughStatus = 'EXPANDING';
          } else {
            followThroughStatus = 'MAINTAINED';
          }
        } else {
          followThroughStatus = 'INITIAL_BREAK';
        }
      }
    }

    // D. Phân loại Trạng Thái Tổng Hợp (Status Mapping)
    let status = 'NO_BREAKOUT';
    let warning = 'NONE';
    let failureRisk = 'LOW';
    let reason = '';

    if (!isBarClosed && breakoutType === 'CLOSE_BREAKOUT' && !bo.prevCloseAbove && !bo.prevCloseBelow) {
      status = 'BREAKOUT_PENDING';
      warning = direction === 'BULLISH' ? 'BULLISH_BREAKOUT_CONFIRMED' : 'BEARISH_BREAKOUT_CONFIRMED';
      failureRisk = 'MODERATE';
      reason = `Giá đang vượt vùng ${direction === 'BULLISH' ? 'Kháng cự' : 'Hỗ trợ'} ($${levelPrice}) trên nến realtime. Cần chờ nến đóng để xác nhận Breakout.`;
    } else if (isFailedConfirmed) {
      status = 'FAILED_BREAKOUT_CONFIRMED';
      warning = direction === 'BULLISH' ? 'FAILED_BULLISH_BREAKOUT' : 'FAILED_BEARISH_BREAKOUT';
      failureRisk = 'HIGH';
      reason = `BẪY PHÁ VỠ XÁC NHẬN (${direction === 'BULLISH' ? 'Bull Trap' : 'Bear Trap'}): Giá đã quay trở lại đóng nến bên trong vùng range ($${levelPrice}).`;
    } else if (breakoutType === 'WICK_BREAKOUT') {
      status = 'WICK_BREAKOUT';
      warning = direction === 'BULLISH' ? 'BULLISH_WICK_BREAKOUT' : 'BEARISH_WICK_BREAKOUT';
      failureRisk = 'HIGH';
      reason = `TỪ CHỐI BẰNG RÂU NẾN: Giá quét qua $${levelPrice} nhưng đóng cửa rút chân trở lại bên trong vùng range.`;
    } else if (retestStatus === 'RETEST_HOLDING') {
      status = 'BREAKOUT_RETEST';
      warning = 'BREAKOUT_RETEST_WARNING';
      failureRisk = 'MODERATE';
      reason = `KIỂM TRA LẠI (Retest): Giá đang kiểm tra lại mức phá vỡ $${levelPrice} và tạm thời giữ vững hỗ trợ/kháng cự mới.`;
    } else if (isFailedWarning || retestStatus === 'RETEST_FAILED' || breakoutStrength === 'WEAK') {
      status = 'FAILED_BREAKOUT_WARNING';
      warning = 'BREAKOUT_WEAKNESS';
      failureRisk = 'ELEVATED';
      reason = `CẢNH BÁO BREAKOUT SUY YẾU: Lực phá vỡ thiếu sự dứt khoát, thân nến nhỏ hoặc xuất hiện áp lực từ chối giá ngược chiều.`;
    } else if (followThroughStatus === 'EXPANDING') {
      status = 'BREAKOUT_FOLLOW_THROUGH';
      warning = direction === 'BULLISH' ? 'BULLISH_BREAKOUT_CONFIRMED' : 'BEARISH_BREAKOUT_CONFIRMED';
      failureRisk = 'LOW';
      reason = `ĐÀ TIẾP DIỄN MẠNH MẼ: Giá tiếp tục mở rộng đà bứt phá theo hướng ${direction} sau khi phá vỡ mức $${levelPrice}.`;
    } else if (breakoutType === 'CLOSE_BREAKOUT') {
      status = 'CONFIRMED_BREAKOUT';
      warning = direction === 'BULLISH' ? 'BULLISH_BREAKOUT_CONFIRMED' : 'BEARISH_BREAKOUT_CONFIRMED';
      failureRisk = 'LOW';
      reason = `PHÁ VỠ XÁC NHẬN: Nến đã đóng cửa dứt khoát vượt mức $${levelPrice} (+${distance_ATR}x ATR).`;
    }

    // E. Đánh giá Bối cảnh Xu Hướng (Counter-trend Breakout Risk)
    const isCounterTrend = (direction === 'BULLISH' && isDowntrendContext) || (direction === 'BEARISH' && isUptrendContext);
    if (isCounterTrend && status !== 'FAILED_BREAKOUT_CONFIRMED' && status !== 'WICK_BREAKOUT') {
      failureRisk = 'ELEVATED';
      reason += ' LƯU Ý: Phá vỡ đi ngược xu hướng chính của dải MA Wave, rủi ro thất bại cao hơn bình thường.';
    }

    // F. Tính Toán Breakout Quality Score (0 - 100 điểm)
    // Công thức minh bạch:
    // 1. Distance & Clearance (Max 25đ)
    // 2. Candle Body Ratio (Max 25đ)
    // 3. Trend Alignment (Max 20đ)
    // 4. Strength Status (Max 15đ)
    // 5. Follow-through / Retest (Max 15đ)
    let score = 0;
    score += Math.min(25, Math.max(0, distance_ATR * 25)); // 1.0x ATR = 25đ
    score += Math.round(bodyRatio * 25);                   // Thân nến 80% = 20đ
    score += isCounterTrend ? 5 : 20;                      // Thuận trend = 20đ
    score += strengthScore / 2;                            // 5đ - 15đ
    score += (followThroughStatus === 'EXPANDING' ? 15 : followThroughStatus === 'MAINTAINED' ? 10 : retestStatus === 'RETEST_HOLDING' ? 10 : 0);

    if (breakoutType === 'WICK_BREAKOUT' || isFailedConfirmed) {
      score = Math.min(25, score * 0.3); // Giảm mạnh điểm nếu là bẫy giá
    }
    const qualityScore = Math.min(100, Math.max(0, Math.round(score)));

    // G. Lời Khuyên Khách Quan (Objective Advice)
    let objectiveAdvice = '';
    if (status === 'WICK_BREAKOUT' || status === 'FAILED_BREAKOUT_CONFIRMED') {
      objectiveAdvice = 'BẪY PHÁ VỠ (False Breakout): Tuyệt đối không FOMO mua/bán đuổi khi giá bị từ chối rút chân. Chờ đợi phản ứng tích lũy lại.';
    } else if (status === 'FAILED_BREAKOUT_WARNING') {
      objectiveAdvice = 'RỦI RO THẤT BẠI: Lực breakout chưa đủ tin cậy. Kiên nhẫn quan sát nến đóng tiếp theo xem giá có giữ được ngoài vùng cản hay không.';
    } else if (status === 'CONFIRMED_BREAKOUT' || status === 'BREAKOUT_FOLLOW_THROUGH') {
      objectiveAdvice = 'Breakout đã được nến đóng xác nhận. Cần chú ý quản lý vốn chặt chẽ, không loại trừ khả năng thị trường quay lại retest.';
    } else {
      objectiveAdvice = 'Theo dõi hành động giá quanh các mốc then chốt. Luôn chờ nến đóng cửa để có quyết định khách quan.';
    }

    const confirmationNote = isBarClosed
      ? 'Dữ liệu nến đã đóng — Trạng thái đã được xác nhận (Confirmed).'
      : 'Cảnh báo realtime trên nến đang chạy — Có thể thay đổi khi nến đóng.';

    return {
      status,                     // 'NO_BREAKOUT' | 'WICK_BREAKOUT' | 'BREAKOUT_PENDING' | 'CONFIRMED_BREAKOUT' | 'BREAKOUT_FOLLOW_THROUGH' | 'BREAKOUT_RETEST' | 'FAILED_BREAKOUT_WARNING' | 'FAILED_BREAKOUT_CONFIRMED' | 'UNKNOWN'
      breakoutDirection: direction,// 'BULLISH' | 'BEARISH' | 'NONE'
      breakoutLevel: levelPrice,  // Mức giá Swing tham chiếu
      currentClose: +currentPrice.toFixed(2),
      breakoutType,               // 'WICK_BREAKOUT' | 'CLOSE_BREAKOUT' | 'NONE'
      breakoutDistance_ATR: distance_ATR,
      breakoutStrength,           // 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'
      followThroughStatus,        // 'EXPANDING' | 'MAINTAINED' | 'WEAK' | 'NONE'
      retestStatus,               // 'RETEST_HOLDING' | 'RETEST_FAILED' | 'NONE'
      qualityScore,               // Điểm chất lượng Breakout (0 - 100)
      failureRisk,                // 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH'
      warning,                    // Enum cảnh báo riêng
      reason,
      confirmationNote,
      objectiveAdvice,
      factors: {
        bodyRatio,
        distance_ATR,
        isCounterTrend,
        isUptrendContext,
        isDowntrendContext,
        zoneBuffer: +zoneBuffer.toFixed(2)
      },
      isBarClosed: !!isBarClosed,
      timeframe: tf,
      asset,
      timestamp: Date.now(),
      mode: this.config.mode
    };
  }

  /**
   * Helper tạo kết quả an toàn UNKNOWN khi thiếu dữ liệu
   */
  _buildUnknownResult(reason, tf, asset, isBarClosed) {
    return {
      status: 'UNKNOWN',
      breakoutDirection: 'NONE',
      breakoutLevel: 0,
      currentClose: 0,
      breakoutType: 'NONE',
      breakoutDistance_ATR: 0,
      breakoutStrength: 'NONE',
      followThroughStatus: 'NONE',
      retestStatus: 'NONE',
      qualityScore: 0,
      failureRisk: 'UNKNOWN',
      warning: 'NONE',
      reason,
      confirmationNote: isBarClosed ? 'Dữ liệu nến đã đóng' : 'Nến realtime',
      objectiveAdvice: 'Hệ thống đang thu thập thêm dữ liệu nến đồng bộ. Giữ nguyên trạng thái quan sát.',
      factors: null,
      isBarClosed: !!isBarClosed,
      timeframe: tf,
      asset,
      timestamp: Date.now(),
      mode: this.config.mode
    };
  }

  /**
   * Tính toán EMA độc lập
   */
  _calcEMA(data, period) {
    if (!data || data.length < period) return [];
    const k = 2 / (period + 1);
    let ema = 0;
    for (let i = 0; i < period; i++) ema += data[i].close;
    ema /= period;

    const res = [{ time: data[period - 1].time, value: +ema.toFixed(3) }];
    for (let i = period; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
      res.push({ time: data[i].time, value: +ema.toFixed(3) });
    }
    return res;
  }

  /**
   * Tính toán ATR(period) độc lập
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
   * Tính toán Pivot Swing Highs / Swing Lows đã xác nhận (Confirmed Pivots)
   * Chống Repaint: Chỉ những nến có đủ `len` nến bên phải thấp hơn (với High) hoặc cao hơn (với Low)
   * mới được ghi nhận là Pivot chính thức.
   */
  _calcConfirmedPivots(data, len = 3) {
    const swingHighs = [];
    const swingLows = [];
    if (!data || data.length < len * 2 + 1) return { swingHighs, swingLows };

    // Giới hạn tìm kiếm chỉ đến `data.length - len - 1` để đảm bảo nến Pivot đã được xác nhận đóng
    for (let i = len; i <= data.length - 1 - len; i++) {
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= len; j++) {
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
  window.FalseBreakoutDetector = FalseBreakoutDetector;
  window.falseBreakoutDetector = new FalseBreakoutDetector();
}

// Export cho Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FalseBreakoutDetector };
}

/**
 * MA WAVE V8 PRO — MODULE 01: OVEREXTENDED DETECTOR
 * ===================================================
 * Module độc lập phát hiện khi giá chạy quá xa EMA20 / EMA50,
 * cảnh báo nguy cơ BUY đuổi ở vùng giá cao (Late Buy Risk)
 * hoặc SELL đuổi ở vùng giá thấp (Late Sell Risk).
 *
 * NGUYÊN TẮC BẮT BUỘC:
 * 1. Độc lập 100%, chỉ đọc dữ liệu (Read-Only Observer).
 * 2. Mặc định chế độ OBSERVE_ONLY.
 * 3. Tuyệt đối KHÔNG can thiệp, trì hoãn hoặc sửa đổi tín hiệu Legacy Core V8.
 * 4. Không phán đoán chắc chắn thị trường đảo chiều.
 * 5. Xử lý an toàn khi thiếu dữ liệu hoặc ATR = 0.
 */

class OverextendedDetector {
  constructor(customConfig = {}) {
    this.config = {
      enabled: true,
      mode: 'OBSERVE_ONLY', // Luôn mặc định OBSERVE_ONLY
      // Các ngưỡng chuẩn hóa theo bội số ATR (có thể cấu hình độc lập)
      thresholds: {
        extendedEMA20_ATR: 2.0,        // Vượt 2.0x ATR so với EMA20 -> EXTENDED
        highlyExtendedEMA20_ATR: 3.2,  // Vượt 3.2x ATR so với EMA20 -> HIGHLY_EXTENDED
        extendedEMA50_ATR: 3.5,        // Vượt 3.5x ATR so với EMA50 -> EXTENDED
        highlyExtendedEMA50_ATR: 5.0   // Vượt 5.0x ATR so với EMA50 -> HIGHLY_EXTENDED
      },
      ...customConfig
    };

    this.lastAnalysis = null;
  }

  /**
   * Cập nhật cấu hình module tại runtime
   */
  configure(newConfig = {}) {
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
   * Phân tích độ dãn giá (Overextension Analysis)
   * @param {Array} bars - Mảng nến OHLC [{ time, open, high, low, close }]
   * @param {Object} options - { timeframe, isBarClosed, asset, livePrice }
   * @returns {Object} Kết quả phân tích chi tiết
   */
  analyze(bars, options = {}) {
    if (!this.config.enabled) {
      return {
        status: 'DISABLED',
        risk: 'NONE',
        reason: 'Module Overextended Detector đang tạm tắt.',
        timestamp: Date.now()
      };
    }

    const tf = options.timeframe || '15m';
    const isBarClosed = options.isBarClosed !== undefined ? options.isBarClosed : false;
    const asset = (options.asset || 'XAU').toUpperCase();

    // 1. KIỂM TRA DỮ LIỆU ĐẦU VÀO
    if (!bars || !Array.isArray(bars) || bars.length < 50) {
      return this._buildUnknownResult('Thiếu dữ liệu nến (cần tối thiểu 50 nến để tính EMA50 & ATR14).', tf, asset, isBarClosed);
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
      // Tận dụng Indicators hoặc V8Engine có sẵn trên window, nếu không có thì tự tính chuẩn xác
      const ema20List = this._calcEMA(bars, 20);
      const ema50List = this._calcEMA(bars, 50);
      const atrList = this._calcATR(bars, 14);

      if (!ema20List || ema20List.length < 2 || !ema50List || ema50List.length < 2 || !atrList || atrList.length === 0) {
        return this._buildUnknownResult('Không thể tính toán EMA20/EMA50 hoặc ATR.', tf, asset, isBarClosed);
      }

      const currentEMA20 = ema20List[ema20List.length - 1].value;
      const prevEMA20 = ema20List[ema20List.length - 2].value;

      const currentEMA50 = ema50List[ema50List.length - 1].value;
      const prevEMA50 = ema50List[ema50List.length - 2].value;

      const currentATR = atrList[atrList.length - 1].value;

      // Kiểm tra tính hợp lệ của ATR (phòng ngừa chia cho 0)
      if (!currentATR || isNaN(currentATR) || currentATR <= 0) {
        return this._buildUnknownResult('Giá trị ATR bằng 0 hoặc không hợp lệ, không thể chuẩn hóa khoảng cách.', tf, asset, isBarClosed);
      }

      // 3. TÍNH TOÁN KHOẢNG CÁCH TUYỆT ĐỐI & CHUẨN HÓA THEO ATR
      const rawDistanceEMA20 = currentPrice - currentEMA20; // Dương: trên EMA20, Âm: dưới EMA20
      const absDistanceEMA20 = Math.abs(rawDistanceEMA20);

      const rawDistanceEMA50 = currentPrice - currentEMA50; // Dương: trên EMA50, Âm: dưới EMA50
      const absDistanceEMA50 = Math.abs(rawDistanceEMA50);

      const emaSpread = currentEMA20 - currentEMA50;
      const absSpread = Math.abs(emaSpread);

      // Chuẩn hóa khoảng cách theo ATR
      const distanceEMA20_ATR = +(absDistanceEMA20 / currentATR).toFixed(2);
      const distanceEMA50_ATR = +(absDistanceEMA50 / currentATR).toFixed(2);
      const spread_ATR = +(absSpread / currentATR).toFixed(2);

      // 4. XÁC ĐỊNH VỊ TRÍ, ĐỘ DỐC VÀ HƯỚNG MA
      const priceVsEMA20 = rawDistanceEMA20 > 0 ? 'ABOVE' : rawDistanceEMA20 < 0 ? 'BELOW' : 'AT';
      const priceVsEMA50 = rawDistanceEMA50 > 0 ? 'ABOVE' : rawDistanceEMA50 < 0 ? 'BELOW' : 'AT';

      const ema20SlopeRaw = currentEMA20 - prevEMA20;
      const ema50SlopeRaw = currentEMA50 - prevEMA50;

      const minSlopeThreshold = 0.001;
      const ema20Direction = ema20SlopeRaw > minSlopeThreshold ? 'UP' : ema20SlopeRaw < -minSlopeThreshold ? 'DOWN' : 'FLAT';
      const ema50Direction = ema50SlopeRaw > minSlopeThreshold ? 'UP' : ema50SlopeRaw < -minSlopeThreshold ? 'DOWN' : 'FLAT';

      // Biến động nến gần nhất
      const recentPriceChange = targetBar.close - prevBar.close;
      const recentCandleBody = Math.abs(targetBar.close - targetBar.open);

      // 5. PHÂN LOẠI TRẠNG THÁI (STATUS CLASSIFICATION)
      const th = this.config.thresholds;
      let status = 'NORMAL';

      const isEMA20Extended = distanceEMA20_ATR >= th.extendedEMA20_ATR;
      const isEMA20HighlyExtended = distanceEMA20_ATR >= th.highlyExtendedEMA20_ATR;
      const isEMA50HighlyExtended = distanceEMA50_ATR >= th.highlyExtendedEMA50_ATR;

      if (isEMA20HighlyExtended || (isEMA20Extended && isEMA50HighlyExtended)) {
        status = 'HIGHLY_EXTENDED';
      } else if (isEMA20Extended) {
        status = 'EXTENDED';
      } else {
        status = 'NORMAL';
      }

      // 6. PHÂN BIỆT NGUY CƠ (RISK CLASSIFICATION)
      let risk = 'NONE';
      let reason = '';

      if (status === 'HIGHLY_EXTENDED' || status === 'EXTENDED') {
        if (priceVsEMA20 === 'ABOVE') {
          risk = 'LATE_BUY_RISK';
          reason = `Giá tăng dãn cách xa dải MA (${distanceEMA20_ATR}x ATR so với EMA20; ${distanceEMA50_ATR}x ATR so với EMA50). Nguy cơ BUY đuổi ở vùng giá cao (Late Buy Risk).`;
        } else if (priceVsEMA20 === 'BELOW') {
          risk = 'LATE_SELL_RISK';
          reason = `Giá giảm dãn cách xa dải MA (${distanceEMA20_ATR}x ATR so với EMA20; ${distanceEMA50_ATR}x ATR so với EMA50). Nguy cơ SELL đuổi ở vùng giá thấp (Late Sell Risk).`;
        }
      } else {
        risk = 'NONE';
        reason = `Khoảng cách giá tới EMA20 (${distanceEMA20_ATR}x ATR) và EMA50 (${distanceEMA50_ATR}x ATR) nằm trong vùng dao động thông thường.`;
      }

      // Ghi chú quan trọng về nến đang chạy vs nến đã đóng
      const confirmationNote = isBarClosed
        ? 'Dữ liệu nến đã đóng — Trạng thái đã được xác nhận (Confirmed).'
        : 'Cảnh báo realtime theo nến đang hình thành — Có thể thay đổi khi nến đóng.';

      // Lời khuyên khách quan (không phán quyết chắc chắn đảo chiều)
      const objectiveAdvice = (status === 'NORMAL')
        ? 'Vùng giá dao động cân bằng tương đối quanh dải trung bình động.'
        : 'LƯU Ý: Giá dãn xa MA phản ánh quán tính mạnh hoặc quá đà ngắn hạn, KHÔNG đồng nghĩa xu hướng chắc chắn sẽ đảo chiều ngay. Nên kiên nhẫn chờ nhịp hồi phục (pullback) về sát EMA thay vì vào lệnh theo cảm xúc.';

      const result = {
        status, // 'NORMAL' | 'EXTENDED' | 'HIGHLY_EXTENDED' | 'UNKNOWN'
        risk,   // 'LATE_BUY_RISK' | 'LATE_SELL_RISK' | 'NONE'
        price: +currentPrice.toFixed(2),
        ema20: +currentEMA20.toFixed(2),
        ema50: +currentEMA50.toFixed(2),
        atr: +currentATR.toFixed(2),
        distanceEMA20: +rawDistanceEMA20.toFixed(2),
        distanceEMA50: +rawDistanceEMA50.toFixed(2),
        distanceEMA20_ATR,
        distanceEMA50_ATR,
        spread: +emaSpread.toFixed(2),
        spread_ATR,
        priceVsEMA20,
        priceVsEMA50,
        ema20Direction,
        ema50Direction,
        ema20Slope: +ema20SlopeRaw.toFixed(4),
        ema50Slope: +ema50SlopeRaw.toFixed(4),
        recentPriceChange: +recentPriceChange.toFixed(2),
        recentCandleBody: +recentCandleBody.toFixed(2),
        isBarClosed: !!isBarClosed,
        timeframe: tf,
        asset,
        reason,
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
      risk: 'NONE',
      price: null,
      ema20: null,
      ema50: null,
      atr: null,
      distanceEMA20: null,
      distanceEMA50: null,
      distanceEMA20_ATR: 0,
      distanceEMA50_ATR: 0,
      spread: null,
      spread_ATR: 0,
      priceVsEMA20: 'UNKNOWN',
      priceVsEMA50: 'UNKNOWN',
      ema20Direction: 'FLAT',
      ema50Direction: 'FLAT',
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
   * Hàm tính toán EMA độc lập (sử dụng close của OHLC)
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
}

// Khởi tạo Singleton Instance sẵn sàng cho Web Client
if (typeof window !== 'undefined') {
  window.OverextendedDetector = OverextendedDetector;
  window.overextendedDetector = new OverextendedDetector();
}

// Export cho Node.js testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OverextendedDetector };
}

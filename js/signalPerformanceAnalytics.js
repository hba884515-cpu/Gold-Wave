/**
 * ============================================================================
 * MODULE 06: SIGNAL PERFORMANCE ANALYTICS CHO MA WAVE V8 PRO WEB
 * ============================================================================
 * 
 * Mục tiêu:
 * - Hệ thống thống kê và đánh giá hiệu suất tín hiệu BUY/SELL của MA WAVE
 *   bằng dữ liệu lịch sử thực tế.
 * - Phân tích khách quan:
 *   + Tổng số tín hiệu BUY / SELL, Open / Closed.
 *   + Kết quả: TP1, TP2, TP3, SL, Break-Even, Expired, Ambiguous.
 *   + Win Rate (mẫu số chuẩn hóa, minh bạch).
 *   + Profit Factor & Expectancy (dựa trên chuỗi PnL thực tế).
 *   + Drawdown Peak-to-Trough theo PnL tích lũy.
 *   + Phân tích hiệu suất theo Khung Giờ (Timeframe), Phiên Giao Dịch (Session),
 *     Market Regime và So sánh BUY vs SELL.
 *   + Đánh giá chất lượng dữ liệu (Data Integrity: VERIFIED, PARTIAL, INSUFFICIENT DATA).
 * 
 * Nguyên tắc an toàn:
 * 1. 100% READ-ONLY OBSERVER (Mặc định OBSERVE_ONLY).
 * 2. Tuyệt đối KHÔNG can thiệp, trì hoãn hoặc sửa đổi tín hiệu BUY/SELL của Legacy Core V8.
 * 3. Không tạo dữ liệu giả hoặc tự suy diễn PnL/kết quả khi thiếu dữ liệu.
 * 4. Phân biệt rõ ràng giữa N/A và 0; không hiển thị 0% khi thiếu mẫu số.
 * 5. Tách biệt Signal Performance (thống kê tín hiệu) với Execution Performance (lệnh broker).
 */

class SignalPerformanceAnalytics {
  constructor(config = {}) {
    this.config = {
      mode: 'OBSERVE_ONLY',
      enabled: true,
      timezone: 'Asia/Ho_Chi_Minh',
      defaultTimeframe: '15m',
      ...config
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
   * Xác định Phiên giao dịch (Session) theo giờ GMT+7 của timestamp
   * - Asia (Phiên Á): 06:00 - 14:00 GMT+7
   * - London (Phiên Âu): 14:00 - 21:00 GMT+7
   * - New York (Phiên Mỹ): 19:00 - 04:00 sáng hôm sau GMT+7
   * - Overlap (Âu - Mỹ giao thoa sôi động nhất): 19:00 - 22:00 GMT+7
   */
  parseSession(timestamp) {
    if (!timestamp || isNaN(timestamp)) return 'UNKNOWN';
    const date = new Date(timestamp * 1000);
    // Tính giờ tại múi giờ GMT+7
    const vnHour = (date.getUTCHours() + 7) % 24;

    if (vnHour >= 19 && vnHour < 22) {
      return 'OVERLAP'; // Giao thoa London - New York
    } else if (vnHour >= 14 && vnHour < 21) {
      return 'LONDON';
    } else if (vnHour >= 6 && vnHour < 14) {
      return 'ASIA';
    } else {
      return 'NEW_YORK';
    }
  }

  /**
   * Phân loại kết quả chi tiết của 1 tín hiệu
   */
  classifyOutcome(signal) {
    if (!signal || typeof signal !== 'object') {
      return {
        outcome: 'UNKNOWN',
        isWin: false,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: false,
        pnlPips: 0,
        pnlUsd: 0
      };
    }

    const status = String(signal.status || '').toUpperCase();
    const hitTp1 = !!signal.hitTp1;
    const hitTp2 = !!signal.hitTp2;
    const hitTp3 = !!signal.hitTp3;
    const pnlPips = typeof signal.pnlPips === 'number' ? signal.pnlPips : 0;
    const pnlUsd = typeof signal.pnlUsd === 'number' ? signal.pnlUsd : 0;

    // 1. Kiểm tra trường hợp Ambiguous (Nến chạm cả TP và SL cùng lúc mà không có tick data)
    if (signal.isAmbiguous || (signal.hitTp && signal.hitSl && !signal.firstHit)) {
      return {
        outcome: 'AMBIGUOUS',
        isWin: false,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: true,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 2. Lệnh đang chạy (OPEN / RUNNING)
    if (status.includes('ĐANG CHẠY') || status.includes('RUNNING') || status.includes('CHỜ TP') || status === 'OPEN') {
      return {
        outcome: 'OPEN',
        isWin: false,
        isLoss: false,
        isBE: false,
        isOpen: true,
        isAmbiguous: false,
        isClosed: false,
        pnlPips,
        pnlUsd
      };
    }

    // 3. Lệnh đạt TP3 (Trọn Sóng)
    if (hitTp3 || status.includes('TP3') || signal.winType === 'TP3') {
      return {
        outcome: 'TP3_HIT',
        isWin: true,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 4. Lệnh đạt TP2
    if (hitTp2 || status.includes('TP2') || signal.winType === 'TP2') {
      return {
        outcome: 'TP2_HIT',
        isWin: true,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 5. Lệnh đạt TP1
    if (hitTp1 || status.includes('TP1') || status.includes('CHỐT LÃI') || signal.winType === 'TP1') {
      return {
        outcome: 'TP1_HIT',
        isWin: true,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 6. Hòa Vốn (Break Even)
    if (status.includes('HÒA VỐN') || status.includes('BREAK_EVEN') || (status.includes('SL DƯƠNG') && pnlPips === 0)) {
      return {
        outcome: 'BREAK_EVEN',
        isWin: false,
        isLoss: false,
        isBE: true,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips: 0,
        pnlUsd: 0
      };
    }

    // 7. Cắt Lỗ (SL HIT)
    if (status.includes('CẮT LỖ') || status.includes('SL_HIT') || (status.includes('SL') && !status.includes('SL DƯƠNG')) || pnlPips < 0) {
      return {
        outcome: 'SL_HIT',
        isWin: false,
        isLoss: true,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 8. Đóng phiên cuối tuần / Hết hạn (EXPIRED / CLOSED_WEEKEND)
    if (status.includes('ĐÓNG PHIÊN CUỐI TUẦN') || status.includes('EXPIRED')) {
      const isWin = pnlPips > 0;
      const isLoss = pnlPips < 0;
      return {
        outcome: 'EXPIRED',
        isWin,
        isLoss,
        isBE: pnlPips === 0,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    // 9. Bị Hủy (CANCELLED)
    if (status.includes('HỦY') || status.includes('CANCEL')) {
      return {
        outcome: 'CANCELLED',
        isWin: false,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips: 0,
        pnlUsd: 0
      };
    }

    // 10. Mặc định dựa trên PnL nếu có
    if (pnlPips > 0 || pnlUsd > 0) {
      return {
        outcome: 'TP1_HIT',
        isWin: true,
        isLoss: false,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    } else if (pnlPips < 0 || pnlUsd < 0) {
      return {
        outcome: 'SL_HIT',
        isWin: false,
        isLoss: true,
        isBE: false,
        isOpen: false,
        isAmbiguous: false,
        isClosed: true,
        pnlPips,
        pnlUsd
      };
    }

    return {
      outcome: 'UNKNOWN',
      isWin: false,
      isLoss: false,
      isBE: false,
      isOpen: false,
      isAmbiguous: false,
      isClosed: false,
      pnlPips,
      pnlUsd
    };
  }

  /**
   * Lọc danh sách tín hiệu theo các tiêu chí đa chiều
   */
  filterSignals(signals, filterOpts = {}) {
    if (!Array.isArray(signals)) return [];

    const nowSec = Math.floor(Date.now() / 1000);
    const dateRange = filterOpts.dateRange || 'all';
    const asset = (filterOpts.asset || 'all').toLowerCase();
    const type = (filterOpts.type || 'all').toUpperCase();
    const timeframe = (filterOpts.timeframe || 'all').toLowerCase();
    const session = (filterOpts.session || 'all').toUpperCase();
    const regime = (filterOpts.regime || 'all').toUpperCase();
    const resultFilter = (filterOpts.result || 'all').toUpperCase();

    // Mốc thời gian lọc
    let cutoffSec = 0;
    let cutoffEndSec = 0;

    if (dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoffSec = Math.floor(today.getTime() / 1000);
    } else if (dateRange === '7d') {
      cutoffSec = nowSec - (7 * 86400);
    } else if (dateRange === '30d') {
      cutoffSec = nowSec - (30 * 86400);
    } else if (dateRange === '90d') {
      cutoffSec = nowSec - (90 * 86400);
    } else if (dateRange === 'custom' && filterOpts.startDate) {
      const start = new Date(filterOpts.startDate);
      start.setHours(0, 0, 0, 0);
      cutoffSec = Math.floor(start.getTime() / 1000);
      if (filterOpts.endDate) {
        const end = new Date(filterOpts.endDate);
        end.setHours(23, 59, 59, 999);
        cutoffEndSec = Math.floor(end.getTime() / 1000);
      }
    }

    return signals.filter(s => {
      if (!s) return false;

      // 1. Lọc Thời Gian
      if (cutoffSec > 0 && s.timestamp && s.timestamp < cutoffSec) return false;
      if (cutoffEndSec > 0 && s.timestamp && s.timestamp > cutoffEndSec) return false;

      // 2. Lọc Asset
      if (asset !== 'all') {
        const sigAsset = (s.asset || (s.pair ? s.pair.slice(0, 3) : 'xau')).toLowerCase();
        if (sigAsset !== asset && !String(s.pair || '').toLowerCase().includes(asset)) {
          return false;
        }
      }

      // 3. Lọc Type (BUY / SELL)
      if (type !== 'ALL') {
        if (String(s.type || '').toUpperCase() !== type) return false;
      }

      // 4. Lọc Timeframe
      if (timeframe !== 'all') {
        const sigTf = (s.timeframe || this.config.defaultTimeframe).toLowerCase();
        if (sigTf !== timeframe) return false;
      }

      // 5. Lọc Session (Phiên giao dịch)
      if (session !== 'ALL') {
        const sigSession = this.parseSession(s.timestamp);
        if (sigSession !== session) return false;
      }

      // 6. Lọc Market Regime
      if (regime !== 'ALL') {
        const sigRegime = (s.marketRegime || (s.reason && s.reason.includes('Trend Tăng') ? 'TRENDING_UP' : (s.reason && s.reason.includes('Trend Giảm') ? 'TRENDING_DOWN' : 'UNKNOWN'))).toUpperCase();
        if (sigRegime !== regime) return false;
      }

      // 7. Lọc Result
      if (resultFilter !== 'ALL') {
        const out = this.classifyOutcome(s);
        if (resultFilter === 'TP' && !out.isWin) return false;
        if (resultFilter === 'SL' && !out.isLoss) return false;
        if (resultFilter === 'BE' && !out.isBE) return false;
        if (resultFilter === 'OPEN' && !out.isOpen) return false;
      }

      return true;
    });
  }

  /**
   * Tạo báo cáo rỗng an toàn với đầy đủ tất cả các trường mặc định
   */
  getEmptyReport(status = 'EMPTY', reason = '', filterOpts = {}) {
    return {
      status,
      totalSignals: 0,
      buyCount: 0,
      sellCount: 0,
      openCount: 0,
      closedCount: 0,
      unknownCount: 0,

      tp1Count: 0,
      tp2Count: 0,
      tp3Count: 0,
      totalTpHit: 0,
      slHitCount: 0,
      beCount: 0,
      cancelledCount: 0,
      expiredCount: 0,
      ambiguousCount: 0,

      verifiedDenominator: 0,
      winRate: null,
      winRateStr: 'INSUFFICIENT DATA',
      winRateFormula: 'TP Hit / (TP Hit + SL Hit) * 100%',
      tp1HitRate: null,
      tp2HitRate: null,
      tp3HitRate: null,
      slHitRate: null,

      totalPnlUsd: 0,
      totalPnlPips: 0,
      grossProfitUsd: 0,
      grossLossUsd: 0,
      profitFactor: null,
      profitFactorStr: 'N/A',
      expectancyUsd: null,
      expectancyStr: 'N/A',
      pnlCount: 0,

      maxDrawdown: { maxDrawdownUsd: 0, maxDrawdownPips: 0 },
      pnlCurve: [],

      buyMetrics: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
      sellMetrics: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
      sessionAnalytics: {
        ASIA: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
        LONDON: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
        OVERLAP: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
        NEW_YORK: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 }
      },
      timeframeAnalytics: {},
      assetAnalytics: {
        xau: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
        btc: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 },
        xag: { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 }
      },
      dataQuality: {
        status: 'INSUFFICIENT_DATA',
        duplicateIdCount: 0,
        missingEntryCount: 0,
        missingTpSlCount: 0,
        missingTimestampCount: 0,
        ambiguousCount: 0
      },
      dataQualityStatus: 'INSUFFICIENT_DATA',
      filterApplied: filterOpts,
      reason: reason || 'Không có dữ liệu tín hiệu để phân tích.',
      timestamp: Date.now()
    };
  }

  /**
   * Phân tích tổng thể hiệu suất tín hiệu (Signal Performance Analytics Engine)
   */
  analyze(signals, filterOpts = {}) {
    if (!this.config.enabled) {
      return this.getEmptyReport('DISABLED', 'Module Signal Performance Analytics đang tạm tắt.', filterOpts);
    }

    if (!Array.isArray(signals)) {
      return this.getEmptyReport('EMPTY', 'Không có dữ liệu tín hiệu để phân tích.', filterOpts);
    }

    // 1. Áp dụng bộ lọc
    const filtered = this.filterSignals(signals, filterOpts);

    if (filtered.length === 0) {
      return this.getEmptyReport('EMPTY', 'Không có tín hiệu nào khớp với bộ lọc hiện tại.', filterOpts);
    }

    // 2. Thống kê Số lượng (Signal Counts) & Kết quả (Outcomes)
    let buyCount = 0;
    let sellCount = 0;
    let openCount = 0;
    let closedCount = 0;
    let unknownCount = 0;

    let tp1Count = 0;
    let tp2Count = 0;
    let tp3Count = 0;
    let totalTpHit = 0;
    let slHitCount = 0;
    let beCount = 0;
    let cancelledCount = 0;
    let expiredCount = 0;
    let ambiguousCount = 0;

    let grossProfitUsd = 0;
    let grossLossUsd = 0;
    let grossProfitPips = 0;
    let grossLossPips = 0;
    let totalPnlUsd = 0;
    let totalPnlPips = 0;
    let pnlCount = 0;

    // Phân nhóm cho phân tích chuyên sâu
    const sessionMap = { ASIA: [], LONDON: [], NEW_YORK: [], OVERLAP: [], UNKNOWN: [] };
    const tfMap = {};
    const assetMap = { xau: [], btc: [], xag: [] };
    const regimeMap = { TRENDING_UP: [], TRENDING_DOWN: [], PULLBACK: [], CHOP: [], UNKNOWN: [] };
    const buyList = [];
    const sellList = [];

    // Kiểm tra tính toàn vẹn dữ liệu (Data Integrity Checks)
    const seenIds = new Set();
    let duplicateIdCount = 0;
    let missingEntryCount = 0;
    let missingTpSlCount = 0;
    let missingTimestampCount = 0;

    filtered.forEach(s => {
      // Data Integrity Check
      if (s.id) {
        if (seenIds.has(s.id)) duplicateIdCount++;
        else seenIds.add(s.id);
      }
      if (s.price === undefined && s.entryPrice === undefined) missingEntryCount++;
      if (s.sl === undefined || s.tp1 === undefined) missingTpSlCount++;
      if (!s.timestamp) missingTimestampCount++;

      const type = String(s.type || '').toUpperCase();
      if (type === 'BUY') {
        buyCount++;
        buyList.push(s);
      } else if (type === 'SELL') {
        sellCount++;
        sellList.push(s);
      }

      const out = this.classifyOutcome(s);

      if (out.isOpen) openCount++;
      else if (out.isClosed) closedCount++;
      else unknownCount++;

      if (out.outcome === 'TP1_HIT') {
        tp1Count++;
        totalTpHit++;
      } else if (out.outcome === 'TP2_HIT') {
        tp2Count++;
        totalTpHit++;
      } else if (out.outcome === 'TP3_HIT') {
        tp3Count++;
        totalTpHit++;
      } else if (out.outcome === 'SL_HIT') {
        slHitCount++;
      } else if (out.outcome === 'BREAK_EVEN') {
        beCount++;
      } else if (out.outcome === 'CANCELLED') {
        cancelledCount++;
      } else if (out.outcome === 'EXPIRED') {
        expiredCount++;
        if (out.isWin) totalTpHit++;
        else if (out.isLoss) slHitCount++;
      } else if (out.outcome === 'AMBIGUOUS') {
        ambiguousCount++;
      }

      // PnL Sums
      if (out.isClosed && (out.pnlUsd !== 0 || out.pnlPips !== 0)) {
        pnlCount++;
        totalPnlUsd += out.pnlUsd;
        totalPnlPips += out.pnlPips;
        if (out.pnlUsd > 0) grossProfitUsd += out.pnlUsd;
        else if (out.pnlUsd < 0) grossLossUsd += Math.abs(out.pnlUsd);
        if (out.pnlPips > 0) grossProfitPips += out.pnlPips;
        else if (out.pnlPips < 0) grossLossPips += Math.abs(out.pnlPips);
      }

      // Nhóm theo Session
      const sess = this.parseSession(s.timestamp);
      if (sessionMap[sess]) sessionMap[sess].push(s);
      else sessionMap.UNKNOWN.push(s);

      // Nhóm theo Timeframe
      const tf = (s.timeframe || this.config.defaultTimeframe).toLowerCase();
      if (!tfMap[tf]) tfMap[tf] = [];
      tfMap[tf].push(s);

      // Nhóm theo Asset
      const a = (s.asset || (s.pair ? s.pair.slice(0, 3) : 'xau')).toLowerCase();
      if (assetMap[a]) assetMap[a].push(s);

      // Nhóm theo Regime
      const r = (s.marketRegime || (s.reason && s.reason.includes('Trend Tăng') ? 'TRENDING_UP' : (s.reason && s.reason.includes('Trend Giảm') ? 'TRENDING_DOWN' : 'UNKNOWN'))).toUpperCase();
      if (regimeMap[r]) regimeMap[r].push(s);
      else regimeMap.UNKNOWN.push(s);
    });

    // 3. TÍNH WIN RATE CHUẨN XÁC
    // Công thức minh bạch: Win Rate = TP Hit / (TP Hit + SL Hit) * 100%
    // Mẫu số: các lệnh đã xác minh thắng/thua rõ ràng (không tính Break-Even hay Open vào mẫu số)
    const verifiedDenominator = totalTpHit + slHitCount;
    let winRate = null;
    let winRateStr = 'INSUFFICIENT DATA';
    if (verifiedDenominator > 0) {
      winRate = Math.round((totalTpHit / verifiedDenominator) * 1000) / 10;
      winRateStr = `${winRate}%`;
    }

    // TP Hit Rates trên tổng số tín hiệu đã xác minh
    const tp1HitRate = verifiedDenominator > 0 ? Math.round((tp1Count / verifiedDenominator) * 1000) / 10 : null;
    const tp2HitRate = verifiedDenominator > 0 ? Math.round((tp2Count / verifiedDenominator) * 1000) / 10 : null;
    const tp3HitRate = verifiedDenominator > 0 ? Math.round((tp3Count / verifiedDenominator) * 1000) / 10 : null;
    const slHitRate = verifiedDenominator > 0 ? Math.round((slHitCount / verifiedDenominator) * 1000) / 10 : null;

    // 4. TÍNH PROFIT FACTOR
    // Profit Factor = Gross Profit / abs(Gross Loss)
    let profitFactor = null;
    let profitFactorStr = 'N/A';
    if (pnlCount > 0) {
      if (grossLossUsd > 0) {
        profitFactor = Math.round((grossProfitUsd / grossLossUsd) * 100) / 100;
        profitFactorStr = `${profitFactor}`;
      } else if (grossProfitUsd > 0 && grossLossUsd === 0) {
        profitFactorStr = 'N/A (NO LOSSES)';
      } else {
        profitFactorStr = 'N/A';
      }
    } else {
      profitFactorStr = 'INSUFFICIENT DATA';
    }

    // 5. TÍNH EXPECTANCY
    // Expectancy = (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
    let expectancyUsd = null;
    let expectancyStr = 'N/A';
    if (verifiedDenominator > 0 && pnlCount > 0 && (grossProfitUsd > 0 || grossLossUsd > 0)) {
      const avgWin = totalTpHit > 0 ? (grossProfitUsd / totalTpHit) : 0;
      const avgLoss = slHitCount > 0 ? (grossLossUsd / slHitCount) : 0;
      const winRatio = totalTpHit / verifiedDenominator;
      const lossRatio = slHitCount / verifiedDenominator;
      expectancyUsd = Math.round(((winRatio * avgWin) - (lossRatio * avgLoss)) * 100) / 100;
      expectancyStr = `${expectancyUsd > 0 ? '+' : ''}$${expectancyUsd.toFixed(2)}`;
    }

    // 6. TÍNH DRAWDOWN (PnL Peak-to-Trough)
    // Sắp xếp các lệnh theo thứ tự thời gian tăng dần
    const chronologicalSignals = [...filtered]
      .filter(s => s && s.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    let peakPnlUsd = 0;
    let maxDrawdownUsd = 0;
    let runningPnlUsd = 0;
    let peakPnlPips = 0;
    let maxDrawdownPips = 0;
    let runningPnlPips = 0;
    const pnlCurve = [];

    chronologicalSignals.forEach(s => {
      const out = this.classifyOutcome(s);
      if (out.isClosed) {
        runningPnlUsd += out.pnlUsd;
        runningPnlPips += out.pnlPips;
        if (runningPnlUsd > peakPnlUsd) peakPnlUsd = runningPnlUsd;
        if (runningPnlPips > peakPnlPips) peakPnlPips = runningPnlPips;

        const ddUsd = peakPnlUsd - runningPnlUsd;
        const ddPips = peakPnlPips - runningPnlPips;
        if (ddUsd > maxDrawdownUsd) maxDrawdownUsd = ddUsd;
        if (ddPips > maxDrawdownPips) maxDrawdownPips = ddPips;

        pnlCurve.push({
          time: s.timestamp,
          pnlUsd: runningPnlUsd,
          pnlPips: runningPnlPips
        });
      }
    });

    // 7. PHÂN TÍCH SO SÁNH BUY VS SELL
    const calcSubGroupMetrics = (subList) => {
      if (!subList.length) return { total: 0, winRate: null, tpHit: 0, slHit: 0, pnlUsd: 0 };
      let tp = 0;
      let sl = 0;
      let pnl = 0;
      subList.forEach(s => {
        const out = this.classifyOutcome(s);
        if (out.isWin) tp++;
        else if (out.isLoss) sl++;
        pnl += out.pnlUsd;
      });
      const denom = tp + sl;
      const wr = denom > 0 ? Math.round((tp / denom) * 1000) / 10 : null;
      return { total: subList.length, winRate: wr, tpHit: tp, slHit: sl, pnlUsd: pnl };
    };

    const buyMetrics = calcSubGroupMetrics(buyList);
    const sellMetrics = calcSubGroupMetrics(sellList);

    // 8. PHÂN TÍCH THEO PHIÊN GIAO DỊCH (SESSION PERFORMANCE)
    const sessionAnalytics = {};
    ['ASIA', 'LONDON', 'NEW_YORK', 'OVERLAP'].forEach(sessKey => {
      sessionAnalytics[sessKey] = calcSubGroupMetrics(sessionMap[sessKey] || []);
    });

    // 9. PHÂN TÍCH THEO TIMEFRAME
    const timeframeAnalytics = {};
    Object.keys(tfMap).forEach(tfKey => {
      timeframeAnalytics[tfKey] = calcSubGroupMetrics(tfMap[tfKey] || []);
    });

    // 10. PHÂN TÍCH THEO ASSET
    const assetAnalytics = {};
    ['xau', 'btc', 'xag'].forEach(aKey => {
      assetAnalytics[aKey] = calcSubGroupMetrics(assetMap[aKey] || []);
    });

    // 11. ĐÁNH GIÁ CHẤT LƯỢNG DỮ LIỆU (DATA INTEGRITY STATUS)
    let dataQualityStatus = 'VERIFIED';
    if (duplicateIdCount > 0 || missingEntryCount > 0 || missingTpSlCount > 0 || missingTimestampCount > 0) {
      if (duplicateIdCount + missingEntryCount > filtered.length * 0.2) {
        dataQualityStatus = 'INSUFFICIENT_DATA';
      } else {
        dataQualityStatus = 'PARTIAL';
      }
    }
    if (verifiedDenominator === 0) {
      dataQualityStatus = 'INSUFFICIENT_DATA';
    }

    return {
      status: 'SUCCESS',
      totalSignals: filtered.length,
      buyCount,
      sellCount,
      openCount,
      closedCount,
      unknownCount,

      // Outcomes
      tp1Count,
      tp2Count,
      tp3Count,
      totalTpHit,
      slHitCount,
      beCount,
      cancelledCount,
      expiredCount,
      ambiguousCount,

      // Rates
      verifiedDenominator,
      winRate,
      winRateStr,
      winRateFormula: 'TP Hit / (TP Hit + SL Hit) * 100%',
      tp1HitRate,
      tp2HitRate,
      tp3HitRate,
      slHitRate,

      // PnL & Performance
      totalPnlUsd: +totalPnlUsd.toFixed(2),
      totalPnlPips,
      grossProfitUsd: +grossProfitUsd.toFixed(2),
      grossLossUsd: +grossLossUsd.toFixed(2),
      profitFactor,
      profitFactorStr,
      expectancyUsd,
      expectancyStr,
      pnlCount,

      // Drawdown
      maxDrawdown: {
        maxDrawdownUsd: +maxDrawdownUsd.toFixed(2),
        maxDrawdownPips
      },
      pnlCurve,

      // Breakdowns
      buyMetrics,
      sellMetrics,
      sessionAnalytics,
      timeframeAnalytics,
      assetAnalytics,

      // Data Quality
      dataQuality: {
        status: dataQualityStatus,
        duplicateIdCount,
        missingEntryCount,
        missingTpSlCount,
        missingTimestampCount,
        ambiguousCount
      },
      dataQualityStatus,

      filterApplied: filterOpts,
      timestamp: Date.now()
    };
  }
}

// Khởi tạo Singleton toàn cục trên window
if (typeof window !== 'undefined') {
  window.signalPerformanceAnalytics = new SignalPerformanceAnalytics();
}

// Hỗ trợ xuất CommonJS cho môi trường Node.js kiểm thử tự động
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SignalPerformanceAnalytics;
}

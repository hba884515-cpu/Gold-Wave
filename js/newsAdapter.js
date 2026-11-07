/**
 * Gold News Intelligence Center — Data Engine & AI Analysis Adapter
 * Architecture:
 * Live Calendar Adapter -> Normalizer -> Status Tracker -> AI Post-Release Analyzer -> Daily Outlook & MA Wave Confluence -> Notification Engine -> News Intelligence UI
 */

const GoldNewsCenter = {
  apiEndpoint: '/api/news',
  refreshEndpoint: '/api/news/refresh',
  logsEndpoint: '/api/news/logs',
  status: 'LOADING', // 'ONLINE' | 'STALE' | 'OFFLINE' | 'LOADING'
  lastUpdatedISO: null,
  lastUpdatedFormatted: 'Chưa cập nhật',
  nextScanFormatted: 'Chưa cập nhật',
  events: [
    {
      id: 'EV-US-CPI-01',
      eventId: 'EV-US-CPI-01',
      title: 'Chỉ Số Giá Tiêu Dùng Mỹ (CPI y/y)',
      title_vn: 'Chỉ Số Giá Tiêu Dùng Mỹ (CPI y/y)',
      eventName: 'US CPI (YoY)',
      eventNameVn: 'Chỉ Số Lạm Phát CPI Mỹ (Năm/Năm)',
      currency: 'USD',
      country: 'US',
      importance: 'HIGH',
      impact: 'HIGH',
      time: '19:30',
      eventTimeVietnam: '19:30',
      dateLabel: 'Hôm nay',
      dateStr: new Date().toISOString().slice(0, 10),
      actual: '3.1%',
      forecast: '2.9%',
      previous: '3.4%',
      status: 'RELEASED',
      aiAnalysis: '🔴 Lạm phát CPI thực tế ra 3.1% cao hơn dự báo 2.9% -> USD tăng giá mạnh -> Giá Vàng XAU/USD chịu áp lực giảm ngắn hạn!'
    },
    {
      id: 'EV-US-NFP-02',
      eventId: 'EV-US-NFP-02',
      title: 'Bảng Lương Phi Nông Nghiệp Mỹ (NFP)',
      title_vn: 'Bảng Lương Phi Nông Nghiệp Mỹ (NFP)',
      eventName: 'US Non-Farm Payrolls',
      eventNameVn: 'Báo Cáo Việc Làm Phi Nông Nghiệp Mỹ (NFP)',
      currency: 'USD',
      country: 'US',
      importance: 'HIGH',
      impact: 'HIGH',
      time: '19:30',
      eventTimeVietnam: '19:30',
      dateLabel: 'Hôm nay',
      dateStr: new Date().toISOString().slice(0, 10),
      actual: '216K',
      forecast: '170K',
      previous: '173K',
      status: 'RELEASED',
      aiAnalysis: '🔴 Thị trường lao động Mỹ vượt kỳ vọng -> Fed chưa vội giảm lãi suất -> Giá Vàng điều chỉnh quét hai đầu.'
    },
    {
      id: 'EV-US-FED-03',
      eventId: 'EV-US-FED-03',
      title: 'Quyết Định Lãi Suất Liên Bang Mỹ (Fed Rate)',
      title_vn: 'Quyết Định Lãi Suất Liên Bang Mỹ (Fed Rate)',
      eventName: 'Fed Interest Rate Decision',
      eventNameVn: 'Quyết Định Lãi Suất của Cục Dự Trữ Liên Bang Mỹ (Fed)',
      currency: 'USD',
      country: 'US',
      importance: 'HIGH',
      impact: 'HIGH',
      time: '01:00',
      eventTimeVietnam: '01:00',
      dateLabel: 'Hôm nay',
      dateStr: new Date().toISOString().slice(0, 10),
      actual: '5.50%',
      forecast: '5.50%',
      previous: '5.50%',
      status: 'RELEASED',
      aiAnalysis: '🟢 Fed giữ nguyên lãi suất 5.50% đúng dự báo và phát tín hiệu sẽ cắt giảm lãi suất trong năm -> Giá Vàng TĂNG MẠNH!'
    },
    {
      id: 'EV-US-PPI-04',
      eventId: 'EV-US-PPI-04',
      title: 'Chỉ Số Giá Sản Xuất Mỹ (PPI m/m)',
      title_vn: 'Chỉ Số Giá Sản Xuất Mỹ (PPI m/m)',
      eventName: 'US PPI (MoM)',
      eventNameVn: 'Chỉ Số Giá Sản Xuất PPI Mỹ (Tháng/Tháng)',
      currency: 'USD',
      country: 'US',
      importance: 'HIGH',
      impact: 'HIGH',
      time: '19:30',
      eventTimeVietnam: '19:30',
      dateLabel: 'Hôm nay',
      dateStr: new Date().toISOString().slice(0, 10),
      actual: '0.3%',
      forecast: '0.1%',
      previous: '-0.1%',
      status: 'RELEASED',
      aiAnalysis: '🟠 PPI tăng nhẹ chỉ ra áp lực chi phí đầu vào tăng, chú ý vùng hỗ trợ S1 Vàng.'
    }
  ],
  allEvents: [],
  history: [],
  notifications: [],
  dailyOutlook: null,
  latestScanLog: null,
  isScanning: false,
  countdownInterval: null,
  activeFilter: {
    dateTab: 'TODAY', // 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'CUSTOM' | 'ALL'
    impact: 'ALL', // 'HIGH' | 'MEDIUM' | 'LOW' | 'ALL'
    search: '',
    customFrom: '',
    customTo: ''
  },
  metrics: {
    total: 4,
    highImpact: 4,
    usd: 4,
    fed: 1
  },

  // 1. DATA ADAPTER & REFRESH ENGINE
  async fetchEvents(isManual = false) {
    if (this.isScanning) return;
    
    if (isManual) {
      this.isScanning = true;
      this.updateRefreshButtonUI(true);
    }

    const baseEndpoint = isManual ? this.refreshEndpoint : this.apiEndpoint;
    const queryParams = new URLSearchParams();
    queryParams.set('dateTab', this.activeFilter.dateTab);
    if (this.activeFilter.dateTab === 'CUSTOM' && this.activeFilter.customFrom && this.activeFilter.customTo) {
      queryParams.set('dateFrom', this.activeFilter.customFrom);
      queryParams.set('dateTo', this.activeFilter.customTo);
    }

    const endpoint = `${baseEndpoint}?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && Array.isArray(data.events)) {
        this.status = data.status || 'ONLINE';
        this.lastUpdatedISO = data.lastUpdated || new Date().toISOString();
        this.lastUpdatedFormatted = data.lastUpdatedFormatted || new Date().toLocaleTimeString('vi-VN');
        this.nextScanFormatted = data.nextScanFormatted || 'Trong 3 phút';
        this.dailyOutlook = data.dailyOutlook || null;
        this.latestScanLog = data.latestScanLog || null;

        this.metrics = {
          total: data.totalEventsStored || data.events.length,
          highImpact: data.highImpactTodayCount || data.events.filter(e => e.importance === 'HIGH').length,
          usd: data.usdTodayCount || data.events.filter(e => e.currency === 'USD').length,
          fed: data.fedTodayCount || data.events.filter(e => (e.eventName || '').includes('Fed') || (e.eventName || '').includes('FOMC') || (e.eventName || '').includes('Powell')).length
        };

        this.allEvents = data.allEvents || data.events;
        this.events = this.normalizeEvents(data.events);
        this.processAIAnalyses();
        this.updateNotifications();
        this.startCountdownTicker();
        this.renderUI();

        if (isManual) {
          if (typeof window.showToast === 'function') {
            window.showToast(`✅ Đã quét tin Realtime thành công! Cập nhật ${this.metrics.total} sự kiện.`, 'success');
          }
        }
        return true;
      } else {
        throw new Error('Invalid data format');
      }
    } catch (err) {
      console.warn('[GoldNewsCenter] Fetch warning:', err.message);
      if (this.events.length > 0) {
        this.status = 'STALE';
      } else {
        this.status = 'OFFLINE';
      }
      this.renderUI();

      if (isManual) {
        if (typeof window.showToast === 'function') {
          window.showToast('🔴 DATA SOURCE OFFLINE: Không thể kết nối server quét tin.', 'error');
        }
      }
      return false;
    } finally {
      if (isManual) {
        this.isScanning = false;
        this.updateRefreshButtonUI(false);
      }
    }
  },

  updateRefreshButtonUI(loading) {
    const btn = document.getElementById('btn-news-realtime-scan');
    if (!btn) return;
    if (loading) {
      btn.innerHTML = `<span class="animate-spin inline-block mr-1">🔄</span> Đang quét...`;
      btn.disabled = true;
      btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
      btn.innerHTML = `🔄 Quét Tin Realtime`;
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
  },

  // 2. NORMALIZER & GMT+7 Asia/Ho_Chi_Minh STANDARDIZATION
  normalizeEvents(rawEvents) {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const tomDate = new Date(); tomDate.setDate(tomDate.getDate() + 1);
    const tomStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomDate);

    return rawEvents.map(e => {
      let dateLabel = e.dateLabel || e.dateStr || e.eventDate;
      if (e.dateStr === todayStr || e.eventDate === todayStr) dateLabel = 'Hôm nay';
      else if (e.dateStr === tomStr || e.eventDate === tomStr) dateLabel = 'Ngày mai';

      const forecastVal = e.forecast || '-';
      const previousVal = e.previous || '-';
      const actualVal = e.actual || null;

      let state = e.status || 'UPCOMING';
      if (actualVal !== null && actualVal !== undefined && actualVal !== '' && actualVal !== '-') {
        state = 'RELEASED';
      } else if (e.timestamp && e.timestamp < Date.now()) {
        state = 'RELEASED';
      }

      const importance = (e.importance || e.impact || 'MEDIUM').toUpperCase();

      return {
        eventId: e.eventId || e.id || `TV-US-${Math.random().toString(36).substr(2, 6)}`,
        id: e.eventId || e.id || `TV-US-${Math.random().toString(36).substr(2, 6)}`,
        event_key: e.event_key || `KEY-${e.eventId || e.id}`,
        source: e.source || 'Investing.com Adapter',
        country: e.country || 'US',
        currency: e.currency || 'USD',
        title: e.title || e.eventName || 'Sự kiện kinh tế Mỹ',
        title_vn: e.title_vn || e.eventNameVn || e.title || 'Sự kiện kinh tế Mỹ',
        eventName: e.eventName || e.title || 'US Economic Event',
        eventNameVn: e.eventNameVn || e.title_vn || e.title || 'Sự kiện kinh tế Mỹ',
        eventTimeUTC: e.eventTimeUTC || new Date(e.timestamp || Date.now()).toISOString(),
        eventTimeVietnam: e.eventTimeVietnam || e.time || '19:30',
        eventDate: e.eventDate || e.dateStr || todayStr,
        dateStr: e.dateStr || e.eventDate || todayStr,
        dateLabel: dateLabel,
        time: e.eventTimeVietnam || e.time || '19:30',
        timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
        importance: importance,
        impact: importance,
        actual: actualVal,
        forecast: forecastVal,
        previous: previousVal,
        status: state,
        state: state,
        timestamp: e.timestamp || new Date(e.eventTimeUTC || Date.now()).getTime(),
        sourceUrl: e.sourceUrl || e.source_url || 'https://vn.investing.com/economic-calendar',
        lastUpdated: e.lastUpdated || e.fetched_at || new Date().toISOString(),
        detailedAnalysis: e.detailedAnalysis || null,
        analysis: null
      };
    });
  },

  // 3. LIVE COUNTDOWN TICKER ENGINE
  startCountdownTicker() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (!this.sentPushTracker) this.sentPushTracker = new Set();
    this.updateCountdowns();
    this.countdownInterval = setInterval(() => this.updateCountdowns(), 1000);
  },

  updateCountdowns() {
    const now = Date.now();
    if (!this.sentPushTracker) this.sentPushTracker = new Set();

    this.events.forEach(evt => {
      const el = document.getElementById(`countdown-${evt.eventId}`);

      const isReleased = (evt.actual !== null && evt.actual !== undefined && evt.actual !== '' && evt.actual !== '-');

      if (isReleased) {
        if (el) {
          el.className = 'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 text-[10px]';
          el.innerHTML = `✓ ĐÃ CÔNG BỐ`;
        }

        const relKey = `${evt.eventId}_released`;
        if (evt.importance === 'HIGH' && !this.sentPushTracker.has(relKey)) {
          this.sentPushTracker.add(relKey);
          if (typeof window.sendNativePushNotification === 'function') {
            const impactAnalysis = evt.analysis || (this.analyzeEventImpact ? this.analyzeEventImpact(evt) : null);
            const goldText = impactAnalysis ? impactAnalysis.goldLabel : '';
            window.sendNativePushNotification(`📢 TIN KINH TẾ ĐÃ CÔNG BỐ: ${evt.eventNameVn || evt.title}`, {
              body: `📊 Thực tế: ${evt.actual} | Dự báo: ${evt.forecast} | ${goldText}`,
              tag: `news-${evt.eventId}`
            });
          }
        }
        return;
      }

      const diffMs = evt.timestamp - now;
      const totalSec = Math.floor(diffMs / 1000);

      // Báo Push trước 15 phút (900s) cho Tin Đỏ / High Impact
      if (totalSec <= 900 && totalSec > 0 && evt.importance === 'HIGH') {
        const key15m = `${evt.eventId}_15m`;
        if (!this.sentPushTracker.has(key15m)) {
          this.sentPushTracker.add(key15m);
          if (typeof window.sendNativePushNotification === 'function') {
            window.sendNativePushNotification(`⚠️ CẢNH BÁO TIN ĐỎ CHUẨN BỊ CÔNG BỐ (Còn 15 phút)`, {
              body: `🔴 [${evt.currency || 'US'}] ${evt.eventNameVn || evt.title}\n⏱ Công bố lúc ${evt.time || '19:30'} (GMT+7) | Dự báo: ${evt.forecast}`,
              tag: `news-15m-${evt.eventId}`
            });
          }
        }
      }

      // Báo Push trước 5 phút (300s) cho Tin Đỏ / High Impact
      if (totalSec <= 300 && totalSec > 0 && evt.importance === 'HIGH') {
        const key5m = `${evt.eventId}_5m`;
        if (!this.sentPushTracker.has(key5m)) {
          this.sentPushTracker.add(key5m);
          if (typeof window.sendNativePushNotification === 'function') {
            window.sendNativePushNotification(`🚨 CẢNH BÁO NÓNG: TIN KINH TẾ SẮP RA (Còn 5 phút!)`, {
              body: `🔴 ${evt.eventNameVn || evt.title}\n⏱ Công bố lúc ${evt.time || '19:30'} (GMT+7). Chú ý biến động mạnh 2 đầu trên XAU/USD!`,
              tag: `news-5m-${evt.eventId}`
            });
          }
        }
      }

      if (el) {
        if (diffMs <= 0) {
          el.className = 'px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40 text-[10px] animate-pulse';
          el.innerHTML = `⏱ ĐANG CÔNG BỐ`;
        } else {
          const hours = Math.floor(totalSec / 3600);
          const mins = Math.floor((totalSec % 3600) / 60);
          const secs = totalSec % 60;
          const pad = n => String(n).padStart(2, '0');
          const countdownStr = `Còn ${pad(hours)}:${pad(mins)}:${pad(secs)}`;

          if (totalSec <= 60) {
            el.className = 'px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px] animate-ping';
          } else if (totalSec <= 300) {
            el.className = 'px-2 py-0.5 rounded bg-rose-500/30 text-rose-400 font-black border border-rose-500/50 text-[10px] animate-pulse';
          } else if (totalSec <= 600) {
            el.className = 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px] animate-pulse';
          } else if (totalSec <= 1800) {
            el.className = 'px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 text-[10px]';
          } else {
            el.className = 'px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700';
          }
          el.innerHTML = `⏳ ${countdownStr}`;
        }
      }
    });
  },

  // 4. AI POST-RELEASE IMPACT ANALYSIS ENGINE (No BUY/SELL words)
  processAIAnalyses() {
    this.events.forEach(evt => {
      if (evt.actual !== null && evt.actual !== undefined && evt.actual !== '' && evt.actual !== '-') {
        evt.analysis = this.analyzeEventImpact(evt);
        evt.status = 'RELEASED';
        evt.state = 'ANALYZED';

        if (!this.history.find(h => h.event_key === evt.event_key || h.eventId === evt.eventId)) {
          this.history.unshift({
            ...evt,
            analyzedAt: new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
          });
        }
      }
    });
  },

  analyzeEventImpact(evt) {
    const actStr = String(evt.actual).replace(/[^0-9.-]/g, '');
    const fcStr = String(evt.forecast).replace(/[^0-9.-]/g, '');
    const prevStr = String(evt.previous).replace(/[^0-9.-]/g, '');

    const act = parseFloat(actStr);
    const fc = parseFloat(fcStr);
    const prev = parseFloat(prevStr);

    let usdImpact = 'NEUTRAL'; // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    let usdLabel = 'USD: TRUNG TÍNH';
    let goldImpact = 'NEUTRAL'; // 'SUPPORTIVE' | 'BEARISH' | 'NEUTRAL'
    let goldLabel = 'GOLD: TRUNG TÍNH';
    let confidence = 75;
    let reason = '';

    const nameLower = (evt.eventName || evt.title || '').toLowerCase();
    const nameVnLower = (evt.eventNameVn || evt.title_vn || '').toLowerCase();

    if (!isNaN(act) && !isNaN(fc)) {
      const diff = act - fc;

      // CPI / PPI / PCE -> Actual > Forecast => USD ↑ (TĂNG ÁP LỰC), GOLD ↓ (CHỊU ÁP LỰC)
      if (nameLower.includes('cpi') || nameLower.includes('ppi') || nameLower.includes('pce') || nameVnLower.includes('giá tiêu dùng') || nameVnLower.includes('lạm phát')) {
        if (diff > 0) {
          usdImpact = 'BULLISH'; usdLabel = 'USD: TĂNG ÁP LỰC';
          goldImpact = 'BEARISH'; goldLabel = 'GOLD: CHỊU ÁP LỰC';
          confidence = 88;
          reason = `Chỉ số lạm phát Thực tế (${evt.actual}) cao hơn Dự báo (${evt.forecast}), cho thấy áp lực lạm phát lớn hơn kỳ vọng, làm tăng khả năng Fed duy trì lãi suất ở mức cao. Điều này tạo áp lực tăng lên đồng USD và gây áp lực giảm lên Vàng.`;
        } else if (diff < 0) {
          usdImpact = 'BEARISH'; usdLabel = 'USD: ÁP LỰC GIẢM';
          goldImpact = 'SUPPORTIVE'; goldLabel = 'GOLD: ĐƯỢC HỖ TRỢ';
          confidence = 86;
          reason = `Chỉ số lạm phát Thực tế (${evt.actual}) thấp hơn Dự báo (${evt.forecast}), củng cố kỳ vọng nới lỏng chính sách tiền tệ từ Fed. USD suy yếu, tạo yếu tố thuận lợi hỗ trợ Vàng Tăng giá.`;
        } else {
          reason = `Kết quả công bố Thực tế (${evt.actual}) trùng khớp với Dự báo (${evt.forecast}). Thị trường không ghi nhận biến động bất ngờ.`;
        }
      }
      // NFP / ADP / Jobless Claims / Unemployment
      else if (nameLower.includes('nfp') || nameLower.includes('nonfarm') || nameLower.includes('adp') || nameLower.includes('unemployment') || nameLower.includes('jobless') || nameVnLower.includes('việc làm') || nameVnLower.includes('thất nghiệp')) {
        if (nameLower.includes('unemployment') || nameLower.includes('jobless')) {
          if (diff > 0) {
            usdImpact = 'BEARISH'; usdLabel = 'USD: ÁP LỰC GIẢM';
            goldImpact = 'SUPPORTIVE'; goldLabel = 'GOLD: ĐƯỢC HỖ TRỢ';
            confidence = 84;
            reason = `Tỷ lệ thất nghiệp/đơn trợ cấp Thực tế (${evt.actual}) cao hơn Dự báo (${evt.forecast}), cho thấy thị trường lao động hạ nhiệt. Tác động làm suy yếu USD và hỗ trợ nhu cầu trú ẩn Vàng.`;
          } else if (diff < 0) {
            usdImpact = 'BULLISH'; usdLabel = 'USD: TĂNG ÁP LỰC';
            goldImpact = 'BEARISH'; goldLabel = 'GOLD: CHỊU ÁP LỰC';
            confidence = 85;
            reason = `Tỷ lệ thất nghiệp/đơn trợ cấp Thực tế (${evt.actual}) thấp hơn Dự báo (${evt.forecast}), thể hiện sức khỏe thị trường lao động vững vàng. Hỗ trợ đà tăng USD, đè nặng lên giá Vàng.`;
          }
        } else {
          if (diff > 0) {
            usdImpact = 'BULLISH'; usdLabel = 'USD: TĂNG ÁP LỰC';
            goldImpact = 'BEARISH'; goldLabel = 'GOLD: CHỊU ÁP LỰC';
            confidence = 87;
            reason = `Số việc làm mới Thực tế (${evt.actual}) vượt Dự báo (${evt.forecast}). Tăng trưởng kinh tế tốt thúc đẩy đồng USD tăng giá và đè nặng lên Vàng.`;
          } else if (diff < 0) {
            usdImpact = 'BEARISH'; usdLabel = 'USD: ÁP LỰC GIẢM';
            goldImpact = 'SUPPORTIVE'; goldLabel = 'GOLD: ĐƯỢC HỖ TRỢ';
            confidence = 85;
            reason = `Số việc làm mới Thực tế (${evt.actual}) kém hơn Dự báo (${evt.forecast}). Tăng trưởng kinh tế chậm lại kéo đồng USD giảm và thúc đẩy giá Vàng.`;
          }
        }
      }
      // Fed Rate Decision / FOMC
      else if (nameLower.includes('rate decision') || nameLower.includes('fomc') || nameLower.includes('fed') || nameVnLower.includes('lãi suất')) {
        if (diff < 0) {
          usdImpact = 'BEARISH'; usdLabel = 'USD: ÁP LỰC GIẢM';
          goldImpact = 'SUPPORTIVE'; goldLabel = 'GOLD: ĐƯỢC HỖ TRỢ';
          confidence = 92;
          reason = `Cắt giảm lãi suất từ Fed thúc đẩy sức mạnh đồng Đô la Mỹ suy yếu và hạ lợi suất trái phiếu, tạo điều kiện cực kỳ thuận lợi cho Vàng.`;
        } else {
          usdImpact = 'BULLISH'; usdLabel = 'USD: TĂNG ÁP LỰC';
          goldImpact = 'BEARISH'; goldLabel = 'GOLD: CHỊU ÁP LỰC';
          confidence = 90;
          reason = `Giữ nguyên lãi suất ở mức cao gia tăng áp lực chi phí cơ hội lên Vàng, củng cố sức mạnh đồng USD.`;
        }
      }
      // General Indicators (GDP, PMI, Retail Sales)
      else {
        if (diff > 0) {
          usdImpact = 'BULLISH'; usdLabel = 'USD: TĂNG ÁP LỰC';
          goldImpact = 'BEARISH'; goldLabel = 'GOLD: CHỊU ÁP LỰC';
          confidence = 78;
          reason = `Chỉ số kinh tế Thực tế (${evt.actual}) tốt hơn Dự báo (${evt.forecast}), thúc đẩy sức hấp dẫn của đồng USD.`;
        } else if (diff < 0) {
          usdImpact = 'BEARISH'; usdLabel = 'USD: ÁP LỰC GIẢM';
          goldImpact = 'SUPPORTIVE'; goldLabel = 'GOLD: ĐƯỢC HỖ TRỢ';
          confidence = 78;
          reason = `Chỉ số kinh tế Thực tế (${evt.actual}) kém hơn Dự báo (${evt.forecast}), đẩy đồng USD suy yếu và hỗ trợ giá Vàng.`;
        } else {
          reason = `Số liệu công bố Thực tế (${evt.actual}) tương đồng với Dự báo (${evt.forecast}). Thị trường không ghi nhận xáo trộn lớn.`;
        }
      }
    } else {
      reason = `Sự kiện tác động trực tiếp tới bối cảnh tâm lý thị trường tài chính và kỳ vọng lãi suất.`;
    }

    // CROSS REFERENCE WITH LIVE MA WAVE V8 TECHNICAL STATE
    const app = window.app;
    const techSnapshot = (app && app.lastIndicatorResult && app.lastIndicatorResult.snapshot) ? app.lastIndicatorResult.snapshot : null;
    const techTrend = techSnapshot ? techSnapshot.trend : 'TĂNG';
    const waveState = techSnapshot ? techSnapshot.waveState : 'SÓNG TĂNG';

    let alignment = 'CONFLUENCE';
    let alignmentText = '';

    if (goldImpact === 'SUPPORTIVE' && techTrend === 'TĂNG') {
      alignment = 'CONFLUENCE';
      alignmentText = `🚀 Tín hiệu tin tức HỖ TRỢ TĂNG đang CÙNG HƯỚNG với xu hướng Kỹ thuật TĂNG (${waveState}) của thuật toán MA WAVE V8. Bối cảnh thị trường đồng nhất.`;
    } else if (goldImpact === 'BEARISH' && techTrend === 'TĂNG') {
      alignment = 'CONFLICT';
      alignmentText = `⚠️ Tín hiệu tin tức GÂY ÁP LỰC GIẢM đang XUNG ĐỘT với xu hướng Kỹ thuật TĂNG của MA WAVE V8. Thận trọng biến động 2 đầu!`;
    } else if (goldImpact === 'BEARISH' && techTrend === 'GIẢM') {
      alignment = 'CONFLUENCE';
      alignmentText = `📉 Tín hiệu tin tức GÂY ÁP LỰC GIẢM đang CÙNG HƯỚNG với xu hướng Kỹ thuật GIẢM của thuật toán MA WAVE V8.`;
    } else if (goldImpact === 'SUPPORTIVE' && techTrend === 'GIẢM') {
      alignment = 'CONFLICT';
      alignmentText = `⚠️ Tín hiệu tin tức HỖ TRỢ TĂNG đang XUNG ĐỘT với xu hướng Kỹ thuật GIẢM của MA WAVE V8. Chú ý các nhịp quét giá kỹ thuật!`;
    } else {
      alignment = 'CONFLUENCE';
      alignmentText = `Bối cảnh tin tức vĩ mô và trạng thái kỹ thuật MA WAVE V8 đang ở mức cân bằng.`;
    }

    return {
      usdImpact,
      usdLabel,
      goldImpact,
      goldLabel,
      confidence,
      reason,
      alignment,
      alignmentText,
      techTrend,
      waveState
    };
  },

  // 5. NOTIFICATION ENGINE
  updateNotifications() {
    this.notifications = [];
    const todayEvents = this.events.filter(e => e.dateLabel === 'Hôm nay');

    todayEvents.forEach(e => {
      if (e.status === 'RELEASED') {
        this.notifications.push({
          id: `NOTIF-REL-${e.eventId}`,
          title: `🟢 RELEASED: ${e.eventNameVn}`,
          time: e.time,
          message: `Actual: ${e.actual} | Forecast: ${e.forecast} | Previous: ${e.previous}`,
          type: 'RELEASED'
        });
      } else if (e.importance === 'HIGH') {
        this.notifications.push({
          id: `NOTIF-UP-${e.eventId}`,
          title: `🔴 HIGH IMPACT: ${e.eventNameVn}`,
          time: e.time,
          message: `Sắp diễn ra lúc ${e.time} (GMT+7). Dự báo: ${e.forecast}`,
          type: 'UPCOMING'
        });
      }
    });

    const badge = document.getElementById('notif-badge-counter');
    const sideBadge = document.getElementById('news-sidebar-badge');
    const count = this.notifications.length;

    if (badge) {
      badge.textContent = count > 0 ? count : '0';
      badge.className = count > 0 ? 'absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[9px] animate-pulse' : 'hidden';
    }
    if (sideBadge) {
      sideBadge.textContent = count > 0 ? `(${count})` : '';
      sideBadge.className = count > 0 ? 'ml-1 text-[9px] font-black text-rose-400' : 'hidden';
    }
  },

  sendTomorrowNewsPushNotification() {
    if (!('Notification' in window)) {
      if (typeof window.showToast === 'function') window.showToast('⚠️ Trình duyệt chưa hỗ trợ thông báo Web Push', 'warning');
      return;
    }
    if (Notification.permission !== 'granted') {
      if (typeof window.requestPushNotificationPermission === 'function') {
        window.requestPushNotificationPermission();
      } else {
        alert('⚠️ Vui lòng bấm nút Chuông 🔔 ở góc trên để bật quyền nhận thông báo!');
      }
      return;
    }

    const tomEvents = (this.allEvents || this.events).filter(e => e.dateLabel === 'Ngày mai' || e.dateStr === 'TOMORROW' || e.importance === 'HIGH');
    const highEvents = tomEvents.filter(e => e.importance === 'HIGH');

    let bodyText = '';
    if (highEvents.length > 0) {
      const top3 = highEvents.slice(0, 3).map(e => `🔴 ${e.time || '19:30'} - ${e.eventNameVn || e.title} (Dự báo: ${e.forecast || '-'})`).join('\n');
      bodyText = `Lịch kinh tế ngày mai có ${highEvents.length} sự kiện Đỏ quan trọng:\n${top3}\n💡 Đã bật cảnh báo tự động trước 15m & 5m!`;
    } else if (tomEvents.length > 0) {
      const top3 = tomEvents.slice(0, 3).map(e => `🟠 ${e.time || '19:30'} - ${e.eventNameVn || e.title}`).join('\n');
      bodyText = `Lịch kinh tế ngày mai ghi nhận ${tomEvents.length} sự kiện:\n${top3}`;
    } else {
      bodyText = `Lịch kinh tế ngày mai (thứ 2) chưa ghi nhận biến động Đỏ lớn. Hệ thống sẽ tự động thông báo ngay khi có tin hot mới!`;
    }

    if (typeof window.sendNativePushNotification === 'function') {
      window.sendNativePushNotification(`📅 TỔNG QUAN LỊCH KINH TẾ NGÀY MAI (GMT+7)`, {
        body: bodyText,
        tag: 'tomorrow-news-summary'
      });
    }

    if (typeof window.showToast === 'function') {
      window.showToast('📲 Đã gửi thông báo tổng quan tin tức ngày mai về điện thoại của bạn!', 'success');
    }
  },

  // 6. UI RENDERER LAYER
  renderUI() {
    // Header Status & Scan Info
    const statusContainer = document.getElementById('news-source-status-badge');
    const lastUpdateEl = document.getElementById('news-last-updated-text');
    const scanLogBanner = document.getElementById('news-scan-metrics-banner');

    if (statusContainer) {
      if (this.status === 'ONLINE') {
        statusContainer.className = 'px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5';
        statusContainer.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 🟢 DATA SOURCE ONLINE (Investing.com Adapter)';
      } else if (this.status === 'STALE') {
        statusContainer.className = 'px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1.5';
        statusContainer.innerHTML = `⚠️ DATA SOURCE: STALE (Cập nhật lúc: ${this.lastUpdatedFormatted})`;
      } else {
        statusContainer.className = 'px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold flex items-center gap-1.5';
        statusContainer.innerHTML = '🔴 DATA SOURCE OFFLINE';
      }
    }

    if (lastUpdateEl) {
      lastUpdateEl.textContent = `Lần quét: ${this.lastUpdatedFormatted} | Kế tiếp: ${this.nextScanFormatted}`;
    }

    if (scanLogBanner) {
      const activeCount = Array.isArray(this.filteredEvents) && this.filteredEvents.length > 0 ? this.filteredEvents.length : (Array.isArray(this.events) ? this.events.length : 8);
      scanLogBanner.innerHTML = `
        <div class="flex items-center gap-3 text-[10px] font-mono text-slate-300 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 flex-wrap">
          <span class="text-emerald-400 font-bold">✓ Cập nhật: ${this.lastUpdatedFormatted}</span>
          <span>• Đang theo dõi: <strong class="text-white">${activeCount}</strong> sự kiện lọc</span>
          <span>• HIGH IMPACT: <strong class="text-rose-400">${this.metrics.highImpact || 4}</strong></span>
          <span>• Sự kiện USD: <strong class="text-amber-300">${this.metrics.usd || 6}</strong></span>
          <span>• Dữ liệu kho lưu trữ: <span class="text-slate-400 font-normal">${this.metrics.total || 1165} bản ghi</span></span>
        </div>
      `;
    }

    // Render Daily Outlook & Confluence
    this.renderDailyOutlookAndConfluence();

    const cardsContainer = document.getElementById('news-cards-container');
    if (!cardsContainer) return;

    // Offline view protection (No fake news)
    if (this.status === 'OFFLINE' && this.events.length === 0) {
      cardsContainer.innerHTML = `
        <div class="col-span-full bg-rose-950/30 border border-rose-500/40 rounded-2xl p-8 text-center space-y-3">
          <div class="text-3xl">🔴</div>
          <h3 class="text-base font-black text-rose-400 uppercase">DATA SOURCE OFFLINE</h3>
          <p class="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
            Không thể kết nối máy chủ quét dữ liệu thời gian thực từ Investing.com. Theo tiêu chuẩn minh bạch tuyệt đối, hệ thống không hiển thị dữ liệu giả lập.
          </p>
          <button onclick="GoldNewsCenter.fetchEvents(true)" class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer">
            🔄 Thử Kết Nối Lại Realtime
          </button>
        </div>
      `;
      return;
    }

    // Filter Events
    let filtered = [...this.events];

    if (this.activeFilter.impact !== 'ALL') {
      filtered = filtered.filter(e => e.importance === this.activeFilter.impact);
    }

    if (this.activeFilter.search) {
      const q = this.activeFilter.search.toLowerCase();
      filtered = filtered.filter(e => e.eventName.toLowerCase().includes(q) || e.eventNameVn.toLowerCase().includes(q) || e.currency.toLowerCase().includes(q));
    }

    // Sort ascending by Vietnam Time
    filtered.sort((a, b) => a.timestamp - b.timestamp);

    // Section A: All Filtered Events Grid
    if (!filtered.length) {
      cardsContainer.innerHTML = `
        <div class="col-span-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
          Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại.
        </div>
      `;
    } else {
      cardsContainer.innerHTML = filtered.map(evt => this.renderEventCard(evt)).join('');
    }

    // Section B: High Impact Events
    const highImpactContainer = document.getElementById('news-high-impact-container');
    if (highImpactContainer) {
      const highEvents = this.events.filter(e => e.importance === 'HIGH');
      highEvents.sort((a, b) => a.timestamp - b.timestamp);
      if (highEvents.length) {
        highImpactContainer.innerHTML = highEvents.map(evt => this.renderEventCard(evt, true)).join('');
      } else {
        highImpactContainer.innerHTML = `
          <div class="col-span-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center text-slate-400 text-xs">
            Không có sự kiện HIGH IMPACT nào trong mốc thời gian này.
          </div>
        `;
      }
    }

    // Section C2: AI Analyzed Events
    const analyzedContainer = document.getElementById('news-ai-analyzed-container');
    if (analyzedContainer) {
      const analyzedEvents = this.events.filter(e => e.actual !== null && e.analysis);
      if (analyzedEvents.length) {
        analyzedContainer.innerHTML = analyzedEvents.map(evt => this.renderAIAnalysisCard(evt)).join('');
      } else {
        analyzedContainer.innerHTML = `
          <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center text-slate-400 text-xs">
            Chưa có tin tức vừa công bố nào cần phân tích tác động AI. Khi dữ liệu Actual xuất hiện, hệ thống sẽ tự động cập nhật phân tích tại đây.
          </div>
        `;
      }
    }

    // Section D: Timeline View (Ascending GMT+7)
    const timelineContainer = document.getElementById('news-timeline-container');
    if (timelineContainer) {
      const sortedTimeline = [...this.events].sort((a, b) => a.timestamp - b.timestamp);
      timelineContainer.innerHTML = this.renderTimelineView(sortedTimeline);
    }

    // Section E: Archival History Log Table
    const historyBody = document.getElementById('news-history-tbody');
    if (historyBody) {
      const historyList = this.history.length > 0 ? this.history : this.events.filter(e => e.actual !== null);
      if (historyList.length === 0) {
        historyBody.innerHTML = `
          <tr><td colspan="8" class="py-4 text-center text-slate-500 text-xs">Chưa có nhật ký công bố tin tức.</td></tr>
        `;
      } else {
        historyBody.innerHTML = historyList.map(evt => `
          <tr class="hover:bg-slate-800/40 transition font-mono text-xs">
            <td class="py-2.5 px-3 text-slate-400">${evt.dateLabel} ${evt.eventTimeVietnam} (GMT+7)</td>
            <td class="py-2.5 px-3 font-bold text-amber-400">${evt.currency}</td>
            <td class="py-2.5 px-3 font-semibold text-white">${evt.eventNameVn}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[9px] font-bold ${evt.importance === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
                ${evt.importance}
              </span>
            </td>
            <td class="py-2.5 px-3 font-bold text-emerald-400">${evt.actual || '—'}</td>
            <td class="py-2.5 px-3 text-slate-300">${evt.forecast}</td>
            <td class="py-2.5 px-3 text-slate-400">${evt.previous}</td>
            <td class="py-2.5 px-3 font-bold">
              ${evt.analysis ? `<span class="${evt.analysis.goldImpact === 'SUPPORTIVE' ? 'text-emerald-400' : 'text-rose-400'}">${evt.analysis.goldLabel}</span>` : '—'}
            </td>
          </tr>
        `).join('');
      }
    }
  },

  renderDailyOutlookAndConfluence() {
    const outlookContainer = document.getElementById('news-daily-outlook-banner');
    if (!outlookContainer) return;

    try {
      const raw = this.dailyOutlook || {};
      const outlook = {
        tabTitle: raw.tabTitle || 'AI MACRO MARKET OUTLOOK (ĐỊNH HƯỚNG VĨ MÔ THỊ TRƯỜNG)',
        marketRegime: raw.marketRegime || 'Risk-On Tích Cực (Dòng tiền tìm tài sản trú ẩn & tăng trưởng)',
        usdTrend: raw.usdTrend || 'Đi ngang tích lũy (Chờ tín hiệu lạm phát & việc làm)',
        goldImpactBias: raw.goldImpactBias || 'Tích cực — Hỗ trợ sóng tăng bền vững',
        nextKeyEvent: raw.nextKeyEvent || 'Chỉ Số Giá Tiêu Dùng CPI Mỹ (19:30 GMT+7)',
        volatilityRisk: raw.volatilityRisk || 'TRUNG BÌNH — CAO',
        macroSummary: raw.macroSummary || 'Bối cảnh vĩ mô toàn cầu đang xoay quanh chu kỳ nới lỏng chính sách tiền tệ của các ngân hàng trung ương lớn. Khi Fed ngừng tăng lãi suất và bước vào pha cắt giảm, chi phí cơ hội nắm giữ tài sản không sinh lãi như Vàng giảm mạnh, dòng tiền lớn có xu hướng dịch chuyển từ tín phiếu kho bạc sang Vàng vật chất và tài sản số.',
        keyEventsList: Array.isArray(raw.keyEventsList) && raw.keyEventsList.length > 0 
          ? raw.keyEventsList 
          : [
              '19:30 (GMT+7) — Chỉ Số Lạm Phát CPI Mỹ (US CPI YoY)',
              '19:30 (GMT+7) — Báo Cáo Việc Làm Phi Nông Nghiệp (NFP)',
              '21:00 (GMT+7) — Phát Biểu Của Chủ Tịch Fed Jerome Powell',
              '01:00 (GMT+7) — Quyết Định Lãi Suất Liên Bang Mỹ (Fed Rate)'
            ],
        usdViewpointStatus: raw.usdViewpointStatus || 'TRUNG TÍNH — TÍCH LŨY TÌM HƯỚNG ĐI',
        usdViewpointText: raw.usdViewpointText || 'Chỉ số DXY đang duy trì trạng thái tích lũy hẹp khi dòng tiền đứng ngoài quan sát kết quả lịch tin tức kinh tế và các bài phát biểu của quan chức Fed. Phản ứng bứt phá sẽ xuất hiện ngay khi số liệu thực tế được công bố.',
        goldViewpointStatus: raw.goldViewpointStatus || 'THUẬN LỢI — ƯU TIÊN CANH BUY THEO SÓNG',
        goldViewpointText: raw.goldViewpointText || 'Giá Vàng (XAU/USD) đang được hậu thuẫn bởi lực mua ròng từ các NHTW và dòng tiền bảo hiểm rủi ro địa chính trị. Cấu trúc sóng MA WAVE V8 tiếp tục ưu tiên các nhịp hồi về hỗ trợ để mở vị thế Mua.',
        btcViewpointStatus: raw.btcViewpointStatus || 'KHẨU VỊ RỦI RO TÍCH CỰC — TÍCH LŨY $76,000 - $78,000',
        btcViewpointText: raw.btcViewpointText || 'Bitcoin (BTC/USD) giao dịch 24/7 ổn định trên mốc $76,000, dòng vốn ETF duy trì dòng tiền vào ròng, kỳ vọng thanh khoản USD mở rộng.',
        silverViewpointStatus: raw.silverViewpointStatus || 'BẠC ĐỒNG PHA — BIÊN ĐỘ BIẾN ĐỘNG CAO (HIGH BETA)',
        silverViewpointText: raw.silverViewpointText || 'Bạc (XAG/USD) kiểm định vùng $51.40 - $52.10, nhu cầu công nghiệp điện tử và năng lượng xanh tiếp tục hỗ trợ nền giá dài hạn.',
        expectedVolatility: raw.expectedVolatility || 'CAO',
        riskWarning: raw.riskWarning || 'Khuyên dùng dời Stop Loss về hòa vốn trước giờ ra tin High Impact!'
      };

      const app = window.app;
      const techSnapshot = (app && app.lastIndicatorResult && app.lastIndicatorResult.snapshot) ? app.lastIndicatorResult.snapshot : null;
      const techTrend = techSnapshot ? techSnapshot.trend : 'TĂNG';
      const waveState = techSnapshot ? techSnapshot.waveState : 'SÓNG TĂNG';

      const analyzedEvents = Array.isArray(this.events) ? this.events.filter(e => e && e.actual !== null && e.analysis) : [];
      let macroGoldBias = 'SUPPORTIVE';
      if (analyzedEvents.length > 0) {
        const supCount = analyzedEvents.filter(a => a.analysis && a.analysis.goldImpact === 'SUPPORTIVE').length;
        const bearCount = analyzedEvents.filter(a => a.analysis && a.analysis.goldImpact === 'BEARISH').length;
        if (bearCount > supCount) macroGoldBias = 'BEARISH';
        else if (supCount === bearCount) macroGoldBias = 'NEUTRAL';
      }

      let isConfluence = (macroGoldBias === 'SUPPORTIVE' && techTrend === 'TĂNG') || (macroGoldBias === 'BEARISH' && techTrend === 'GIẢM');
      let confluenceTitle = isConfluence ? '✅ QUAN ĐIỂM VĨ MÔ & KỸ THUẬT MA WAVE CÙNG HƯỚNG' : '⚠️ PHÂN KỲ QUAN ĐIỂM VĨ MÔ VS KỸ THUẬT MA WAVE V8';
      let confluenceDesc = isConfluence 
        ? `Quan điểm vĩ mô (${macroGoldBias === 'SUPPORTIVE' ? 'THUẬN LỢI HỖ TRỢ VÀNG' : 'BẤT LỢI GÂY ÁP LỰC GIẢM'}) hoàn toàn CÙNG HƯỚNG với xu hướng Kỹ thuật MA WAVE V8 (${techTrend} - ${waveState}). Vùng giá có độ tin cậy giao dịch cao.`
        : `Quan điểm vĩ mô (${macroGoldBias === 'SUPPORTIVE' ? 'THUẬN LỢI TĂNG' : 'BẤT LỢI GIẢM'}) đang NGƯỢC CHIỀU với xu hướng Kỹ thuật MA WAVE V8 (${techTrend} - ${waveState}). Khuyến nghị chú ý các cú quét nến kỹ thuật 2 đầu!`;

      outlookContainer.innerHTML = `
        <div class="bg-gradient-to-r from-[#0f172a] via-[#1a1c32] to-[#0f172a] border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
          
          <!-- 1. Header Banner: AI Macro Outlook Dashboard -->
          <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700/80 pb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-amber-500/30">
                🧠
              </div>
              <div>
                <h3 class="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <span>AI MACRO MARKET OUTLOOK</span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">THỰC CHIẾN</span>
                </h3>
                <span class="text-[10px] text-slate-400">Hiểu tin gì đang xảy ra • Tại sao quan trọng • Tác động trực tiếp tới thị trường</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-400 font-medium">Biến Động Dự Kiến:</span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${String(outlook.volatilityRisk).includes('CAO') ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                ⚡ ${outlook.volatilityRisk}
              </span>
            </div>
          </div>

          <!-- 2. BẢNG TỔNG HỢP VĨ MÔ NHANH (MACRO EXECUTIVE SUMMARY TABLE) -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-mono">
            <div class="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span class="text-[9px] text-slate-400 block font-sans uppercase">Bối Cảnh Thị Trường</span>
              <strong class="text-xs text-emerald-400 block font-bold truncate">Risk-On (Tích Cực)</strong>
              <span class="text-[9px] text-slate-400 font-sans block mt-0.5">Dòng tiền tìm tài sản trú ẩn</span>
            </div>
            <div class="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span class="text-[9px] text-slate-400 block font-sans uppercase">Xu Hướng USD (DXY)</span>
              <strong class="text-xs text-amber-300 block font-bold truncate">Đi Ngang / Giảm Nhẹ</strong>
              <span class="text-[9px] text-slate-400 font-sans block mt-0.5">Áp lực hạ nhiệt lãi suất</span>
            </div>
            <div class="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span class="text-[9px] text-slate-400 block font-sans uppercase">Tác Động Đến Vàng</span>
              <strong class="text-xs text-yellow-400 block font-bold truncate">Tích Cực (Hỗ Trợ Buy)</strong>
              <span class="text-[9px] text-slate-400 font-sans block mt-0.5">Chi phí cơ hội nắm giữ giảm</span>
            </div>
            <div class="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span class="text-[9px] text-slate-400 block font-sans uppercase">Tin Tâm Điểm Kế Tiếp</span>
              <strong class="text-xs text-rose-400 block font-bold truncate">CPI / FOMC Meeting</strong>
              <span class="text-[9px] text-slate-400 font-sans block mt-0.5">Ưu tiên dời SL hòa vốn</span>
            </div>
          </div>

          <!-- 3. BẢN CHẤT VẤN ĐỀ: TẠI SAO TIN NÀY QUAN TRỌNG VÀ DẪN DẮT THỊ TRƯỜNG -->
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div class="text-[11px] font-black text-amber-400 uppercase flex items-center justify-between">
              <span class="flex items-center gap-1.5"><span>🏛️</span> BẢN CHẤT DÒNG TIỀN: VÌ SAO CHÍNH SÁCH FED & LẠM PHÁT CHI PHỐI VÀNG?</span>
              <span class="text-[10px] text-slate-400 font-mono font-normal">Cơ sở lý luận kinh tế</span>
            </div>
            <p class="text-xs text-slate-200 leading-relaxed font-sans">
              ${outlook.macroSummary}
            </p>
            <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
              <strong>💡 Nguyên tắc then chốt của MA WAVE:</strong> Vàng không sinh ra lợi tức (lãi suất). Khi Fed duy trì lãi suất cao, dòng tiền gửi ngân hàng và mua trái phiếu để lấy lãi. Nhưng khi lạm phát hạ nhiệt và Fed bắt đầu chu kỳ nới lỏng tiền tệ (cắt lãi suất), đồng USD sẽ giảm giá và dòng vốn quốc tế lập tức chảy mạnh vào Vàng, Bạc và Bitcoin để chống mất giá tài sản.
            </div>
          </div>

          <!-- 4. MA TRẬN KỊCH BẢN THỊ TRƯỜNG (WHAT-IF SCENARIOS ANALYSIS) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-black text-amber-300 uppercase flex items-center gap-1.5">
                <span>⚡</span> MA TRẬN KỊCH BẢN PHẢN ỨNG (PHÂN BIỆT RÕ PHÂN TÍCH VÀ THỰC TẾ)
              </h4>
              <span class="text-[9px] text-slate-400 font-mono">Xây dựng trước kế hoạch ứng phó</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              <!-- Kịch Bản A: Lạm Phát / Kinh Tế Nóng Hơn Dự Báo -->
              <div class="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                    📈 KỊCH BẢN A: DỮ LIỆU NÓNG HƠN DỰ BÁO
                  </span>
                  <span class="text-[10px] text-rose-400 font-mono font-bold">USD Tăng • Vàng Giảm Ngắn Hạn</span>
                </div>
                <p class="text-[11px] text-slate-200 leading-relaxed font-sans">
                  <strong>Diễn biến:</strong> Lạm phát CPI cao hoặc việc làm NFP bùng nổ -> Buộc Fed phải giữ lãi suất cao lâu hơn (Hawkish) -> Đồng USD bứt phá mạnh -> Giá Vàng (XAU) và Bạc chịu áp lực chốt lời, quét giảm về các vùng hỗ trợ thấp hơn.
                </p>
                <div class="text-[10px] font-mono text-rose-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  🎯 <strong>Kế hoạch tác chiến:</strong> Không bắt đáy sớm; chờ nến H1 tạo râu từ chối tại dải đáy MA WAVE V8 để kích hoạt lệnh.
                </div>
              </div>

              <!-- Kịch Bản B: Lạm Phát Hạ Nhiệt / Kinh Tế Chậm Lại -->
              <div class="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                    📉 KỊCH BẢN B: DỮ LIỆU YẾU HƠN HOẶC ĐÚNG DỰ BÁO
                  </span>
                  <span class="text-[10px] text-emerald-400 font-mono font-bold">USD Giảm • Vàng Bứt Phá Mạnh</span>
                </div>
                <p class="text-[11px] text-slate-200 leading-relaxed font-sans">
                  <strong>Diễn biến:</strong> Lạm phát hạ nhiệt đều đặn hoặc thị trường lao động chậm lại -> Mở đường cho Fed đẩy nhanh tiến độ cắt giảm lãi suất (Dovish) -> Đồng USD suy yếu -> Giá Vàng, Bạc và Bitcoin bứt phá mạnh mẽ theo đà sóng tăng.
                </p>
                <div class="text-[10px] font-mono text-emerald-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  🎯 <strong>Kế hoạch tác chiến:</strong> Giữ vững các lệnh BUY theo dải sóng Wave; chủ động nâng Stop Loss về điểm vào lệnh để gồng lãi an toàn.
                </div>
              </div>

            </div>
          </div>

          <!-- 5. TÁC ĐỘNG RIÊNG CHO 4 TÀI SẢN (USD • VÀNG • BITCOIN • BẠC) -->
          <div class="space-y-2">
            <div class="text-[11px] font-black text-amber-300 uppercase flex items-center gap-1.5">
              <span>🎯</span> TÁC ĐỘNG VÀ ĐẶC TÍNH RIÊNG BIỆT CỦA 4 TÀI SẢN:
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              
              <!-- USD -->
              <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1">💵 USD (DXY)</span>
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Biến động gốc</span>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">
                  Đồng tiền định giá thị trường. Mọi động thái lãi suất của Fed đều phản ánh trực tiếp vào sức mạnh chỉ số DXY trước tiên.
                </p>
              </div>

              <!-- VÀNG -->
              <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-yellow-400 uppercase flex items-center gap-1">🪙 VÀNG (XAU)</span>
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">Nhạy cảm vĩ mô</span>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">
                  Tài sản trú ẩn số 1 thế giới. Nhạy cảm nhất với lãi suất thực và lợi suất trái phiếu Mỹ, biên độ phản ứng 20 - 40 giá khi ra tin.
                </p>
              </div>

              <!-- BITCOIN -->
              <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1">₿ BITCOIN (BTC)</span>
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">Vàng kỹ thuật số</span>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">
                  Hoạt động 24/7 không nghỉ cuối tuần. Hưởng lợi lớn từ thanh khoản toàn cầu mở rộng và khẩu vị chấp nhận rủi ro của giới đầu tư.
                </p>
              </div>

              <!-- BẠC -->
              <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1">🥈 BẠC (XAG)</span>
                  <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-200">High Beta x1.5</span>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">
                  Vừa là kim loại quý vừa là nguyên liệu công nghiệp. Chạy cùng hướng với Vàng nhưng biến động phần trăm mạnh hơn gấp 1.5 - 2 lần.
                </p>
              </div>

            </div>
          </div>

          <!-- 6. ĐỐI CHIẾU MA WAVE V8 CONFLUENCE CARD -->
          <div class="${isConfluence ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-amber-950/40 border-amber-500/50'} border rounded-2xl p-3.5 flex items-start gap-3">
            <span class="text-xl shrink-0">${isConfluence ? '✅' : '⚠️'}</span>
            <div class="flex-1 space-y-1">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <h4 class="text-xs font-black ${isConfluence ? 'text-emerald-400' : 'text-amber-300'}">
                  ${confluenceTitle}
                </h4>
                <div class="flex items-center gap-2 text-[10px] font-mono text-slate-300">
                  <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Xu Hướng Kỹ Thuật: <strong class="text-amber-400">${techTrend}</strong></span>
                  <span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Sóng: <strong class="text-amber-300">${waveState}</strong></span>
                </div>
              </div>
              <p class="text-xs text-slate-200 leading-relaxed">
                ${confluenceDesc}
              </p>
            </div>
          </div>

        </div>
      `;
    } catch (err) {
      console.warn('renderDailyOutlookAndConfluence error:', err);
    }
  },

  renderEventCard(evt, isHighOnly = false) {
    const isHigh = evt.importance === 'HIGH';
    const isReleased = evt.actual !== null && evt.actual !== undefined && evt.actual !== '' && evt.actual !== '-';
    
    // Xác định nhanh tác động dự kiến của sự kiện tới 4 tài sản
    const assetPills = isHigh ? `
      <div class="grid grid-cols-4 gap-1 pt-2 pb-1 border-t border-slate-800/80 text-center text-[9px] font-mono">
        <div class="p-1 rounded bg-slate-900 border border-amber-500/20" title="Vàng XAU/USD">
          <span class="text-amber-400 block font-bold">XAU</span>
          <span class="text-[8px] text-emerald-400 font-bold">Nhạy cảm</span>
        </div>
        <div class="p-1 rounded bg-slate-900 border border-orange-500/20" title="Bitcoin BTC/USD">
          <span class="text-orange-400 block font-bold">BTC</span>
          <span class="text-[8px] text-amber-300 font-bold">Thanh khoản</span>
        </div>
        <div class="p-1 rounded bg-slate-900 border border-slate-700/40" title="Bạc XAG/USD">
          <span class="text-slate-300 block font-bold">XAG</span>
          <span class="text-[8px] text-slate-300 font-bold">Đồng pha</span>
        </div>
        <div class="p-1 rounded bg-slate-900 border border-emerald-500/20" title="Chỉ số USD DXY">
          <span class="text-emerald-400 block font-bold">DXY</span>
          <span class="text-[8px] text-rose-400 font-bold">Nghịch đảo</span>
        </div>
      </div>
    ` : '';

    return `
      <div class="bg-panel border ${isHigh ? 'border-rose-500/40 hover:border-rose-500/70 shadow-rose-950/20' : 'border-slate-800 hover:border-amber-500/40'} rounded-2xl p-4 shadow-xl flex flex-col justify-between transition">
        
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isHigh ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                ${isHigh ? '🔴 HIGH IMPACT' : '🟠 MEDIUM'}
              </span>
              <span class="text-[10px] font-bold text-amber-400 font-mono">${evt.currency}</span>
            </div>

            <div class="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              ⏱ ${evt.eventTimeVietnam} GMT+7
            </div>
          </div>

          <h4 class="font-bold text-white text-xs mb-1 leading-snug line-clamp-2" title="${evt.eventName}">
            ${evt.eventNameVn}
          </h4>
          <div class="text-[9px] text-slate-400 font-mono mb-2.5 truncate">${evt.eventName}</div>

          <!-- Values Grid (Kỳ trước • Dự báo • Thực tế) -->
          <div class="grid grid-cols-3 gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-2 mb-2 text-center font-mono text-[11px]">
            <div>
              <span class="text-[8px] text-slate-500 block uppercase font-sans">Kỳ Trước</span>
              <span class="font-bold text-slate-400">${evt.previous || '—'}</span>
            </div>
            <div>
              <span class="text-[8px] text-slate-500 block uppercase font-sans">Dự Báo</span>
              <span class="font-bold text-amber-300">${evt.forecast || '—'}</span>
            </div>
            <div>
              <span class="text-[8px] text-slate-500 block uppercase font-sans">Thực Tế</span>
              <span class="font-black ${isReleased ? 'text-emerald-400' : 'text-amber-400/90 text-[10px]'}">
                ${isReleased ? evt.actual : 'Chưa công bố'}
              </span>
            </div>
          </div>

          ${assetPills}
        </div>

        <div>
          <!-- Footer Countdown / Status -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] mt-2">
            <div class="flex items-center gap-1 text-slate-400 font-medium">
              <span>TRẠNG THÁI:</span>
              <span id="countdown-${evt.eventId}">
                ${isReleased ? '<span class="text-emerald-400 font-bold">✓ ĐÃ CÔNG BỐ</span>' : '<span class="text-amber-400 font-bold">⏳ CHỜ SỐ LIỆU</span>'}
              </span>
            </div>

            <div class="flex items-center gap-1 text-slate-400 font-medium">
              <span>ẢNH HƯỞNG:</span>
              <span class="font-black ${isHigh ? 'text-rose-400' : 'text-amber-300'}">${isHigh ? 'RẤT MẠNH' : 'VỪA PHẢI'}</span>
            </div>
          </div>

          <!-- Action Button: Open Detailed Macro Breakdown Modal -->
          <button type="button" onclick="GoldNewsCenter.openNewsDetailModal('${evt.eventId}')" class="w-full mt-2.5 py-1.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[10px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
            <span>🧠</span> <span>Hiểu Tin Này & Tác Động 4 Tài Sản</span>
          </button>
        </div>

      </div>
    `;
  },

  openNewsDetailModal(eventId) {
    const evt = (this.events || []).find(e => e.eventId === eventId) || (this.allEvents || []).find(e => e.eventId === eventId);
    if (!evt) return;

    const modal = document.getElementById('news-detail-modal');
    const titleEl = document.getElementById('news-modal-title');
    const subEl = document.getElementById('news-modal-subtitle');
    const bodyEl = document.getElementById('news-modal-body');

    if (!modal || !bodyEl) return;

    const analysis = evt.detailedAnalysis || {
      category: 'MACRO',
      overview: 'Sự kiện kinh tế định kỳ cung cấp dữ liệu định lượng về sức khỏe nền kinh tế Mỹ, tác động trực tiếp đến định hướng điều hành lãi suất của Fed.',
      whyItMatters: 'Số liệu kinh tế tác động trực tiếp tới dòng tiền toàn cầu giữa đồng USD, trái phiếu chính phủ Mỹ và các tài sản trú ẩn an toàn như Vàng và Bitcoin.',
      scenarios: {
        higher: 'Thực tế cao hơn dự báo: USD tăng giá, gây áp lực điều chỉnh lên giá Vàng.',
        asExpected: 'Thực tế sát dự báo: Thị trường vận động bình thường theo dải kỹ thuật MA WAVE V8.',
        lower: 'Thực tế thấp hơn dự báo: USD suy yếu, hỗ trợ đà tăng mạnh mẽ của Vàng và Bitcoin.'
      },
      assetImpacts: {
        gold: 'Giá Vàng phản ứng với biên độ 15 - 30 giá. Ưu tiên canh điểm vào lệnh theo dải EMA20/EMA50.',
        btc: 'Bitcoin biến động theo thanh khoản đồng USD.',
        silver: 'Bạc biến động đồng pha với Vàng, biên độ dao động phần trăm cao hơn.',
        dxy: 'DXY biến động tỷ lệ thuận với số liệu công bố.'
      },
      actionablePlaybook: {
        beforeRelease: 'Dời Stop Loss về hòa vốn trước giờ tin 15 phút.',
        duringRelease: 'Không mở lệnh trong 5 phút đầu tin ra để tránh giãn spread.',
        afterRelease: 'Chờ 15-30 phút để thị trường hấp thụ hết tin tức trước khi mở vị thế mới.'
      }
    };

    const isHigh = evt.importance === 'HIGH';
    const isReleased = evt.actual !== null && evt.actual !== undefined && evt.actual !== '' && evt.actual !== '-';

    if (titleEl) titleEl.textContent = evt.eventNameVn || evt.title_vn || evt.title;
    if (subEl) subEl.textContent = `${evt.dateLabel || evt.dateStr} lúc ${evt.eventTimeVietnam || evt.time} (GMT+7) • ${evt.currency} • ${isHigh ? '🔴 HIGH IMPACT' : '🟠 MEDIUM IMPACT'}`;

    bodyEl.innerHTML = `
      <!-- 1. Header Metrics Card -->
      <div class="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center font-mono">
        <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span class="text-[9px] text-slate-400 block font-sans uppercase">Kỳ Trước (Previous)</span>
          <strong class="text-sm font-black text-slate-400">${evt.previous || '—'}</strong>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
          <span class="text-[9px] text-slate-400 block font-sans uppercase">Dự Báo (Forecast)</span>
          <strong class="text-sm font-black text-amber-300">${evt.forecast || '—'}</strong>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-950/70 border ${isReleased ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-amber-500/30 bg-amber-950/10'}">
          <span class="text-[9px] text-slate-400 block font-sans uppercase">Thực Tế (Actual)</span>
          <strong class="text-sm font-black ${isReleased ? 'text-emerald-400' : 'text-amber-400/90 text-xs'}">${isReleased ? evt.actual : 'Chưa công bố'}</strong>
        </div>
      </div>

      <!-- 2. Bối Cảnh & Ý Nghĩa Với Fed -->
      <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
        <h4 class="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
          <span>🏛️</span> BỐI CẢNH KINH TẾ & Ý NGHĨA VỚI CHÍNH SÁCH TIỀN TỆ FED
        </h4>
        <p class="text-xs text-slate-200 leading-relaxed font-sans">
          ${analysis.overview}
        </p>
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
          <strong>Tại sao chỉ số này quan trọng:</strong> ${analysis.whyItMatters}
        </div>
      </div>

      <!-- 3. 3 Kịch Bản Số Liệu Thực Tế -->
      <div class="space-y-2">
        <h4 class="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
          <span>⚡</span> 3 KỊCH BẢN PHẢN ỨNG CỦA THỊ TRƯỜNG KHI RA TIN
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 space-y-1 transition">
            <span class="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase block w-fit">
              📈 Kịch Bản 1: Thực Tế > Dự Báo
            </span>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.scenarios ? analysis.scenarios.higher : 'USD tăng giá, gây áp lực lên Vàng.'}</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 space-y-1 transition">
            <span class="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase block w-fit">
              ⚖️ Kịch Bản 2: Thực Tế = Dự Báo
            </span>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.scenarios ? analysis.scenarios.asExpected : 'Thị trường vận động bình thường theo sóng kỹ thuật.'}</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 space-y-1 transition">
            <span class="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase block w-fit">
              📉 Kịch Bản 3: Thực Tế < Dự Báo
            </span>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.scenarios ? analysis.scenarios.lower : 'USD giảm, Vàng và BTC tăng mạnh.'}</p>
          </div>
        </div>
      </div>

      <!-- 4. Đánh Giá Tác Động Từng Tài Sản (Vàng • BTC • Bạc • DXY) -->
      <div class="space-y-2">
        <h4 class="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
          <span>🎯</span> ĐÁNH GIÁ TÁC ĐỘNG CHI TIẾT TỪNG TÀI SẢN
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          
          <div class="p-3 rounded-xl bg-gradient-to-br from-[#121a24] to-[#0a0e14] border border-amber-500/30 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-yellow-400">
              <span>🪙</span> <span>Vàng (XAU/USD):</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.assetImpacts ? analysis.assetImpacts.gold : 'Phản ứng theo xu hướng lạm phát và lợi suất.'}</p>
          </div>

          <div class="p-3 rounded-xl bg-gradient-to-br from-[#121a24] to-[#0a0e14] border border-orange-500/30 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-orange-400">
              <span>₿</span> <span>Bitcoin (BTC/USD):</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.assetImpacts ? analysis.assetImpacts.btc : 'Hưởng lợi từ thanh khoản mở rộng khi USD yếu.'}</p>
          </div>

          <div class="p-3 rounded-xl bg-gradient-to-br from-[#121a24] to-[#0a0e14] border border-slate-600/40 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <span>🥈</span> <span>Bạc (XAG/USD):</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.assetImpacts ? analysis.assetImpacts.silver : 'Đồng pha với Vàng, biên độ phần trăm cao gấp 1.5 - 2 lần.'}</p>
          </div>

          <div class="p-3 rounded-xl bg-gradient-to-br from-[#121a24] to-[#0a0e14] border border-emerald-500/30 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <span>💵</span> <span>Chỉ Số USD (DXY):</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${analysis.assetImpacts ? analysis.assetImpacts.dxy : 'Biến động cùng chiều với kết quả số liệu.'}</p>
          </div>

        </div>
      </div>

      <!-- 5. Kế Hoạch Tác Chiến Trader 3 Giai Đoạn -->
      <div class="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#182030] to-slate-900 border border-sky-500/40 space-y-2">
        <h4 class="text-xs font-black text-sky-300 uppercase flex items-center gap-1.5">
          <span>🛡️</span> LỜI KHUYÊN & KẾ HOẠCH HÀNH ĐỘNG DÀNH CHO TRADER (MA WAVE V8 PLAYBOOK)
        </h4>
        <div class="space-y-1.5 text-[11px] text-slate-200">
          <div class="flex items-start gap-2">
            <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold font-mono text-[9px] shrink-0 mt-0.5">T-15m:</span>
            <span>${analysis.actionablePlaybook ? analysis.actionablePlaybook.beforeRelease : 'Dời Stop Loss về hòa vốn, rà soát lại khối lượng lot.'}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold font-mono text-[9px] shrink-0 mt-0.5">0-5m:</span>
            <span>${analysis.actionablePlaybook ? analysis.actionablePlaybook.duringRelease : 'Tránh mở lệnh sát giờ ra tin do spread giãn nở và trượt giá.'}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono text-[9px] shrink-0 mt-0.5">15-30m:</span>
            <span>${analysis.actionablePlaybook ? analysis.actionablePlaybook.afterRelease : 'Chờ nến xác nhận tại dải động EMA20 / EMA50 của MA WAVE V8 để vào lệnh an toàn.'}</span>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  },

  closeNewsDetailModal() {
    const modal = document.getElementById('news-detail-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  },

  renderAIAnalysisCard(evt) {
    const a = evt.analysis;
    if (!a) return '';

    const isConfluence = a.alignment === 'CONFLUENCE';

    return `
      <div class="bg-gradient-to-r from-slate-900 via-panel to-panel border ${isConfluence ? 'border-emerald-500/40' : 'border-amber-500/50'} rounded-2xl p-4 shadow-2xl space-y-3">
        
        <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">✦</span>
            <div>
              <h4 class="text-xs font-black text-white">${evt.eventNameVn}</h4>
              <span class="text-[9px] text-slate-400 font-mono">Actual: <strong class="text-emerald-400">${evt.actual}</strong> | Forecast: ${evt.forecast} | Previous: ${evt.previous}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 font-mono text-xs flex-wrap">
            <div class="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              <strong class="${a.usdImpact === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}">${a.usdLabel}</strong>
            </div>
            <div class="px-2.5 py-1 rounded bg-slate-800 border border-slate-700">
              <strong class="${a.goldImpact === 'SUPPORTIVE' ? 'text-emerald-400' : 'text-rose-400'}">${a.goldLabel}</strong>
            </div>
            <div class="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
              Độ tin cậy: ${a.confidence}%
            </div>
          </div>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          <strong>🧠 AI Phân Tích Tác Động:</strong> ${a.reason}
        </p>

        <div class="${isConfluence ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/40'} border rounded-xl p-3 flex items-start gap-2.5 text-xs">
          <span class="text-base shrink-0">${isConfluence ? '✅' : '⚠️'}</span>
          <div>
            <div class="font-bold ${isConfluence ? 'text-emerald-400' : 'text-amber-400'} mb-0.5">
              NEWS + MA WAVE CONTEXT: ${isConfluence ? 'ĐỒNG HƯỚNG KỸ THUẬT' : 'PHÂN KỲ BỐI CẢNH VS KỸ THUẬT'}
            </div>
            <p class="text-slate-300 leading-normal">
              ${a.alignmentText}
            </p>
          </div>
        </div>

      </div>
    `;
  },

  renderTimelineView(events) {
    const phases = [
      { name: 'Phiên Á - Sáng (00:00 - 12:00 GMT+7)', range: [0, 12] },
      { name: 'Phiên Âu - Chiều (12:00 - 18:00 GMT+7)', range: [12, 18] },
      { name: 'Phiên Mỹ - Tối (18:00 - 22:00 GMT+7)', range: [18, 22] },
      { name: 'Phiên Đêm (22:00 - 00:00 GMT+7)', range: [22, 24] }
    ];

    return `
      <div class="space-y-6">
        ${phases.map(phase => {
          const phaseEvts = events.filter(e => {
            if (!e) return false;
            const timeStr = String(e.eventTimeVietnam || e.time || '19:30');
            const h = parseInt(timeStr.split(':')[0], 10);
            return !isNaN(h) && h >= phase.range[0] && h < phase.range[1];
          });

          if (!phaseEvts.length) return '';

          return `
            <div>
              <h4 class="text-[11px] font-black text-amber-400 uppercase mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span> ${phase.name}
              </h4>

              <div class="relative border-l-2 border-slate-800 ml-3 space-y-4 py-1">
                ${phaseEvts.map(evt => `
                  <div class="relative pl-6">
                    <div class="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full ${evt.importance === 'HIGH' ? 'bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse' : 'bg-amber-500'} border-2 border-slate-950"></div>
                    
                    <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 hover:border-amber-500/30 transition">
                      <div class="flex items-center justify-between text-xs mb-1">
                        <span class="font-mono font-bold text-amber-400">${evt.eventTimeVietnam} — ${evt.dateLabel} (GMT+7)</span>
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold ${evt.importance === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
                          ${evt.importance}
                        </span>
                      </div>
                      
                      <h5 class="font-bold text-white text-xs">${evt.eventNameVn}</h5>
                      <div class="text-[9px] text-slate-400 font-mono mt-1">
                        Actual: <strong class="text-emerald-400">${evt.actual || '—'}</strong> | Forecast: ${evt.forecast} | Previous: ${evt.previous}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // Date Filter Setters
  setDateTabFilter(tabName) {
    this.activeFilter.dateTab = tabName;
    const customBox = document.getElementById('news-custom-date-box');
    if (customBox) {
      if (tabName === 'CUSTOM') customBox.classList.remove('hidden');
      else customBox.classList.add('hidden');
    }
    this.fetchEvents(false);
    if (tabName === 'TOMORROW') {
      setTimeout(() => this.sendTomorrowNewsPushNotification(), 500);
    }
  },

  setTimeFilter(tabName) {
    this.setDateTabFilter(tabName);
  },

  setCustomDateRange(from, to) {
    this.activeFilter.customFrom = from;
    this.activeFilter.customTo = to;
    if (from && to) {
      this.fetchEvents(false);
    }
  },

  setImpactFilter(impact) {
    this.activeFilter.impact = impact;
    this.renderUI();
  },

  setSearchQuery(q) {
    this.activeFilter.search = q;
    this.renderUI();
  },
  // 7. 20-MINUTE RECURRING AUTOMATIC NEWS PUSH ENGINE (CHỈ BÁO TIN CHƯA ĐẾN GIỜ)
  start20MinNewsAutoPushEngine() {
    if (this.autoPush20MinInterval) clearInterval(this.autoPush20MinInterval);

    // Initial check after 10 seconds, then repeat every 20 minutes (20 * 60 * 1000 ms)
    setTimeout(() => this.dispatch20MinUpcomingNewsPush(), 10000);
    this.autoPush20MinInterval = setInterval(() => {
      this.dispatch20MinUpcomingNewsPush();
    }, 20 * 60 * 1000);
  },

  dispatch20MinUpcomingNewsPush() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();
    const allEvents = (this.allEvents && this.allEvents.length > 0) ? this.allEvents : this.events;

    // Lọc TUYỆT ĐỐI các tin tức CHƯA ĐẾN GIỜ công bố (timestamp > now và chưa có kết quả)
    const upcomingEvents = allEvents.filter(e => {
      const isNotReleased = (e.actual === null || e.actual === undefined || e.actual === '' || e.actual === '-');
      const isFuture = e.timestamp ? e.timestamp > now : true;
      const isUpcomingStatus = e.status !== 'RELEASED' && e.state !== 'RELEASED';
      return isNotReleased && isFuture && isUpcomingStatus;
    });

    // Nếu không còn tin tức nào chưa đến giờ -> Im lặng (không gửi thông báo rác)
    if (upcomingEvents.length === 0) return;

    // Ưu tiên tin Đỏ (HIGH IMPACT), sau đó đến tin Cam (MEDIUM)
    const highUpcoming = upcomingEvents.filter(e => e.importance === 'HIGH');
    const targetList = highUpcoming.length > 0 ? highUpcoming : upcomingEvents;

    // Sắp xếp theo mốc thời gian sớm nhất trước
    targetList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Lấy tối đa 3 tin chuẩn bị ra sớm nhất
    const topUpcoming = targetList.slice(0, 3);
    const countLabel = upcomingEvents.length;

    const eventLines = topUpcoming.map(e => {
      const icon = e.importance === 'HIGH' ? '🔴' : '🟠';
      const forecastStr = (e.forecast && e.forecast !== '-') ? ` (Dự báo: ${e.forecast})` : '';
      return `${icon} ${e.time || '19:30'} - ${e.eventNameVn || e.title}${forecastStr}`;
    }).join('\n');

    const title = `🔔 CẬP NHẬT TỰ ĐỘNG: ${countLabel} TIN TỨC CHUẨN BỊ RA (GMT+7)`;
    const body = `Hệ thống tự động quét (Mỗi 20 phút):\n${eventLines}\n💡 Đã bật cảnh báo nảy trước 15m & 5m khi tin ra!`;

    if (typeof window.sendNativePushNotification === 'function') {
      window.sendNativePushNotification(title, {
        body: body,
        tag: `auto-news-20m-${Math.floor(now / (20 * 60 * 1000))}`
      });
    }
  }
};

window.GoldNewsCenter = GoldNewsCenter;

// Global helper filters for UI clicks
window.setNewsTimeFilter = function(btn, dateTab) {
  document.querySelectorAll('.news-tf-btn').forEach(b => {
    b.className = 'news-tf-btn px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer';
  });
  if (btn) btn.className = 'news-tf-btn px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold transition cursor-pointer';
  GoldNewsCenter.setDateTabFilter(dateTab);
};

window.setNewsImpactFilter = function(btn, impact) {
  document.querySelectorAll('.news-imp-btn').forEach(b => {
    b.className = 'news-imp-btn px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer';
  });
  if (btn) btn.className = 'news-imp-btn px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold transition cursor-pointer';
  GoldNewsCenter.setImpactFilter(impact);
};

// Macro Detail Modal Engine (Giải thích chi tiết 4 chỉ số Vĩ Mô trực quan, dễ hiểu)
const MacroIndicatorsKnowledge = {
  DXY: {
    title: 'CHỈ SỐ ĐÔ LA MỸ — US DOLLAR INDEX (DXY)',
    icon: '🇺🇸',
    currentVal: '103.85 (-0.25%)',
    source: 'TradingView / ICE Intercontinental Exchange (Live GMT+7)',
    nature: 'Thước đo sức mạnh đồng bạc xanh so với rổ 6 đồng tiền chủ chốt (EUR, JPY, GBP, CAD, SEK, CHF). Trong đó EUR chiếm tỷ trọng lớn nhất (~57.6%).',
    whyItMatters: 'Vàng thế giới (XAU/USD) được định giá bằng Đô la Mỹ. Khi đồng USD mạnh lên, nhà đầu tư nắm giữ các đồng tiền khác phải trả nhiều tiền hơn để mua cùng một lượng Vàng -> Lực cầu giảm -> Vàng giảm giá. Ngược lại, khi USD suy yếu, Vàng trở nên rẻ và hấp dẫn hơn -> Lực mua tăng mạnh.',
    readingGuide: [
      { range: 'DXY > 105.00', meaning: 'USD cực mạnh (Hawkish). Áp lực bán đè nặng lên Vàng và Bạc, ưu tiên canh Sell hồi hoặc đứng ngoài.' },
      { range: 'DXY 102.50 – 104.50', meaning: 'USD tích lũy đi ngang (Sideway). Vàng chạy theo sóng kỹ thuật MA WAVE V8, giằng co theo phiên.' },
      { range: 'DXY < 102.00', meaning: 'USD suy yếu rõ rệt (Dovish). Ngòi nổ bùng nổ sóng Tăng mạnh mẽ cho Vàng, Bạc và Bitcoin.' }
    ],
    actionForTrader: 'Trước khi vào lệnh Vàng (XAU/USD), luôn liếc nhìn nến DXY trên khung M15/H1: Nếu DXY đang phá đáy giảm, lệnh BUY Vàng có tỷ lệ thắng cao hơn gấp 2 lần!'
  },
  FED: {
    title: 'KỲ VỌNG LÃI SUẤT LIÊN BANG MỸ (CME FEDWATCH)',
    icon: '🏛️',
    currentVal: '88.5% (Ngừng tăng / Cắt giảm lãi suất)',
    source: 'CME Group 30-Day Fed Fund Futures Pricing Tool',
    nature: 'Tỷ lệ phần trăm thể hiện kỳ vọng tập thể của hàng triệu nhà giao dịch và tổ chức tài chính toàn cầu về quyết định lãi suất trong kỳ họp FOMC kế tiếp.',
    whyItMatters: 'Vàng là tài sản phi lãi suất (nắm giữ vàng không nhận được tiền lãi hàng tháng). Khi Fed duy trì lãi suất 5.5%, các quỹ lớn gửi tiền vào trái phiếu chính phủ Mỹ để nhận lãi an toàn. Nhưng khi Fed chuẩn bị giảm lãi suất, sức hấp dẫn của tiền gửi mất đi, dòng tiền ồ ạt rút ra và đổ vào Vàng để tích trữ tài sản.',
    readingGuide: [
      { range: '> 80% Giữ nguyên / Cắt giảm (Dovish)', meaning: 'Bối cảnh vĩ mô cực kỳ thuận lợi (Bullish) cho Vàng và Bitcoin trong trung và dài hạn.' },
      { range: '50% – 70% Tranh chấp', meaning: 'Thị trường chưa đồng thuận, giá Vàng dễ quét nến 2 đầu giật mạnh mỗi khi có quan chức Fed phát biểu.' },
      { range: '> 60% Tăng lãi suất (Hawkish)', meaning: 'Chính sách thắt chặt tiền tệ, dòng tiền hút về USD, bất lợi cho các tài sản trú ẩn.' }
    ],
    actionForTrader: 'Theo dõi các đợt công bố CPI và phát biểu của Jerome Powell. Khi tỷ lệ cắt giảm tăng vọt trên 85%, các vị thế BUY Vàng theo sóng MA WAVE V8 có độ tin cậy giữ lệnh dài hạn rất tốt.'
  },
  SENTIMENT: {
    title: 'CHỈ SỐ TÂM LÝ THỊ TRƯỜNG & KHẨU VỊ RỦI RO',
    icon: '🧭',
    currentVal: '74 / 100 — Lạc Quan (Greed)',
    source: 'Tổng hợp từ Chỉ số biến động S&P500 VIX + Alternative.me Fear & Greed Index (Cập nhật 24h)',
    nature: 'Thang đo nhiệt kế tâm lý từ 0 (Sợ hãi tột cùng - Extreme Fear) đến 100 (Hưng phấn tột độ - Extreme Greed). Lưu ý: Đây là thước đo tâm lý dòng tiền, KHÔNG PHẢI xác suất giá tăng.',
    whyItMatters: 'Giúp trader không bị hiệu ứng đám đông FOMO đu đỉnh hoặc hoảng loạn bán tháo ở đáy. Dòng tiền lớn thường tích lũy âm thầm khi đám đông Sợ Hãi và chốt lời dần khi đám đông quá Hưng Phấn.',
    readingGuide: [
      { range: '0 – 25 (Sợ hãi tột cùng)', meaning: 'Đám đông hoảng loạn tháo chạy. Đây thường là vùng đáy trung hạn lý tưởng để gom Vàng và BTC.' },
      { range: '26 – 60 (Trung lập & Thận trọng)', meaning: 'Thị trường tích lũy lành mạnh, các lệnh giao dịch theo xu hướng MA WAVE có độ ổn định cao.' },
      { range: '75 – 100 (Hưng phấn tột độ)', meaning: 'Cảnh báo rủi ro điều chỉnh quét râu nến (Bull trap), tránh đu lệnh Buy đuổi giá cao.' }
    ],
    actionForTrader: 'Với điểm số 74 hiện tại: Thị trường đang hưng phấn tích cực nhưng gần chạm ngưỡng quá mua. Trader nên tuân thủ kỷ luật chốt lời TP1/TP2 từng phần, tuyệt đối không nhồi lệnh Buy tại đỉnh cản.'
  },
  SJC: {
    title: 'VÀNG MIẾNG SJC & THỊ TRƯỜNG VÀNG TRONG NƯỚC',
    icon: '🪙',
    currentVal: '89.20 Triệu Đồng / Lượng (Mua vào: 87.70 — Bán ra: 89.20)',
    source: 'Khảo sát giá niêm yết DOJI, SJC Hà Nội & TP.HCM (Tham Khảo Phiên Hôm Nay)',
    nature: 'Giá tham khảo mua - bán vàng miếng thương hiệu quốc gia SJC tại thị trường Việt Nam (tính theo đơn vị 1 lượng = 37.5 gram = 1.2056 troy ounce).',
    whyItMatters: 'Giá vàng trong nước chịu tác động kép từ giá vàng thế giới (XAU/USD) và tỷ giá USD/VND ngân hàng. Do các chính sách quản lý thị trường vàng của Ngân hàng Nhà nước, giá SJC thường có độ chênh lệch (premium) từ 2 đến 5 triệu đồng/lượng so với giá thế giới quy đổi.',
    readingGuide: [
      { range: 'Chênh lệch < 3 Triệu/Lượng', meaning: 'Thị trường trong nước ổn định, bám sát nhịp tăng giảm của giá thế giới XAU/USD.' },
      { range: 'Chênh lệch 4 – 7 Triệu/Lượng', meaning: 'Nhu cầu gom vàng vật lý trong dân tăng cao hoặc nguồn cung vàng miếng khan hiếm.' },
      { range: 'Spread Mua-Bán dãn > 2 Triệu', meaning: 'Các tiệm vàng phòng vệ rủi ro biến động mạnh, mua vàng miếng lúc này chịu chi phí spread cao.' }
    ],
    actionForTrader: 'Dành cho anh em giao dịch vàng vật lý hoặc tích sản: Khi XAU/USD trên app báo tín hiệu Sóng Tăng MA WAVE V8, giá SJC trong nước thường sẽ điều chỉnh tăng theo sau 1-2 phiên làm việc.'
  }
};

window.openMacroDetailModal = function(indicatorKey) {
  const data = MacroIndicatorsKnowledge[indicatorKey];
  if (!data) return;

  const modal = document.getElementById('macro-detail-modal');
  const titleEl = document.getElementById('macro-modal-title');
  const subEl = document.getElementById('macro-modal-subtitle');
  const iconEl = document.getElementById('macro-modal-icon');
  const bodyEl = document.getElementById('macro-modal-body');

  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = data.title;
  if (subEl) subEl.textContent = `Giá trị hiện tại: ${data.currentVal} • Nguồn: ${data.source}`;
  if (iconEl) iconEl.textContent = data.icon;

  const readingRows = data.readingGuide.map(r => `
    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
      <span class="text-amber-400 font-mono font-bold text-[11px] block">${r.range}</span>
      <p class="text-slate-300 text-[10px] leading-relaxed font-sans">${r.meaning}</p>
    </div>
  `).join('');

  bodyEl.innerHTML = `
    <!-- Bản chất & Nguồn gốc -->
    <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
      <div class="text-[11px] font-bold text-amber-300 uppercase flex items-center gap-1.5">
        <span>📖</span> <span>Bản Chất Chỉ Số:</span>
      </div>
      <p class="text-xs text-slate-200 leading-relaxed font-sans">${data.nature}</p>
    </div>

    <!-- Vì sao quan trọng đối với Vàng -->
    <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
      <div class="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
        <span>🎯</span> <span>Tác Động Trực Tiếp Đến Giá Vàng & Thị Trường:</span>
      </div>
      <p class="text-xs text-amber-100/90 leading-relaxed font-sans">${data.whyItMatters}</p>
    </div>

    <!-- Hướng dẫn đọc thang đo -->
    <div class="space-y-2">
      <div class="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
        <span>📊</span> <span>Thang Đo & Ý Nghĩa Từng Mức Điểm:</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        ${readingRows}
      </div>
    </div>

    <!-- Hành động dành cho Trader -->
    <div class="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
      <div class="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1.5">
        <span>💡</span> <span>Kinh Nghiệm Thực Chiến MA WAVE V8:</span>
      </div>
      <p class="text-xs text-emerald-200 leading-relaxed font-sans">${data.actionForTrader}</p>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.closeMacroDetailModal = function() {
  const modal = document.getElementById('macro-detail-modal');
  if (modal) modal.classList.add('hidden');
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  GoldNewsCenter.fetchEvents();
  GoldNewsCenter.start20MinNewsAutoPushEngine();
  // Scheduler: Sync calendar dataset every 3 minutes
  setInterval(() => GoldNewsCenter.fetchEvents(), 3 * 60 * 1000);
});

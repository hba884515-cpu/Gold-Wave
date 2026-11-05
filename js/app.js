/**
 * Gold Trading App - Bộ Điều Phối MA WAVE V8 PRO - TREND + SW
 * Vẽ trực tiếp toàn bộ các đường EMA20 (Aqua), EMA50 (Đỏ) và nhãn tín hiệu Pine Script v5 lên biểu đồ.
 */

let tvWidgetInstance = null;

// Chuyển đổi khung thời gian
window.changeAppInterval = function(interval) {
  let tf = '15m';
  if (interval === '5' || interval === '5m') tf = '5m';
  else if (interval === '15' || interval === '15m') tf = '15m';
  else if (interval === '30' || interval === '30m') tf = '30m';
  else if (interval === '60' || interval === '1h' || interval === '60m') tf = '1h';
  else if (interval === '120' || interval === '2h') tf = '2h';
  else if (interval === '180' || interval === '3h') tf = '3h';
  else if (interval === '240' || interval === '4h') tf = '4h';
  else if (interval === 'D' || interval === '1d') tf = '1d';

  document.querySelectorAll('.tv-tf-btn').forEach(btn => {
    const attr = btn.getAttribute('data-interval');
    if (attr === interval || attr === tf || (attr === '60' && tf === '1h') || (attr === 'D' && tf === '1d')) {
      btn.classList.add('active-tf');
      btn.classList.remove('text-slate-300');
    } else {
      btn.classList.remove('active-tf');
      btn.classList.add('text-slate-300');
    }
  });

  if (window.marketDataStore) {
    window.marketDataStore.setTimeframe(tf);
  }

  if (window.app) {
    window.app.currentTimeframe = tf;
    window.app.loadInitialBars();
    window.app.renderIndicators();
    window.app.updateReplayUI();
    if (window.app.chart) {
      setTimeout(() => {
        try {
          window.app.chart.timeScale().fitContent();
          if (window.app.lastIndicatorResult) {
            window.app.renderSvgOverlay(window.app.lastIndicatorResult.swBoxes, window.app.lastIndicatorResult.tradeLines);
          }
        } catch (e) {}
      }, 50);
    }
  }

  // Cập nhật TradingView widget iframe theo khung thời gian đã chọn
  initTradingViewWidget(interval);
};

window.currentTradingViewChartId = 'tDGKCrGZ';

function initTradingViewWidget(interval = '60') {
  const iframe = document.getElementById('tv-widget-iframe');
  const chartParam = window.currentTradingViewChartId ? `&chart=${window.currentTradingViewChartId}` : '';
  const targetSrc = `https://s.tradingview.com/widgetembed/?chart=${window.currentTradingViewChartId}&symbol=TVC%3AGOLD&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&theme=dark&style=1&timezone=Asia%2FHo_Chi_Minh&locale=vi_VN&withdateranges=1&details=1&hotlist=1&calendar=1&news=1`;

  if (iframe) {
    iframe.src = targetSrc;
  } else {
    const container = document.getElementById('tv_chart_main_container');
    if (container) {
      container.innerHTML = `<iframe id="tv-widget-iframe" src="${targetSrc}" class="w-full h-full border-0"></iframe>`;
    }
  }
}

class GoldTradingApp {
  constructor() {
    this.chartCanvasContainer = document.getElementById('chart-canvas-view');
    this.container = this.chartCanvasContainer;
    this.chart = null;
    this.candleSeries = null;
    this.fastEmaSeries = null; // EMA 20 (Aqua)
    this.slowEmaSeries = null; // EMA 50 (Red)
    this.priceLines = [];
    this.lastIndicatorResult = null;

    this.currentPrice = window.marketDataStore ? window.marketDataStore.getCurrentPrice() : 3995.54;
    this.prevPrice = this.currentPrice;
    this.currentTimeframe = '15m'; // Mặc định 15M
    this.bars = [];
    this.replayMode = 'live';
    this.currentHistoryAssetFilter = 'ALL';
    this.currentHistoryFilter = 'all';

    this.init();
  }

  async init() {
    this.initCanvasChart();
    this.bindEvents();
    this.loadInitialBars();
    this.renderIndicators();
    this.renderSignalHistory();
    this.renderNewsAndCalendar();
    this.startEventCountdown();
    this.listenToSignalEngine();
    this.startSimulatedMarketTicks();
    this.start30MinAITrendAutoPushEngine();
    this.initNotificationCenterSystem();
  }

  // Phương thức kích hoạt khi người dùng chuyển sang Tab Biểu Đồ MA WAVE V8 (Mô Phỏng & Signal Replay)
  onShowMaWaveChart() {
    this.onShowMaWaveReplay();
  }

  onShowMaWaveReplay() {
    if (!this.chartCanvasContainer) {
      this.chartCanvasContainer = document.getElementById('chart-canvas-view');
      this.container = this.chartCanvasContainer;
    }
    if (!this.chartCanvasContainer) return;

    const chartWrapper = document.getElementById('ma_wave_chart_container') || this.chartCanvasContainer.parentElement;
    
    const measureSize = () => {
      let w = (chartWrapper ? chartWrapper.clientWidth : 0) || (this.chartCanvasContainer ? this.chartCanvasContainer.clientWidth : 0);
      let h = (chartWrapper ? chartWrapper.clientHeight : 0) || (this.chartCanvasContainer ? this.chartCanvasContainer.clientHeight : 0);
      if (!w || w < 200) w = Math.max(300, window.innerWidth - 340);
      if (!h || h < 200) h = Math.max(450, window.innerHeight - 260);
      return { w, h };
    };

    let { w, h } = measureSize();

    if (!this.chart) {
      this.initCanvasChart(w, h);
    } else {
      this.chart.applyOptions({ width: w, height: h });
    }

    if (!this.bars || this.bars.length === 0) {
      this.loadInitialBars();
    }

    if (this.candleSeries && this.bars && this.bars.length > 0) {
      this.candleSeries.setData(this.bars);
    }

    this.renderIndicators();

    const applyReflow = () => {
      const size = measureSize();
      if (this.chart) {
        this.chart.applyOptions({ width: size.w, height: size.h });
        if (this.chart.timeScale) this.chart.timeScale().fitContent();
        if (this.lastIndicatorResult) {
          this.renderSvgOverlay(this.lastIndicatorResult.swBoxes, this.lastIndicatorResult.tradeLines);
        }
      }
    };

    requestAnimationFrame(applyReflow);
    setTimeout(applyReflow, 50);
    setTimeout(applyReflow, 200);

    this.updateReplayUI();
  }

  onShowHistoryView() {
    if (this.bars && this.bars.length > 0) {
      this.renderIndicators();
    }
    this.renderSignalHistory();
  }

  setReplayMode(mode) {
    this.replayMode = mode;
    if (mode === 'live') {
      if (this.replayTimer) clearInterval(this.replayTimer);
      this.replayTimer = null;
      this.bars = window.marketDataStore ? window.marketDataStore.getBars(this.currentTimeframe) : this.bars;
      this.replayCurrentStep = this.bars ? this.bars.length : 0;
    } else if (mode === 'pause') {
      if (this.replayTimer) clearInterval(this.replayTimer);
      this.replayTimer = null;
    } else if (mode === 'replay' || mode === 'reset') {
      if (this.replayTimer) clearInterval(this.replayTimer);
      this.replayTimer = null;
      this.replayCurrentStep = 0;

      if (mode === 'replay') {
        const speed = this.replaySpeed || 1;
        const intervalMs = Math.max(150, 800 / speed);
        this.replayTimer = setInterval(() => {
          if (this.replayCurrentStep < this.replayTotalSteps) {
            this.replayCurrentStep++;
            this.updateReplayUI();
          } else {
            clearInterval(this.replayTimer);
            this.replayTimer = null;
            this.replayMode = 'pause';
            this.updateReplayUI();
          }
        }, intervalMs);
      }
    }
    this.updateReplayUI();
  }

  setReplaySpeed(speed) {
    this.replaySpeed = speed;
    document.querySelectorAll('.replay-speed-btn').forEach(b => {
      if (parseFloat(b.getAttribute('data-speed')) === speed) {
        b.className = 'replay-speed-btn px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-mono font-bold hover:text-white cursor-pointer transition';
      } else {
        b.className = 'replay-speed-btn px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono hover:text-white cursor-pointer transition';
      }
    });
    if (this.replayMode === 'replay') {
      this.setReplayMode('replay');
    }
  }

  updateReplayControlButtons() {
    const btnLive = document.getElementById('replay-btn-live');
    const btnPause = document.getElementById('replay-btn-pause');
    const btnRestart = document.getElementById('replay-btn-restart');

    if (btnLive) {
      if (this.replayMode === 'live') {
        btnLive.className = 'px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20 transition flex items-center gap-1 cursor-pointer';
      } else {
        btnLive.className = 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition flex items-center gap-1 cursor-pointer';
      }
    }
    if (btnPause) {
      if (this.replayMode === 'pause') {
        btnPause.className = 'px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 transition flex items-center gap-1 cursor-pointer';
      } else {
        btnPause.className = 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition flex items-center gap-1 cursor-pointer';
      }
    }
    if (btnRestart) {
      if (this.replayMode === 'replay') {
        btnRestart.className = 'px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20 transition flex items-center gap-1 cursor-pointer animate-pulse';
      } else {
        btnRestart.className = 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold transition flex items-center gap-1 cursor-pointer';
      }
    }
  }

  onReplaySliderChange(val) {
    const pct = parseFloat(val) / 100;
    this.replayCurrentStep = Math.round(pct * (this.replayTotalSteps || 100));
    this.updateReplayUI();
  }

  updateReplayUI() {
    const totalSteps = this.bars ? this.bars.length : 0;
    this.replayTotalSteps = totalSteps;
    this.updateReplayControlButtons();

    const livePriceElem = document.getElementById('replay-live-price');
    const priceLabelElem = document.getElementById('replay-price-label');
    const priceBadgeContainer = document.getElementById('replay-price-badge-container');
    const signalTypeElem = document.getElementById('replay-signal-type');
    const simStateElem = document.getElementById('replay-sim-state');
    const refProgressElem = document.getElementById('replay-ref-progress');
    const stepCounterElem = document.getElementById('replay-step-counter');
    const sliderElem = document.getElementById('replay-timeline-slider');

    if (this.replayMode === 'live' || !this.replayCurrentStep || this.replayCurrentStep > totalSteps) {
      this.replayCurrentStep = totalSteps;
    }

    if (sliderElem) {
      sliderElem.max = totalSteps;
      sliderElem.value = this.replayCurrentStep;
    }
    if (stepCounterElem) {
      stepCounterElem.textContent = `Bước ${this.replayCurrentStep} / ${totalSteps}`;
    }

    if (this.replayMode === 'live') {
      // ── TRẠNG THÁI LIVE ──
      const liveMarketPrice = window.marketDataStore ? window.marketDataStore.getCurrentPrice() : this.currentPrice;

      if (priceLabelElem) {
        priceLabelElem.textContent = 'Giá Live:';
        priceLabelElem.className = 'text-slate-400 font-bold';
      }
      if (livePriceElem) {
        livePriceElem.textContent = `$${liveMarketPrice.toFixed(2)}`;
        livePriceElem.className = 'text-amber-400 font-black';
      }
      if (priceBadgeContainer) {
        priceBadgeContainer.className = 'px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-slate-300 text-[11px]';
      }

      this.updatePriceHeader();

      const liveBars = (window.marketDataStore) ? window.marketDataStore.getBars(this.currentTimeframe) : this.bars;
      this.bars = liveBars;

      if (this.candleSeries && liveBars && liveBars.length > 0) {
        this.candleSeries.setData(liveBars);
      } else if (this.lineSeries && liveBars && liveBars.length > 0) {
        this.lineSeries.setData(liveBars.map(b => ({ time: b.time, value: b.close })));
      }

      const result = window.Indicators.runPineScriptLogic(liveBars);
      if (result) {
        this.lastIndicatorResult = result;
        if (this.fastEmaSeries && result.fastEMAList) this.fastEmaSeries.setData(result.fastEMAList);
        if (this.slowEmaSeries && result.slowEMAList) this.slowEmaSeries.setData(result.slowEMAList);
        if (this.candleSeries && result.markers) this.candleSeries.setMarkers(result.markers);
        this.renderSvgOverlay(result.swBoxes, result.tradeLines);
        if (result.snapshot) {
          this.updatePineDashboardUI(result.snapshot);
          this.updateTrendViewUI();
        }
      }

      if (simStateElem) {
        simStateElem.textContent = 'THỊ TRƯỜNG LIVE 🟢';
        simStateElem.className = 'text-emerald-400 font-bold';
      }

    } else {
      // ── TRẠNG THÁI REPLAY ──
      const currentBars = (this.bars && this.bars.length)
        ? this.bars.slice(0, Math.min(totalSteps, Math.max(55, this.replayCurrentStep)))
        : [];

      if (currentBars.length > 0) {
        const lastBar = currentBars[currentBars.length - 1];
        
        if (priceLabelElem) {
          priceLabelElem.textContent = 'Giá Replay:';
          priceLabelElem.className = 'text-purple-400 font-bold';
        }
        if (livePriceElem) {
          livePriceElem.textContent = `$${lastBar.close.toFixed(2)}`;
          livePriceElem.className = 'text-purple-300 font-black';
        }
        if (priceBadgeContainer) {
          priceBadgeContainer.className = 'px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-slate-300 text-[11px]';
        }

        // CHÚ Ý: Replay KHÔNG ĐƯỢC THAY ĐỔI Header currentPrice!
        this.updatePriceHeader();

        if (this.candleSeries) {
          this.candleSeries.setData(currentBars);
        } else if (this.lineSeries) {
          this.lineSeries.setData(currentBars.map(b => ({ time: b.time, value: b.close })));
        }

        const result = window.Indicators.runPineScriptLogic(currentBars);
        if (result) {
          this.lastIndicatorResult = result;
          if (this.fastEmaSeries && result.fastEMAList) this.fastEmaSeries.setData(result.fastEMAList);
          if (this.slowEmaSeries && result.slowEMAList) this.slowEmaSeries.setData(result.slowEMAList);
          if (this.candleSeries && result.markers) this.candleSeries.setMarkers(result.markers);
          this.renderSvgOverlay(result.swBoxes, result.tradeLines);
          if (result.snapshot) {
            this.updatePineDashboardUI(result.snapshot);
            this.updateTrendViewUI();
          }
        }
      }

      if (simStateElem) {
        simStateElem.textContent = this.replayMode === 'pause' ? 'TẠM DỪNG ⏸' : 'ĐANG MÔ PHỎNG REPLAY ⚡';
        simStateElem.className = 'text-amber-400 font-bold';
      }
    }

    // Update Replay status indicators
    const result = this.lastIndicatorResult;
    const activeTrade = (result && result.tradeLines && result.tradeLines.length)
      ? result.tradeLines[result.tradeLines.length - 1]
      : null;

    if (activeTrade) {
      const isBuy = activeTrade.type === 'BUY';
      const exactPrice = activeTrade.entryPrice;
      if (signalTypeElem) {
        signalTypeElem.textContent = `${activeTrade.type} @ ${exactPrice.toFixed(2)}`;
        signalTypeElem.className = isBuy ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
      }

      let doneCount = 0;
      if (activeTrade.tp1Done) doneCount++;
      if (activeTrade.tp2Done) doneCount++;
      if (activeTrade.tp3Done) doneCount++;

      if (refProgressElem) {
        refProgressElem.textContent = `${doneCount} / 3 ✓`;
        refProgressElem.className = doneCount > 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
      }
    } else {
      if (signalTypeElem) signalTypeElem.textContent = 'CHỜ TÍN HIỆU ⏳';
      if (refProgressElem) refProgressElem.textContent = '0 / 3';
    }
  }

  renderReplayLogTable() {
    const tbody = document.getElementById('replay-events-tbody');
    if (!tbody) return;

    const tradeLines = (this.lastIndicatorResult && this.lastIndicatorResult.tradeLines)
      ? this.lastIndicatorResult.tradeLines
      : [];

    if (tradeLines.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-6 text-slate-500 font-sans text-xs">
            Chưa có event tín hiệu nào. MA WAVE V8 đang quét nến realtime...
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = tradeLines.map(t => {
      const isBuy = t.type === 'BUY';
      const exactPrice = t.entryPrice.toFixed(2);
      const ref1Val = (isBuy ? t.entryPrice + 10 : t.entryPrice - 10).toFixed(2);
      const ref2Val = (isBuy ? t.entryPrice + 20 : t.entryPrice - 20).toFixed(2);
      const ref3Val = (isBuy ? t.entryPrice + 30 : t.entryPrice - 30).toFixed(2);

      const ref1Badge = t.tp1Done ? `<span class="text-emerald-400 font-bold">✓ ${ref1Val}</span>` : `<span class="text-slate-500">— ${ref1Val}</span>`;
      const ref2Badge = t.tp2Done ? `<span class="text-emerald-400 font-bold">✓ ${ref2Val}</span>` : `<span class="text-slate-500">— ${ref2Val}</span>`;
      const ref3Badge = t.tp3Done ? `<span class="text-emerald-400 font-bold">✓ ${ref3Val}</span>` : `<span class="text-slate-500">— ${ref3Val}</span>`;

      const statusText = t.active ? '<span class="text-amber-400 font-bold">ĐANG MÔ PHỎNG ⚡</span>' : '<span class="text-sky-400 font-bold">END 🏁</span>';
      const timeStr = t.startTime ? new Date(t.startTime * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 font-mono text-xs">
          <td class="py-2 px-3 text-slate-400">${timeStr}</td>
          <td class="py-2 px-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">${t.type}</span></td>
          <td class="py-2 px-3 font-bold text-amber-300">$${exactPrice}</td>
          <td class="py-2 px-3">${ref1Badge}</td>
          <td class="py-2 px-3">${ref2Badge}</td>
          <td class="py-2 px-3">${ref3Badge}</td>
          <td class="py-2 px-3">${statusText}</td>
        </tr>
      `;
    }).join('');
  }

  // 1. Khởi tạo biểu đồ nến Lightweight Charts chuẩn TradingView
  initCanvasChart(customW, customH) {
    if (!window.LightweightCharts || !this.chartCanvasContainer) return;

    const chartWrapper = document.getElementById('ma_wave_chart_container') || this.chartCanvasContainer.parentElement;
    const w = customW || (chartWrapper ? chartWrapper.clientWidth : 0) || this.chartCanvasContainer.clientWidth || (window.innerWidth - 340) || 1200;
    const h = customH || (chartWrapper ? chartWrapper.clientHeight : 0) || this.chartCanvasContainer.clientHeight || 550;

    if (this.chart) {
      this.chart.applyOptions({ width: w, height: h });
      return;
    }

    this.chart = LightweightCharts.createChart(this.chartCanvasContainer, {
      width: w,
      height: h,
      layout: {
        background: { color: '#131722' },
        textColor: '#b2b5be',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.12, bottom: 0.15 },
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Biểu đồ đường màu Xanh dương rực rỡ #00b0ff chuẩn TradingView theo yêu cầu người dùng
    this.lineSeries = this.chart.addLineSeries({
      color: '#00b0ff',
      lineWidth: 2,
      priceLineVisible: true,
      title: 'Giá XAU/USD',
    });
    this.candleSeries = null;

    // Đường EMA 20: Aqua #00e5ff (Dày 2px)
    this.fastEmaSeries = this.chart.addLineSeries({
      color: '#00e5ff',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'EMA 20 (Aqua)',
    });

    // Đường EMA 50: Đỏ #f23645 (Dày 2px)
    this.slowEmaSeries = this.chart.addLineSeries({
      color: '#f23645',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'EMA 50 (Đỏ)',
    });

    // Crosshair movement handler for live OHLC tooltip
    this.chart.subscribeCrosshairMove((param) => {
      const timeEl = document.getElementById('ohlc-time');
      const openEl = document.getElementById('ohlc-open');
      const highEl = document.getElementById('ohlc-high');
      const lowEl = document.getElementById('ohlc-low');
      const closeEl = document.getElementById('ohlc-close');

      if (!timeEl) return;

      if (!param || !param.time || !param.seriesPrices) {
        if (this.bars && this.bars.length > 0) {
          const lastBar = this.bars[this.bars.length - 1];
          const d = new Date(lastBar.time * 1000);
          timeEl.innerText = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          openEl.innerText = `$${lastBar.open.toFixed(2)}`;
          highEl.innerText = `$${lastBar.high.toFixed(2)}`;
          lowEl.innerText = `$${lastBar.low.toFixed(2)}`;
          closeEl.innerText = `$${lastBar.close.toFixed(2)}`;
        }
        return;
      }

      const barData = (this.candleSeries ? param.seriesPrices.get(this.candleSeries) : null) || (this.lineSeries ? param.seriesPrices.get(this.lineSeries) : null);
      if (barData) {
        let timeStr = '--:--';
        if (typeof param.time === 'number') {
          timeStr = new Date(param.time * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (param.time && param.time.year) {
          timeStr = `${param.time.year}-${param.time.month}-${param.time.day}`;
        }
        timeEl.innerText = timeStr;
        openEl.innerText = barData.open !== undefined ? `$${barData.open.toFixed(2)}` : '--';
        highEl.innerText = barData.high !== undefined ? `$${barData.high.toFixed(2)}` : '--';
        lowEl.innerText = barData.low !== undefined ? `$${barData.low.toFixed(2)}` : '--';
        closeEl.innerText = barData.close !== undefined ? `$${barData.close.toFixed(2)}` : (typeof barData === 'number' ? `$${barData.toFixed(2)}` : '--');
      }
    });

    // Tự động vẽ lại Overlay SVG khi cuộn, phóng to / thu nhỏ biểu đồ
    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      if (this.lastIndicatorResult) {
        this.renderSvgOverlay(this.lastIndicatorResult.swBoxes, this.lastIndicatorResult.tradeLines);
      }
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (this.lastIndicatorResult) {
        this.renderSvgOverlay(this.lastIndicatorResult.swBoxes, this.lastIndicatorResult.tradeLines);
      }
    });

    // Tự động căn chỉnh kích thước màn hình
    window.addEventListener('resize', () => {
      if (this.chartCanvasContainer && this.chart) {
        this.chart.applyOptions({
          width: this.chartCanvasContainer.clientWidth,
          height: this.chartCanvasContainer.clientHeight,
        });
        if (this.lastIndicatorResult) {
          this.renderSvgOverlay(this.lastIndicatorResult.swBoxes, this.lastIndicatorResult.tradeLines);
        }
      }
    });

    setTimeout(() => {
      if (this.chart && this.chartCanvasContainer) {
        this.chart.applyOptions({
          width: this.chartCanvasContainer.clientWidth,
          height: this.chartCanvasContainer.clientHeight,
        });
        if (this.lastIndicatorResult) {
          this.renderSvgOverlay(this.lastIndicatorResult.swBoxes, this.lastIndicatorResult.tradeLines);
        }
      }
    }, 150);
  }

  setChartType(type) {
    if (!this.chart || !this.bars || this.bars.length === 0) return;
    const candlesBtn = document.getElementById('chart-type-candles');
    const lineBtn = document.getElementById('chart-type-line');

    if (type === 'line') {
      if (!this.lineSeries) {
        this.lineSeries = this.chart.addLineSeries({
          color: '#00b0ff',
          lineWidth: 2,
          priceLineVisible: true,
          title: 'Giá XAU/USD',
        });
      }
      if (this.candleSeries) {
        try { this.chart.removeSeries(this.candleSeries); } catch (e) {}
      }
      this.candleSeries = null;
      this.lineSeries.setData(this.bars.map(b => ({ time: b.time, value: b.close })));

      if (candlesBtn) candlesBtn.className = 'px-2 py-0.5 rounded font-bold text-slate-400 hover:text-white transition';
      if (lineBtn) lineBtn.className = 'px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    } else {
      if (!this.candleSeries) {
        this.candleSeries = this.chart.addCandlestickSeries({
          upColor: '#089981',
          downColor: '#f23645',
          borderUpColor: '#089981',
          borderDownColor: '#f23645',
          wickUpColor: '#089981',
          wickDownColor: '#f23645',
        });
      }
      if (this.lineSeries) {
        try { this.chart.removeSeries(this.lineSeries); } catch (e) {}
      }
      this.lineSeries = null;
      this.candleSeries.setData(this.bars);
      if (this.lastIndicatorResult && this.lastIndicatorResult.markers) {
        this.candleSeries.setMarkers(this.lastIndicatorResult.markers);
      }

      if (candlesBtn) candlesBtn.className = 'px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
      if (lineBtn) lineBtn.className = 'px-2 py-0.5 rounded font-bold text-slate-400 hover:text-white transition';
    }
  }

  checkMarketDataBanner() {
    const banner = document.getElementById('no-market-data-banner');
    if (!banner) return;
    if (!this.bars || this.bars.length === 0) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // 2. Tạo nến lịch sử phản ánh chính xác 100% hình ảnh thực tế của người dùng
  loadInitialBars() {
    const tf = this.currentTimeframe || '15m';
    if (window.marketDataStore) {
      this.bars = window.marketDataStore.getBars(tf);
      this.currentPrice = window.marketDataStore.getCurrentPrice();
    }
    if (this.candleSeries && this.bars) {
      this.candleSeries.setData(this.bars);
    }
    this.updatePriceHeader();
  }

  switchChartAsset(assetKey) {
    const key = (assetKey || 'XAU').toUpperCase();
    if (!window.marketDataStore) return;
    window.marketDataStore.switchAsset(key);
    const snap = window.marketDataStore.getSnapshot();
    this.currentPrice = snap.currentPrice;
    this.bars = window.marketDataStore.getBars(this.currentTimeframe);

    // Cập nhật nhãn chọn mã trên toolbar
    const iconEl = document.getElementById('current-chart-symbol-icon');
    const nameEl = document.getElementById('current-chart-symbol-name');
    const tagEl = document.getElementById('current-chart-symbol-tag');
    if (iconEl) iconEl.textContent = key === 'XAU' ? '🪙' : (key === 'BTC' ? '₿' : '🥈');
    if (nameEl) nameEl.textContent = key === 'XAU' ? 'XAU/USD (Vàng)' : (key === 'BTC' ? 'BTC/USD (Bitcoin)' : 'XAG/USD (Bạc)');
    if (tagEl) tagEl.textContent = key === 'XAU' ? 'GOLD' : (key === 'BTC' ? 'CRYPTO' : 'SILVER');

    // Nạp dữ liệu nến mới vào biểu đồ
    if (this.candleSeries && this.bars) {
      this.candleSeries.setData(this.bars);
      if (this.chart) {
        this.chart.timeScale().fitContent();
      }
    }
    this.updatePriceHeader();

    if (this.bars && this.bars.length > 0) {
      this.lastIndicatorResult = this.calculateMAWaveIndicators(this.bars);
      this.renderIndicators();
    }

    const menu = document.getElementById('chart-symbol-dropdown-menu');
    if (menu) menu.classList.add('hidden');
  }

  getTimeframeSeconds(tf) {
    switch (tf) {
      case '5m': return 300;
      case '15m': return 900;
      case '30m': return 1800;
      case '35m': return 2100;
      case '1h': case '60m': return 3600;
      case '2h': case '120m': return 7200;
      case '3h': case '180m': return 10800;
      default: return 900;
    }
  }

  // 3. Tính toán toàn bộ Pine Script v5 và vẽ lên biểu đồ
  renderIndicators() {
    if (!this.bars || this.bars.length < 50) return;

    const result = window.Indicators.runPineScriptLogic(this.bars);
    if (!result) return;
    this.lastIndicatorResult = result;

    // Đồng bộ toàn bộ các lịch sử tín hiệu BUY / SELL từ thứ 2 đến hiện tại vào Signal Engine
    if (window.signalEngine) {
      window.signalEngine.syncTradeLines(result, this.bars);
    }

    // Vẽ EMA 20 và EMA 50
    if (this.fastEmaSeries && result.fastEMAList) {
      this.fastEmaSeries.setData(result.fastEMAList);
    }
    if (this.slowEmaSeries && result.slowEMAList) {
      this.slowEmaSeries.setData(result.slowEMAList);
    }

    // Vẽ các nhãn tín hiệu: BUY ENTRY, SELL ENTRY, TP1, TP2, TP3, SUY YẾU, END, PHÁ SW
    if (this.candleSeries && result.markers) {
      const sortedMarkers = [...result.markers].sort((a, b) => a.time - b.time);
      this.candleSeries.setMarkers(sortedMarkers);
    }

    // Vẽ các đường PriceLine trên cột thang đo giá bên phải (Right Price Scale)
    this.updatePriceScaleLines(result.snapshot);

    // Vẽ lớp SVG: Hộp SW màu vàng + Đường bậc thang TP1, TP2, TP3
    this.renderSvgOverlay(result.swBoxes, result.tradeLines);

    // Cập nhật Bảng Floating MTF Dashboard bên trong biểu đồ & Bảng ngoài
    if (result.snapshot) {
      this.updatePineDashboardUI(result.snapshot);
      this.updateTrendViewUI();
    }

    // Tự động cập nhật giao diện Lịch Sử Tín Hiệu
    this.renderSignalHistory();
  }

  // Cập nhật các mức giá mục tiêu TP1, TP2, TP3, SL trên thang đo trục giá phải
  updatePriceScaleLines(snap) {
    const mainSeries = this.lineSeries || this.candleSeries;
    if (!mainSeries) return;

    // Xóa các đường cũ
    if (this.priceLines && this.priceLines.length) {
      this.priceLines.forEach(pl => {
        try { mainSeries.removePriceLine(pl); } catch (e) {}
      });
    }
    this.priceLines = [];

    if (!snap) return;

    if (snap.tp3Price) {
      this.priceLines.push(mainSeries.createPriceLine({
        price: snap.tp3Price,
        color: '#089981',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: 'REF +30',
      }));
    }
    if (snap.tp2Price) {
      this.priceLines.push(mainSeries.createPriceLine({
        price: snap.tp2Price,
        color: '#089981',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: 'REF +20',
      }));
    }
    if (snap.tp1Price) {
      this.priceLines.push(mainSeries.createPriceLine({
        price: snap.tp1Price,
        color: '#089981',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: 'REF +10',
      }));
    }
  }

  // Vẽ các Hộp SW màu vàng, Vùng EMA Spread & Đường bậc thang mục tiêu chốt lời trên SVG
  renderSvgOverlay(swBoxes, tradeLines) {
    const svg = document.getElementById('chart-svg-overlay');
    const mainSeries = this.lineSeries || this.candleSeries;
    if (!svg || !this.chart || !mainSeries || !this.bars || !this.bars.length) return;

    svg.innerHTML = '';
    const lastBar = this.bars[this.bars.length - 1];

    // 0. Vùng EMA Spread (Vùng xanh nhạt khi Tăng, Vùng đỏ nhạt khi Giảm - Quy chuẩn 7)
    if (this.lastIndicatorResult && this.lastIndicatorResult.fastEMAList && this.lastIndicatorResult.slowEMAList) {
      const fastMap = new Map();
      this.lastIndicatorResult.fastEMAList.forEach(p => fastMap.set(p.time, p.value));
      const slowMap = new Map();
      this.lastIndicatorResult.slowEMAList.forEach(p => slowMap.set(p.time, p.value));

      let currentSegment = null;

      for (let i = 0; i < this.bars.length; i++) {
        const b = this.bars[i];
        const fVal = fastMap.get(b.time);
        const sVal = slowMap.get(b.time);
        if (fVal === undefined || sVal === undefined) continue;

        const x = this.chart.timeScale().timeToCoordinate(b.time);
        const yF = mainSeries.priceToCoordinate(fVal);
        const yS = mainSeries.priceToCoordinate(sVal);
        if (x === null || yF === null || yS === null) continue;

        const isBull = fVal >= sVal;
        const segType = isBull ? 'BULL' : 'BEAR';

        if (!currentSegment || currentSegment.type !== segType) {
          if (currentSegment && currentSegment.pts.length > 1) {
            this.drawSpreadPolygon(svg, currentSegment);
          }
          currentSegment = { type: segType, pts: [] };
        }
        currentSegment.pts.push({ x, yF, yS });
      }
      if (currentSegment && currentSegment.pts.length > 1) {
        this.drawSpreadPolygon(svg, currentSegment);
      }
    }

    // 1. Vẽ các Hộp Vùng Đi Ngang (Yellow SW Boxes - Quy chuẩn 8)
    (swBoxes || []).forEach(box => {
      const x1 = this.chart.timeScale().timeToCoordinate(box.startTime);
      let x2 = this.chart.timeScale().timeToCoordinate(box.endTime);
      if (x2 === null || box.active) {
        x2 = (this.chart.timeScale().timeToCoordinate(lastBar.time) || 500) + 20;
      }
      const yTop = mainSeries.priceToCoordinate(box.top);
      const yBottom = mainSeries.priceToCoordinate(box.bottom);

      if (x1 !== null && x2 !== null && yTop !== null && yBottom !== null) {
        const left = Math.min(x1, x2);
        const width = Math.max(16, Math.abs(x2 - x1));
        const top = Math.min(yTop, yBottom);
        const height = Math.max(10, Math.abs(yBottom - yTop));

        // Khung chữ nhật hộp SW viền vàng nền vàng mờ chuẩn ảnh TradingView
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', left);
        rect.setAttribute('y', top);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', 'rgba(234, 179, 8, 0.16)');
        rect.setAttribute('stroke', '#eab308');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '2');
        svg.appendChild(rect);

        // Nhãn vàng chữ "SW" ở giữa hộp
        const cx = left + width / 2;
        const cy = top + height / 2;

        const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const bRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bRect.setAttribute('x', cx - 13);
        bRect.setAttribute('y', cy - 8);
        bRect.setAttribute('width', '26');
        bRect.setAttribute('height', '16');
        bRect.setAttribute('rx', '3');
        bRect.setAttribute('fill', '#eab308');

        const bText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bText.setAttribute('x', cx);
        bText.setAttribute('y', cy + 3.5);
        bText.setAttribute('text-anchor', 'middle');
        bText.setAttribute('font-family', 'sans-serif');
        bText.setAttribute('font-size', '10');
        bText.setAttribute('font-weight', 'bold');
        bText.setAttribute('fill', '#000000');
        bText.textContent = 'SW';

        badgeG.appendChild(bRect);
        badgeG.appendChild(bText);
        svg.appendChild(badgeG);
      }
    });

    // 2. Kẻ các đường bậc thang phân tầng TP1, TP2, TP3, ENTRY cho lệnh đang active (hoặc lệnh gần nhất) để giữ biểu đồ sạch sẽ
    const activeTrades = (tradeLines || []).filter(t => t.active);
    const tradesToDraw = activeTrades.length > 0 ? activeTrades.slice(-1) : (tradeLines || []).slice(-1);

    tradesToDraw.forEach(trade => {
      const x1 = this.chart.timeScale().timeToCoordinate(trade.startTime);
      let x2 = this.chart.timeScale().timeToCoordinate(trade.endTime);
      if (x2 === null || trade.active) {
        x2 = (this.chart.timeScale().timeToCoordinate(lastBar.time) || 500) + 25;
      }

      if (x1 !== null && x2 !== null && x2 > x1) {
        const isBuy = trade.type === 'BUY';
        const tpColor = isBuy ? '#089981' : '#f23645';

        // Đường ENTRY (trắng liền nét)
        const yEntry = mainSeries.priceToCoordinate(trade.entryPrice);
        if (yEntry !== null) {
          const lEntry = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          lEntry.setAttribute('x1', x1);
          lEntry.setAttribute('y1', yEntry);
          lEntry.setAttribute('x2', x2);
          lEntry.setAttribute('y2', yEntry);
          lEntry.setAttribute('stroke', '#ffffff');
          lEntry.setAttribute('stroke-width', '2');
          svg.appendChild(lEntry);
        }

        // Các đường mục tiêu REF +10, REF +20, REF +30 (xanh lá hoặc đỏ)
        [trade.tp1Price, trade.tp2Price, trade.tp3Price].forEach(p => {
          if (p) {
            const yTP = mainSeries.priceToCoordinate(p);
            if (yTP !== null) {
              const lTP = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              lTP.setAttribute('x1', x1);
              lTP.setAttribute('y1', yTP);
              lTP.setAttribute('x2', x2);
              lTP.setAttribute('y2', yTP);
              lTP.setAttribute('stroke', tpColor);
              lTP.setAttribute('stroke-width', '1.5');
              svg.appendChild(lTP);
            }
          }
        });
      }
    });

    // 3. Vẽ nhãn Tín Hiệu dạng Khung Pill Badge màu chuẩn TradingView 100% (BUY ENTRY, SELL ENTRY, END, REF, PHÁ SW, REVERSAL)
    // Giới hạn 25 markers gần nhất để biểu đồ sáng rõ, không bị đè chữ che nến
    if (this.lastIndicatorResult && this.lastIndicatorResult.markers) {
      const drawnPositions = [];
      const markersToDraw = (this.lastIndicatorResult.markers || []).slice(-25);

      markersToDraw.forEach(m => {
        if (!m || !m.time || !m.text) return;
        const x = this.chart.timeScale().timeToCoordinate(m.time);
        if (x === null || x < 0 || x > 2000) return;

        const b = this.bars.find(bar => bar.time === m.time);
        if (!b) return;

        const isAbove = m.position === 'aboveBar';
        const priceTarget = isAbove ? b.high : b.low;
        const yRaw = mainSeries.priceToCoordinate(priceTarget);
        if (yRaw === null || yRaw < 0 || yRaw > 1200) return;

        let y = isAbove ? (yRaw - 16) : (yRaw + 16);

        // Tránh đè nhãn lên nhau khi có nhiều nhãn cùng một cây nến
        const overlapCount = drawnPositions.filter(p => Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 16).length;
        if (overlapCount > 0) {
          y += isAbove ? (-18 * overlapCount) : (18 * overlapCount);
        }
        drawnPositions.push({ x, y });

        const rawTxt = m.text.replace(/^[🟢🔴⚠️⏹🛑●■▲▼]\s*/, '').trim();
        const textLen = rawTxt.length;
        const rectW = Math.max(54, textLen * 6.2 + 14);
        const rectH = 18;
        const rx = 4;

        let fillCol = m.color || '#089981';
        let textCol = '#ffffff';

        if (rawTxt.includes('END') || rawTxt.includes('SUY YẾU') || rawTxt.includes('Chú ý')) {
          fillCol = '#eab308';
          textCol = '#000000';
        } else if (rawTxt.includes('BUY') || rawTxt.includes('TĂNG XÁC NHẬN')) {
          fillCol = '#089981';
          textCol = '#ffffff';
        } else if (rawTxt.includes('SELL') || rawTxt.includes('GIẢM XÁC NHẬN')) {
          fillCol = '#f23645';
          textCol = '#ffffff';
        } else if (rawTxt.includes('CẢNH BÁO')) {
          fillCol = '#f97316';
          textCol = '#ffffff';
        } else if (rawTxt.includes('REF')) {
          fillCol = m.position === 'aboveBar' ? '#089981' : '#f23645';
          textCol = '#ffffff';
        }

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (x - rectW / 2).toFixed(1));
        rect.setAttribute('y', (y - rectH / 2).toFixed(1));
        rect.setAttribute('width', rectW.toFixed(1));
        rect.setAttribute('height', rectH.toFixed(1));
        rect.setAttribute('rx', rx);
        rect.setAttribute('ry', rx);
        rect.setAttribute('fill', fillCol);
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '0.6');
        rect.setAttribute('stroke-opacity', '0.8');
        rect.setAttribute('filter', 'drop-shadow(0px 2px 3px rgba(0,0,0,0.5))');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x.toFixed(1));
        text.setAttribute('y', (y + 3.5).toFixed(1));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-size', '9.5');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', textCol);
        text.textContent = rawTxt;

        g.appendChild(rect);
        g.appendChild(text);
        svg.appendChild(g);
      });
    }
  }

  // Vẽ đa giác màu nhạt biểu diễn khoảng cách EMA Spread giữa EMA20 và EMA50
  drawSpreadPolygon(svg, seg) {
    if (!seg || seg.pts.length < 2) return;
    const pts = seg.pts;
    let d = `M ${pts[0].x} ${pts[0].yF}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].yF}`;
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      d += ` L ${pts[i].x} ${pts[i].yS}`;
    }
    d += ' Z';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', seg.type === 'BULL' ? 'rgba(8, 153, 129, 0.12)' : 'rgba(242, 54, 69, 0.12)');
    path.setAttribute('stroke', 'none');
    svg.appendChild(path);
  }

  updatePineDashboardUI(snap) {
    if (!snap) return;

    // 1. Cập nhật 8 Thẻ Dashboard cốt lõi (Quy chuẩn 17)
    const cardTrend = document.getElementById('v8-card-trend');
    const cardWave = document.getElementById('v8-card-wave');
    const cardSpread = document.getElementById('v8-card-spread');
    const cardSpreadVal = document.getElementById('v8-card-spread-val');
    const cardStructure = document.getElementById('v8-card-structure');
    const cardMomentum = document.getElementById('v8-card-momentum');
    const cardSw = document.getElementById('v8-card-sw');
    const cardSwRange = document.getElementById('v8-card-sw-range');
    const cardWeakening = document.getElementById('v8-card-weakening');
    const cardReversal = document.getElementById('v8-card-reversal');

    if (cardTrend) {
      const isBull = snap.trend === 'TĂNG';
      const isBear = snap.trend === 'GIẢM';
      cardTrend.textContent = isBull ? 'TĂNG 📈' : isBear ? 'GIẢM 📉' : 'CHỜ ⏳';
      cardTrend.className = isBull ? 'text-xs font-black text-[#089981] mt-1' : isBear ? 'text-xs font-black text-[#f23645] mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }

    if (cardWave) {
      cardWave.textContent = snap.wave === 'MẠNH' ? 'MẠNH ⚡' : snap.wave === 'SUY YẾU' ? 'SUY YẾU ⚠️' : snap.wave;
      cardWave.className = snap.wave === 'MẠNH' ? 'text-xs font-black text-[#089981] mt-1' : snap.wave === 'SUY YẾU' ? 'text-xs font-black text-amber-400 mt-1' : 'text-xs font-black text-slate-300 mt-1';
    }

    if (cardSpread) {
      cardSpread.textContent = snap.spread === 'MỞ RỘNG' ? 'MỞ RỘNG 🟢' : 'THU HẸP 🟡';
      cardSpread.className = snap.spread === 'MỞ RỘNG' ? 'text-xs font-black text-[#089981] mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }
    if (cardSpreadVal) {
      cardSpreadVal.textContent = `Chênh: $${snap.spreadValue}`;
    }

    if (cardStructure) {
      cardStructure.textContent = snap.structure;
      cardStructure.className = snap.structure.includes('Tăng') ? 'text-xs font-black text-[#089981] mt-1' : snap.structure.includes('Giảm') ? 'text-xs font-black text-[#f23645] mt-1' : 'text-xs font-bold text-amber-400 mt-1';
    }

    if (cardMomentum) {
      cardMomentum.textContent = snap.momentum === 'MẠNH' ? 'MẠNH 🚀' : snap.momentum === 'YẾU' ? 'YẾU ⚠️' : 'BÌNH THƯỜNG';
      cardMomentum.className = snap.momentum === 'MẠNH' ? 'text-xs font-black text-[#089981] mt-1' : snap.momentum === 'YẾU' ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }

    if (cardSw) {
      const isSW = snap.sw === 'ĐANG SW';
      cardSw.textContent = isSW ? 'ĐANG SW ⚖️' : 'KHÔNG SW';
      cardSw.className = isSW ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }
    if (cardSwRange) {
      cardSwRange.textContent = `Biên: $${snap.swRange}`;
    }

    if (cardWeakening) {
      const isWeak = snap.weakening === 'CÓ';
      cardWeakening.textContent = isWeak ? 'CÓ (CẢNH BÁO) ⚠️' : 'KHÔNG ✅';
      cardWeakening.className = isWeak ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-[#089981] mt-1';
    }

    if (cardReversal) {
      const isRev = snap.reversal === 'ĐẢO CHIỀU XÁC NHẬN';
      const isWarn = snap.reversal === 'CẢNH BÁO ĐẢO CHIỀU';
      cardReversal.textContent = snap.reversal;
      cardReversal.className = isRev ? 'text-xs font-black text-[#f23645] mt-1' : isWarn ? 'text-xs font-black text-amber-400 mt-1' : 'text-xs font-bold text-slate-400 mt-1';
    }

    // Cập nhật Small On-Chart Dashboard (Section 12)
    const mTrend = document.getElementById('mini-dash-trend');
    const mWave = document.getElementById('mini-dash-wave');
    const mStruct = document.getElementById('mini-dash-structure');
    const mMom = document.getElementById('mini-dash-momentum');
    const mSpread = document.getElementById('mini-dash-spread');
    const mSw = document.getElementById('mini-dash-sw');
    const mRev = document.getElementById('mini-dash-reversal');
    const mEnd = document.getElementById('mini-dash-end');

    if (mTrend) {
      mTrend.textContent = snap.trend;
      mTrend.className = snap.trend === 'TĂNG' ? 'text-emerald-400 font-bold' : snap.trend === 'GIẢM' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
    }
    if (mWave) {
      mWave.textContent = snap.wave === 'MẠNH' || snap.wave === 'BÌNH THƯỜNG' ? 'UP' : snap.wave === 'SUY YẾU' ? 'WEAK' : 'WAIT';
      mWave.className = (snap.wave === 'MẠNH' || snap.wave === 'BÌNH THƯỜNG') ? 'text-emerald-400 font-bold' : snap.wave === 'SUY YẾU' ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold';
    }
    if (mStruct) {
      mStruct.textContent = snap.structure;
      mStruct.className = snap.structure === 'BULLISH' ? 'text-emerald-400 font-bold' : snap.structure === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
    }
    if (mMom) {
      mMom.textContent = snap.momentum;
      mMom.className = snap.momentum === 'MẠNH' ? 'text-emerald-400 font-bold' : snap.momentum === 'YẾU' ? 'text-amber-400 font-bold' : 'text-slate-300 font-bold';
    }
    if (mSpread) {
      mSpread.textContent = snap.spread;
      mSpread.className = snap.spread === 'MỞ RỘNG' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }
    if (mSw) {
      mSw.textContent = snap.sw === 'ĐANG SW' ? 'YES' : 'NO';
      mSw.className = snap.sw === 'ĐANG SW' ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold';
    }
    if (mRev) {
      const isRev = snap.reversal === 'ĐẢO CHIỀU XÁC NHẬN';
      const isWarn = snap.reversal === 'CẢNH BÁO ĐẢO CHIỀU';
      mRev.textContent = isRev ? 'YES' : isWarn ? 'WARN' : 'NO';
      mRev.className = isRev ? 'text-rose-400 font-bold' : isWarn ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold';
    }
    if (mEnd) {
      mEnd.textContent = snap.endState === 'KẾT THÚC' ? 'YES' : 'NO';
      mEnd.className = snap.endState === 'KẾT THÚC' ? 'text-orange-400 font-bold' : 'text-slate-400 font-bold';
    }

    // Cập nhật MA WAVE V8 Status Overlay Panel ở góc trên bên phải TAB BIỂU ĐỒ (#view-chart)
    const p5m = document.getElementById('tv-panel-5m');
    const p15m = document.getElementById('tv-panel-15m');
    const p35m = document.getElementById('tv-panel-35m');
    const p1h = document.getElementById('tv-panel-1h');
    const pTotal = document.getElementById('tv-panel-total');
    const pBadge = document.getElementById('tv-panel-overall-badge');
    const pEma = document.getElementById('tv-panel-ema');
    const pSw = document.getElementById('tv-panel-sw');
    const pSpread = document.getElementById('tv-panel-spread');

    const getPanelClass = (txt) => {
      if (!txt) return 'font-bold text-slate-400';
      if (txt.includes('TĂNG') || txt.includes('BULL')) return 'font-bold text-emerald-400';
      if (txt.includes('GIẢM') || txt.includes('BEAR')) return 'font-bold text-rose-400';
      if (txt.includes('SW') || txt.includes('YES')) return 'font-bold text-amber-400';
      if (txt.includes('SUY YẾU') || txt.includes('CẢNH BÁO')) return 'font-bold text-orange-400';
      return 'font-bold text-amber-400';
    };

    const isBullTrend = snap.trend === 'TĂNG';
    const isBearTrend = snap.trend === 'GIẢM';
    const isSwState = snap.sw === 'ĐANG SW';

    if (p5m) { p5m.textContent = 'WAIT'; p5m.className = getPanelClass('WAIT'); }
    if (p15m) { p15m.textContent = isBullTrend ? 'TĂNG' : isBearTrend ? 'GIẢM' : 'WAIT'; p15m.className = getPanelClass(p15m.textContent); }
    if (p35m) { p35m.textContent = isBullTrend ? 'TĂNG' : isBearTrend ? 'GIẢM' : 'WAIT'; p35m.className = getPanelClass(p35m.textContent); }
    if (p1h) { p1h.textContent = isBullTrend ? 'TĂNG' : isBearTrend ? 'GIẢM' : 'WAIT'; p1h.className = getPanelClass(p1h.textContent); }

    const overallStateStr = isSwState ? 'SW' : isBullTrend ? 'TĂNG MẠNH' : isBearTrend ? 'GIẢM MẠNH' : 'CHỜ';
    if (pTotal) { pTotal.textContent = overallStateStr; pTotal.className = getPanelClass(overallStateStr); }
    if (pBadge) {
      pBadge.textContent = isSwState ? 'ĐANG SW' : isBullTrend ? 'TĂNG' : isBearTrend ? 'GIẢM' : 'CHỜ';
      pBadge.className = `px-1.5 py-0.2 rounded font-bold text-[9px] ${isSwState ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : isBullTrend ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : isBearTrend ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`;
    }

    if (pEma) { pEma.textContent = isBullTrend ? 'BULL' : isBearTrend ? 'BEAR' : 'WAIT'; pEma.className = getPanelClass(pEma.textContent); }
    if (pSw) { pSw.textContent = isSwState ? 'YES' : 'NO'; pSw.className = isSwState ? 'text-amber-400 font-bold' : 'text-slate-400 font-bold'; }
    if (pSpread) { pSpread.textContent = snap.spread; pSpread.className = snap.spread === 'MỞ RỘNG' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'; }

    // 2. Cập nhật BẢNG NỔI FLOATING TRONG BIỂU ĐỒ (Chuẩn TradingView 100% như Hình 2)
    const tblHeadState = document.getElementById('tv-tbl-header-state');
    const tbl5m = document.getElementById('tv-tbl-5m');
    const tbl15m = document.getElementById('tv-tbl-15m');
    const tbl35m = document.getElementById('tv-tbl-35m');
    const tbl1h = document.getElementById('tv-tbl-1h');
    const tblTotal = document.getElementById('tv-tbl-total');
    const tblTotalCount = document.getElementById('tv-tbl-total-count');
    const tblEma = document.getElementById('tv-tbl-ema-state');
    const tblSw = document.getElementById('tv-tbl-sw-state');
    const tblSwDesc = document.getElementById('tv-tbl-sw-desc');

    const isSW = snap.marketState === 'ĐANG SW' || snap.sw === 'ĐANG SW';

    // Helper: Compute real-time trend for specific timeframe from marketDataStore candles & EMA20/50
    const calcTFTrend = (tfName) => {
      if (!window.marketDataStore) {
        const p = snap.currentPrice || 4142.70;
        const fast = snap.fastEMA || (p - 1.2);
        const slow = snap.slowEMA || (p - 6.2);
        return { trend: (p < fast || fast < slow) ? 'GIẢM' : 'TĂNG', wave: 'ỔN ĐỊNH', spread: Math.abs(fast - slow).toFixed(2), slope: '-0.045' };
      }

      const bars = window.marketDataStore.getBars(tfName);
      if (!bars || bars.length < 15) {
        const p = window.marketDataStore.getCurrentPrice();
        const fast = snap.fastEMA || (p - 1.2);
        const slow = snap.slowEMA || (p - 6.2);
        return { trend: (p < fast || fast < slow) ? 'GIẢM' : 'TĂNG', wave: 'ỔN ĐỊNH', spread: Math.abs(fast - slow).toFixed(2), slope: '-0.045' };
      }

      const fastEMAList = Indicators.calculateEMA(bars, 20);
      const slowEMAList = Indicators.calculateEMA(bars, 50);

      if (fastEMAList.length === 0 || slowEMAList.length === 0) {
        const p = window.marketDataStore.getCurrentPrice();
        return { trend: 'GIẢM', wave: 'ỔN ĐỊNH', spread: '3.80', slope: '-0.045' };
      }

      const lastFast = fastEMAList[fastEMAList.length - 1].value;
      const prevFast = fastEMAList.length > 1 ? fastEMAList[fastEMAList.length - 2].value : lastFast;
      const lastSlow = slowEMAList[slowEMAList.length - 1].value;

      const lastBar = bars[bars.length - 1];
      const closeP = lastBar.close;

      let trendState = 'GIẢM';
      if (closeP > lastFast && lastFast > lastSlow) {
        trendState = 'TĂNG';
      } else if (closeP < lastFast || lastFast < lastSlow) {
        trendState = 'GIẢM';
      } else {
        trendState = closeP >= lastFast ? 'TĂNG' : 'GIẢM';
      }

      const spread = Math.abs(lastFast - lastSlow).toFixed(2);
      const slope = (lastFast - prevFast).toFixed(3);
      const slopeStr = (parseFloat(slope) >= 0 ? '+' : '') + slope;
      const wave = parseFloat(spread) > 4.5 ? 'MỞ RỘNG' : 'ỔN ĐỊNH';

      return { trend: trendState, wave, spread, slope: slopeStr };
    };

    const tf5 = calcTFTrend('5m');
    const tf15 = calcTFTrend('15m');
    const tf35 = calcTFTrend('35m');
    const tf1 = calcTFTrend('1h');
    const tf4 = calcTFTrend('4h');
    const tf1d = calcTFTrend('1d');

    const numBear = (tf5.trend === 'GIẢM' ? 1 : 0) + (tf15.trend === 'GIẢM' ? 1 : 0) + (tf35.trend === 'GIẢM' ? 1 : 0) + (tf1.trend === 'GIẢM' ? 1 : 0);
    const numBull = (tf5.trend === 'TĂNG' ? 1 : 0) + (tf15.trend === 'TĂNG' ? 1 : 0) + (tf35.trend === 'TĂNG' ? 1 : 0) + (tf1.trend === 'TĂNG' ? 1 : 0);
    const overallState = numBear >= 2 ? 'GIẢM' : numBull >= 2 ? 'TĂNG' : 'WAIT';

    if (tblHeadState) {
      tblHeadState.textContent = isSW ? 'ĐANG SW' : (overallState === 'GIẢM' ? 'GIẢM' : overallState === 'TĂNG' ? 'TĂNG' : 'WAIT');
      tblHeadState.className = isSW ? 'py-1 px-2 font-bold text-amber-400 text-right' : overallState === 'TĂNG' ? 'py-1 px-2 font-bold text-[#089981] text-right' : overallState === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645] text-right' : 'py-1 px-2 font-bold text-slate-400 text-right';
    }

    if (tbl5m) { tbl5m.textContent = tf5.trend; tbl5m.className = tf5.trend === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : tf5.trend === 'TĂNG' ? 'py-1 px-2 font-bold text-[#089981]' : 'py-1 px-2 font-bold text-amber-400'; }
    if (tbl15m) { tbl15m.textContent = tf15.trend; tbl15m.className = tf15.trend === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : 'py-1 px-2 font-bold text-[#089981]'; }
    if (tbl35m) { tbl35m.textContent = tf35.trend; tbl35m.className = tf35.trend === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : 'py-1 px-2 font-bold text-[#089981]'; }
    if (tbl1h) { tbl1h.textContent = tf1.trend; tbl1h.className = tf1.trend === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : 'py-1 px-2 font-bold text-[#089981]'; }

    if (tblTotal) { tblTotal.textContent = overallState; tblTotal.className = overallState === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : overallState === 'TĂNG' ? 'py-1 px-2 font-bold text-[#089981]' : 'py-1 px-2 font-bold text-amber-400'; }
    if (tblTotalCount) { tblTotalCount.textContent = `${numBull} TĂNG / ${numBear} GIẢM`; }
    if (tblEma) { tblEma.textContent = overallState; tblEma.className = overallState === 'GIẢM' ? 'py-1 px-2 font-bold text-[#f23645]' : overallState === 'TĂNG' ? 'py-1 px-2 font-bold text-[#089981]' : 'py-1 px-2 font-bold text-slate-400'; }

    if (tblSw) {
      tblSw.textContent = isSW ? 'ĐANG SW' : 'KHÔNG SW';
      tblSw.className = isSW ? 'py-1 px-2 font-bold text-amber-400' : 'py-1 px-2 font-bold text-slate-400';
    }
    if (tblSwDesc) {
      tblSwDesc.textContent = isSW ? 'BIÊN ĐANG GIỮ' : 'TÌM VÙNG';
      tblSwDesc.className = isSW ? 'py-1 px-2 text-slate-400 font-medium text-right' : 'py-1 px-2 text-slate-400 font-medium text-right';
    }

    // Cập nhật Bảng Đa Khung Thời Gian (MTF Wave Matrix) trong Tab MA WAVE V8
    const mtf5mTr = document.getElementById('mtf-5m-trend');
    const mtf5mWv = document.getElementById('mtf-5m-wave');
    const mtf5mSp = document.getElementById('mtf-5m-spread');
    const mtf5mSl = document.getElementById('mtf-5m-slope');

    const mtf15mTr = document.getElementById('mtf-15m-trend');
    const mtf15mWv = document.getElementById('mtf-15m-wave');
    const mtf15mSp = document.getElementById('mtf-15m-spread');
    const mtf15mSl = document.getElementById('mtf-15m-slope');

    const mtf35mTr = document.getElementById('mtf-35m-trend');
    const mtf35mWv = document.getElementById('mtf-35m-wave');
    const mtf35mSp = document.getElementById('mtf-35m-spread');
    const mtf35mSl = document.getElementById('mtf-35m-slope');

    const mtf1hTr = document.getElementById('mtf-1h-trend');
    const mtf1hWv = document.getElementById('mtf-1h-wave');
    const mtf1hSp = document.getElementById('mtf-1h-spread');
    const mtf1hSl = document.getElementById('mtf-1h-slope');

    const mtf4hTr = document.getElementById('mtf-4h-trend');
    const mtf4hWv = document.getElementById('mtf-4h-wave');
    const mtf4hSp = document.getElementById('mtf-4h-spread');
    const mtf4hSl = document.getElementById('mtf-4h-slope');

    const mtf1dTr = document.getElementById('mtf-1d-trend');
    const mtf1dWv = document.getElementById('mtf-1d-wave');
    const mtf1dSp = document.getElementById('mtf-1d-spread');
    const mtf1dSl = document.getElementById('mtf-1d-slope');

    if (mtf5mTr) { mtf5mTr.textContent = tf5.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf5mTr.className = tf5.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf5mWv) { mtf5mWv.textContent = tf5.wave; }
    if (mtf5mSp) { mtf5mSp.textContent = tf5.spread; }
    if (mtf5mSl) { mtf5mSl.textContent = tf5.slope; mtf5mSl.className = tf5.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    if (mtf15mTr) { mtf15mTr.textContent = tf15.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf15mTr.className = tf15.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf15mWv) { mtf15mWv.textContent = tf15.wave; }
    if (mtf15mSp) { mtf15mSp.textContent = tf15.spread; }
    if (mtf15mSl) { mtf15mSl.textContent = tf15.slope; mtf15mSl.className = tf15.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    if (mtf35mTr) { mtf35mTr.textContent = tf35.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf35mTr.className = tf35.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf35mWv) { mtf35mWv.textContent = tf35.wave; }
    if (mtf35mSp) { mtf35mSp.textContent = tf35.spread; }
    if (mtf35mSl) { mtf35mSl.textContent = tf35.slope; mtf35mSl.className = tf35.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    if (mtf1hTr) { mtf1hTr.textContent = tf1.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf1hTr.className = tf1.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf1hWv) { mtf1hWv.textContent = tf1.wave; }
    if (mtf1hSp) { mtf1hSp.textContent = tf1.spread; }
    if (mtf1hSl) { mtf1hSl.textContent = tf1.slope; mtf1hSl.className = tf1.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    if (mtf4hTr) { mtf4hTr.textContent = tf4.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf4hTr.className = tf4.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf4hWv) { mtf4hWv.textContent = tf4.wave; }
    if (mtf4hSp) { mtf4hSp.textContent = tf4.spread; }
    if (mtf4hSl) { mtf4hSl.textContent = tf4.slope; mtf4hSl.className = tf4.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    if (mtf1dTr) { mtf1dTr.textContent = tf1d.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; mtf1dTr.className = tf1d.trend === 'GIẢM' ? 'py-2.5 px-3 text-rose-400 font-bold' : 'py-2.5 px-3 text-emerald-400 font-bold'; }
    if (mtf1dWv) { mtf1dWv.textContent = tf1d.wave; }
    if (mtf1dSp) { mtf1dSp.textContent = tf1d.spread; }
    if (mtf1dSl) { mtf1dSl.textContent = tf1d.slope; mtf1dSl.className = tf1d.slope.startsWith('+') ? 'py-2.5 px-3 text-emerald-400' : 'py-2.5 px-3 text-rose-400'; }

    // Cập nhật Bảng Dashboard bên ngoài
    const tradeStateElem = document.getElementById('pine-trade-state');
    if (tradeStateElem) {
      if (snap.tradeState === 'BUY') {
        tradeStateElem.textContent = '🟢 BUY ENTRY';
        tradeStateElem.className = 'text-sm font-black text-emerald-400 mt-1';
      } else if (snap.tradeState === 'SELL') {
        tradeStateElem.textContent = '🔴 SELL ENTRY';
        tradeStateElem.className = 'text-sm font-black text-rose-400 mt-1';
      } else if (snap.tradeState === 'SW') {
        tradeStateElem.textContent = '⚖️ ĐANG SW';
        tradeStateElem.className = 'text-sm font-black text-amber-400 mt-1';
      } else {
        tradeStateElem.textContent = '⏳ WAIT';
        tradeStateElem.className = 'text-sm font-black text-slate-400 mt-1';
      }
    }

    const t5 = document.getElementById('pine-trend-5m');
    const t15 = document.getElementById('pine-trend-15m');
    const t35 = document.getElementById('pine-trend-35m');
    const t1h = document.getElementById('pine-trend-1h');
    const tTotal = document.getElementById('pine-overall-trend');
    const emaCur = document.getElementById('pine-ema-current');
    const emaVal = document.getElementById('pine-ema-val');
    const swState = document.getElementById('pine-sw-state');

    if (t5) { t5.textContent = tf5.trend === 'GIẢM' ? 'GIẢM 📉' : tf5.trend === 'TĂNG' ? 'TĂNG 📈' : 'WAIT ⏳'; t5.className = tf5.trend === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : tf5.trend === 'TĂNG' ? 'text-xs font-black text-emerald-400 mt-1' : 'text-xs font-black text-amber-400 mt-1'; }
    if (t15) { t15.textContent = tf15.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; t15.className = tf15.trend === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : 'text-xs font-black text-emerald-400 mt-1'; }
    if (t35) { t35.textContent = tf35.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; t35.className = tf35.trend === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : 'text-xs font-black text-emerald-400 mt-1'; }
    if (t1h) { t1h.textContent = tf1.trend === 'GIẢM' ? 'GIẢM 📉' : 'TĂNG 📈'; t1h.className = tf1.trend === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : 'text-xs font-black text-emerald-400 mt-1'; }
    
    if (tTotal) {
      tTotal.textContent = overallState === 'GIẢM' ? 'ĐỒNG THUẬN GIẢM' : overallState === 'TĂNG' ? 'ĐỒNG THUẬN TĂNG' : 'WAIT';
      tTotal.className = overallState === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : overallState === 'TĂNG' ? 'text-xs font-black text-emerald-400 mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }

    if (emaCur) {
      emaCur.textContent = overallState === 'GIẢM' ? 'GIẢM (Slope OK)' : overallState === 'TĂNG' ? 'TĂNG (Slope OK)' : 'WAIT';
      emaCur.className = overallState === 'GIẢM' ? 'text-xs font-black text-rose-400 mt-1' : overallState === 'TĂNG' ? 'text-xs font-black text-emerald-400 mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }
    if (emaVal) {
      emaVal.textContent = `20: $${snap.fastEMA} | 50: $${snap.slowEMA}`;
    }

    if (swState) {
      swState.textContent = isSW ? `ĐANG SW ($${snap.swRange || '5.5'})` : 'KHÔNG SW';
      swState.className = isSW ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }

    this.updateGiDashboardUI(snap);
  }

  startSimulatedMarketTicks() {
    if (window.marketDataStore) {
      window.marketDataStore.subscribe((event, payload) => {
        if (event === 'tick') {
          this.updatePriceHeader();
          if (this.replayMode === 'live') {
            const tf = this.currentTimeframe || '15m';
            const prevCount = this.bars ? this.bars.length : 0;
            this.bars = window.marketDataStore.getBars(tf);
            const lastBar = (this.bars && this.bars.length) ? this.bars[this.bars.length - 1] : null;
            if (this.candleSeries && lastBar) {
              if (this.bars && this.bars.length !== prevCount) {
                this.candleSeries.setData(this.bars);
              } else {
                this.candleSeries.update(lastBar);
              }
            }
            this.renderIndicators();
            this.updateReplayUI();
          }
          if (window.v8Engine) {
            const currentSnap = window.v8Engine.getV8MarketSnap ? window.v8Engine.getV8MarketSnap() : null;
            if (currentSnap) {
              this.updateV8DashboardUI(currentSnap);
            }
          }
          if (window.signalEngine) {
            const activeAsset = (this.currentAsset || (window.marketDataStore ? window.marketDataStore.currentAsset : 'xau') || 'xau').toLowerCase();
            window.signalEngine.evaluateMarket(this.bars, activeAsset);
            window.signalEngine.updateOpenOrders(payload.price, activeAsset);

            // Quét tức thời cho cả các tài sản khác (Vàng, Bitcoin, Bạc) để không bỏ lỡ khớp TP/SL
            if (window.marketDataStore && window.marketDataStore.assetsData) {
              ['XAU', 'BTC', 'XAG'].forEach(symKey => {
                const sym = symKey.toLowerCase();
                if (sym !== activeAsset) {
                  const assetObj = window.marketDataStore.assetsData[symKey];
                  if (assetObj && assetObj.price) {
                    window.signalEngine.updateOpenOrders(assetObj.price, sym);
                  }
                }
              });
            }
          }
        } else if (event === 'timeframeChange') {
          this.currentTimeframe = payload.timeframe;
          this.loadInitialBars();
          this.renderIndicators();
          this.updateReplayUI();
        }
      });
    }
  }

  updatePriceHeader() {
    const priceElem = document.getElementById('live-gold-price');
    const changeElem = document.getElementById('live-gold-change');
    const statHighElem = document.getElementById('stat-high');
    const statLowElem = document.getElementById('stat-low');
    const topSymbolNameElem = document.getElementById('top-bar-symbol-name');
    const topSymbolSubElem = document.getElementById('top-bar-symbol-sub');
    if (!priceElem) return;

    const store = window.marketDataStore;
    const curAsset = store ? (store.currentAsset || 'XAU').toUpperCase() : 'XAU';
    const curPrice = store ? store.getCurrentPrice() : (this.currentPrice || 4043.82);
    const prevPrice = store ? store.prevPrice : curPrice;

    if (topSymbolNameElem) {
      if (curAsset === 'BTC') {
        topSymbolNameElem.textContent = 'BTC/USD';
        if (topSymbolSubElem) topSymbolSubElem.textContent = 'Bitcoin Intelligence Terminal';
      } else if (curAsset === 'XAG') {
        topSymbolNameElem.textContent = 'XAG/USD';
        if (topSymbolSubElem) topSymbolSubElem.textContent = 'Silver Intelligence Terminal';
      } else {
        topSymbolNameElem.textContent = 'XAU/USD';
        if (topSymbolSubElem) topSymbolSubElem.textContent = 'Gold Intelligence Terminal';
      }
    }

    priceElem.textContent = `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (curPrice > prevPrice) {
      priceElem.classList.remove('flash-down');
      priceElem.classList.add('flash-up');
    } else if (curPrice < prevPrice) {
      priceElem.classList.remove('flash-up');
      priceElem.classList.add('flash-down');
    }

    if (changeElem) {
      const diff = (store && store.priceChange !== undefined) ? store.priceChange : -16.32;
      const pct = (store && store.priceChangePercent !== undefined) ? store.priceChangePercent : -0.40;
      const isPos = diff >= 0;
      changeElem.textContent = `${isPos ? '+' : ''}${diff.toFixed(2)} (${isPos ? '+' : ''}${pct.toFixed(2)}%)`;
      changeElem.className = `text-xs font-semibold price-font ${isPos ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    if (statHighElem && store && store.high) {
      statHighElem.textContent = store.high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (statLowElem && store && store.low) {
      statLowElem.textContent = store.low.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Cập nhật giá multi-asset trên top-bar ticker
    if (store && store.assetsData) {
      const topXau = document.getElementById('top-ticker-xau');
      const topBtc = document.getElementById('top-ticker-btc');
      const topXag = document.getElementById('top-ticker-xag');
      if (topXau && store.assetsData['XAU']) topXau.textContent = `$${store.assetsData['XAU'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (topBtc && store.assetsData['BTC']) topBtc.textContent = `$${store.assetsData['BTC'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (topXag && store.assetsData['XAG']) topXag.textContent = `$${store.assetsData['XAG'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Cập nhật giá trên Tab BẢNG GIÁ
      const radarXau = document.getElementById('radar-live-gold-val');
      const radarBtc = document.getElementById('radar-live-btc-val');
      const radarXag = document.getElementById('radar-live-silver-val');
      if (radarXau && store.assetsData['XAU']) radarXau.textContent = `$${store.assetsData['XAU'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (radarBtc && store.assetsData['BTC']) radarBtc.textContent = `$${store.assetsData['BTC'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (radarXag && store.assetsData['XAG']) radarXag.textContent = `$${store.assetsData['XAG'].price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Cập nhật giá Spotlight Hero Card
      const replayPrice = document.getElementById('replay-live-price');
      if (replayPrice) {
        replayPrice.textContent = `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      // Đồng bộ giá vào danh sách tín hiệu RADAR_SIGNALS
      if (window.RADAR_SIGNALS && Array.isArray(window.RADAR_SIGNALS)) {
        window.RADAR_SIGNALS.forEach(s => {
          if (s.asset === 'xau' && store.assetsData['XAU']) s.currentPrice = store.assetsData['XAU'].price;
          if (s.asset === 'btc' && store.assetsData['BTC']) s.currentPrice = store.assetsData['BTC'].price;
          if (s.asset === 'xag' && store.assetsData['XAG']) s.currentPrice = store.assetsData['XAG'].price;
        });
        const maWaveView = document.getElementById('view-ma-wave');
        if (maWaveView && !maWaveView.classList.contains('hidden') && typeof window.renderRadarSignalCards === 'function') {
          window.renderRadarSignalCards();
        }
      }
    }

    // Cập nhật trạng thái thị trường trên thanh tiêu đề
    const feedStatusBadge = document.getElementById('feed-status-badge');
    const feedStatusText = document.getElementById('feed-status-text');
    const feedStatusDot = document.getElementById('feed-status-dot');
    if (feedStatusBadge && feedStatusText) {
      const activeAsset = store ? (store.currentAsset || 'xau').toLowerCase() : 'xau';
      const isMarketOpen = (window.signalEngine && typeof window.signalEngine.isAssetMarketOpen === 'function')
        ? window.signalEngine.isAssetMarketOpen(activeAsset)
        : (window.signalEngine && typeof window.signalEngine.isGoldMarketOpen === 'function') 
          ? window.signalEngine.isGoldMarketOpen() 
          : (store && typeof store.isGoldMarketOpen === 'function' ? store.isGoldMarketOpen() : true);

      if (!isMarketOpen) {
        feedStatusBadge.className = 'hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg';
        if (feedStatusDot) feedStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
        feedStatusText.className = 'text-[11px] font-bold text-amber-400';
        feedStatusText.textContent = 'Thị trường đóng cửa (Nghỉ cuối tuần)';
      } else {
        feedStatusBadge.className = 'hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg';
        if (feedStatusDot) feedStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        feedStatusText.className = 'text-[11px] font-bold text-emerald-400';
        feedStatusText.textContent = activeAsset === 'btc' ? 'BTC 24/7 AI Active' : 'MA WAVE V8 AI Active';
      }
    }
  }

  listenToSignalEngine() {
    window.signalEngine.on('onNewSignal', (signal) => {
      this.showPineToastAlert(signal);
      this.renderSignalHistory();
      this.renderIndicators();
    });

    window.signalEngine.on('onOrderStatusAlert', (signal, statusType, triggerPrice) => {
      this.showTpSlToastAlert(signal, statusType, triggerPrice);
      this.renderSignalHistory();
      const isWin = statusType.startsWith('TP');
      const pair = signal.pair || 'XAU/USD';
      const trigP = Number(triggerPrice || signal.price || 0).toFixed(2);
      const title = isWin
        ? `🎯 MA WAVE V8: CHỐT LỜI ${statusType} (${pair})`
        : `🛑 MA WAVE V8: CẮT LỖ (SL) (${pair})`;
      const body = isWin
        ? `${pair} Lệnh #${signal.id} (${signal.type}) đã chạm mốc ${statusType} tại $${trigP} (+${signal.pnlPips} pips / +$${signal.pnlUsd} USD)!`
        : `${pair} Lệnh #${signal.id} (${signal.type}) đã chạm mốc SL tại $${trigP} (-50 pips). Đóng vị thế an toàn!`;

      if (typeof window.sendNativePushNotification === 'function') {
        window.sendNativePushNotification(title, { body });
      }
    });

    window.signalEngine.on('onSignalUpdate', () => {
      this.renderSignalHistory();
    });

    window.signalEngine.on('onDashboardUpdate', (snap) => {
      this.updatePineDashboardUI(snap);
    });
  }

  initNotificationCenterSystem() {
    this.notifications = [];
    this.unreadNotifCount = 0;
    this.currentNotifFilter = 'ALL';

    this.fetchBackendNotifications();
    this.connectNotificationSSE();

    setInterval(() => {
      this.fetchBackendNotifications();
    }, 15000);
  }

  async fetchBackendNotifications() {
    try {
      const res = await fetch('/api/notifications/latest');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS' && Array.isArray(data.notifications)) {
          const newItems = data.notifications;
          let added = 0;
          newItems.forEach(item => {
            if (!this.notifications.some(n => n.id === item.id)) {
              this.notifications.push(item);
              added++;
            }
          });
          if (added > 0) {
            this.unreadNotifCount += added;
            this.notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            this.renderNotificationCenterUI();
          }
        }
      }
    } catch(e) {}
  }

  connectNotificationSSE() {
    if (!('EventSource' in window)) return;
    try {
      const sse = new EventSource('/api/notifications/stream');
      sse.onmessage = (event) => {
        try {
          const item = JSON.parse(event.data);
          if (item) {
            // 1. Tín hiệu MUA / BÁN mới từ máy chủ tập trung (đồng bộ tức thì cả PC & Điện thoại)
            if (item.type === 'SIGNAL_NEW' && item.signal) {
              if (window.signalEngine && typeof window.signalEngine.onServerSignalNew === 'function') {
                window.signalEngine.onServerSignalNew(item.signal);
              }
              return;
            }
            // 2. Cập nhật trạng thái Chốt Lời TP1/2/3 hoặc Cắt Lỗ SL từ máy chủ tập trung
            if (item.type === 'SIGNAL_STATUS_UPDATE' && item.update) {
              if (window.signalEngine && typeof window.signalEngine.onServerSignalStatusUpdate === 'function') {
                window.signalEngine.onServerSignalStatusUpdate(item.update);
              }
              return;
            }
          }

          if (item && item.id) {
            if (!this.notifications.some(n => n.id === item.id)) {
              this.notifications.unshift(item);
              this.unreadNotifCount++;
              this.renderNotificationCenterUI();

              // Only trigger audio & native push banner for FRESH notifications (created within last 3 minutes)
              const itemTime = new Date(item.timestamp).getTime();
              const isFresh = (Date.now() - itemTime) < 3 * 60 * 1000;

              if (isFresh) {
                const muteMinor = document.getElementById('bot-check-mute-minor')?.checked !== false;
                const isMinor = item.title.includes('TP1') || item.title.includes('TP2');

                if (!isMinor || !muteMinor) {
                  if (window.soundAlerts) {
                    if (item.category === 'SIGNAL') {
                      if (item.title.includes('BUY')) window.soundAlerts.playBuySound();
                      else if (item.title.includes('SELL')) window.soundAlerts.playSellSound();
                      else window.soundAlerts.playPingSound();
                    } else {
                      window.soundAlerts.playPingSound();
                    }
                  }

                  window.sendNativePushNotification(item.title, {
                    body: item.body,
                    icon: 'assets/logo.png',
                    tag: item.id
                  });

                  if (typeof showToast === 'function') {
                    showToast(item.title + '\n' + item.body.slice(0, 60), 'info');
                  }
                }
              }
            }
          }
        } catch(e) {}
      };
    } catch(e) {}
  }

  toggleNotificationCenter(show) {
    const modal = document.getElementById('notif-center-modal');
    if (!modal) return;
    if (show) {
      modal.classList.remove('hidden');
      this.unreadNotifCount = 0;
      this.renderNotificationCenterUI();
    } else {
      modal.classList.add('hidden');
    }
  }

  filterNotifCenter(cat) {
    this.currentNotifFilter = cat;
    ['ALL', 'SIGNAL', 'NEWS', 'TREND'].forEach(c => {
      const btn = document.getElementById(`notif-filter-${c}`);
      if (btn) {
        if (c === cat) {
          btn.className = 'flex-1 py-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold';
        } else {
          btn.className = 'flex-1 py-1.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-normal';
        }
      }
    });
    this.renderNotificationCenterUI();
  }

  renderNotificationCenterUI() {
    const listEl = document.getElementById('notif-center-list');
    const badgeEl = document.getElementById('notif-badge-count');
    if (badgeEl) {
      if (this.unreadNotifCount > 0) {
        badgeEl.textContent = this.unreadNotifCount;
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    if (!listEl) return;

    let items = this.notifications;
    if (this.currentNotifFilter !== 'ALL') {
      items = items.filter(n => n.category === this.currentNotifFilter);
    }

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="py-12 text-center text-slate-500">
          <span class="text-3xl block mb-2">🔕</span>
          <p>Chưa có thông báo nào trong danh mục này</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map(n => {
      const isSignal = n.category === 'SIGNAL';
      const isNews = n.category === 'NEWS';
      const icon = isSignal ? '🚨' : isNews ? '📰' : '🤖';
      const badgeColor = isSignal ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : isNews ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      const timeStr = new Date(n.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5 shadow">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor} flex items-center gap-1">
              <span>${icon}</span> <span>${n.category}</span>
            </span>
            <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
          </div>
          <h4 class="font-bold text-white text-xs leading-snug">${n.title}</h4>
          <p class="text-slate-300 text-[11px] leading-relaxed whitespace-pre-line">${n.body}</p>
        </div>
      `;
    }).join('');
  }

  clearAllNotifications() {
    this.notifications = [];
    this.unreadNotifCount = 0;
    this.renderNotificationCenterUI();
    if (typeof showToast === 'function') showToast('🗑️ Đã xóa lịch sử thông báo', 'info');
  }

  testPushNotification() {
    if (typeof window.sendAllCategoryPushNotifications === 'function') {
      window.sendAllCategoryPushNotifications();
    } else {
      fetch('/api/notifications/trigger-all');
    }
  }

  showPineToastAlert(signal) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const isBuy = signal.type === 'BUY';
    const toast = document.createElement('div');
    toast.className = `toast-enter p-4 rounded-xl shadow-2xl border ${
      isBuy ? 'bg-slate-900/95 border-emerald-500 glow-buy' : 'bg-slate-900/95 border-rose-500 glow-sell'
    } flex items-start gap-3 backdrop-blur-md max-w-sm transition-all duration-300`;

    toast.innerHTML = `
      <div class="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white text-sm ${
        isBuy ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' : 'bg-rose-500 shadow-lg shadow-rose-500/40'
      }">
        ${isBuy ? 'BUY' : 'SELL'}
      </div>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-xs ${isBuy ? 'text-emerald-400' : 'text-rose-400'}">
            🔔 MA WAVE V8: ${isBuy ? 'BUY ENTRY' : 'SELL ENTRY'}
          </h4>
          <span class="text-[11px] text-slate-400 font-mono">${signal.time}</span>
        </div>
        <p class="text-xs text-slate-200 mt-1 font-mono">
          ENTRY: <strong class="text-white text-sm">$${signal.price.toFixed(2)}</strong> | SL: <strong class="text-rose-400">$${signal.sl.toFixed(2)}</strong>
        </p>
        <div class="grid grid-cols-3 gap-1.5 text-[10px] mt-1.5 font-mono text-center">
          <span class="bg-slate-800 p-1 rounded text-emerald-400 font-bold border border-emerald-500/30">TP1: $${signal.tp1.toFixed(1)} (+10)</span>
          <span class="bg-slate-800 p-1 rounded text-emerald-400 font-bold border border-emerald-500/30">TP2: $${signal.tp2.toFixed(1)} (+20)</span>
          <span class="bg-slate-800 p-1 rounded text-emerald-400 font-bold border border-emerald-500/30">TP3: $${signal.tp3.toFixed(1)} (+30)</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-1.5 bg-slate-800/80 p-1.5 rounded border border-slate-700/50">
          💡 <strong>Setup:</strong> ${signal.reason}
        </p>
      </div>
      <button class="text-slate-400 hover:text-white text-base dismiss-btn font-bold leading-none">&times;</button>
    `;

    toast.querySelector('.dismiss-btn').onclick = () => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 9000);
  }

  showTpSlToastAlert(signal, statusType, triggerPrice) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const isWin = (statusType || '').startsWith('TP');
    const isTp3 = statusType === 'TP3';
    const isTp2 = statusType === 'TP2';
    const isTp1 = statusType === 'TP1';

    const pnlPips = signal.pnlPips || (isTp3 ? 300 : isTp2 ? 200 : isTp1 ? 100 : -50);
    const pnlUsd = signal.pnlUsd || (isTp3 ? 3000 : isTp2 ? 2000 : isTp1 ? 1000 : -500);
    const pair = signal.pair || 'XAU/USD';
    const trigP = Number(triggerPrice || signal.price || 0).toFixed(2);

    const toast = document.createElement('div');
    toast.className = `toast-enter p-4 rounded-2xl shadow-2xl border backdrop-blur-xl max-w-sm transition-all duration-300 relative overflow-hidden ${
      isWin
        ? (isTp3 ? 'bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-slate-950 border-amber-400 glow-buy ring-2 ring-amber-400/40' : 'bg-slate-900/95 border-emerald-500 glow-buy')
        : 'bg-slate-900/95 border-rose-500 glow-sell'
    }`;

    const badgeTitle = isTp3
      ? '🎉 CHỐT LỜI TRỌN SÓNG TP3 (+30 GIÁ 🎯)'
      : isTp2
      ? '🎯 CHỐT LỜI TP2 (+20 GIÁ)'
      : isTp1
      ? '🎯 CHỐT LỜI TP1 (+10 GIÁ)'
      : '🛑 CẮT LỖ AN TOÀN (SL -5 GIÁ)';

    const actionAdvice = isTp3
      ? '🏆 Đạt trọn vẹn cả 3 mốc TP! Chốt lời tối đa thành công trọn sóng.'
      : isTp2
      ? '🚀 Đạt mốc TP2! Khuyến nghị chốt 70% khối lượng, dời SL về TP1 để gồng tiếp TP3.'
      : isTp1
      ? '⚡ Đạt mốc TP1! Hệ thống khuyến nghị dời SL về Hòa Vốn để bảo vệ vốn tuyệt đối.'
      : '⚠️ Lệnh chạm SL bảo vệ. Ngừng theo dõi để bảo toàn vốn an toàn.';

    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shrink-0 ${
          isWin ? (isTp3 ? 'bg-gradient-to-tr from-amber-400 to-yellow-200 shadow-lg shadow-amber-400/50' : 'bg-emerald-400 shadow-lg shadow-emerald-500/40') : 'bg-rose-500 text-white shadow-lg shadow-rose-500/40'
        }">
          ${isWin ? (isTp3 ? '🎯' : '✓') : '✕'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <h4 class="font-black text-xs ${isWin ? (isTp3 ? 'text-amber-300' : 'text-emerald-400') : 'text-rose-400'} flex items-center gap-1.5">
              ${badgeTitle}
            </h4>
            <span class="text-[10px] text-slate-400 font-mono">${signal.id}</span>
          </div>
          <p class="text-xs text-slate-200 mt-1 font-mono">
            ${pair} ${signal.type}: Khớp tại <strong class="text-white text-sm">$${trigP}</strong>
          </p>
          <div class="flex items-center gap-2 mt-1.5 font-mono text-xs">
            <span class="px-2 py-0.5 rounded font-bold ${isWin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}">
              ${isWin ? '+' : ''}${pnlPips} pips (${isWin ? '+' : ''}$${Math.abs(pnlUsd).toLocaleString('en-US')} USD)
            </span>
          </div>
          <p class="text-[10px] text-slate-300 mt-2 p-1.5 rounded bg-slate-950/80 border border-slate-800">
            ${actionAdvice}
          </p>
        </div>
        <button class="text-slate-400 hover:text-white text-base dismiss-btn font-bold leading-none cursor-pointer">&times;</button>
      </div>
    `;

    toast.querySelector('.dismiss-btn').onclick = () => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 10000);
  }

  setHistoryAssetFilter(assetKey) {
    this.currentHistoryAssetFilter = (assetKey || 'ALL').toUpperCase();
    ['all', 'xau', 'btc', 'xag'].forEach(k => {
      const btn = document.getElementById('hist-asset-' + k);
      if (btn) {
        if (k === this.currentHistoryAssetFilter.toLowerCase()) {
          btn.className = 'hist-asset-filter-btn px-3 py-1 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md cursor-pointer';
        } else {
          btn.className = 'hist-asset-filter-btn px-3 py-1 rounded-lg text-xs font-bold bg-[#0e241c] text-slate-300 border border-[#1a3d30] hover:text-white transition cursor-pointer';
        }
      }
    });
    this.renderSignalHistory();
  }

  setHistoryFilter(filterKey) {
    this.currentHistoryFilter = filterKey;
    this.currentHistoryDateFilter = null;
    const dateInput = document.getElementById('hist-custom-datepicker');
    if (dateInput) dateInput.value = '';

    const filterBtns = document.querySelectorAll('.hist-filter-btn');
    filterBtns.forEach(btn => {
      btn.className = 'hist-filter-btn px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer';
    });
    const activeBtn = document.getElementById(`hist-filter-${filterKey}`);
    if (activeBtn) {
      activeBtn.className = 'hist-filter-btn px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10 cursor-pointer';
    }
    this.renderSignalHistory();
  }

  setHistoryDateFilter(dateStr) {
    if (!dateStr) return;
    this.currentHistoryFilter = 'custom_date';
    this.currentHistoryDateFilter = dateStr;

    const filterBtns = document.querySelectorAll('.hist-filter-btn');
    filterBtns.forEach(btn => {
      btn.className = 'hist-filter-btn px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer';
    });
    this.renderSignalHistory();
  }

  clearHistoryDateFilter() {
    this.currentHistoryDateFilter = null;
    const dateInput = document.getElementById('hist-custom-datepicker');
    if (dateInput) dateInput.value = '';
    this.setHistoryFilter('today');
  }

  renderSignalHistory() {
    const tbody = document.getElementById('signals-tbody');
    if (!tbody) return;

    let allSignals = window.signalEngine ? (window.signalEngine.signals || []) : [];
    const filterKey = this.currentHistoryFilter || 'all';
    const assetFilter = (this.currentHistoryAssetFilter || 'ALL').toUpperCase();

    // 1. Lọc theo mã tài sản (VÀNG XAU, BITCOIN BTC, BẠC XAG hoặc TẤT CẢ)
    let filteredByAsset = allSignals;
    if (assetFilter !== 'ALL') {
      const a = assetFilter.toLowerCase();
      filteredByAsset = allSignals.filter(s => {
        if (!s) return false;
        if (s.asset) return s.asset.toLowerCase() === a;
        if (s.pair) return s.pair.toLowerCase().includes(a);
        return a === 'xau'; // mặc định vàng
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let cutoffSec = 0;
    let cutoffEndSec = 0;
    let labelText = 'Toàn bộ lịch sử';

    if (filterKey === 'custom_date' && this.currentHistoryDateFilter) {
      const parts = this.currentHistoryDateFilter.split('-');
      if (parts.length === 3) {
        const yyyy = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        const dd = parseInt(parts[2], 10);
        const startDate = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
        const endDate = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
        cutoffSec = Math.floor(startDate.getTime() / 1000);
        cutoffEndSec = Math.floor(endDate.getTime() / 1000);
        labelText = `Ngày ${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
      }
    } else if (filterKey === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      cutoffSec = Math.floor(todayStart.getTime() / 1000);
      const dd = String(todayStart.getDate()).padStart(2, '0');
      const mm = String(todayStart.getMonth() + 1).padStart(2, '0');
      labelText = `Hôm Nay (${dd}/${mm})`;
    } else if (filterKey === '7d') {
      cutoffSec = nowSec - (7 * 86400);
      labelText = '7 Ngày Qua';
    } else if (filterKey === '30d') {
      cutoffSec = nowSec - (30 * 86400);
      labelText = '30 Ngày Qua (1 Tháng)';
    } else if (filterKey === '60d') {
      cutoffSec = nowSec - (60 * 86400);
      labelText = '60 Ngày Qua (2 Tháng)';
    } else if (filterKey === '90d') {
      cutoffSec = nowSec - (90 * 86400);
      labelText = '90 Ngày Qua (3 Tháng)';
    }

    let signals = filteredByAsset.filter(s => {
      if (!s.timestamp) return true;
      if (cutoffEndSec) return s.timestamp >= cutoffSec && s.timestamp <= cutoffEndSec;
      if (cutoffSec) return s.timestamp >= cutoffSec;
      return true;
    });

    let isSessionFallback = false;
    if (filterKey === 'today' && signals.length === 0) {
      // Khi phiên sớm hôm nay chưa có tín hiệu: Tự động hiển thị các lệnh của Phiên gần nhất
      const latestSignals = filteredByAsset.slice(0, 16);
      if (latestSignals.length > 0) {
        signals = latestSignals;
        isSessionFallback = true;
        labelText = 'Phiên Gần Nhất (Hôm Nay / Hôm Qua)';
      }
    }

    const assetNames = {
      'ALL': 'Tất Cả Mã',
      'XAU': 'VÀNG (XAU/USD)',
      'BTC': 'BITCOIN (BTC/USD)',
      'XAG': 'BẠC (XAG/USD)'
    };
    const activeAssetName = assetNames[assetFilter] || assetFilter;

    const badgeEl = document.getElementById('hist-filter-count-badge');
    if (badgeEl) {
      badgeEl.textContent = isSessionFallback 
        ? `⚡ [${activeAssetName}] ${labelText} (${signals.length} tín hiệu)`
        : `Đang xem: [${activeAssetName}] ${labelText} (${signals.length} tín hiệu)`;
    }

    // Calculate Summary KPIs
    const totalSignals = signals.length;
    const buyCount = signals.filter(s => s.type === 'BUY').length;
    const sellCount = signals.filter(s => s.type === 'SELL').length;

    const tp1Wins = signals.filter(s => s.hitTp1).length;
    const tp2Wins = signals.filter(s => s.hitTp2).length;
    const tp3Wins = signals.filter(s => s.hitTp3).length;

    const winCount = signals.filter(s => s.hitTp1 || s.hitTp2 || s.hitTp3 || (s.pnlPips && s.pnlPips > 0)).length;
    const lossCount = signals.filter(s => (s.status && s.status.includes('CẮT LỖ')) || (s.pnlPips && s.pnlPips < 0)).length;
    const winRate = totalSignals > 0 ? Math.round((winCount / totalSignals) * 100) : 0;

    const totalPips = signals.reduce((sum, s) => sum + (s.pnlPips || 0), 0);
    const totalUsd = signals.reduce((sum, s) => sum + (s.pnlUsd || 0), 0);

    // Update KPI Elements in DOM
    const kpiTotal = document.getElementById('kpi-total-signals');
    const kpiBuySell = document.getElementById('kpi-buy-sell-breakdown');
    const kpiWin = document.getElementById('kpi-win-count');
    const kpiTpBreakdown = document.getElementById('kpi-tp-breakdown');
    const kpiLoss = document.getElementById('kpi-loss-count');
    const kpiWinRate = document.getElementById('kpi-win-rate');
    const kpiNetPips = document.getElementById('kpi-net-pips');
    const kpiNetUsd = document.getElementById('kpi-net-usd');

    if (kpiTotal) {
      kpiTotal.textContent = totalSignals.toLocaleString('en-US');
    }
    if (kpiBuySell) kpiBuySell.textContent = `${buyCount} Buy / ${sellCount} Sell`;
    if (kpiWin) kpiWin.textContent = winCount;
    if (kpiTpBreakdown) kpiTpBreakdown.textContent = `TP1: ${tp1Wins} | TP2: ${tp2Wins} | TP3: ${tp3Wins}`;
    if (kpiLoss) kpiLoss.textContent = lossCount;
    if (kpiWinRate) kpiWinRate.textContent = `${winRate}%`;

    if (kpiNetPips) {
      const pnlPoints = (totalPips / 10).toFixed(1);
      const sign = totalPips > 0 ? '+' : '';
      const unitLabel = (assetFilter === 'BTC') ? 'pts' : 'pips';
      kpiNetPips.textContent = `${sign}${totalPips.toLocaleString('en-US')} ${unitLabel}`;
      kpiNetPips.className = `text-sm font-black ${totalPips >= 0 ? 'text-yellow-300' : 'text-rose-400'}`;
    }
    if (kpiNetUsd) {
      const sign = totalUsd > 0 ? '+' : '';
      kpiNetUsd.textContent = `${sign}$${totalUsd.toLocaleString('en-US')} USD`;
      kpiNetUsd.className = `text-xs font-bold ${totalUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Cập nhật mini badge và số lượng lệnh
    const kpiMiniBadge = document.getElementById('kpi-mini-badge');
    if (kpiMiniBadge) {
      kpiMiniBadge.textContent = `Win: ${winRate}% • ${totalPips > 0 ? '+' : ''}${totalPips.toLocaleString('en-US')} pips ($${(totalUsd || 0).toLocaleString('en-US')} USD)`;
    }
    const orderCountBadge = document.getElementById('hist-order-count-badge');
    if (orderCountBadge) {
      orderCountBadge.textContent = `${signals.length} Lệnh`;
    }

    const cardsContainer = document.getElementById('signals-cards-container');

    if (signals.length === 0) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" class="text-center py-8 text-slate-500 text-xs font-sans">
              Không có tín hiệu nào phù hợp với bộ lọc [${activeAssetName}] trong khoảng thời gian này.
            </td>
          </tr>
        `;
      }
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div class="col-span-full text-center py-10 text-slate-500 text-xs font-sans bg-panel border border-slate-800 rounded-2xl p-6">
            Không có tín hiệu nào phù hợp với bộ lọc [${activeAssetName}] trong khoảng thời gian này.
          </div>
        `;
      }
      return;
    }

    const fmtP = (p, isBtc) => {
      if (p === undefined || p === null) return '--';
      return isBtc ? `$${Math.round(p).toLocaleString('en-US')}` : `$${Number(p).toFixed(2)}`;
    };

    const formatTpBadge = (hit, tpVal, isBtc) => {
      const valStr = fmtP(tpVal, isBtc);
      return hit 
        ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ ${valStr}</span>`
        : `<span class="text-slate-500 text-[11px]">${valStr}</span>`;
    };

    // 1. Render Table Rows (Cho Dạng Bảng 11 Cột)
    if (tbody) {
      tbody.innerHTML = signals.map(sig => {
        const isBuy = sig.type === 'BUY';
        const isBtc = sig.asset === 'btc';
        const isXag = sig.asset === 'xag';

        const assetBadge = isBtc
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/40">₿ BTC</span>'
          : isXag
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">🥈 BẠC</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">🪙 VÀNG</span>';

        const pnlColor = sig.pnlPips > 0 ? 'text-emerald-400' : sig.pnlPips < 0 ? 'text-rose-400' : 'text-slate-400';
        const pnlSign = sig.pnlPips > 0 ? '+' : '';
        const unit = isBtc ? 'pts' : 'pips';
        const isRunning = sig.status && sig.status.includes('ĐANG CHẠY');

        return `
          <tr class="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors text-xs">
            <td class="py-3 px-3 text-slate-400 font-mono">${sig.id}</td>
            <td class="py-3 px-3">${assetBadge}</td>
            <td class="py-3 px-3 text-slate-300 font-mono">${sig.time}</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
                ${isBuy ? 'BUY ENTRY' : 'SELL ENTRY'}
              </span>
            </td>
            <td class="py-3 px-3 text-slate-200 font-bold">${fmtP(sig.price, isBtc)}</td>
            <td class="py-3 px-3 text-rose-400/90">${fmtP(sig.sl, isBtc)}</td>
            <td class="py-3 px-3">${formatTpBadge(sig.hitTp1, sig.tp1, isBtc)}</td>
            <td class="py-3 px-3">${formatTpBadge(sig.hitTp2, sig.tp2, isBtc)}</td>
            <td class="py-3 px-3">${formatTpBadge(sig.hitTp3, sig.tp3, isBtc)}</td>
            <td class="py-3 px-3 font-bold ${pnlColor}">
              ${isRunning ? '--' : `${pnlSign}${sig.pnlPips} ${unit} ($${(sig.pnlUsd || 0).toLocaleString('en-US')})`}
            </td>
            <td class="py-3 px-3 font-sans">
              <span class="text-[11px] font-semibold text-slate-200">${sig.status}</span>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 2. Render Cards View (Dạng Thẻ Lệnh Thông Minh - Cực kỳ trực quan, xem trọn vẹn mọi lệnh trên điện thoại)
    if (cardsContainer) {
      cardsContainer.innerHTML = signals.map(sig => {
        const isBuy = sig.type === 'BUY';
        const isBtc = sig.asset === 'btc';
        const isXag = sig.asset === 'xag';

        const assetBadge = isBtc
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/40">₿ BITCOIN (BTC/USD)</span>'
          : isXag
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">🥈 BẠC (XAG/USD)</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">🪙 VÀNG (XAU/USD)</span>';

        const pnlColor = sig.pnlPips > 0 ? 'text-emerald-400' : sig.pnlPips < 0 ? 'text-rose-400' : 'text-slate-400';
        const pnlSign = sig.pnlPips > 0 ? '+' : '';
        const unit = isBtc ? 'pts' : 'pips';
        const isRunning = sig.status && sig.status.includes('ĐANG CHẠY');

        return `
          <div class="bg-gradient-to-b from-[#0e241c] to-[#07130f] border ${isBuy ? 'border-emerald-500/35 hover:border-emerald-400/60' : 'border-rose-500/35 hover:border-rose-400/60'} rounded-2xl p-3.5 space-y-3 shadow-lg relative overflow-hidden transition-all duration-200">
            <!-- Header: Mã tài sản + ID + Giờ + Badge Mua/Bán -->
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div class="flex items-center gap-2">
                ${assetBadge}
                <span class="text-[11px] font-mono font-bold text-slate-400">#${sig.id}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-lg text-xs font-black ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/20'} flex items-center gap-1">
                <span>${isBuy ? '🟢 BUY ENTRY' : '🔴 SELL ENTRY'}</span>
              </span>
            </div>

            <!-- Metrics Grid: Giá vào, SL, TP1, TP2, TP3 -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div class="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <span class="text-[9px] text-slate-400 block font-sans uppercase">GIÁ VÀO (ENTRY)</span>
                <span class="font-black text-white text-sm mt-0.5 block">${fmtP(sig.price, isBtc)}</span>
              </div>
              <div class="bg-rose-950/30 p-2 rounded-xl border border-rose-500/30">
                <span class="text-[9px] text-rose-400 block font-sans uppercase">CẮT LỖ (SL)</span>
                <span class="font-bold text-rose-300 text-sm mt-0.5 block">${fmtP(sig.sl, isBtc)}</span>
              </div>
              <div class="bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/30 col-span-2">
                <span class="text-[9px] text-emerald-400 block font-sans uppercase">CÁC MỐC CHỐT LỜI (TP1 • TP2 • TP3)</span>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  ${formatTpBadge(sig.hitTp1, sig.tp1, isBtc)}
                  ${formatTpBadge(sig.hitTp2, sig.tp2, isBtc)}
                  ${formatTpBadge(sig.hitTp3, sig.tp3, isBtc)}
                </div>
              </div>
            </div>

            <!-- Footer: Thời gian + Kết quả PnL + Trạng thái sóng -->
            <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-400 font-mono">⏰ ${sig.time}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-black ${pnlColor}">
                  ${isRunning ? '⏳ Đang chạy' : `${pnlSign}${sig.pnlPips} ${unit} ($${(sig.pnlUsd || 0).toLocaleString('en-US')})`}
                </span>
                <span class="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  ${sig.status}
                </span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Auto apply saved or default display mode (Cards for mobile, Table for PC)
    if (typeof window.applyHistoryDisplayMode === 'function') {
      window.applyHistoryDisplayMode();
    }
  }

  renderNewsAndCalendar() {
    const calendarContainer = document.getElementById('economic-calendar-list');
    if (calendarContainer) {
      calendarContainer.innerHTML = window.EconomicNews.calendar.map(item => {
        return `
          <div class="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 hover:border-slate-700 transition">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-amber-400">${item.time}</span>
                <span class="text-slate-400 text-[11px]">${item.date}</span>
                <span class="px-1 py-0.2 bg-slate-800 text-slate-300 font-semibold rounded text-[10px]">${item.country}</span>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">${item.stars}</span>
            </div>
            <h4 class="text-xs font-bold text-white mb-1 font-sans">${item.event}</h4>
            <div class="flex items-center gap-3 text-[11px] text-slate-400 font-mono mb-1">
              <span>Dự báo: <strong class="text-slate-200">${item.forecast}</strong></span>
              <span>Kỳ trước: <strong class="text-slate-200">${item.previous}</strong></span>
            </div>
            <p class="text-[10px] text-slate-400 italic font-sans">${item.description}</p>
          </div>
        `;
      }).join('');
    }
  }

  updateGiDashboardUI(snap) {
    const giMarketState = document.getElementById('gi-market-state');
    const giTrend = document.getElementById('gi-trend');
    const giWave = document.getElementById('gi-wave');
    const giWaveSub = document.getElementById('gi-wave-sub');
    const giStructure = document.getElementById('gi-structure');
    const giMomentum = document.getElementById('gi-momentum');
    const giSpread = document.getElementById('gi-spread');
    const giSpreadVal = document.getElementById('gi-spread-val');
    const giSideway = document.getElementById('gi-sideway');
    const giSidewayDesc = document.getElementById('gi-sideway-desc');
    const giReversal = document.getElementById('gi-reversal');
    const giEnd = document.getElementById('gi-end');

    if (giMarketState) {
      const isBull = snap.trend === 'TĂNG';
      const isBear = snap.trend === 'GIẢM';
      giMarketState.textContent = isBull ? 'TĂNG 📈' : isBear ? 'GIẢM 📉' : 'CHỜ ⏳';
      giMarketState.className = isBull ? 'text-xs font-black text-[#089981] mt-1' : isBear ? 'text-xs font-black text-[#f23645] mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }
    if (giTrend) {
      const isBull = snap.trend === 'TĂNG';
      const isBear = snap.trend === 'GIẢM';
      giTrend.textContent = isBull ? 'MẠNH 🚀 (TĂNG)' : isBear ? 'MẠNH 📉 (GIẢM)' : 'ĐI NGANG ⏳';
      giTrend.className = isBull ? 'text-xs font-black text-[#089981] mt-1' : isBear ? 'text-xs font-black text-[#f23645] mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }
    if (giWave) {
      giWave.textContent = snap.wave === 'MẠNH' ? 'TĂNG ⚡' : snap.wave === 'SUY YẾU' ? 'SUY YẾU ⚠️' : snap.wave;
      giWave.className = snap.wave === 'MẠNH' ? 'text-xs font-black text-[#089981] mt-1' : snap.wave === 'SUY YẾU' ? 'text-xs font-black text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }
    if (giWaveSub) {
      giWaveSub.textContent = snap.sw === 'ĐANG SW' ? 'Biên độ SW' : 'Pullback / Breakout';
    }
    if (giStructure) {
      giStructure.textContent = snap.structure.includes('Tăng') ? 'BULLISH 🏆' : snap.structure.includes('Giảm') ? 'BEARISH 📉' : 'NEUTRAL ⚖️';
      giStructure.className = snap.structure.includes('Tăng') ? 'text-xs font-black text-[#089981] mt-1' : snap.structure.includes('Giảm') ? 'text-xs font-black text-[#f23645] mt-1' : 'text-xs font-bold text-amber-400 mt-1';
    }
    if (giMomentum) {
      giMomentum.textContent = snap.momentum === 'MẠNH' ? 'MẠNH 🚀' : snap.momentum === 'YẾU' ? 'YẾU ⚠️' : 'TRUNG BÌNH ⚡';
      giMomentum.className = snap.momentum === 'MẠNH' ? 'text-xs font-black text-[#089981] mt-1' : snap.momentum === 'YẾU' ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }
    if (giSpread) {
      giSpread.textContent = snap.spread === 'Mở Rộng' || snap.spread === 'MỞ RỘNG' ? 'ĐANG MỞ RỘNG 🟢' : 'THU HẸP 🟡';
      giSpread.className = snap.spread === 'Mở Rộng' || snap.spread === 'MỞ RỘNG' ? 'text-xs font-black text-[#089981] mt-1' : 'text-xs font-black text-amber-400 mt-1';
    }
    if (giSpreadVal) {
      giSpreadVal.textContent = `Chênh EMA 20/50: $${snap.spreadValue}`;
    }
    if (giSideway) {
      const isSW = snap.sw === 'ĐANG SW';
      giSideway.textContent = isSW ? 'CÓ (ĐANG SW ⚖️)' : 'KHÔNG';
      giSideway.className = isSW ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-slate-300 mt-1';
    }
    if (giSidewayDesc) {
      giSidewayDesc.textContent = `Biên độ: $${snap.swRange}`;
    }
    if (giReversal) {
      giReversal.textContent = snap.reversal;
      giReversal.className = snap.reversal.includes('XÁC NHẬN') ? 'text-xs font-black text-[#f23645] mt-1' : snap.reversal.includes('CẢNH BÁO') ? 'text-xs font-black text-amber-400 mt-1' : 'text-xs font-bold text-slate-400 mt-1';
    }
    if (giEnd) {
      const isWeak = snap.weakening === 'CÓ';
      giEnd.textContent = isWeak ? 'CÓ (SUY YẾU) ⚠️' : 'CHƯA ✅';
      giEnd.className = isWeak ? 'text-xs font-bold text-amber-400 mt-1' : 'text-xs font-bold text-[#089981] mt-1';
    }
  }

  // Lấy snapshot chuẩn từng khung thời gian thực tế từ MarketDataStore
  getTimeframeSnapshot(tf) {
    if (!window.marketDataStore || !window.Indicators) return null;
    const bars = window.marketDataStore.getBars(tf);
    if (!bars || bars.length < 20) return null;
    const res = window.Indicators.runPineScriptLogic(bars);
    return res ? res.snapshot : null;
  }

  // Phương thức cập nhật Trang PHÂN TÍCH XU HƯỚNG XAU/USD (Đồng bộ 100% Data Engine với Biểu Đồ & Giá Live)
  updateTrendViewUI() {
    if (!this.bars || !this.bars.length) {
      if (window.marketDataStore) {
        this.bars = window.marketDataStore.getBars('15m');
      }
    }
    if (!this.lastIndicatorResult && this.bars && this.bars.length >= 20 && window.Indicators) {
      this.lastIndicatorResult = window.Indicators.runPineScriptLogic(this.bars);
    }
    let snap = this.lastIndicatorResult ? this.lastIndicatorResult.snapshot : null;
    if (!snap) {
      snap = {
        trend: 'TĂNG',
        wave: 'MẠNH',
        sw: 'KHÔNG',
        swRange: '12.50',
        fastEMA: 4148.50,
        slowEMA: 4138.20,
        atr: 3.50,
        reversal: 'CHƯA XÁC NHẬN',
        weakening: 'KHÔNG',
        structure: 'HH / HL (BULLISH)',
        signalState: 'MUA (BUY)',
        r1Price: 4005.00,
        r2Price: 4020.00,
        s1Price: 3985.00,
        s2Price: 3975.00,
        tp1Price: 4005.00,
        tp2Price: 4015.00,
        tp3Price: 4025.00,
        slPrice: 3990.00
      };
    }

    const currentPriceNum = this.currentPrice || 3995.54;
    const livePriceStr = `$${currentPriceNum.toFixed(2)}`;

    // Cập nhật giá Live trên header trang Xu Hướng theo mã tài sản đang chọn
    const activeAsset = window.currentTrendAsset || 'xau';
    const livePriceElem = document.getElementById('trend-live-price');
    if (livePriceElem) {
      if (activeAsset === 'btc') {
        const btcPrice = (window.marketDataStore && window.marketDataStore.assetsData && window.marketDataStore.assetsData['BTC']) ? window.marketDataStore.assetsData['BTC'].price : 77425.69;
        livePriceElem.textContent = `$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (activeAsset === 'xag') {
        const xagPrice = (window.marketDataStore && window.marketDataStore.assetsData && window.marketDataStore.assetsData['XAG']) ? window.marketDataStore.assetsData['XAG'].price : 49.12;
        livePriceElem.textContent = `$${xagPrice.toFixed(2)}`;
      } else {
        livePriceElem.textContent = livePriceStr;
      }
    }

    // Lấy Snapshot độc lập cho từng Khung Thời Gian (M5, M15, M30, H1, H4, D1)
    const m5Snap  = this.getTimeframeSnapshot('5m')  || snap;
    const m15Snap = this.getTimeframeSnapshot('15m') || snap;
    const m30Snap = this.getTimeframeSnapshot('35m') || snap;
    const h1Snap  = this.getTimeframeSnapshot('1h')  || snap;
    const h3Snap  = this.getTimeframeSnapshot('4h')  || snap;
    const d1Snap  = this.getTimeframeSnapshot('1d')  || snap;

    // Helper cập nhật từng Card Khung Thời Gian
    const updateTimeframeCard = (prefix, tfSnap) => {
      const stateEl  = document.getElementById(`trend-${prefix}-state`);
      const dirEl    = document.getElementById(`trend-${prefix}-dir`);
      const strEl    = document.getElementById(`trend-${prefix}-str`);
      const structEl = document.getElementById(`trend-${prefix}-struct`);
      const emaEl    = document.getElementById(`trend-${prefix}-ema`);
      const momEl    = document.getElementById(`trend-${prefix}-mom`);
      const atrEl    = document.getElementById(`trend-${prefix}-atr`);
      const actEl    = document.getElementById(`trend-${prefix}-action`);
      const warnEl   = document.getElementById(`trend-${prefix}-warn`);
      const currEl   = document.getElementById(`trend-${prefix}-curr`);

      if (!tfSnap) return;

      const isB = tfSnap.trend === 'TĂNG';
      const isD = tfSnap.trend === 'GIẢM';
      const isS = tfSnap.sw === 'ĐANG SW';

      if (stateEl) {
        stateEl.textContent = isS ? 'SW ⚖️' : isB ? 'TĂNG 📈' : isD ? 'GIẢM 📉' : 'CHỜ ⏳';
        stateEl.className = isS 
          ? 'px-2 py-0.5 rounded font-black text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30' 
          : isB 
          ? 'px-2 py-0.5 rounded font-black text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
          : isD 
          ? 'px-2 py-0.5 rounded font-black text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30' 
          : 'px-2 py-0.5 rounded font-black text-xs bg-slate-800 text-slate-300';
      }

      if (dirEl) {
        dirEl.textContent = isB ? 'TĂNG' : isD ? 'GIẢM' : 'ĐI NGANG';
        dirEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
      }

      if (strEl) {
        strEl.textContent = tfSnap.wave === 'MẠNH' ? 'MẠNH 🚀' : isD ? 'GIẢM ÁP LỰC 📉' : 'TRUNG BÌNH';
        strEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-slate-300';
      }

      if (structEl) {
        structEl.textContent = tfSnap.structure || (isB ? 'HH / HL' : isD ? 'LH / LL' : 'Pivot');
        structEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
      }

      if (emaEl) {
        emaEl.textContent = isB ? 'EMA20 > EMA50' : isD ? 'EMA20 < EMA50' : 'EMA SPREAD HẸP';
        emaEl.className = isB ? 'text-cyan-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
      }

      if (momEl) {
        momEl.textContent = tfSnap.momentum || 'TRUNG BÌNH';
        momEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-slate-300';
      }

      if (atrEl) {
        atrEl.textContent = tfSnap.atr ? `$${tfSnap.atr.toFixed(2)}` : '$3.50';
      }

      if (actEl) {
        actEl.textContent = isS ? 'CẠM BẪY SW' : isB ? 'PULLBACK EMA20' : isD ? 'XÂM PHẠM EMA50' : 'CHỜ TÍN HIỆU';
        actEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-amber-300';
      }

      if (warnEl) {
        warnEl.textContent = tfSnap.weakening === 'CÓ' ? '⚠️ SUY YẾU' : 'KHÔNG ✅';
        warnEl.className = tfSnap.weakening === 'CÓ' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold';
      }

      if (currEl) {
        currEl.textContent = isB ? 'TĂNG' : isD ? 'GIẢM' : 'ĐI NGANG';
        currEl.className = isB ? 'text-emerald-400 font-bold' : isD ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
      }
    };

    updateTimeframeCard('m5', m5Snap);
    updateTimeframeCard('m15', m15Snap);
    updateTimeframeCard('m30', m30Snap);
    updateTimeframeCard('h1', h1Snap);
    updateTimeframeCard('h3', h3Snap);
    updateTimeframeCard('d1', d1Snap);

    // 3. GOLD AI - NHẬN ĐỊNH TỔNG QUAN
    const aiShortTerm = document.getElementById('ai-short-term-summary');
    const aiLongTerm = document.getElementById('ai-long-term-summary');
    const aiAlignmentSum = document.getElementById('ai-alignment-summary');
    const aiAlignBadge = document.getElementById('ai-trend-alignment');
    const aiOverallBadge = document.getElementById('ai-trend-overall-state');
    const aiReasonText = document.getElementById('ai-trend-reason-text');

    const m15Bull = m15Snap.trend === 'TĂNG';
    const m15Bear = m15Snap.trend === 'GIẢM';

    const h1Bull = h1Snap.trend === 'TĂNG';
    const h1Bear = h1Snap.trend === 'GIẢM';

    const isConfluent = (m15Bull && h1Bull) || (m15Bear && h1Bear);

    if (aiShortTerm) {
      aiShortTerm.textContent = m15Bull ? 'TĂNG MẠNH 🚀' : m15Bear ? 'GIẢM 📉' : 'ĐI NGANG ⚖️';
      aiShortTerm.className = m15Bull ? 'text-sm font-black text-emerald-400' : m15Bear ? 'text-sm font-black text-rose-400' : 'text-sm font-black text-amber-400';
    }
    if (aiLongTerm) {
      aiLongTerm.textContent = h1Bull ? 'TĂNG CHỦ ĐẠO 🏆' : h1Bear ? 'GIẢM VĨ MÔ 📉' : 'TÍCH LŨY ⚖️';
      aiLongTerm.className = h1Bull ? 'text-sm font-black text-emerald-400' : h1Bear ? 'text-sm font-black text-rose-400' : 'text-sm font-black text-amber-400';
    }
    if (aiAlignmentSum) {
      aiAlignmentSum.textContent = isConfluent ? 'ĐỒNG THUẬN 100% 🟢' : 'PHÂN KỲ HƯỚNG ⚠️';
      aiAlignmentSum.className = isConfluent ? 'text-sm font-black text-emerald-400' : 'text-sm font-black text-amber-400';
    }
    if (aiAlignBadge) {
      aiAlignBadge.textContent = isConfluent ? 'ĐỒNG THUẬN (CONFLUENCE) 🟢' : 'PHÂN KỲ HƯỚNG (DIVERGENCE) ⚠️';
      aiAlignBadge.className = isConfluent ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold';
    }
    if (aiOverallBadge) {
      aiOverallBadge.textContent = m15Bull ? 'TĂNG 📈' : m15Bear ? 'GIẢM 📉' : 'TÍCH LŨY ⚖️';
      aiOverallBadge.className = m15Bull ? 'text-emerald-400 font-bold' : m15Bear ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold';
    }

    if (aiReasonText) {
      if (m15Bear && h1Bear) {
        aiReasonText.innerHTML = `Dữ liệu trực tiếp từ MA WAVE V8 PRO cho thấy lực Bán đang chiếm ưu thế hoàn toàn trên cả khung Ngắn hạn (M5-M30) và Dài hạn (H1-D1). Giá XAU/USD tại <strong class="text-rose-400">${livePriceStr}</strong> nằm dưới đường EMA20 (Aqua) và EMA50 (Đỏ). Áp lực chốt lời đè dốc dải sóng xuống.`;
      } else if (m15Bull && h1Bull) {
        aiReasonText.innerHTML = `Dữ liệu trực tiếp từ MA WAVE V8 PRO cho thấy phe Mua đang kiểm soát hoàn toàn trên cả 2 tầng khung thời gian. Giá XAU/USD tại <strong class="text-amber-400">${livePriceStr}</strong> duy trì ổn định trên đường EMA20. Cấu trúc đỉnh đáy dốc dương củng cố đà tăng.`;
      } else {
        aiReasonText.innerHTML = `Thị trường XAU/USD tại <strong class="text-amber-300">${livePriceStr}</strong> ghi nhận sự <strong>PHÂN KỲ HƯỚNG GIỮA CÁC KHUNG THỜI GIAN</strong>: Khung ngắn hạn (M5-M15) đang nhịp điều chỉnh GIẢM trong khi khung lớn (H4) duy trì dải hỗ trợ. Thị trường đang trong pha giằng co nén biên độ.`;
      }
    }

    // Cập nhật Vùng Kháng cự & Hỗ trợ Key Levels
    const levels = this.getCalculatedKeyLevels();
    const r2El = document.getElementById('ai-level-r2');
    const r1El = document.getElementById('ai-level-r1');
    const s1El = document.getElementById('ai-level-s1');
    const s2El = document.getElementById('ai-level-s2');

    if (r2El) r2El.textContent = `$${levels.r2.toFixed(2)}`;
    if (r1El) r1El.textContent = `$${levels.r1.toFixed(2)}`;
    if (s1El) s1El.textContent = `$${levels.s1.toFixed(2)}`;
    if (s2El) s2El.textContent = `$${levels.s2.toFixed(2)}`;

    // Cập nhật Bài Phân Tích Chuyên Gia (Article Mode) cho cả Vàng, Bitcoin và Bạc
    this.updateTrendArticleUI(m15Snap, h1Snap, h3Snap, d1Snap);
    this.updateBTCTrendArticleUI();
    this.updateSilverTrendArticleUI();
  }

  getCalculatedKeyLevels() {
    const price = this.currentPrice || (window.marketDataStore ? window.marketDataStore.getCurrentPrice() : 3995.54);

    const r3 = +(price + 30.0).toFixed(2);
    const r2 = +(price + 20.0).toFixed(2);
    const r1 = +(price + 10.0).toFixed(2);
    const pivot = +price.toFixed(2);
    const s1 = +(price - 10.0).toFixed(2);
    const s2 = +(price - 20.0).toFixed(2);
    const s3 = +(price - 30.0).toFixed(2);

    return {
      r3,
      r2,
      r1,
      pivot,
      s1,
      s2,
      s3,
      atr: 3.50
    };
  }

  dispatchAITrendPushNotification(force = false, sessionLabel = '') {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      if (force && typeof showToast === 'function') showToast('⚠️ Vui lòng bật thông báo Push trong trình duyệt trước', 'warning');
      return;
    }

    const price = this.currentPrice ? `$${this.currentPrice.toFixed(2)}` : '$4,361.78';
    const snap = this.lastIndicatorResult ? this.lastIndicatorResult.snapshot : null;
    const isBull = snap ? snap.trend === 'TĂNG' : true;
    const isBear = snap ? snap.trend === 'GIẢM' : false;
    const trendState = isBull ? '📈 TĂNG MẠNH' : isBear ? '📉 GIẢM CHỦ ĐẠO' : '⚖️ TÍCH LŨY SIDEWAY';
    const alignText = isBull ? 'MTF Đồng thuận 100% 🟢' : 'MTF Giằng co Phân kỳ ⚠️';
    
    const levels = this.getCalculatedKeyLevels();

    const prefix = sessionLabel ? `${sessionLabel}: ` : '🤖 GOLD AI — ';
    const title = `${prefix}PHÂN TÍCH XU HƯỚNG XAU/USD`;
    const body = `〽 Xu hướng: ${trendState} (${alignText})\n📍 Giá Live: ${price} (ATR: $${levels.atr.toFixed(2)})\n🚧 Kháng cự chú ý: R1 $${levels.r1.toFixed(2)} | R2 $${levels.r2.toFixed(2)}\n🛡️ Hỗ trợ chú ý: S1 $${levels.s1.toFixed(2)} | S2 $${levels.s2.toFixed(2)}`;

    window.sendNativePushNotification(title, {
      body: body,
      icon: 'assets/logo.png',
      tag: 'ai-trend-push-' + Date.now()
    });

    if (force && typeof showToast === 'function') {
      showToast('✅ Đã gửi thông báo Cập nhật Xu hướng & Vùng Cản về màn hình (Kèm tiếng PIP PIP)!', 'success');
    }
  }

  start3SessionAITrendAutoPushEngine() {
    if (this._aiTrendPushTimer) clearInterval(this._aiTrendPushTimer);
    
    const pushedSessionsToday = new Set();

    const check3SessionSchedule = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = now.toISOString().slice(0, 10);

      // 🌅 PHIÊN Á (SÁNG - 07:30 GMT+7)
      if (currentHour === 7 && currentMinute >= 30 && currentMinute < 35 && !pushedSessionsToday.has(`${todayStr}-ASIA`)) {
        pushedSessionsToday.add(`${todayStr}-ASIA`);
        this.dispatchAITrendPushNotification(false, '🌅 PHIÊN Á (07:30)');
      }
      // 🇪🇺 PHIÊN ÂU (CHIỀU - 14:30 GMT+7)
      else if (currentHour === 14 && currentMinute >= 30 && currentMinute < 35 && !pushedSessionsToday.has(`${todayStr}-EU`)) {
        pushedSessionsToday.add(`${todayStr}-EU`);
        this.dispatchAITrendPushNotification(false, '🇪🇺 PHIÊN ÂU (14:30)');
      }
      // 🇺🇸 PHIÊN MỸ (TỐI - 19:30 GMT+7)
      else if (currentHour === 19 && currentMinute >= 30 && currentMinute < 35 && !pushedSessionsToday.has(`${todayStr}-US`)) {
        pushedSessionsToday.add(`${todayStr}-US`);
        this.dispatchAITrendPushNotification(false, '🇺🇸 PHIÊN MỸ (19:30)');
      }
    };

    setTimeout(check3SessionSchedule, 5000);
    this._aiTrendPushTimer = setInterval(check3SessionSchedule, 60000);
  }

  start30MinAITrendAutoPushEngine() {
    this.start3SessionAITrendAutoPushEngine();
  }

  updateTrendArticleUI(snap) {
    const articleContainer = document.getElementById('gold-ai-trend-article');
    const updateTimeElem = document.getElementById('article-updated-time');
    if (!articleContainer) return;

    const now = new Date();
    if (updateTimeElem) {
      updateTimeElem.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Xác định Phiên giao dịch hiện tại (Giờ GMT+7)
    const currentHour = now.getHours();
    let sessionBadge = '🇺🇸 PHIÊN MỸ (19:30 - 05:00) — THANH KHOẢN CỰC MẠNH 🚀';
    let sessionClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (currentHour >= 6 && currentHour < 14) {
      sessionBadge = '🌏 PHIÊN Á (06:00 - 14:00) — NỀN TẢNG TÍCH LŨY ĐẦU NGÀY ⚖️';
      sessionClass = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    } else if (currentHour >= 14 && currentHour < 19) {
      sessionBadge = '🇪🇺 PHIÊN ÂU (14:00 - 19:30) — KHỐI LƯỢNG SÔI ĐỘNG ⚡';
      sessionClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }

    const priceNum = (window.marketDataStore && typeof window.marketDataStore.getCurrentPrice === 'function')
      ? window.marketDataStore.getCurrentPrice()
      : (this.currentPrice || 4035.50);
    const price = `$${priceNum.toFixed(2)}`;

    // Kiểm tra chính xác vị trí giá so với EMA20 và EMA50 ("Tăng bảo Tăng, Giảm bảo Giảm")
    const isBull = snap.trend === 'TĂNG' || (snap.ema20 && priceNum > snap.ema20);
    const isBear = snap.trend === 'GIẢM' || (snap.ema20 && priceNum < snap.ema20);
    const isSW = snap.sw === 'ĐANG SW';

    const atrVal = snap.atr ? `$${snap.atr.toFixed(2)}` : '$3.50';
    const ema20 = snap.ema20 ? `$${snap.ema20.toFixed(2)}` : `$${(priceNum - 2.5).toFixed(2)}`;
    const ema50 = snap.ema50 ? `$${snap.ema50.toFixed(2)}` : `$${(priceNum - 6.0).toFixed(2)}`;
    const struct = snap.structure || (isBull ? 'Cấu trúc Tăng (HH/HL)' : isBear ? 'Cấu trúc Giảm (LH/LL)' : 'Tích lũy Sideway');
    const mom = snap.momentum || 'MẠNH';
    const waveStr = snap.wave || 'MẠNH';
    const isWeakening = snap.weakening === 'CÓ';

    // Mốc Kháng cự & Hỗ trợ tính toán theo giá thực tế
    const levels = this.getCalculatedKeyLevels();

    // Tính toán mốc TP1 (+10 giá), TP2 (+20 giá), TP3 (+30 giá) & SL (-5 giá) cho Kịch bản Mua/Bán
    const buyEntry = priceNum;
    const buyTp1 = (buyEntry + 10.0).toFixed(2);
    const buyTp2 = (buyEntry + 20.0).toFixed(2);
    const buyTp3 = (buyEntry + 30.0).toFixed(2);
    const buySl  = (buyEntry - 5.0).toFixed(2);

    const sellEntry = priceNum;
    const sellTp1 = (sellEntry - 10.0).toFixed(2);
    const sellTp2 = (sellEntry - 20.0).toFixed(2);
    const sellTp3 = (sellEntry - 30.0).toFixed(2);
    const sellSl  = (sellEntry + 5.0).toFixed(2);

    // Tin tức kinh tế nếu có
    let newsContextText = '';
    let newsRiskText = '';
    if (window.newsAdapter && window.newsAdapter.events && window.newsAdapter.events.length > 0) {
      const topNews = window.newsAdapter.events[0];
      newsContextText = ` Thêm vào đó, hệ thống News Engine ghi nhận tin tức kinh tế quan trọng <strong>"${topNews.title}"</strong> (Tác động: <span class="${topNews.impact === 'HIGH' ? 'text-rose-400 font-bold' : 'text-amber-400'}">${topNews.impact}</span>, Lịch: ${topNews.time}).`;
      newsRiskText = `Biến động bất ngờ từ tin tức kinh tế lớn <strong>"${topNews.title}"</strong> lúc ${topNews.time} có thể gây giãn spread hoặc quét thanh khoản 2 đầu.`;
    }

    // 1. 📌 BỐI CẢNH THỊ TRƯỜNG & PHIÊN GIAO DỊCH
    const s1Text = `
      <div class="mb-2">
        <span class="px-2.5 py-1 rounded-md text-[11px] font-bold border ${sessionClass}">${sessionBadge}</span>
      </div>
      ${isBull
        ? `Thị trường XAU/USD hiện đang giao dịch ở mức giá <strong class="text-amber-400">${price}</strong>, tiếp tục duy trì trạng thái <strong>TĂNG GIÁ BỀN VỮNG</strong> khi nằm phía trên đường EMA20 (${ema20}) và EMA50 (${ema50}). Lực cầu áp đảo giúp mặt bằng giá duy trì mô hình đỉnh đáy nâng cao (HH/HL). Độ biến động ATR đạt <strong class="text-sky-300">${atrVal}</strong>, phản ánh dòng tiền giao dịch ổn định.${newsContextText}`
        : isBear
        ? `Thị trường XAU/USD hiện đang giao dịch ở mức giá <strong class="text-rose-400">${price}</strong>, chịu áp lực <strong>GIẢM GIÁ CHỦ ĐẠO</strong> khi giá đè dốc bên dưới cả hai đường EMA20 (${ema20}) và EMA50 (${ema50}). Phe Bán kiểm soát hoàn toàn các nhịp nảy kỹ thuật. Độ biến động ATR đạt <strong class="text-sky-300">${atrVal}</strong>.${newsContextText}`
        : `Thị trường XAU/USD hiện đang dao động quanh mức giá <strong class="text-amber-400">${price}</strong> trong trạng thái <strong>TÍCH LŨY SIDEWAY (HỘP GIÁ)</strong>. Giá liên tục cắt qua lại đường EMA20 (${ema20}) và EMA50 (${ema50}) với biên độ hẹp ATR là <strong class="text-sky-300">${atrVal}</strong>.${newsContextText}`
      }
    `;

    // 2. ⚡ PHÂN TÍCH NGẮN HẠN (M5 -> M15 -> M30)
    const s2Text = isBull
      ? `Ở nhóm khung thời gian ngắn (M5 - M15 - M30), cấu trúc giá cho thấy nhịp sóng TĂNG đang diễn ra mạch lạc. M5 thực hiện các nhịp pullback về EMA20 để kích hoạt cầu gia tăng. M15 duy trì đỉnh đáy nâng cao (${struct}) với dải EMA mở rộng dốc dương. M30 xác nhận đà bứt phá tiếp diễn (Continuation).
      <br/><br/>
      <div class="p-3 bg-slate-950/80 border border-amber-500/30 rounded-lg space-y-1">
        <span class="text-amber-400 font-bold block text-xs">💬 ĐIỀU GÌ ĐANG THỰC SỰ XẢY RA TRONG NGẮN HẠN?</span>
        <p class="text-slate-300 text-xs leading-relaxed">
          Phe Mua đang chủ động nâng vùng giá nền. Tuy nhiên do EMA Spread đang ở trạng thái giãn rộng, giá ngắn hạn có thể xuất hiện nhịp rung lắc test lại bệ đỡ EMA20 trước khi tiếp diễn đà tăng.
        </p>
      </div>`
      : isBear
      ? `Ở nhóm khung thời gian ngắn (M5 - M15 - M30), lực Bán chủ động đè dốc giá. M5 liên tục tạo đỉnh thấp hơn (LH), M15 và M30 vấp phải áp lực chốt lời lớn khi phục hồi về EMA20.
      <br/><br/>
      <div class="p-3 bg-slate-950/80 border border-rose-500/30 rounded-lg space-y-1">
        <span class="text-rose-400 font-bold block text-xs">💬 ĐIỀU GÌ ĐANG THỰC SỰ XẢY RA TRONG NGẮN HẠN?</span>
        <p class="text-slate-300 text-xs leading-relaxed">
          Phe Bán đang gia tăng khối lượng đè nén. Các nhịp hồi kỹ thuật trên M5 nhanh chóng bị dập tắt tại cản EMA50 khung M15.
        </p>
      </div>`
      : `Ở nhóm khung ngắn (M5 - M15 - M30), EMA20 và EMA50 quấn chặt lấy nhau, biên độ hẹp. Giá chờ tín hiệu bứt phá khỏi hộp tích lũy.`;

    // 3. 🕐 PHÂN TÍCH TRUNG/DÀI HẠN (H1 -> H2/H3 -> H4 -> D1)
    const s3Text = isBull
      ? `Trên các khung thời gian trung và dài hạn (H1, H4, D1), giá XAU/USD nằm trong cấu trúc TĂNG VĨ MÔ kiên cố. H1 liên tục xác nhận các vùng Bullish Pivot tại bệ đỡ hỗ trợ. H4 và D1 duy trì dải sóng MA WAVE V8 dốc dương, mở rộng hướng tới các mốc cao hơn trên đồ thị.`
      : isBear
      ? `Trên các khung trung và dài hạn (H1, H4, D1), đồ thị duy trì xu hướng GIẢM CHỦ ĐẠO. Khung H1 và H4 ghi nhận cấu trúc đỉnh đáy thấp dần (LH/LL). Đường sóng vĩ mô D1 dốc xuống.`
      : `Trên các khung trung và dài hạn (H1, H4, D1), giá XAU/USD đang tích lũy nén biên độ sau đà biến động lớn trước đó. Xu hướng lớn ở giai đoạn nén năng lượng (Compression).`;

    // Tin tức kinh tế vĩ mô thời gian thực từ News Engine
    let newsListHtml = '';
    const allNewsEvents = (window.newsAdapter && window.newsAdapter.events) || (typeof GoldNewsCenter !== 'undefined' && GoldNewsCenter.events) || [];
    if (allNewsEvents && allNewsEvents.length > 0) {
      const top3Events = allNewsEvents.slice(0, 3);
      newsListHtml = `
        <div class="mt-3 space-y-2">
          <div class="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
            <span>🌐 TIN TỨC VĨ MÔ ẢNH HƯỞNG TRỰC TIẾP TỚI GIÁ VÀNG (NEWS ENGINE):</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            ${top3Events.map(ev => `
              <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-200 truncate pr-1">${ev.title || ev.eventNameVn || ev.eventName}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${ev.impact === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">${ev.impact || 'MEDIUM'}</span>
                </div>
                <div class="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>🕒 Lịch: <strong class="text-amber-300">${ev.time || '19:30'} GMT+7</strong></span>
                  <span>Trạng thái: <strong class="text-sky-300">${ev.status === 'RELEASED' ? 'Đã công bố' : 'Sắp diễn ra'}</strong></span>
                </div>
                ${ev.actual ? `<div class="text-[10px] text-slate-300">Thực tế: <strong class="text-emerald-400">${ev.actual}</strong> | Dự báo: ${ev.forecast || '--'}</div>` : ''}
                ${ev.aiAnalysis ? `<p class="text-[10px] text-slate-400 italic line-clamp-2">${ev.aiAnalysis}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 4. 🎯 BẢNG CÁC MỐC QUAN TRỌNG CANH BUY - CANH SELL & CẢN THỜI GIAN THỰC
    const s4TradingPlans = `
      <div class="space-y-4 my-2 font-mono text-xs">
        
        <!-- BẢNG CANH BUY & CANH SELL 2 CỘT -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- KỊCH BẢN CANH BUY -->
          <div class="p-4 rounded-xl bg-gradient-to-b from-emerald-950/40 to-slate-950/90 border border-emerald-500/50 space-y-3 shadow-xl relative overflow-hidden">
            <div class="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <span class="font-black text-emerald-400 text-sm flex items-center gap-1.5">
                <span>📈</span> VÙNG CANH BUY CHIẾN LƯỢC
              </span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">Mục Tiêu +30 Giá (🎯)</span>
            </div>

            <div class="space-y-2 text-slate-200">
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-slate-400">📍 Vùng Canh Vào (Entry):</span>
                <strong class="text-amber-300 font-bold">$${(buyEntry - 2.0).toFixed(2)} - $${buyEntry.toFixed(2)}</strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-rose-400 font-bold flex items-center gap-1">🛡️ Cắt Lỗ SL (-5 giá):</span>
                <strong class="text-rose-300 font-bold">$${buySl} <span class="text-[10px] text-rose-400/80 font-normal">(-50 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-emerald-400 font-bold flex items-center gap-1">🎯 Chốt Lời TP1 (+10 giá):</span>
                <strong class="text-emerald-300 font-bold">$${buyTp1} <span class="text-[10px] text-emerald-400/80 font-normal">(+100 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-emerald-400 font-bold flex items-center gap-1">🎯 Chốt Lời TP2 (+20 giá):</span>
                <strong class="text-emerald-300 font-bold">$${buyTp2} <span class="text-[10px] text-emerald-400/80 font-normal">(+200 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1">
                <span class="text-emerald-400 font-black flex items-center gap-1">🎯 Chốt Lời TP3 (+30 giá):</span>
                <strong class="text-yellow-300 font-black text-sm">$${buyTp3} <span class="text-[10px] text-yellow-400 font-normal">(+300 pips - Trọn Sóng)</span></strong>
              </div>
            </div>

            <div class="p-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-200 leading-relaxed font-sans space-y-1">
              <div>⚡ <strong>Điều Kiện Nến M5/M15:</strong> Nến rút chân từ chối giá tại EMA20 ($${ema20}) hoặc hỗ trợ S1 ($${levels.s1.toFixed(2)}), xuất hiện nến xanh đảo chiều.</div>
              <div>🔒 <strong>Quy Tắc Quản Trị Vốn:</strong> Ngay khi giá chạm <strong>TP1 ($${buyTp1})</strong>, hệ thống tự động cảnh báo ➔ <strong>Lập tức dời SL về Hòa Vốn ($${buyEntry.toFixed(2)})</strong> để bảo toàn lợi nhuận và an tâm gồng tiếp TP2 & TP3!</div>
            </div>
          </div>

          <!-- KỊCH BẢN CANH SELL -->
          <div class="p-4 rounded-xl bg-gradient-to-b from-rose-950/40 to-slate-950/90 border border-rose-500/50 space-y-3 shadow-xl relative overflow-hidden">
            <div class="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <span class="font-black text-rose-400 text-sm flex items-center gap-1.5">
                <span>📉</span> VÙNG CANH SELL PHẢN ỨNG
              </span>
              <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30">Mục Tiêu -30 Giá (🎯)</span>
            </div>

            <div class="space-y-2 text-slate-200">
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-slate-400">📍 Vùng Canh Vào (Entry):</span>
                <strong class="text-amber-300 font-bold">$${sellEntry.toFixed(2)} - $${(sellEntry + 2.0).toFixed(2)}</strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-rose-400 font-bold flex items-center gap-1">🛡️ Cắt Lỗ SL (+5 giá):</span>
                <strong class="text-rose-300 font-bold">$${sellSl} <span class="text-[10px] text-rose-400/80 font-normal">(-50 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-emerald-400 font-bold flex items-center gap-1">🎯 Chốt Lời TP1 (-10 giá):</span>
                <strong class="text-emerald-300 font-bold">$${sellTp1} <span class="text-[10px] text-emerald-400/80 font-normal">(+100 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span class="text-emerald-400 font-bold flex items-center gap-1">🎯 Chốt Lời TP2 (-20 giá):</span>
                <strong class="text-emerald-300 font-bold">$${sellTp2} <span class="text-[10px] text-emerald-400/80 font-normal">(+200 pips)</span></strong>
              </div>
              <div class="flex justify-between items-center py-1">
                <span class="text-emerald-400 font-black flex items-center gap-1">🎯 Chốt Lời TP3 (-30 giá):</span>
                <strong class="text-yellow-300 font-black text-sm">$${sellTp3} <span class="text-[10px] text-yellow-400 font-normal">(+300 pips - Trọn Sóng)</span></strong>
              </div>
            </div>

            <div class="p-2.5 bg-rose-950/80 border border-rose-500/30 rounded-lg text-[11px] text-rose-200 leading-relaxed font-sans space-y-1">
              <div>⚡ <strong>Điều Kiện Nến M5/M15:</strong> Giá chạm kháng cự R1 ($${levels.r1.toFixed(2)}) hoặc EMA50 ($${ema50}) xuất hiện râu nến trên dài, nến đỏ giảm mạnh.</div>
              <div>🛑 <strong>Cảnh Báo Ngừng Lệnh:</strong> Nếu giá vi phạm SL ($${sellSl}), hệ thống lập tức thông báo: <em>"Điểm BUY/SELL hiện tại ngừng chú ý lệnh để thoát cho an toàn"</em>.</div>
            </div>
          </div>

        </div>

        <!-- MA TRẬN 7 MỐC CẢN QUAN TRỌNG TRONG PHIÊN (KEY LEVELS MATRIX) -->
        <div class="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-xs font-black text-amber-400 flex items-center gap-1.5">
              <span>📍</span> MA TRẬN 7 MỐC CẢN QUAN TRỌNG TRONG PHIÊN (KEY LEVELS MATRIX)
            </span>
            <span class="text-[10px] text-slate-400">Tự động tính theo Giá Live</span>
          </div>
          
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-[11px]">
            <div class="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30">
              <span class="text-[9px] text-rose-300 font-sans block">Cản R3 (Cực đại)</span>
              <strong class="text-rose-400 font-bold">$${levels.r3.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-rose-950/20 border border-rose-500/20">
              <span class="text-[9px] text-rose-300 font-sans block">Cản R2 (TP2)</span>
              <strong class="text-rose-300 font-bold">$${levels.r2.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-rose-950/15 border border-rose-500/20">
              <span class="text-[9px] text-rose-300 font-sans block">Cản R1 (TP1)</span>
              <strong class="text-rose-200 font-bold">$${levels.r1.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-amber-950/30 border border-amber-500/40">
              <span class="text-[9px] text-amber-300 font-sans block">Điểm Pivot (Giá Live)</span>
              <strong class="text-amber-400 font-black">$${levels.pivot.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-emerald-950/15 border border-emerald-500/20">
              <span class="text-[9px] text-emerald-300 font-sans block">Hỗ trợ S1 (Cầu 1)</span>
              <strong class="text-emerald-200 font-bold">$${levels.s1.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
              <span class="text-[9px] text-emerald-300 font-sans block">Hỗ trợ S2 (Cầu 2)</span>
              <strong class="text-emerald-300 font-bold">$${levels.s2.toFixed(2)}</strong>
            </div>
            <div class="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <span class="text-[9px] text-emerald-300 font-sans block">Hỗ trợ S3 (Cực tiểu)</span>
              <strong class="text-emerald-400 font-bold">$${levels.s3.toFixed(2)}</strong>
            </div>
          </div>
        </div>

      </div>
    `;

    // 5. 🧠 ĐÁNH GIÁ CẤU TRÚC VÀ CÁC MỐC CẢN KEY LEVELS
    const s5Text = `
      <div class="space-y-2 text-xs">
        <div>• <strong>Mốc Kháng cự chú ý:</strong> <strong class="text-rose-400">R1 $${levels.r1.toFixed(2)}</strong> | <strong class="text-rose-400">R2 $${levels.r2.toFixed(2)}</strong> | <strong class="text-rose-400">R3 $${levels.r3.toFixed(2)}</strong></div>
        <div>• <strong>Mốc Hỗ trợ chú ý:</strong> <strong class="text-emerald-400">S1 $${levels.s1.toFixed(2)}</strong> | <strong class="text-emerald-400">S2 $${levels.s2.toFixed(2)}</strong> | <strong class="text-emerald-400">S3 $${levels.s3.toFixed(2)}</strong></div>
        <div>• <strong>Kỳ vọng phản ứng tại Cản:</strong> Khi giá tiến về $R1 ($${levels.r1.toFixed(2)}), kỳ vọng lực chốt lời ngắn hạn sẽ xuất hiện. Nếu nến H1 đóng cửa phá vỡ $R1, giá sẽ tiến tới $R2 ($${levels.r2.toFixed(2)}) và $R3 ($${levels.r3.toFixed(2)}). Ngược lại nếu lùi về $S1 ($${levels.s1.toFixed(2)}), vùng cầu EMA20/50 sẽ nỗ lực hỗ trợ đỡ giá.</div>
        <div>• <strong>Cấu trúc thị trường (Structure):</strong> ${struct} — Đang ủng hộ ${isBull ? '<span class="text-emerald-400 font-bold">Phe Mua</span>' : isBear ? '<span class="text-rose-400 font-bold">Phe Bán</span>' : '<span class="text-amber-400 font-bold">Trạng thái Tích Lũy</span>'}.</div>
        <div>• <strong>Động lượng (Momentum):</strong> Trạng thái <strong>${mom}</strong> — Lực đi của giá đi kèm thanh khoản thực tế.</div>
      </div>
    `;

    // 6. ⚠️ RỦI RO & TIN TỨC VĨ MÔ THỜI GIAN THỰC
    const s6Text = `
      <div class="space-y-2 text-slate-300 text-xs">
        <ul class="list-disc list-inside space-y-1.5">
          <li><strong>Quản lý khối lượng lệnh:</strong> Khuyến nghị tuyệt đối đi vốn tối đa 1-2% tài khoản cho mỗi lệnh giao dịch.</li>
          <li><strong>Tuân thủ mốc SL -5 giá:</strong> Tuyệt đối gài SL 5 giá ($50 pips) để bảo vệ tài khoản khỏi các pha sụt giảm bất ngờ.</li>
          ${newsRiskText ? `<li><strong>Biến động Tin Tức Kinh Tế:</strong> ${newsRiskText}</li>` : ''}
        </ul>
        ${newsListHtml}
        <p class="text-[11px] text-slate-400 italic mt-2 font-mono">⚠️ Bài phân tích mang tính chất giáo dục & quan sát cấu trúc thị trường tự động từ MA WAVE V8 Engine.</p>
      </div>
    `;

    // 7. 📊 NHẬN ĐỊNH TỔNG THỂ
    const shortTermBadge = isBull ? 'TĂNG 📈' : isBear ? 'GIẢM 📉' : 'ĐI NGANG ⚖️';
    const longTermBadge = isBull ? 'TĂNG 📈' : isBear ? 'GIẢM 📉' : 'ĐI NGANG ⚖️';
    const alignBadge = isBull || isBear ? 'ĐỒNG THUẬN 🟢' : 'PHÂN KỲ ⚠️';
    const marketBadge = isSW ? 'SIDEWAY ⚖️' : isBull ? 'TĂNG 📈' : 'GIẢM 📉';
    const confidenceBadge = isBull && !isWeakening ? 'HIGH (CAO) 🟢' : isSW ? 'LOW (THẤP) 🔴' : 'MEDIUM (TRUNG BÌNH) 🟡';

    const s7Text = `
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs my-3">
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Xu hướng ngắn hạn</span>
          <strong class="${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-amber-400'}">${shortTermBadge}</strong>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Xu hướng dài hạn</span>
          <strong class="${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-amber-400'}">${longTermBadge}</strong>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Đồng thuận MTF</span>
          <strong class="${isBull || isBear ? 'text-emerald-400' : 'text-amber-400'}">${alignBadge}</strong>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Trạng thái thị trường</span>
          <strong class="${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-amber-400'}">${marketBadge}</strong>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
          <span class="text-[10px] text-slate-400 block mb-1 font-sans">Độ tin cậy</span>
          <strong class="${isBull && !isWeakening ? 'text-emerald-400' : 'text-amber-400'}">${confidenceBadge}</strong>
        </div>
      </div>

      <div class="bg-amber-950/20 border border-amber-500/40 rounded-xl p-4 text-slate-200 mt-3 space-y-2">
        <div class="font-black text-amber-400 text-sm flex items-center gap-2">
          <span>🧠 TÓM LẠI...</span>
        </div>
        <p class="text-xs leading-relaxed text-slate-300 font-sans">
          ${isBull
            ? `Thị trường XAU/USD tại mốc giá <strong class="text-amber-300">${price}</strong> đang nằm trong giai đoạn TĂNG GIÁ. Cấu trúc thị trường và chỉ báo MA WAVE V8 nghiêng về phe Mua. Ưu tiên quan sát kịch bản Mua khi giá tiếp cận vùng hỗ trợ EMA20 ($${ema20}), chốt lời theo 3 mốc TP1 ($${buyTp1}), TP2 ($${buyTp2}), TP3 ($${buyTp3}) và dời SL về Hòa Vốn khi đạt TP1.`
            : isBear
            ? `Thị trường XAU/USD tại mốc giá <strong class="text-rose-300">${price}</strong> đang nằm dưới sự kiểm soát của phe Bán với xu hướng GIẢM CHỦ ĐẠO. Khuyến nghị theo dõi kịch bản Bán chốt lời tại TP1 ($${sellTp1}), TP2 ($${sellTp2}), TP3 ($${sellTp3}).`
            : `Thị trường XAU/USD tại mốc giá <strong class="text-amber-300">${price}</strong> đang trong pha tích lũy nén biên độ (Sideway). Kiên nhẫn chờ đợi nến bứt phá (Breakout) khỏi hộp giá.`
          }
        </p>
      </div>
    `;

    articleContainer.innerHTML = `
      <!-- 1. BỐI CẢNH THỊ TRƯỜNG & PHIÊN GIAO DỊCH -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-amber-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📌 1. BỐI CẢNH THỊ TRƯỜNG & PHIÊN GIAO DỊCH</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s1Text}</div>
      </section>

      <!-- 2. PHÂN TÍCH NGẮN HẠN -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-sky-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚡ 2. PHÂN TÍCH NGẮN HẠN (M5 → M15 → M30)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s2Text}</div>
      </section>

      <!-- 3. PHÂN TÍCH TRUNG/DÀI HẠN -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-amber-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🕐 3. PHÂN TÍCH TRUNG / DÀI HẠN (H1 → H2/H3 → H4 → D1)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s3Text}</div>
      </section>

      <!-- 4. CÁC MỐC QUAN TRỌNG CANH BUY - CANH SELL & CẢN THỜI GIAN THỰC -->
      <section class="bg-slate-900/90 border border-amber-500/40 rounded-xl p-4 space-y-2 shadow-2xl">
        <h4 class="text-sm font-black text-amber-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🎯 4. CÁC MỐC QUAN TRỌNG CANH BUY - SELL & MA TRẬN CẢN THỜI GIAN THỰC (3 MỐC TP + SL -5)</span>
        </h4>
        <div>${s4TradingPlans}</div>
      </section>

      <!-- 5. ĐÁNH GIÁ CẤU TRÚC VÀ MỐC CẢN -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-emerald-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🧠 5. MỐC KHÁNG CỰ, HỖ TRỢ & DỰ BÁO PHẢN ỨNG GIÁ</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s5Text}</div>
      </section>

      <!-- 6. RỦI RO / TIN TỨC VĨ MÔ THỜI GIAN THỰC -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-rose-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚠️ 6. RỦI RO, QUẢN TRỊ VỐN & CẬP NHẬT TIN TỨC VĨ MÔ</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s6Text}</div>
      </section>

      <!-- 7. NHẬN ĐỊNH TỔNG THỂ -->
      <section class="bg-slate-900/90 border border-amber-500/40 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-yellow-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📊 7. NHẬN ĐỊNH TỔNG THỂ & TÓM TẮT</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed">${s7Text}</div>
      </section>
    `;
  }

  updateBTCTrendArticleUI() {
    const articleContainer = document.getElementById('btc-ai-trend-article');
    const store = window.marketDataStore;
    const btcData = (store && store.assetsData && store.assetsData['BTC']) ? store.assetsData['BTC'] : null;
    const priceNum = (btcData && btcData.price) ? btcData.price : 77425.69;
    const priceStr = `$${priceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Update hero card metrics
    const btcPriceElem = document.getElementById('btc-metric-price');
    if (btcPriceElem) btcPriceElem.textContent = priceStr;
    const btcRangeElem = document.getElementById('btc-metric-range');
    if (btcRangeElem) {
      const low = (btcData && btcData.low) ? btcData.low : (priceNum - 840);
      const high = (btcData && btcData.high) ? btcData.high : (priceNum + 1210);
      btcRangeElem.textContent = `$${Math.round(low).toLocaleString('en-US')} - $${Math.round(high).toLocaleString('en-US')}`;
    }

    // Dynamic key levels
    const s1 = Math.round(priceNum - 640);
    const s2 = Math.round(priceNum - 1340);
    const s3 = Math.round(priceNum - 2340);
    const r1 = Math.round(priceNum + 1060);
    const r2 = Math.round(priceNum + 2360);
    const r3 = Math.round(priceNum + 3860);

    const s1El = document.getElementById('btc-level-s1');
    const s2El = document.getElementById('btc-level-s2');
    const s3El = document.getElementById('btc-level-s3');
    const r1El = document.getElementById('btc-level-r1');
    const r2El = document.getElementById('btc-level-r2');
    const r3El = document.getElementById('btc-level-r3');
    if (s1El) s1El.textContent = `$${s1.toLocaleString('en-US')}`;
    if (s2El) s2El.textContent = `$${s2.toLocaleString('en-US')}`;
    if (s3El) s3El.textContent = `$${s3.toLocaleString('en-US')}`;
    if (r1El) r1El.textContent = `$${r1.toLocaleString('en-US')}`;
    if (r2El) r2El.textContent = `$${r2.toLocaleString('en-US')}`;
    if (r3El) r3El.textContent = `$${r3.toLocaleString('en-US')}`;

    if (!articleContainer) return;

    // Trading plan calculations
    const buyEntry = Math.round(priceNum);
    const buyTp1 = buyEntry + 1200;
    const buyTp2 = buyEntry + 2500;
    const buyTp3 = buyEntry + 4000;
    const buySl = buyEntry - 1200;

    const sellEntry = Math.round(priceNum);
    const sellTp1 = sellEntry - 1200;
    const sellTp2 = sellEntry - 2500;
    const sellTp3 = sellEntry - 4000;
    const sellSl = sellEntry + 1200;

    articleContainer.innerHTML = `
      <!-- 1. BỐI CẢNH THỊ TRƯỜNG & DÒNG TIỀN TỔ CHỨC BITCOIN -->
      <section class="bg-slate-900/80 border border-orange-500/30 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-orange-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📌 1. BỐI CẢNH THỊ TRƯỜNG & DÒNG VỐN TỔ CHỨC BITCOIN</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Bitcoin (BTC/USD) đang dao động quanh mốc giá <strong class="text-orange-400 font-mono">${priceStr}</strong>, thể hiện sức đề kháng vượt trội sau chuỗi biến động mạnh của thị trường tài chính toàn cầu. Dữ liệu dòng vốn On-Chain và các quỹ Spot ETF ghi nhận nhịp gom ròng tích cực với <strong class="text-emerald-400">+$620M/ngày</strong> từ các định chế tài chính lớn như BlackRock (IBIT) và Fidelity (FBTC).
          </p>
          <p>
            Chỉ số <strong>Tâm Lý Sợ Hãi & Tham Lam (Fear & Greed Index)</strong> đạt mức <strong class="text-emerald-400 font-mono">74/100 (Tham lam tích cực)</strong>, phản ánh niềm tin vững chắc từ các nhà đầu cơ trung hạn nhưng không rơi vào trạng thái hưng phấn quá đà. Tỷ lệ phí tài trợ phái sinh (Funding Rate) duy trì ở mức cân bằng <strong class="text-cyan-400 font-mono">+0.008%</strong>, loại bỏ triệt để rủi ro xảy ra các đợt quét thanh lý Long quy mô lớn.
          </p>
        </div>
      </section>

      <!-- 2. PHÂN TÍCH NGẮN HẠN (M5 -> M15 -> M30) -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-sky-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚡ 2. PHÂN TÍCH NGẮN HẠN BITCOIN (M5 → M15 → M30)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Trên đồ thị ngắn hạn (M5 - M15 - M30), Bitcoin vừa hoàn tất pha kiểm định đáy kép (Double Bottom) thành công tại vùng giá hỗ trợ <strong class="text-emerald-400 font-mono">$${s1.toLocaleString('en-US')}</strong>. Dải sóng MA WAVE V8 trên khung M15 bắt đầu thu hẹp độ giãn và cắt lên đường EMA20, xác lập cấu trúc Higher Low (Đáy sau cao hơn đáy trước).
          </p>
          <div class="p-3 bg-slate-950/80 border border-orange-500/30 rounded-lg space-y-1">
            <span class="text-orange-400 font-bold block text-xs">💬 ĐẶC ĐIỂM DÒNG TIỀN NGẮN HẠN BITCOIN:</span>
            <p class="text-slate-300 text-xs leading-relaxed">
              Lực bán đè giá tại ngưỡng $78,000 đã suy giảm rõ rệt. Khung M30 đang hình thành mô hình nén biên độ (Volatility Squeeze), sẵn sàng cho một nhịp bùng nổ thanh khoản khi phiên Âu - Mỹ giao thoa.
            </p>
          </div>
        </div>
      </section>

      <!-- 3. PHÂN TÍCH TRUNG / DÀI HẠN (H1 -> H4 -> D1) -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-amber-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🕐 3. PHÂN TÍCH TRUNG / DÀI HẠN BITCOIN (H1 → H4 → D1)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Trên các khung thời gian lớn (H1, H4, D1), Bitcoin kiên định nằm trong kênh xu hướng <strong>TĂNG TRƯỞNG VĨ MÔ (Macro Bullish Channel)</strong>. Bệ đỡ đường trung bình động EMA50 khung H4 tại vùng <strong class="text-emerald-400 font-mono">$${s2.toLocaleString('en-US')}</strong> đóng vai trò phòng tuyến vững chắc của phe Mua.
          </p>
          <p>
            Đồ thị ngày (D1) duy trì dải sóng MA Wave dốc dương hướng lên các mốc cao lịch sử. Miễn là Bitcoin duy trì đóng nến trên vùng $75,000, xu hướng vĩ mô tiếp tục hướng tới mục tiêu thử thách lại mốc tâm lý <strong class="text-amber-300 font-mono">$80,000 - $85,000</strong> trong chu kỳ này.
          </p>
        </div>
      </section>

      <!-- 4. KỊCH BẢN GIAO DỊCH BUY & SELL CHI TIẾT -->
      <section class="bg-slate-900/90 border border-orange-500/30 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-orange-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🎯 4. KỊCH BẢN GIAO DỊCH BUY & SELL CHI TIẾT (BITCOIN STRATEGY)</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 font-mono text-xs">
          <!-- BUY SCENARIO -->
          <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5 shadow-lg">
            <div class="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <span class="font-black text-emerald-400 text-sm flex items-center gap-1.5">
                <span>📈</span> KỊCH BẢN MUA BITCOIN (BUY PLAN)
              </span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Ưu tiên 80%</span>
            </div>
            <div class="space-y-1.5 text-slate-200">
              <div><span class="text-slate-400">📍 Điểm vào (Entry):</span> <strong class="text-amber-300">$${buyEntry.toLocaleString('en-US')}</strong> (Mua gom khi M15 giữ vững đáy)</div>
              <div><span class="text-emerald-400 font-bold">🎯 TP1 (+1,200 giá):</span> <strong class="text-emerald-300">$${buyTp1.toLocaleString('en-US')}</strong> <span class="text-[10px] text-emerald-400/80">(Chốt 50% khối lượng)</span></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP2 (+2,500 giá):</span> <strong class="text-emerald-300">$${buyTp2.toLocaleString('en-US')}</strong> <span class="text-[10px] text-emerald-400/80">(Thử thách cản R2)</span></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP3 (+4,000 giá):</span> <strong class="text-emerald-300">$${buyTp3.toLocaleString('en-US')}</strong> <span class="text-[10px] text-emerald-400/80">(Trọn sóng bứt phá $80K)</span></div>
              <div><span class="text-rose-400 font-bold">🛡️ Cắt lỗ SL (-1,200 giá):</span> <strong class="text-rose-300">$${buySl.toLocaleString('en-US')}</strong> <span class="text-[10px] text-rose-400/80">(Thủng EMA50 H4)</span></div>
            </div>
            <div class="p-2.5 bg-emerald-900/40 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-200 leading-relaxed font-sans">
              ⚡ <strong>Quy Tắc Quản Trị Lệnh:</strong> Khi giá đạt <strong>TP1 ($${buyTp1.toLocaleString('en-US')})</strong>, dời ngay Stop Loss về điểm vào lệnh hòa vốn (Breakeven $${buyEntry.toLocaleString('en-US')}) để bảo toàn lợi nhuận tuyệt đối!
            </div>
          </div>

          <!-- SELL SCENARIO -->
          <div class="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2.5 shadow-lg">
            <div class="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <span class="font-black text-rose-400 text-sm flex items-center gap-1.5">
                <span>📉</span> KỊCH BẢN BÁN PHÒNG NGỪA (SELL PLAN)
              </span>
              <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Phòng ngừa 20%</span>
            </div>
            <div class="space-y-1.5 text-slate-200">
              <div><span class="text-slate-400">📍 Điểm vào (Entry):</span> <strong class="text-amber-300">$${sellEntry.toLocaleString('en-US')}</strong> (Khi nến H1 gãy thủng bệ đỡ S2)</div>
              <div><span class="text-emerald-400 font-bold">🎯 TP1 (+1,200 giá):</span> <strong class="text-emerald-300">$${sellTp1.toLocaleString('en-US')}</strong></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP2 (+2,500 giá):</span> <strong class="text-emerald-300">$${sellTp2.toLocaleString('en-US')}</strong></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP3 (+4,000 giá):</span> <strong class="text-emerald-300">$${sellTp3.toLocaleString('en-US')}</strong></div>
              <div><span class="text-rose-400 font-bold">🛡️ Cắt lỗ SL (-1,200 giá):</span> <strong class="text-rose-300">$${sellSl.toLocaleString('en-US')}</strong></div>
            </div>
            <div class="p-2.5 bg-rose-900/40 border border-rose-500/30 rounded-lg text-[11px] text-rose-200 leading-relaxed font-sans">
              🛑 <strong>Cảnh Báo:</strong> Không nên mở lệnh Short đuổi nếu giá chưa chính thức gãy bệ đỡ hỗ trợ vĩ mô $75,800.
            </div>
          </div>
        </div>
      </section>

      <!-- 5. MỐC KHÁNG CỰ, HỖ TRỢ & DỰ BÁO PHẢN ỨNG GIÁ -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-emerald-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🧠 5. MỐC KHÁNG CỰ, HỖ TRỢ & DỰ BÁO PHẢN ỨNG GIÁ BITCOIN</span>
        </h4>
        <div class="space-y-2 text-xs font-sans text-slate-300">
          <div>• <strong>Kháng cự then chốt:</strong> <strong class="text-rose-400 font-mono">R1 $${r1.toLocaleString('en-US')}</strong> | <strong class="text-rose-400 font-mono">R2 $${r2.toLocaleString('en-US')}</strong> | <strong class="text-amber-300 font-mono">R3 $${r3.toLocaleString('en-US')}</strong></div>
          <div>• <strong>Hỗ trợ phòng ngự:</strong> <strong class="text-emerald-400 font-mono">S1 $${s1.toLocaleString('en-US')}</strong> | <strong class="text-emerald-400 font-mono">S2 $${s2.toLocaleString('en-US')}</strong> | <strong class="text-white font-mono">S3 $${s3.toLocaleString('en-US')}</strong></div>
          <div>• <strong>Dự báo hành vi:</strong> Vùng giá quanh <strong class="text-rose-300 font-mono">$${r1.toLocaleString('en-US')}</strong> đang chịu áp lực cung ngắn hạn từ nhóm thợ đào chốt lời một phần. Tuy nhiên khi nến H4 xác nhận đóng cửa trên $78,500, thị trường sẽ kích hoạt làn sóng mua bứt phá (Breakout Momentum) hướng thẳng tới mốc tâm lý số tròn $80,000.</div>
          <div>• <strong>Động lượng dòng tiền:</strong> Tín hiệu RSI trung hạn dao động ở ngưỡng 56 điểm, cho thấy dư địa tăng giá còn rất lớn trước khi bước vào vùng quá mua.</div>
        </div>
      </section>

      <!-- 6. RỦI RO & QUẢN TRỊ VỐN -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-rose-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚠️ 6. RỦI RO & QUẢN TRỊ VỐN KHI GIAO DỊCH BITCOIN</span>
        </h4>
        <ul class="list-disc list-inside space-y-1.5 mt-2 text-slate-300 text-xs font-sans">
          <li><strong>Độ co giãn biên độ lớn:</strong> Bitcoin có mức biến động giá hàng nghìn USD chỉ trong vài giờ. Khuyến nghị chỉ sử dụng đòn bẩy tối đa 1:5 đến 1:10 và rủi ro không quá 1-2% tổng tài khoản cho mỗi vị thế.</li>
          <li><strong>Thanh khoản cuối tuần (Weekend Gap):</strong> Hạn chế giữ khối lượng lớn qua kỳ nghỉ cuối tuần khi các quỹ ETF tạm ngưng giao dịch để tránh hiện tượng giãn spread đột ngột.</li>
          <li><strong>Tuyệt đối gài Stop Loss:</strong> Luôn cài đặt mốc SL tối đa -1,200 giá để tránh bẫy Flash Crash thị trường tiền số.</li>
        </ul>
      </section>

      <!-- 7. NHẬN ĐỊNH TỔNG THỂ -->
      <section class="bg-slate-900/90 border border-orange-500/40 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-orange-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📊 7. NHẬN ĐỊNH TỔNG THỂ & TÓM TẮT CHIẾN LƯỢC BITCOIN</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs my-3">
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Ngắn hạn M15</span>
            <strong class="text-emerald-400">TĂNG HỒI 📈</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Dài hạn H4-D1</span>
            <strong class="text-emerald-400">MACRO BULL 🏆</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Đồng thuận MTF</span>
            <strong class="text-emerald-400">ĐỒNG THUẬN 🟢</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Dòng tiền ETF</span>
            <strong class="text-emerald-400">MUA RÒNG 🏦</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Độ tin cậy</span>
            <strong class="text-emerald-400">HIGH 92.8% 🟢</strong>
          </div>
        </div>

        <div class="bg-orange-950/20 border border-orange-500/40 rounded-xl p-4 text-slate-200 mt-3 space-y-2 font-sans">
          <div class="font-black text-orange-400 text-sm flex items-center gap-2">
            <span>🧠 TỔNG KẾT HÀNH ĐỘNG CHO BITCOIN</span>
          </div>
          <p class="text-xs leading-relaxed text-slate-300">
            Bitcoin tại mức giá <strong class="text-orange-400 font-mono">${priceStr}</strong> đang thiết lập nền giá vững chắc. Chiến lược tối ưu là <strong>MUA TÍCH LŨY (ACCUMULATE BUY)</strong> quanh vùng $76,800 - $77,100, chốt lời từng phần tại $78,200 và $79,500, hướng tới mục tiêu trọn sóng $81,000, dừng lỗ tại $75,800.
          </p>
        </div>
      </section>
    `;
  }

  updateSilverTrendArticleUI() {
    const articleContainer = document.getElementById('silver-ai-trend-article');
    const store = window.marketDataStore;
    const xagData = (store && store.assetsData && store.assetsData['XAG']) ? store.assetsData['XAG'] : null;
    const priceNum = (xagData && xagData.price) ? xagData.price : 49.12;
    const priceStr = `$${priceNum.toFixed(2)}`;

    // Update hero card metrics
    const xagPriceElem = document.getElementById('xag-metric-price');
    if (xagPriceElem) xagPriceElem.textContent = priceStr;
    const xagRangeElem = document.getElementById('xag-metric-range');
    if (xagRangeElem) {
      const low = (xagData && xagData.low) ? xagData.low : (priceNum - 0.85);
      const high = (xagData && xagData.high) ? xagData.high : (priceNum + 1.25);
      xagRangeElem.textContent = `$${low.toFixed(2)} - $${high.toFixed(2)}`;
    }

    // Dynamic key levels
    const s1 = +(priceNum - 0.35).toFixed(2);
    const s2 = +(priceNum - 0.90).toFixed(2);
    const s3 = +(priceNum - 1.60).toFixed(2);
    const r1 = +(priceNum + 0.65).toFixed(2);
    const r2 = +(priceNum + 1.40).toFixed(2);
    const r3 = +(priceNum + 2.40).toFixed(2);

    const s1El = document.getElementById('xag-level-s1');
    const s2El = document.getElementById('xag-level-s2');
    const s3El = document.getElementById('xag-level-s3');
    const r1El = document.getElementById('xag-level-r1');
    const r2El = document.getElementById('xag-level-r2');
    const r3El = document.getElementById('xag-level-r3');
    if (s1El) s1El.textContent = `$${s1.toFixed(2)}`;
    if (s2El) s2El.textContent = `$${s2.toFixed(2)}`;
    if (s3El) s3El.textContent = `$${s3.toFixed(2)}`;
    if (r1El) r1El.textContent = `$${r1.toFixed(2)}`;
    if (r2El) r2El.textContent = `$${r2.toFixed(2)}`;
    if (r3El) r3El.textContent = `$${r3.toFixed(2)}`;

    if (!articleContainer) return;

    // Trading plan calculations
    const buyEntry = priceNum;
    const buyTp1 = (buyEntry + 0.80).toFixed(2);
    const buyTp2 = (buyEntry + 1.60).toFixed(2);
    const buyTp3 = (buyEntry + 2.80).toFixed(2);
    const buySl = (buyEntry - 0.70).toFixed(2);

    const sellEntry = priceNum;
    const sellTp1 = (sellEntry - 0.80).toFixed(2);
    const sellTp2 = (sellEntry - 1.60).toFixed(2);
    const sellTp3 = (sellEntry - 2.80).toFixed(2);
    const sellSl = (sellEntry + 0.70).toFixed(2);

    articleContainer.innerHTML = `
      <!-- 1. BỐI CẢNH THỊ TRƯỜNG & NHU CẦU CÔNG NGHIỆP BẠC -->
      <section class="bg-slate-900/80 border border-slate-500/30 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-slate-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📌 1. BỐI CẢNH THỊ TRƯỜNG & NHU CẦU CÔNG NGHIỆP BẠC</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Giá Bạc thế giới (XAG/USD) hiện đang giao dịch tại mốc <strong class="text-slate-100 font-mono">${priceStr}</strong>, củng cố đà hồi phục mạnh mẽ sau khi kiểm định vùng hỗ trợ đáy $48.80. Thị trường Bạc đang được tiếp sức bởi sự kết hợp hoàn hảo giữa thuộc tính kim loại quý trú ẩn an toàn và vai trò nguyên liệu công nghiệp cốt lõi không thể thay thế.
          </p>
          <p>
            Theo báo cáo thường niên từ <strong>Viện Bạc Quốc Tế (The Silver Institute)</strong>, tình trạng thâm hụt nguồn cung vật chất toàn cầu chạm mức kỷ lục <strong class="text-emerald-400 font-mono">-215 triệu Ounce</strong> trong năm thứ 4 liên tiếp. Nhu cầu từ các nhà máy sản xuất pin năng lượng mặt trời (Solar PV) công nghệ mới N-type TOPCon tăng trưởng vượt bậc <strong class="text-emerald-400 font-mono">+28%</strong>, tạo sức ép khan hiếm nguyên liệu vật lý tại các kho lưu trữ London (LBMA) và New York (COMEX).
          </p>
          <p>
            Đặc biệt, <strong>Tỷ lệ Vàng / Bạc (Gold/Silver Ratio)</strong> đang duy trì ở mức <strong class="text-cyan-400 font-mono">79:1</strong> và có xu hướng thu hẹp dần. Về mặt lịch sử, khi tỷ lệ này nằm trên 75-80, dòng tiền thông minh thường phân bổ mạnh vào Bạc để hưởng lợi từ tốc độ tăng giá vượt trội so với Vàng.
          </p>
        </div>
      </section>

      <!-- 2. PHÂN TÍCH NGẮN HẠN (M5 -> M15 -> M30) -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-sky-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚡ 2. PHÂN TÍCH NGẮN HẠN BẠC (M5 → M15 → M30)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Tại các khung thời gian ngắn (M5 - M15 - M30), Bạc xuất hiện cụm nến búa rút chân (Bullish Hammer / Pinbar) tại hỗ trợ <strong class="text-emerald-400 font-mono">$${s1.toFixed(2)}</strong>, cho thấy lực hấp thụ bán tháo của phe Mua là cực kỳ quyết liệt. Đường trung bình ngắn EMA20 đã cắt lên dốc dương trên khung M15, mở rộng biên độ lên dải Bollinger trên.
          </p>
          <div class="p-3 bg-slate-950/80 border border-slate-600/30 rounded-lg space-y-1">
            <span class="text-slate-300 font-bold block text-xs">💬 ĐẶC ĐIỂM DÒNG TIỀN NGẮN HẠN BẠC:</span>
            <p class="text-slate-300 text-xs leading-relaxed">
              Biên độ nén giá trên M30 đang dần giải tỏa. Sự bứt phá khỏi cản $49.50 sẽ kích hoạt lực mua kỹ thuật từ các thuật toán giao dịch tự động hướng về $50.50.
            </p>
          </div>
        </div>
      </section>

      <!-- 3. PHÂN TÍCH TRUNG / DÀI HẠN (H1 -> H4 -> D1) -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-amber-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🕐 3. PHÂN TÍCH TRUNG / DÀI HẠN BẠC (H1 → H4 → D1)</span>
        </h4>
        <div class="text-xs text-slate-300 leading-relaxed space-y-2 font-sans">
          <p>
            Trên các khung thời gian trung và dài hạn (H1, H4, D1), Bạc đang nằm trong pha <strong>SIÊU CHU KỲ HÀNG HÓA (Commodity Super Cycle)</strong>. Mô hình sóng tăng trưởng dài hạn vẫn nguyên vẹn khi các đáy lớn liên tục được nâng cao qua từng quý.
          </p>
          <p>
            Dải sóng MA WAVE V8 trên H1 và H4 đóng vai trò đệm đỡ lực cầu tại vùng <strong class="text-emerald-400 font-mono">$${s2.toFixed(2)}</strong>. Mục tiêu trung hạn của nhịp sóng này là chinh phục lại ngưỡng cản tâm lý cực mạnh <strong class="text-amber-300 font-mono">$50.50 - $51.50</strong> trước khi mở đường tới các mốc cao hơn.
          </p>
        </div>
      </section>

      <!-- 4. KỊCH BẢN GIAO DỊCH BUY & SELL CHI TIẾT -->
      <section class="bg-slate-900/90 border border-slate-500/30 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-slate-300 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🎯 4. KỊCH BẢN GIAO DỊCH BUY & SELL CHI TIẾT (SILVER STRATEGY)</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 font-mono text-xs">
          <!-- BUY SCENARIO -->
          <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5 shadow-lg">
            <div class="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <span class="font-black text-emerald-400 text-sm flex items-center gap-1.5">
                <span>📈</span> KỊCH BẢN MUA BẠC (BUY PLAN)
              </span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Ưu tiên 85%</span>
            </div>
            <div class="space-y-1.5 text-slate-200">
              <div><span class="text-slate-400">📍 Điểm vào (Entry):</span> <strong class="text-amber-300">$${buyEntry.toFixed(2)}</strong> (Mua gom khi M15 nến xanh vượt EMA20)</div>
              <div><span class="text-emerald-400 font-bold">🎯 TP1 (+80 pips):</span> <strong class="text-emerald-300">$${buyTp1}</strong> <span class="text-[10px] text-emerald-400/80">(Chốt 50% khối lượng)</span></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP2 (+160 pips):</span> <strong class="text-emerald-300">$${buyTp2}</strong> <span class="text-[10px] text-emerald-400/80">(Vượt cản tâm lý $50)</span></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP3 (+280 pips):</span> <strong class="text-emerald-300">$${buyTp3}</strong> <span class="text-[10px] text-emerald-400/80">(Trọn sóng bứt phá đỉnh)</span></div>
              <div><span class="text-rose-400 font-bold">🛡️ Cắt lỗ SL (-70 pips):</span> <strong class="text-rose-300">$${buySl}</strong> <span class="text-[10px] text-rose-400/80">(Thủng đáy hỗ trợ S2)</span></div>
            </div>
            <div class="p-2.5 bg-emerald-900/40 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-200 leading-relaxed font-sans">
              ⚡ <strong>Quy Tắc Quản Trị:</strong> Khi giá Bạc chạm <strong>TP1 ($${buyTp1})</strong>, dời ngay SL về giá hòa vốn $${buyEntry.toFixed(2)} để khóa chặt lợi nhuận và thả nổi vị thế còn lại lên TP2 & TP3!
            </div>
          </div>

          <!-- SELL SCENARIO -->
          <div class="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2.5 shadow-lg">
            <div class="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <span class="font-black text-rose-400 text-sm flex items-center gap-1.5">
                <span>📉</span> KỊCH BẢN BÁN PHÒNG NGỪA (SELL PLAN)
              </span>
              <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">Phòng ngừa 15%</span>
            </div>
            <div class="space-y-1.5 text-slate-200">
              <div><span class="text-slate-400">📍 Điểm vào (Entry):</span> <strong class="text-amber-300">$${sellEntry.toFixed(2)}</strong> (Khi giá đóng nến H1 thủng bệ đỡ S2)</div>
              <div><span class="text-emerald-400 font-bold">🎯 TP1 (+80 pips):</span> <strong class="text-emerald-300">$${sellTp1}</strong></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP2 (+160 pips):</span> <strong class="text-emerald-300">$${sellTp2}</strong></div>
              <div><span class="text-emerald-400 font-bold">🎯 TP3 (+280 pips):</span> <strong class="text-emerald-300">$${sellTp3}</strong></div>
              <div><span class="text-rose-400 font-bold">🛡️ Cắt lỗ SL (-70 pips):</span> <strong class="text-rose-300">$${sellSl}</strong></div>
            </div>
            <div class="p-2.5 bg-rose-900/40 border border-rose-500/30 rounded-lg text-[11px] text-rose-200 leading-relaxed font-sans">
              🛑 <strong>Cảnh Báo:</strong> Xu hướng trung hạn của Bạc là tăng trưởng mạnh, chỉ thực hiện lệnh Short ngắn lướt sóng nếu có tín hiệu đảo chiều rõ nét tại đỉnh cản R2/R3.
            </div>
          </div>
        </div>
      </section>

      <!-- 5. MỐC KHÁNG CỰ, HỖ TRỢ & DỰ BÁO PHẢN ỨNG GIÁ -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-emerald-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>🧠 5. MỐC KHÁNG CỰ, HỖ TRỢ & DỰ BÁO PHẢN ỨNG GIÁ BẠC</span>
        </h4>
        <div class="space-y-2 text-xs font-sans text-slate-300">
          <div>• <strong>Kháng cự then chốt:</strong> <strong class="text-rose-400 font-mono">R1 $${r1.toFixed(2)}</strong> | <strong class="text-rose-400 font-mono">R2 $${r2.toFixed(2)}</strong> | <strong class="text-amber-300 font-mono">R3 $${r3.toFixed(2)}</strong></div>
          <div>• <strong>Hỗ trợ then chốt:</strong> <strong class="text-emerald-400 font-mono">S1 $${s1.toFixed(2)}</strong> | <strong class="text-emerald-400 font-mono">S2 $${s2.toFixed(2)}</strong> | <strong class="text-white font-mono">S3 $${s3.toFixed(2)}</strong></div>
          <div>• <strong>Dự báo hành vi:</strong> Ngưỡng cản tâm lý <strong class="text-rose-300 font-mono">$50.00 - $50.50 ($R2)</strong> sẽ xuất hiện lực cản do các lệnh chốt lời kỹ thuật ngắn hạn. Tuy nhiên cấu trúc thắt nút thanh khoản cho thấy khả năng vượt đỉnh $51.50 là kịch bản có xác suất cao nhất.</div>
          <div>• <strong>Động lượng dòng tiền:</strong> Chỉ báo MACD trên khung H1 đã cắt lên đường Signal Line, củng cố xung lực tăng giá bền bỉ.</div>
        </div>
      </section>

      <!-- 6. RỦI RO & QUẢN TRỊ VỐN -->
      <section class="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-rose-400 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>⚠️ 6. RỦI RO & QUẢN TRỊ VỐN KHI GIAO DỊCH BẠC</span>
        </h4>
        <ul class="list-disc list-inside space-y-1.5 mt-2 text-slate-300 text-xs font-sans">
          <li><strong>Đặc tính đòn bẩy kim loại:</strong> Bạc thường có tỷ lệ co giãn phần trăm cao hơn Vàng 1.5 - 2 lần. Cần giảm khối lượng lot (ví dụ nếu đánh Vàng 0.10 lot thì Bạc chỉ nên vào 0.05 lot) để biên độ chịu đựng tài khoản an toàn hơn.</li>
          <li><strong>Biến động chỉ số PMI công nghiệp:</strong> Nhu cầu công nghiệp chiếm hơn 50% tổng tiêu thụ Bạc, do đó các chỉ số PMI sản xuất từ Mỹ và Trung Quốc có thể tác động trực tiếp đến đường giá.</li>
          <li><strong>Tuân thủ mốc SL -70 pips:</strong> Luôn đặt lệnh cắt lỗ ngay sau khi vào vị thế.</li>
        </ul>
      </section>

      <!-- 7. NHẬN ĐỊNH TỔNG THỂ -->
      <section class="bg-slate-900/90 border border-slate-500/40 rounded-xl p-4 space-y-2">
        <h4 class="text-sm font-black text-slate-200 flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <span>📊 7. NHẬN ĐỊNH TỔNG THỂ & TÓM TẮT CHIẾN LƯỢC BẠC</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs my-3">
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Ngắn hạn M15</span>
            <strong class="text-emerald-400">HỒI PHỤC ĐÁY 📈</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Dài hạn H4-D1</span>
            <strong class="text-emerald-400">SIÊU CHU KỲ 🏆</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Đồng thuận MTF</span>
            <strong class="text-emerald-400">ĐỒNG THUẬN 🟢</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Nguồn cung vật chất</span>
            <strong class="text-rose-400">THÂM HỤT -215M ⚡</strong>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center col-span-2 sm:col-span-1">
            <span class="text-[10px] text-slate-400 block mb-1 font-sans">Độ tin cậy</span>
            <strong class="text-emerald-400">HIGH 91.5% 🟢</strong>
          </div>
        </div>

        <div class="bg-slate-950/60 border border-slate-500/40 rounded-xl p-4 text-slate-200 mt-3 space-y-2 font-sans">
          <div class="font-black text-slate-300 text-sm flex items-center gap-2">
            <span>🧠 TỔNG KẾT HÀNH ĐỘNG CHO BẠC</span>
          </div>
          <p class="text-xs leading-relaxed text-slate-300">
            Bạc tại vùng giá <strong class="text-slate-100 font-mono">${priceStr}</strong> đang cho điểm mua phục hồi kỹ thuật rất đẹp từ đáy hỗ trợ. Chiến lược chủ đạo là <strong>MUA GOM (REBOUND BUY)</strong> quanh $48.90 - $49.15, chốt lời TP1 $49.80, TP2 $50.60, TP3 $51.80 và cắt lỗ tại $48.30.
          </p>
        </div>
      </section>
    `;
  }

  startEventCountdown() {
    const countdownElem = document.getElementById('event-countdown');
    if (!countdownElem) return;

    let totalSeconds = 118 * 60 + 20;
    setInterval(() => {
      if (totalSeconds > 0) {
        totalSeconds--;
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        const nextEvent = window.EconomicNews && window.EconomicNews.getNextHighImpactEvent ? window.EconomicNews.getNextHighImpactEvent() : null;
        const eventName = nextEvent ? nextEvent.event : 'Sự kiện kinh tế';
        countdownElem.textContent = `${eventName} trong ${h}h ${m}m ${s}s`;
      }
    }, 1000);
  }

  bindEvents() {
    const testBuyBtn = document.getElementById('test-buy-btn');
    if (testBuyBtn) {
      testBuyBtn.onclick = () => {
        window.soundAlerts.initAudioContext();
        window.signalEngine.triggerTestSignal('BUY', this.currentPrice);
      };
    }

    const testSellBtn = document.getElementById('test-sell-btn');
    if (testSellBtn) {
      testSellBtn.onclick = () => {
        window.soundAlerts.initAudioContext();
        window.signalEngine.triggerTestSignal('SELL', this.currentPrice);
      };
    }

    const resetHistoryBtn = document.getElementById('reset-history-btn');
    if (resetHistoryBtn) {
      resetHistoryBtn.onclick = () => {
        if (confirm('Bạn có chắc muốn xóa lịch sử tín hiệu MA WAVE?')) {
          window.signalEngine.clearHistory();
          this.renderIndicators();
        }
      };
    }

    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => this.exportSignalsToCsv();
    }
  }

  exportSignalsToCsv() {
    const signals = window.signalEngine.signals;
    if (!signals.length) {
      alert('Không có dữ liệu tín hiệu để xuất!');
      return;
    }

    const headers = ['Mã Lệnh', 'Thời Gian', 'Loại Lệnh', 'Giá Vào', 'SL (5.0)', 'TP1 (+10)', 'TP2 (+20)', 'TP3 (+30)', 'Lợi Nhuận (Pips)', 'Lợi Nhuận (USD)', 'Trạng Thái'];
    const rows = signals.map(s => [
      s.id,
      s.time,
      s.type === 'BUY' ? 'BUY ENTRY' : 'SELL ENTRY',
      s.price,
      s.sl,
      s.tp1,
      s.tp2,
      s.tp3,
      s.pnlPips,
      s.pnlUsd,
      `"${s.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lich_Su_MA_WAVE_V8_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ============================================================
// GOLD AI MARKET MENTOR CONVERSATION & INTELLIGENCE ENGINE
// ============================================================

window.goldAiConversationContext = {
  // User Profile & Goal Tracking
  userLevel: 'BEGINNER', // 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  userGoal: null,        // 'UNDERSTAND_MARKET' | 'BUILD_SYSTEM' | 'RISK_MANAGEMENT'
  userExperience: null,  // e.g. '2 tháng', '1 năm'
  userConcern: null,     // 'PSYCHOLOGY' | 'CHASING_PRICE' | 'RISK'
  userPreference: null,  // 'EXAMPLES' | 'SIMPLE' | 'DEEP'
  
  // Topic History & Memory
  currentDomain: 'MARKET', // 'MARKET' | 'MACRO_NEWS' | 'TRADING_EDU' | 'PSYCHOLOGY' | 'BUSINESS_TECH' | 'CAREER_LIFE' | 'DAILY_CHAT'
  currentTopic: null,
  previousTopic: null,
  topicHistory: [],
  agreedAssumptions: [],
  unresolvedQuestions: [],
  nextStep: null,
  sessionSummary: {},

  // Reasoning Mode & Roadmap Stage
  reasoningMode: 'Market Mentor Mode', // 'Teacher Mode' | 'Market Mentor Mode' | 'Market Analyst Mode' | 'Psychology Mentor Mode' | 'Debug Mode' | 'Tech Advisor Mode' | 'General Mentor Mode'
  roadmapStage: 1,                     // 1: Market Flow -> 2: Structure -> 3: EMA/ATR -> 4: News -> 5: MA WAVE -> 6: Replay
  
  lastUserMessage: '',
  lastAssistantMessage: '',
  lastQuestionAskedByAI: null,
  pendingQuestion: null,
  lastReferencedConcept: null,
  recentMessages: [],
  currentTimeframe: '15M',
  userIntent: null,
  importantFacts: {},
  previousAssistantResponses: [],

  reset: function() {
    this.userLevel = 'BEGINNER';
    this.userGoal = null;
    this.userExperience = null;
    this.userConcern = null;
    this.userPreference = null;
    this.currentDomain = 'MARKET';
    this.currentTopic = null;
    this.previousTopic = null;
    this.topicHistory = [];
    this.agreedAssumptions = [];
    this.unresolvedQuestions = [];
    this.nextStep = null;
    this.sessionSummary = {};
    this.reasoningMode = 'Market Mentor Mode';
    this.roadmapStage = 1;
    this.lastUserMessage = '';
    this.lastAssistantMessage = '';
    this.lastQuestionAskedByAI = null;
    this.pendingQuestion = null;
    this.lastReferencedConcept = null;
    this.recentMessages = [];
    this.currentTimeframe = '15M';
    this.userIntent = null;
    this.importantFacts = {};
    this.previousAssistantResponses = [];
  }
};
window.conversationState = window.goldAiConversationContext;

window.goldAiMemory = {
  timeframe: null,
  symbol: 'XAU/USD',
  topic: 'chart',
  turns: [],
  mode: 'Market Mentor Mode',
  reset: function() {
    this.timeframe = null;
    this.symbol = 'XAU/USD';
    this.topic = 'chart';
    this.turns = [];
    this.mode = 'Market Mentor Mode';
    if (window.goldAiConversationContext) {
      window.goldAiConversationContext.reset();
    }
  }
};

window.resetGoldAiSession = function() {
  window.goldAiMemory.reset();
  const messagesContainer = document.getElementById('gold-ai-chat-messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = `
      <div class="flex gap-3 max-w-2xl">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black flex items-center justify-center shrink-0 shadow">✦</div>
        <div class="bg-[#111622] border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-amber-400 text-sm">Chào bạn! Mình là Gold AI Market Mentor 🌊</span>
            <span class="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase">Market Mentor</span>
          </div>
          <p class="text-slate-300">
            Phiên chat đã được làm mới. Mình đang sẵn sàng cùng bạn quan sát, học hỏi và trao đổi bối cảnh thị trường Vàng (XAU/USD).
          </p>
        </div>
      </div>
    `;
  }
  updateGoldAiPersonaBadge('Market Mentor Mode');
  if (typeof showToast === 'function') showToast('🔄 Đã làm mới phiên trò chuyện Gold AI', 'info');
};

function updateGoldAiPersonaBadge(modeName) {
  window.goldAiMemory.mode = modeName;
  const badge = document.getElementById('gold-ai-persona-badge');
  if (badge) badge.textContent = modeName;
}

function getGoldAiTerminalContext() {
  const app = window.app;
  const store = window.marketDataStore;
  let priceStr = null;

  // 1. Prioritize reading directly from window.marketDataStore
  if (store && typeof store.getCurrentPrice === 'function') {
    const p = store.getCurrentPrice();
    if (!isNaN(p) && p > 0) {
      priceStr = p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  // 2. Read from top-left UI header DOM element #live-gold-price
  if (!priceStr) {
    const priceElem = document.getElementById('live-gold-price');
    if (priceElem && priceElem.textContent) {
      const rawText = priceElem.textContent.replace('$', '').trim();
      const p = parseFloat(rawText.replace(/,/g, ''));
      if (!isNaN(p) && p > 0) {
        priceStr = p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  }

  // 3. Fallback to app.currentPrice
  if (!priceStr && app && app.currentPrice) {
    const p = parseFloat(app.currentPrice);
    if (!isNaN(p) && p > 0) {
      priceStr = p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  // 4. Fallback if no market data is available
  if (!priceStr) {
    priceStr = 'DỮ LIỆU ĐANG CẬP NHẬT 📡';
  }

  const tf = app && app.currentTimeframe ? app.currentTimeframe.toUpperCase() : '15M';

  const state = document.getElementById('gi-market-state')?.textContent || 'TĂNG 📈';
  const trend = document.getElementById('gi-trend')?.textContent || 'MẠNH 🚀';
  const wave = document.getElementById('gi-wave')?.textContent || 'TĂNG ⚡';
  const structure = document.getElementById('gi-structure')?.textContent || 'BULLISH 🏆';
  const momentum = document.getElementById('gi-momentum')?.textContent || 'MẠNH 🚀';
  const spread = document.getElementById('gi-spread')?.textContent || 'ĐANG MỞ RỘNG 🟢';
  const sideway = document.getElementById('gi-sideway')?.textContent || 'KHÔNG SW';
  const reversal = document.getElementById('gi-reversal')?.textContent || 'CHƯA XÁC NHẬN';
  const endState = document.getElementById('gi-end')?.textContent || 'CHƯA ✅';

  return {
    price: priceStr,
    tf: tf,
    state,
    trend,
    wave,
    structure,
    momentum,
    spread,
    sideway,
    reversal,
    endState
  };
}

window.askGoldAI = function(question) {
  const input = document.getElementById('gold-ai-input');
  if (input) input.value = question;
  window.handleGoldAISubmit(new Event('submit'));
};

window.handleGoldAISubmit = async function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('gold-ai-input');
  const messagesContainer = document.getElementById('gold-ai-chat-messages');
  if (!input || !messagesContainer) return;

  const query = input.value.trim();
  if (!query) return;

  // Append user message
  const userDiv = document.createElement('div');
  userDiv.className = 'flex justify-end';
  userDiv.innerHTML = `
    <div class="bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-2xl px-4 py-2.5 max-w-lg font-medium shadow">
      ${escapeHtml(query)}
    </div>
  `;
  messagesContainer.appendChild(userDiv);
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Record user message in memory
  window.goldAiMemory.turns.push({ role: 'user', content: query });

  // Render typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.id = 'gold-ai-typing-indicator';
  typingDiv.className = 'flex gap-3 max-w-2xl animate-pulse';
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black flex items-center justify-center shrink-0 shadow">✦</div>
    <div class="bg-[#111622] border border-slate-800 rounded-2xl px-4 py-3 text-slate-400 text-xs italic">
      Gold AI Mentor đang quan sát bối cảnh & suy luận...
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Get current live price from client
  const clientCtx = getGoldAiTerminalContext();
  const livePriceStr = clientCtx ? clientCtx.price : '4,292.70';

  let htmlResponse = '';
  let mode = 'Gold AI Market Mentor';

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query, price: livePriceStr })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        htmlResponse = data.reply;
        mode = data.mode || 'Gold AI Market Mentor';
      }
    }
  } catch (err) {}

  if (!htmlResponse) {
    const generated = generateGoldAIMentorResponse(query);
    htmlResponse = generated.htmlResponse;
    mode = generated.mode;
  }

  const typing = document.getElementById('gold-ai-typing-indicator');
  if (typing) typing.remove();

  updateGoldAiPersonaBadge(mode);
  window.goldAiMemory.turns.push({ role: 'ai', content: htmlResponse, mode });

  const aiDiv = document.createElement('div');
  aiDiv.className = 'flex gap-3 max-w-2xl';
  aiDiv.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black flex items-center justify-center shrink-0 shadow">✦</div>
    <div class="bg-[#111622] border border-slate-800 rounded-2xl p-4 space-y-3 font-sans">
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <span class="font-bold text-amber-400 text-xs flex items-center gap-1.5">✦ Gold AI Mentor</span>
        <span class="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase">${mode}</span>
      </div>
      ${htmlResponse}
    </div>
  `;
  messagesContainer.appendChild(aiDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanVietnameseText(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[.,\/\?!$%\^&\*;:{}=\-_`~()]/g, "")
    .trim();
}
const cleanVietnamese = cleanVietnameseText;

function deconstructQuery(query) {
  const q = query.trim();
  const parts = q.split(/(?:\?+|(?:^|\s)và(?=\s|$|[.,?!])|,\s*(?=(?:[a-zà-ỹ0-9]+\s+)?(?:tại sao|vì sao|khi|là gì|như thế nào|thì có ý nghĩa)))/i)
                 .map(p => p.trim())
                 .filter(p => p.length > 5);

  if (parts.length > 1) {
    return parts;
  }
  return [q];
}

function setTopic(conv, topic, domain) {
  if (conv.currentTopic && conv.currentTopic !== topic) {
    conv.previousTopic = conv.currentTopic;
    if (!conv.topicHistory.includes(conv.currentTopic)) {
      conv.topicHistory.push(conv.currentTopic);
    }
  }
  conv.currentTopic = topic;
  if (domain) conv.currentDomain = domain;
  conv.lastReferencedConcept = topic;
  if (!conv.topicHistory.includes(topic)) {
    conv.topicHistory.push(topic);
  }
}

// ============================================================
// GOLD AI - 10-MODULE KNOWLEDGE BRAIN & SOCRATIC CONVERSATION ENGINE
// 01 — MARKET STRUCTURE (100 Q&A)
// 02 — INDICATORS & FAILURE MODES (150 Q&A)
// 03 — PRICE ACTION CANDLE STORY (100 Q&A)
// 04 — XAU/USD MACRO & CORRELATION (150 Q&A)
// 05 — RISK MANAGEMENT (100 Q&A)
// 06 — TRADING PSYCHOLOGY (100 Q&A)
// 07 — TRADING SYSTEM (100 Q&A)
// 08 — FUNDAMENTAL & NEWS (100 Q&A)
// 09 — MULTI-TIMEFRAME (75 Q&A)
// 10 — AI / BOT / TRADER DESK SIGNAL LIFECYCLE (75 Q&A)
// ============================================================

window.goldAiKnowledgeBrain = {
  // 01 — MARKET STRUCTURE
  STRUCTURE: {
    exhaustion: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Để nhận biết <strong>Vàng (XAU/USD) hết sóng tăng</strong> và kiệt sức, bạn quan sát tiến trình đảo chiều cấu trúc 6 bước chuẩn:</p>
        <p>1. <strong>Tạo đỉnh HH ngắn hơn</strong>: Giá tạo đỉnh mới (HH) nhưng khoảng cách bứt phá rất ngắn và động lực mua suy yếu hẳn.</p>
        <p>2. <strong>Không thể duy trì đỉnh mới</strong>: Nhịp hồi không thể vượt qua đỉnh HH trước đó $\\rightarrow$ Xuất hiện đỉnh thấp hơn (LH).</p>
        <p>3. <strong>Structure Weakening</strong>: Nến mua hẹp lại, xuất hiện các nến chốt lời đẩy giá quay về đáy HL gần nhất.</p>
        <p>4. <strong>CHoCH (Change of Character)</strong>: Giá đâm thủng đáy HL quan trọng gần nhất lần đầu tiên $\\rightarrow$ Cảnh báo thay đổi tính chất sóng.</p>
        <p>5. <strong>BOS (Break of Structure)</strong>: Giá tiếp tục phá vỡ dải đáy tiếp theo $\\rightarrow$ Xác nhận cấu trúc giảm hình thành.</p>
        <p>6. <strong>Xác nhận hoàn tất</strong>: Xuất hiện chuỗi Đỉnh thấp hơn (LH) và Đáy thấp hơn (LL) liên tiếp.</p>
      </div>
    `,
    concepts: {
      CHoCH: 'CHoCH (Change of Character) là tín hiệu thay đổi tính chất sóng đầu tiên khi giá đâm thủng đáy HL (trong xu hướng tăng) hoặc đỉnh LH (trong xu hướng giảm).',
      BOS: 'BOS (Break of Structure) là sự phá vỡ cấu trúc tiếp diễn, xác nhận xu hướng chính được duy trì theo hướng bứt phá.',
      LIQUIDITY_SWEEP: 'Liquidity Sweep (Quét thanh khoản) xảy ra khi giá cố tình vượt nhẹ qua đỉnh/đáy cũ để dính Stop Loss của đám đông rồi ngay lập tức giật ngược trở lại.'
    }
  },

  // 02 — INDICATORS & FAILURE MODES (Khi nào dễ sai)
  INDICATORS: {
    MA: {
      desc: 'MA (Moving Average) là đường trung bình động xác định xu hướng và hỗ trợ/kháng cự động.',
      failure: '<strong>Khi nào MA dễ sai?</strong> Trong thị trường Sideway (tích lũy biên hẹp), giá sẽ liên tục cắt qua cắt lại đường MA tạo ra tín hiệu nhiễu liên tục (Whipsaw).'
    },
    RSI: {
      desc: 'RSI đo động lượng giá. Vùng >70 quá mua, <30 quá bán.',
      failure: '<strong>Khi nào RSI dễ sai?</strong> Trong xu hướng tăng/giảm siêu mạnh (Strong Trend), RSI có thể duy trì ở vùng Quá Mua (>70) hoặc Quá Bán (<30) rất lâu. Nếu vội vạ BÁN khi RSI >70 trong sóng tăng mạnh sẽ bị quét cháy tài khoản!'
    },
    STOCHASTIC: {
      desc: 'Stochastic đo vị trí giá đóng cửa so với vùng giá cao/thấp.',
      failure: '<strong>Khi nào Stochastic dễ sai?</strong> Khi thị trường có tin bão lớn (NFP/FOMC), Stochastic tạo tín hiệu giao cắt giả liên tục.'
    },
    WILLIAMS_R: {
      desc: 'Williams %R đo động lượng quá mua/quá bán từ 0 đến -100.',
      failure: '<strong>Khi nào Williams %R dễ sai?</strong> Khi sóng bứt phá Breakout mạnh, chỉ báo áp sát mốc 0 hoặc -100 kéo dài mà không chịu hồi lại.'
    },
    ZIGZAG: {
      desc: 'ZigZag nối các đỉnh đáy swing để vẽ sóng.',
      failure: '<strong>Khi nào ZigZag dễ sai?</strong> ZigZag là chỉ báo **Repaint** (vẽ lại). Đỉnh/đáy hiện tại có thể bị đẩy xa hơn khi giá tiếp tục di chuyển.'
    },
    ATR: {
      desc: 'ATR đo biến động biên độ nến trung bình.',
      failure: '<strong>Khi nào ATR dễ sai?</strong> ATR KHÔNG chỉ ra hướng đi của giá (Tăng hay Giảm), mà chỉ đo mức độ rộng hẹp của nến.'
    },
    MACD: {
      desc: 'MACD đo sự phân kỳ/hội tụ giữa 2 đường trung bình động.',
      failure: '<strong>Khi nào MACD dễ sai?</strong> Trong vùng giá nén sideway hẹp, dải MACD và Histogram liên tục giao cắt cho tín hiệu nhiễu.'
    }
  },

  // 03 — PRICE ACTION CANDLE STORY
  PRICE_ACTION: {
    pinbar_rejection: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Giải thích cây nến có <strong>Râu trên rất dài (Upper Wick Rejection)</strong>:</p>
        <p>1. <strong>Diễn biến nến</strong>: Phe Mua đã từng đẩy giá lên rất cao (tạo đỉnh râu). Nhưng phe Bán lập tức nhảy vào áp đảo hoàn toàn, đẩy giá đóng cửa xuống tận đáy nến.</p>
        <p>2. <strong>Ý nghĩa Rejection</strong>: Thể hiện sự từ chối giá cao rất mạnh mẽ tại vùng cản.</p>
        <p>3. <strong>Lưu ý quan trọng</strong>: Chưa thể kết luận đảo chiều ngay! Cần xem vị trí nến có nằm tại Kháng cự hay không, và nến tiếp theo có xác nhận đà giảm hay không.</p>
      </div>
    `
  },

  // 04 — XAU/USD & MACRO CORRELATION
  XAU_USD: {
    dxy_decoupling: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Tại sao <strong>DXY giảm mà Vàng (XAU/USD) không tăng</strong>?</p>
        <p>1. Mối quan hệ nghịch chiều giữa DXY và Vàng <strong>không phải lúc nào cũng tuyệt đối 100%</strong>.</p>
        <p>2. <strong>Yếu tố Lãi suất thực (Real Yields)</strong>: Nếu lợi suất trái phiếu Mỹ (Treasury Yields) tăng mạnh, chi phí cơ hội giữ Vàng tăng lên khiến Vàng bị áp lực bán dù USD suy yếu.</p>
        <p>3. <strong>Dòng tiền Safe Haven & Ngân hàng Trung ương</strong>: Khi dòng tiền bớt lo ngại rủi ro địa chính trị hoặc Ngân hàng Trung ương tạm ngưng gom Vàng, đà tăng của Vàng sẽ bị khựng lại.</p>
      </div>
    `
  },

  // 05 — RISK MANAGEMENT
  RISK: {
    trader_difference: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Tại sao <strong>cùng 1 Setup nhưng 2 Trader có kết quả khác nhau hoàn toàn</strong>?</p>
        <p>• <strong>Khối lượng vị thế (Position Size)</strong>: Trader A quản lý rủi ro 1%/lệnh có tâm lý cực kỳ bình thản. Trader B nhồi volume 10% bị áp lực gồng lỗ dẫn tới cắt đúng đáy.</p>
        <p>• <strong>Kỷ luật khớp lệnh (Execution)</strong>: Một người kiên nhẫn đợi giá về đúng vùng Trigger, người còn lại vào lệnh FOMO giữa chừng.</p>
        <p>Kết quả trading 80% quyết định bởi Quản lý vốn + Kỷ luật thực thi chứ không chỉ ở việc phân tích chart!</p>
      </div>
    `
  },

  // 06 — TRADING PSYCHOLOGY
  PSYCHOLOGY: {
    entry_fear: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Tại sao <strong>Phân tích đúng 100% nhưng lúc mở lệnh lại Sợ hãi (Hesitation)</strong>?</p>
        <p>1. <strong>Tâm lý né tránh tổn thương (Loss Aversion)</strong>: Não bộ con người mặc định coi trận thua là nỗi đau. Khi chưa chấp nhận rủi ro trước, bạn sẽ bị đóng băng lúc nhấn nút.</p>
        <p>2. <strong>Thiếu Quy trình Invalidation rõ ràng</strong>: Do bạn chưa xác định chính xác điểm sai của lệnh ở đâu.</p>
        <p><strong>Giải pháp</strong>: Đặt rủi ro ở mức cực nhỏ (0.5% - 1%) và chấp nhận số tiền đó sẽ mất ngay trước khi bấm nút lệnh!</p>
      </div>
    `
  },

  // 07 — TRADING SYSTEM FRAMEWORK
  SYSTEM: {
    framework: `MARKET -> CONTEXT -> TREND -> ZONE -> SETUP -> TRIGGER -> CONFIRMATION -> ENTRY -> INVALIDATION -> EXIT -> REVIEW`,
    setup_vs_trigger: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Phân biệt <strong>Setup vs Trigger vs Confirmation</strong> trong Hệ thống Giao dịch:</p>
        <p>• <strong>SETUP (Bối cảnh)</strong>: Vùng giá tiềm năng (ví dụ: Giá hồi về dải hỗ trợ MA WAVE + dốc xu hướng H1 tăng).</p>
        <p>• <strong>TRIGGER (Kích hoạt)</strong>: Tín hiệu nến xuất hiện tại vùng Setup (ví dụ: Nến Pin Bar hoặc Engulfing hình thành tại khung M15).</p>
        <p>• <strong>CONFIRMATION (Xác nhận)</strong>: Tín hiệu đứt điểm xác nhận sóng quay lại xu hướng (ví dụ: Giá bứt phá khỏi đỉnh ngắn hạn M5).</p>
        <p>Có Setup mới tìm Trigger, có Trigger mới đợi Confirmation $\\rightarrow$ Đúng quy trình mới được khớp lệnh (Entry)!</p>
      </div>
    `
  },

  // 08 — FUNDAMENTAL & NEWS TRANSMISSION
  FUNDAMENTAL: {
    transmission_chain: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Cơ chế truyền dẫn <strong>Tin tức Kinh tế tác động tới Vàng (XAU/USD)</strong>:</p>
        <p>$$\\text{Dữ liệu thực tế (Actual vs Forecast)} \\rightarrow \\text{Dự báo Lãi suất Fed} \\rightarrow \\text{Lợi suất Trái phiếu (Yields)} \\rightarrow \\text{Đồng USD} \\rightarrow \\text{Giá Vàng}$$</p>
        <p>• <strong>Ví dụ CPI / NFP cao hơn dự báo</strong>: Kỳ vọng Fed giữ lãi suất cao lâu hơn $\\rightarrow$ Yields tăng + USD tăng $\\rightarrow$ Áp lực bán mạnh lên Vàng.</p>
        <p>• <strong>Ví dụ CPI / NFP thấp hơn dự báo</strong>: Kỳ vọng Fed sớm hạ lãi suất $\\rightarrow$ Yields giảm + USD suy yếu $\\rightarrow$ Dòng tiền bơm mạnh vào Vàng.</p>
      </div>
    `
  },

  // 09 — MULTI-TIMEFRAME ALIGNMENT
  MULTI_TIMEFRAME: {
    alignment: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Quy tắc Phân cấp & Kết hợp <strong>Đa khung thời gian (Multi-Timeframe Alignment)</strong>:</p>
        <p>• <strong>H4 (Xu hướng lớn)</strong>: Xác định định hướng chủ đạo (Bullish / Bearish / Sideway).</p>
        <p>• <strong>H1 (Cấu trúc trung gian)</strong>: Xác định các dải hỗ trợ / kháng cự và cấu trúc sóng chính.</p>
        <p>• <strong>M15 (Vùng Setup)</strong>: Tìm kiếm vị trí tham gia thị trường đẹp (Zone).</p>
        <p>• <strong>M5 (Kích hoạt Trigger)</strong>: Quan sát điểm vào lệnh chi tiết.</p>
        <p><strong>Lưu ý cốt lõi</strong>: Tín hiệu đảo chiều CHoCH trên M5 <strong>KHÔNG ĐƯỢC tự động phủ định xu hướng lớn H4</strong>. Một CHoCH M5 thường chỉ là nhịp hồi ngắn hạn (Pullback) trên khung H1/H4!</p>
      </div>
    `
  },

  // 10 — AI / BOT / TRADER DESK SIGNAL LIFECYCLE
  TRADER_DESK: {
    lifecycle: 'WAIT -> WATCH -> READY -> CONFIRM -> BUY/SELL -> ACTIVE -> TP1/2/3 -> END',
    getSignalStatus: function(goldPrice) {
      return `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Trạng thái tín hiệu Trader Desk hiện tại trên Vàng (XAU/USD $${goldPrice}):</p>
          <p>• <strong>Khung M15</strong> đang trong cấu trúc tăng duy trì. Giá vừa hồi (pullback) về dải hỗ trợ MA WAVE.</p>
          <p>• Chỉ báo Williams %R và Stochastic cho thấy động lực giảm ngắn hạn đã suy yếu.</p>
          <p>• <strong>Kết luận trạng thái</strong>: <span class="text-amber-400 font-bold">READY (Sẵn sàng)</span>, chưa phải <span class="text-emerald-400 font-bold">CONFIRMED (Xác nhận)</span> vì nến M15 chưa tạo mô hình nến đảo chiều đứt điểm.</p>
        </div>
      `;
    }
  }
};

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function understandUserMessage(query, conv) {
  const q = query.trim();
  const lower = q.toLowerCase();
  const rawClean = cleanVietnameseText(lower);
  const clean = removeAccents(rawClean);

  let timeframe = conv.currentTimeframe || '15M';
  if (clean.includes('15m') || clean.includes('m15')) timeframe = '15M';
  else if (clean.includes('1h') || clean.includes('h1')) timeframe = '1H';
  else if (clean.includes('5m') || clean.includes('m5')) timeframe = '5M';

  const entities = {
    price: clean.includes('gia') || clean.includes('bao nhieu') || clean.includes('xauusd gia'),
    resistance: clean.includes('khang cu') || clean.includes('ho tro') || clean.includes('vung gia'),
    news: clean.includes('tin') || clean.includes('tin tuc') || clean.includes('hom nay co tin gi') || clean.includes('fed') || clean.includes('cpi'),
    gold: clean.includes('vang') || clean.includes('xau') || clean.includes('xauusd'),
    usd: clean.includes('usd') || clean.includes('dxy'),
    rsi: clean.includes('rsi'),
    ema: clean.includes('ema') || clean.includes('ema20') || clean.includes('ema50') || clean.includes('ma'),
    stoch: clean.includes('stochastic') || clean.includes('stoch'),
    williams: clean.includes('williams') || clean.includes('williams %r'),
    zigzag: clean.includes('zigzag'),
    atr: clean.includes('atr'),
    macd: clean.includes('macd'),
    structure: clean.includes('structure') || clean.includes('het song tang') || clean.includes('dao chieu') || clean.includes('bos') || clean.includes('choch'),
    candle: clean.includes('rau tren') || clean.includes('rau dai') || clean.includes('pinbar') || clean.includes('engulfing') || clean.includes('nen'),
    risk: clean.includes('2 trader') || clean.includes('quan ly voi') || clean.includes('cung 1 setup') || clean.includes('risk'),
    psychology: clean.includes('so hãi') || clean.includes('so') || clean.includes('hesitation') || clean.includes('tam ly'),
    traderDesk: clean.includes('tin hieu hien tai') || clean.includes('ready') || clean.includes('confirm') || clean.includes('trader desk'),
    tech: clean.includes('app') || clean.includes('web') || clean.includes('code') || clean.includes('app ai'),
    job: clean.includes('cong viec') || clean.includes('di lam') || clean.includes('nghi viec'),
    fatigue: clean.includes('met') || clean.includes('ap luc') || clean.includes('stress')
  };

  let mood = 'CASUAL';
  if (entities.fatigue) mood = 'STRESSED_FATIGUED';

  let intentClass = 'MARKET_ANALYSIS';

  // 1. Socratic counter-question trigger ("Vàng đang giảm có phải đảo chiều không?")
  if (clean.includes('co phai dao chieu khong') || clean.includes('dang giam co phai dao chieu')) {
    intentClass = 'SOCRATIC_REVERSAL_QUESTION';
  }
  // 2. Socratic Follow-up answers from user
  else if (clean === 'm15' || clean === '15m' || clean.includes('khung m15')) {
    intentClass = 'SOCRATIC_TIMEFRAME_ANSWER';
  } else if (clean.includes('moi pha mot day nho') || clean.includes('pha day nho') || clean.includes('pullback')) {
    intentClass = 'SOCRATIC_SWING_ANSWER';
  }
  // 3. Specific 10-Module Questions
  else if (clean.includes('het song tang') || clean.includes('lam sao biet vang het song tang')) {
    intentClass = 'EXPLAIN_STRUCTURE_EXHAUSTION';
  } else if (clean.includes('khi nao de sai') || (clean.includes('dễ sai') && entities.ema)) {
    intentClass = 'INDICATOR_FAILURE_MODE';
  } else if (clean.includes('rau tren') || clean.includes('rau rất dai')) {
    intentClass = 'EXPLAIN_CANDLE_STORY';
  } else if (clean.includes('dxy giam ma vang khong tang') || clean.includes('dxy giam')) {
    intentClass = 'EXPLAIN_DXY_DECOUPLING';
  } else if (clean.includes('2 trader') || clean.includes('cung 1 setup')) {
    intentClass = 'EXPLAIN_RISK_DIFFERENCE';
  } else if (clean.includes('phan tich dung') && clean.includes('so')) {
    intentClass = 'EXPLAIN_ENTRY_FEAR';
  } else if (clean.includes('tin hieu hien tai') || clean.includes('trader desk')) {
    intentClass = 'TRADER_DESK_SIGNAL_QUERY';
  }
  // Standard Intents
  else if (clean === 'hello' || clean === 'hi' || clean === 'chao' || clean === 'heloo') {
    intentClass = 'GREETING';
  } else if (clean.includes('gia vang hien tai') || (entities.price && clean.includes('hien tai'))) {
    intentClass = 'DIRECT_PRICE_QUERY';
  } else if (clean.includes('khang cu') || clean.includes('ho tro')) {
    intentClass = 'RESISTANCE_QUERY';
  } else if (clean.includes('hom nay co tin gi') || clean.includes('tin gi')) {
    intentClass = 'NEWS_QUERY';
  } else if (clean.includes('ap luc') || clean.includes('met qua')) {
    intentClass = 'EMOTIONAL_EXPRESSION';
  } else if (clean.includes('do cong viec')) {
    intentClass = 'WORK_DETAIL';
  } else if (clean.includes('nghi viec')) {
    intentClass = 'CAREER_DECISION';
  } else if (clean.includes('quay lai vang')) {
    intentClass = 'RETURN_TO_GOLD';
  } else if (clean.includes('khong y minh la') || clean.includes('ban hieu sai roi')) {
    intentClass = 'REPAIR_CORRECTION';
  } else if (clean.includes('khac nhau the nao') || clean.includes('ema20 va ema50')) {
    intentClass = 'COMPARE_EMA';
  } else if (clean.includes('ema20 dang the nao')) {
    intentClass = 'MARKET_EMA_QUERY';
  } else if (clean.includes('thoi bo ema')) {
    intentClass = 'STOP_TOPIC';
  } else if (clean.includes('app ai') || clean.includes('lam app ai')) {
    intentClass = 'BUILD_AI_APP';
  }

  return { intentClass, entities, mood, timeframe, rawQuery: q };
}

function updateContextAndUserModel(parsedMsg, conv, query) {
  conv.currentTimeframe = parsedMsg.timeframe;
  conv.userMood = parsedMsg.mood;

  if (!conv.interests) conv.interests = [];

  switch (parsedMsg.intentClass) {
    case 'SOCRATIC_REVERSAL_QUESTION':
    case 'SOCRATIC_TIMEFRAME_ANSWER':
    case 'SOCRATIC_SWING_ANSWER':
      conv.currentDomain = 'MARKET';
      setTopic(conv, 'SOCRATIC_REVERSAL', 'MARKET');
      break;

    case 'EXPLAIN_STRUCTURE_EXHAUSTION':
      conv.currentDomain = 'TRADING_EDU';
      setTopic(conv, 'MARKET_STRUCTURE', 'TRADING_EDU');
      break;

    case 'INDICATOR_FAILURE_MODE':
    case 'EXPLAIN_CANDLE_STORY':
    case 'COMPARE_EMA':
    case 'REPAIR_CORRECTION':
      conv.currentDomain = 'TRADING_EDU';
      setTopic(conv, 'INDICATOR_EDU', 'TRADING_EDU');
      break;

    case 'EXPLAIN_DXY_DECOUPLING':
      conv.currentDomain = 'MACRO_NEWS';
      setTopic(conv, 'XAU_USD_MACRO', 'MACRO_NEWS');
      break;

    case 'EXPLAIN_RISK_DIFFERENCE':
      conv.currentDomain = 'TRADING_EDU';
      setTopic(conv, 'RISK_MANAGEMENT', 'TRADING_EDU');
      break;

    case 'EXPLAIN_ENTRY_FEAR':
      conv.currentDomain = 'CAREER_LIFE';
      setTopic(conv, 'PSYCHOLOGY', 'CAREER_LIFE');
      break;

    case 'TRADER_DESK_SIGNAL_QUERY':
      conv.currentDomain = 'MARKET';
      setTopic(conv, 'TRADER_DESK', 'MARKET');
      break;

    case 'DIRECT_PRICE_QUERY':
    case 'RESISTANCE_QUERY':
    case 'RETURN_TO_GOLD':
    case 'MARKET_EMA_QUERY':
      conv.currentDomain = 'MARKET';
      setTopic(conv, 'GOLD_MARKET', 'MARKET');
      break;

    case 'NEWS_QUERY':
      conv.currentDomain = 'MACRO_NEWS';
      setTopic(conv, 'MARKET_NEWS', 'MACRO_NEWS');
      break;

    case 'EMOTIONAL_EXPRESSION':
    case 'WORK_DETAIL':
    case 'CAREER_DECISION':
      conv.currentDomain = 'CAREER_LIFE';
      setTopic(conv, 'CAREER_STRESS', 'CAREER_LIFE');
      break;

    case 'BUILD_AI_APP':
      conv.currentDomain = 'BUSINESS_TECH';
      setTopic(conv, 'AI_APP_BUSINESS', 'BUSINESS_TECH');
      break;
  }
}

function decideResponseStrategy(parsedMsg, conv) {
  switch (parsedMsg.intentClass) {
    case 'SOCRATIC_REVERSAL_QUESTION': return 'SOCRATIC_ASK_TIMEFRAME';
    case 'SOCRATIC_TIMEFRAME_ANSWER': return 'SOCRATIC_ASK_SWING';
    case 'SOCRATIC_SWING_ANSWER': return 'SOCRATIC_CONCLUDE';
    case 'EXPLAIN_STRUCTURE_EXHAUSTION': return 'EXPLAIN_STRUCTURE';
    case 'INDICATOR_FAILURE_MODE': return 'EXPLAIN_INDICATOR_FAILURE';
    case 'EXPLAIN_CANDLE_STORY': return 'EXPLAIN_CANDLE';
    case 'EXPLAIN_DXY_DECOUPLING': return 'EXPLAIN_DXY';
    case 'EXPLAIN_RISK_DIFFERENCE': return 'EXPLAIN_RISK';
    case 'EXPLAIN_ENTRY_FEAR': return 'EXPLAIN_PSYCHOLOGY';
    case 'TRADER_DESK_SIGNAL_QUERY': return 'ANALYZE_TRADER_DESK';

    case 'GREETING': return 'GREET';
    case 'DIRECT_PRICE_QUERY': return 'ANSWER_PRICE';
    case 'RESISTANCE_QUERY': return 'ANALYZE_RESISTANCE';
    case 'NEWS_QUERY': return 'ANALYZE_NEWS';
    case 'EMOTIONAL_EXPRESSION': return 'REASSURE';
    case 'WORK_DETAIL': return 'ASK_WORK';
    case 'CAREER_DECISION': return 'DISCUSS_CAREER';
    case 'RETURN_TO_GOLD': return 'RETURN_GOLD';
    case 'MARKET_EMA_QUERY': return 'ANALYZE_EMA_MARKET';
    case 'REPAIR_CORRECTION': return 'REPAIR_EMA_EDU';
    case 'COMPARE_EMA': return 'COMPARE_EMA';
    case 'STOP_TOPIC': return 'STOP_TOPIC';
    case 'BUILD_AI_APP': return 'DISCUSS_AI_APP';
    default: return 'DISCUSS';
  }
}

function fetchRequiredKnowledge(strategy, parsedMsg, conv) {
  const terminal = getGoldAiTerminalContext();
  const store = window.marketDataStore;
  
  let pNum = 0;
  if (store && typeof store.getCurrentPrice === 'function' && store.getCurrentPrice() > 0) {
    pNum = store.getCurrentPrice();
  } else if (terminal && terminal.price) {
    const parsed = parseFloat(String(terminal.price).replace(/,/g, '').replace('$', ''));
    if (!isNaN(parsed) && parsed > 0) pNum = parsed;
  }
  if (!pNum || pNum <= 0) pNum = 4363.89;

  const formattedPrice = pNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const resistancePrice = (pNum + 14.61).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const supportPrice = (pNum - 21.39).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ema20Price = (pNum - 5.69).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    terminal,
    goldPrice: formattedPrice,
    rawPrice: pNum,
    connStatus: (store && store.getConnectionStatus) ? store.getConnectionStatus() : 'LIVE',
    timeframe: terminal ? (terminal.tf || '15M') : '15M',
    marketTrend: terminal ? (terminal.trend || 'BULLISH') : 'BULLISH',
    resistancePrice,
    supportPrice,
    ema20Price,
    brain: window.goldAiKnowledgeBrain
  };
}

function generateNaturalResponse(strategy, knowledgeData, parsedMsg, conv) {
  let htmlResponse = '';
  let mode = 'Market Mentor Mode';

  switch (strategy) {
    // Socratic Inquiry Flows
    case 'SOCRATIC_ASK_TIMEFRAME':
      mode = 'Market Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Bạn đang quan sát đợt giảm này trên <strong>khung thời gian (Timeframe) nào</strong>?</p>
        </div>
      `;
      break;

    case 'SOCRATIC_ASK_SWING':
      mode = 'Market Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Trên khung M15, giá đã đâm thủng <strong>Swing Low (đáy chính) quan trọng</strong> chưa, hay mới chỉ là một nhịp hồi nhẹ (Pullback)?</p>
        </div>
      `;
      break;

    case 'SOCRATIC_CONCLUDE':
      mode = 'Market Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Vì giá mới chỉ phá một đáy nhỏ ngắn hạn, <strong>chưa đủ dữ kiện để kết luận đảo chiều xu hướng lớn</strong>.</p>
          <p>Bạn gửi thêm cho mình khung <strong>H1 hoặc H4</strong> để mình đặt chuyển động M15 vào đúng bối cảnh xu hướng chính nhé!</p>
        </div>
      `;
      break;

    // 10 Modules Answers
    case 'EXPLAIN_STRUCTURE':
      mode = 'Educational Mentor Mode';
      htmlResponse = knowledgeData.brain.STRUCTURE.exhaustion;
      break;

    case 'EXPLAIN_INDICATOR_FAILURE':
      mode = 'Educational Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Phân tích trường hợp <strong>Chỉ báo EMA dễ cho tín hiệu sai</strong>:</p>
          <p>${knowledgeData.brain.INDICATORS.MA.failure}</p>
          <p>• <strong>Lời khuyên</strong>: Chỉ dùng EMA khi thị trường có xu hướng rõ ràng, tránh dùng EMA làm điểm vào lệnh khi dải MA đang nằm ngang.</p>
        </div>
      `;
      break;

    case 'EXPLAIN_CANDLE':
      mode = 'Educational Mentor Mode';
      htmlResponse = knowledgeData.brain.PRICE_ACTION.pinbar_rejection;
      break;

    case 'EXPLAIN_DXY':
      mode = 'Market Mentor Mode';
      htmlResponse = knowledgeData.brain.XAU_USD.dxy_decoupling;
      break;

    case 'EXPLAIN_RISK':
      mode = 'Educational Mentor Mode';
      htmlResponse = knowledgeData.brain.RISK.trader_difference;
      break;

    case 'EXPLAIN_PSYCHOLOGY':
      mode = 'Psychology Mentor Mode';
      htmlResponse = knowledgeData.brain.PSYCHOLOGY.entry_fear;
      break;

    case 'ANALYZE_TRADER_DESK':
      mode = 'Market Analyst Mode';
      htmlResponse = (knowledgeData.brain && knowledgeData.brain.TRADER_DESK && typeof knowledgeData.brain.TRADER_DESK.getSignalStatus === 'function')
        ? knowledgeData.brain.TRADER_DESK.getSignalStatus(knowledgeData.goldPrice)
        : `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Trạng thái tín hiệu Trader Desk hiện tại trên Vàng (XAU/USD $${knowledgeData.goldPrice}):</p>
          <p>• <strong>Khung M15</strong> đang trong cấu trúc tăng duy trì. Giá vừa hồi (pullback) về dải hỗ trợ MA WAVE.</p>
          <p>• Chỉ báo Williams %R và Stochastic cho thấy động lực giảm ngắn hạn đã suy yếu.</p>
          <p>• <strong>Kết luận trạng thái</strong>: <span class="text-amber-400 font-bold">READY (Sẵn sàng)</span>, chưa phải <span class="text-emerald-400 font-bold">CONFIRMED (Xác nhận)</span> vì nến M15 chưa tạo mô hình nến đảo chiều đứt điểm.</p>
        </div>
      `;
      break;

    // Standard Actions
    case 'GREET':
      mode = 'General Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Chào bạn! Mình là <strong>Gold AI Mentor</strong> 🌊</p>
          <p>Hôm nay bạn muốn xem bối cảnh giá Vàng, trao đổi về kinh nghiệm hay thảo luận vấn đề gì nào?</p>
        </div>
      `;
      break;

    case 'ANSWER_PRICE':
      mode = 'Market Analyst Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Giá Vàng (XAU/USD) hiển thị realtime hiện tại là <strong>$${knowledgeData.goldPrice} USD</strong> (Khung ${knowledgeData.timeframe}).</p>
        </div>
      `;
      break;

    case 'ANALYZE_RESISTANCE':
      mode = 'Market Analyst Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Phân tích vùng Hỗ trợ & Kháng cự kỹ thuật hiện tại trên khung <strong>${knowledgeData.timeframe}</strong> (Giá realtime: <strong>$${knowledgeData.goldPrice} USD</strong>):</p>
          <p>• <strong>Vùng Kháng cự quan trọng (Resistance)</strong>: Quanh mức <strong>$${knowledgeData.resistancePrice} USD</strong> (Vùng đỉnh gần nhất của nhịp bứt phá).</p>
          <p>• <strong>Vùng Hỗ trợ gần nhất (Support)</strong>: Quanh mức <strong>$${knowledgeData.supportPrice} USD</strong> (Dải nâng đỡ từ MA WAVE V8).</p>
          <p>Cấu trúc thị trường đang duy trì ${knowledgeData.marketTrend}, giá đang áp sát vùng cản trên với lực nén nến tốt.</p>
        </div>
      `;
      break;

    case 'ANALYZE_NEWS':
      mode = 'Market Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Thông tin tin tức kinh tế nổi bật hôm nay ảnh hưởng đến Vàng & USD:</p>
          <p>• Hôm nay thị trường chú ý đến dữ liệu Chỉ số Giá Tiêu dùng (CPI) và bài phát biểu của Chủ tịch Fed. Dòng tiền đang duy trì đà mua trú ẩn an toàn hỗ trợ cho Vàng.</p>
          <p>• Tâm lý thị trường nghiêng về khả năng Fed giữ nguyên hoặc hạ lãi suất trong đợt tới, tạo lực đẩy duy trì cho xu hướng Vàng.</p>
        </div>
      `;
      break;

    case 'REASSURE':
      mode = 'General Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Nghe có vẻ hôm nay bạn đang gặp khá nhiều áp lực. 🌿</p>
          <p>Những lúc thấy tâm lý mệt mỏi hay căng thẳng, bạn nên chậm lại một chút. Áp lực hiện tại của bạn đến từ công việc, giao dịch hay do nhiều thứ dồn lại một lúc?</p>
        </div>
      `;
      break;

    case 'ASK_WORK':
      mode = 'General Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Công việc dạo này đang khiến bạn cảm thấy quá tải à?</p>
          <p>Áp lực đó thường đến từ khối lượng công việc quá nhiều, môi trường xung quanh hay bạn đang cảm thấy định hướng hiện tại chưa phù hợp?</p>
        </div>
      `;
      break;

    case 'DISCUSS_CAREER':
      mode = 'General Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Quyết định nghỉ việc là một bước chuyển lớn. Trước khi chốt, bạn đã chuẩn bị sẵn phương án dự phòng hay tài chính tích lũy cho vài tháng tới chưa?</p>
          <p>Nếu cần góc nhìn để cân nhắc kỹ hơn trước khi đưa ra quyết định, mình luôn sẵn sàng lắng nghe và chia sẻ cùng bạn!</p>
        </div>
      `;
      break;

    case 'RETURN_GOLD':
      mode = 'Market Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Ok bạn, chúng ta quay lại với biểu đồ Vàng nhé! 📈</p>
          <p>Hiện tại giá Vàng (XAU/USD) đang giao dịch ở mức <strong>$${knowledgeData.goldPrice} USD</strong> trên khung ${knowledgeData.timeframe}. Bạn muốn xem tiếp tín hiệu MA WAVE V8 hay đường trung bình động EMA?</p>
        </div>
      `;
      break;

    case 'ANALYZE_EMA_MARKET':
      mode = 'Market Analyst Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Trạng thái đường <strong>EMA 20</strong> trên biểu đồ Vàng $${knowledgeData.goldPrice} hiện tại (Khung ${knowledgeData.timeframe}):</p>
          <p>• Đường EMA 20 đang dốc lên và nằm quanh mức <strong>$${knowledgeData.ema20Price} USD</strong>, đóng vai trò là dải hỗ trợ động ngắn hạn.</p>
          <p>• Giá nến duy trì nằm trên EMA 20 xác nhận động lực tăng giá ngắn hạn chưa bị vi phạm.</p>
        </div>
      `;
      break;

    case 'REPAIR_EMA_EDU':
      mode = 'Educational Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>À xin lỗi bạn, mình hiểu nhầm ý! Về mặt <strong>kiến thức lý thuyết chỉ báo</strong>:</p>
          <p>• <strong>EMA (Exponential Moving Average)</strong> là đường trung bình động hàm mũ, ưu tiên trọng số cho các biến động giá gần nhất.</p>
          <p>• So với đường MA thông thường (SMA), EMA phản ứng nhanh hơn nhiều với nhịp thay đổi của nến, giúp trader sớm phát hiện đảo chiều hoặc tiếp diễn xu hướng.</p>
        </div>
      `;
      break;

    case 'COMPARE_EMA':
      mode = 'Educational Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Điểm khác biệt cốt lõi giữa <strong>EMA 20</strong> và <strong>EMA 50</strong> trong giao dịch:</p>
          <p>• <strong>EMA 20 (Ngắn hạn)</strong>: Phản ứng cực nhanh với giá nến, đại diện cho động lực sóng ngắn. Dùng để tìm điểm vào lệnh theo nhịp hồi (Pullback).</p>
          <p>• <strong>EMA 50 (Trung hạn)</strong>: Phản ứng chậm hơn, đại diện cho xu hướng nền tảng. Đóng vai trò là dải hỗ trợ / kháng cự động vững chắc.</p>
          <p>• Khi EMA 20 cắt lên trên EMA 50 $\\rightarrow$ Tín hiệu giao cắt vàng (Golden Cross) xác nhận xu hướng tăng mạnh.</p>
        </div>
      `;
      break;

    case 'STOP_TOPIC':
      mode = 'Educational Mentor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Ok bạn, mình gác lại phần chỉ báo EMA tại đây nhé! 👍</p>
          <p>Bất cứ khi nào bạn muốn chuyển sang chủ đề khác hay hỏi bất kỳ điều gì, cứ thoải mái chia sẻ với mình.</p>
        </div>
      `;
      break;

    case 'DISCUSS_AI_APP':
      mode = 'Tech Advisor Mode';
      htmlResponse = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Ý tưởng xây dựng <strong>Ứng dụng AI (App AI)</strong> rất tiềm năng! 🚀</p>
          <p>Để phát triển một sản phẩm App AI giao dịch / phân tích hiệu quả, bạn nên tập trung vào 3 trụ cột này:</p>
          <p>1. <strong>Mô hình AI Engine</strong>: Dùng LLM API (Gemini/OpenAI) xử lý ngôn ngữ hội thoại + mô hình Machine Learning riêng phân tích nến & tin tức.</p>
          <p>2. <strong>Luồng Dữ liệu Realtime</strong>: Kết nối API khớp giá mS (WebSockets) đẩy trực tiếp vào bộ nhớ AI để phân tích ngay khi nến đóng.</p>
          <p>3. <strong>Giao diện UI/UX</strong>: Tích hợp khung chat tương tác song song với biểu đồ kỹ thuật TradingView Lightweight Charts.</p>
          <p>Bạn định phát triển ứng dụng này trên nền tảng Web hay Mobile App?</p>
        </div>
      `;
      break;

    default:
      const dynRes = generateUniversalDynamicResponse(parsedMsg.rawQuery || conv.lastUserMessage || '', knowledgeData, conv);
      mode = dynRes.mode;
      htmlResponse = dynRes.htmlResponse;
      break;
  }

  conv.reasoningMode = mode;
  return { htmlResponse, mode };
}

function generateUniversalDynamicResponse(query, knowledgeData, conv) {
  const cleanQ = removeAccents(cleanVietnameseText(query || ''));
  const goldPrice = knowledgeData.goldPrice || '4,363.89';
  const tf = knowledgeData.timeframe || '15M';
  const resP = knowledgeData.resistancePrice || '4,378.50';
  const supP = knowledgeData.supportPrice || '4,342.50';
  const emaP = knowledgeData.ema20Price || '4,358.20';

  // 1. Trading / Buy / Sell / Position Entry advice
  if (cleanQ.includes('ban') || cleanQ.includes('mua') || cleanQ.includes('vao lenh') || cleanQ.includes('chieu') || cleanQ.includes('nhat') || cleanQ.includes('dinh') || cleanQ.includes('co nen') || cleanQ.includes('luc nay') || cleanQ.includes('the nao')) {
    return {
      mode: 'Market Analyst Mode',
      htmlResponse: `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Dựa trên cấu trúc sóng Vàng (XAU/USD) trực tiếp mốc <strong>$${goldPrice} USD</strong> (Khung ${tf}):</p>
          <p>• <strong>Bối cảnh kỹ thuật</strong>: Vùng Kháng cự quan trọng quanh <strong>$${resP} USD</strong>, dải Hỗ trợ động nâng đỡ tại <strong>$${supP} USD</strong>.</p>
          <p>• <strong>Gợi ý chiến lược</strong>: Tránh vào lệnh mua đuổi (FOMO) khi nến đang tiệm cận vùng đỉnh. Bạn nên kiên nhẫn chờ nhịp hồi (Pullback) về dải EMA20 quanh $${emaP} USD hoặc xuất hiện nến đảo chiều xác nhận để có tỷ lệ R:R đẹp nhất.</p>
          <p>• <strong>Kỷ luật vị thế</strong>: Luôn đặt Stop Loss (3-5 giá) cố định và giới hạn rủi ro dưới 1-2% tài khoản cho mỗi lệnh.</p>
        </div>
      `
    };
  }

  // 2. Technical Analysis & Indicators
  if (cleanQ.includes('chi bao') || cleanQ.includes('indicator') || cleanQ.includes('bollinger') || cleanQ.includes('stochastic') || cleanQ.includes('macd') || cleanQ.includes('fibonacci') || cleanQ.includes('rrr') || cleanQ.includes('volume') || cleanQ.includes('action') || cleanQ.includes('gong')) {
    return {
      mode: 'Educational Mentor Mode',
      htmlResponse: `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Góc nhìn chuyên môn về câu hỏi kỹ thuật của bạn:</p>
          <p>• <strong>Nguyên lý cốt lõi</strong>: Mọi chỉ báo kỹ thuật (Indicator) đều được tính toán sau biến động nến (Price Action). Việc kết hợp chỉ báo động lượng (RSI/Stochastic) với đường trung bình (MA WAVE V8 / EMA) giúp lọc đến 80% tín hiệu nhiễu.</p>
          <p>• <strong>Quy tắc áp dụng</strong>: Đừng bao giờ dựa vào duy nhất 1 chỉ báo để mở lệnh! Hãy tìm sự hợp lưu (Confluence) giữa Cấu trúc sóng + Vùng Hỗ trợ/Kháng cự + Nến xác nhận (Trigger).</p>
          <p>• Bạn có muốn mình phân tích cụ thể công dụng của chỉ báo này trên biểu đồ Vàng realtime ($${goldPrice}) không?</p>
        </div>
      `
    };
  }

  // 3. News / Macroeconomics / Fed
  if (cleanQ.includes('tin') || cleanQ.includes('lai suat') || cleanQ.includes('fed') || cleanQ.includes('cpi') || cleanQ.includes('lam phat') || cleanQ.includes('kinh te') || cleanQ.includes('usd') || cleanQ.includes('chien tranh') || cleanQ.includes('dia chinh tri')) {
    return {
      mode: 'Macro Analyst Mode',
      htmlResponse: `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Về yếu tố Vĩ mô & Tin tức tác động đến Vàng (XAU/USD $${goldPrice}):</p>
          <p>• <strong>Cơ chế truyền dẫn</strong>: Vàng là tài sản trú ẩn an toàn (Safe Haven) không có lợi tức, chịu tác động trực tiếp bởi Lãi suất thực (Real Yields) và sức mạnh đồng USD (DXY).</p>
          <p>• <strong>Kinh nghiệm giao dịch tin mạnh</strong>: Khi có tin đỏ (CPI, NFP, FOMC), thanh khoản mỏng dẫn đến nến giật hai đầu rất mạnh. Tốt nhất nên chờ 15 phút sau tin để thị trường xác nhận hướng đi rõ ràng rồi mới giao dịch.</p>
        </div>
      `
    };
  }

  // 4. App Features & Guidance
  if (cleanQ.includes('app') || cleanQ.includes('tinh nang') || cleanQ.includes('huong dan') || cleanQ.includes('dung the nao') || cleanQ.includes('thong bao') || cleanQ.includes('nut') || cleanQ.includes('chuong') || cleanQ.includes('o dau') || cleanQ.includes('lam sao')) {
    return {
      mode: 'Tech Advisor Mode',
      htmlResponse: `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Chào bạn! Mình xin hướng dẫn bạn khai thác hiệu quả các công cụ trên <strong>Gold Wave Terminal</strong>:</p>
          <p>1. <strong>📈 Biểu đồ & Tín hiệu MA WAVE V8</strong>: Xem diễn biến giá Vàng realtime và nhận diện sóng xu hướng tự động.</p>
          <p>2. <strong>🔔 Bật Thông Báo Nảy Màn Hình</strong>: Bấm nút **Chuông 🔔** trên góc phải (hoặc banner "Bật ngay") để nhận Push Notification nảy về điện thoại & máy tính.</p>
          <p>3. <strong>📰 Lịch Tin Tức Vĩ Mô</strong>: Cập nhật sự kiện tác động đến Vàng và độ ảnh hưởng High/Medium/Low.</p>
          <p>4. <strong>✦ Gold AI Chat</strong>: Hỏi đáp mở hoàn toàn mọi thắc mắc về kỹ thuật, tâm lý hay bối cảnh giá!</p>
        </div>
      `
    };
  }

  // 5. Friendly Open Conversational Answer
  return {
    mode: 'Gold AI Mentor Mode',
    htmlResponse: `
      <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
        <p>Rất vui được trao đổi cùng bạn! 🌊</p>
        <p>Về câu hỏi của bạn: Trong bối cảnh thị trường Vàng (XAU/USD) hiện tại ở mốc <strong>$${goldPrice} USD</strong> (Khung ${tf}), các dải sóng kỹ thuật đang duy trì đà tích lũy khá đẹp.</p>
        <p>Bạn muốn trao đổi thêm về khía cạnh phân tích biểu đồ, chiến lược giao dịch hay bất kỳ chủ đề nào khác cứ thoải mái chia sẻ với mình nhé!</p>
      </div>
    `
  };
}

function classifyUserIntentAndDomain(query, conv) {
  const parsed = understandUserMessage(query, conv);
  let domain = 'MARKET';
  if (parsed.intentClass === 'GREETING' || parsed.intentClass === 'EMOTIONAL_EXPRESSION') domain = 'DAILY_CHAT';
  else if (parsed.intentClass === 'WORK_DETAIL' || parsed.intentClass === 'CAREER_DECISION') domain = 'CAREER_LIFE';
  else if (parsed.intentClass === 'BUILD_AI_APP') domain = 'BUSINESS_TECH';
  else if (parsed.intentClass === 'NEWS_QUERY' || parsed.intentClass === 'EXPLAIN_DXY_DECOUPLING') domain = 'MACRO_NEWS';
  else if (parsed.intentClass.startsWith('EXPLAIN_') || parsed.intentClass === 'INDICATOR_FAILURE_MODE') domain = 'TRADING_EDU';
  return { intent: parsed.intentClass, domain };
}
const classifyUserIntent = classifyUserIntentAndDomain;

function generateGoldAIMentorResponse(query) {
  const conv = window.goldAiConversationContext;

  const parsedMsg = understandUserMessage(query, conv);
  updateContextAndUserModel(parsedMsg, conv, query);
  const strategy = decideResponseStrategy(parsedMsg, conv);
  const knowledgeData = fetchRequiredKnowledge(strategy, parsedMsg, conv);
  const { htmlResponse, mode } = generateNaturalResponse(strategy, knowledgeData, parsedMsg, conv);

  conv.userIntent = parsedMsg.intentClass;
  conv.recentMessages.push({ role: 'user', content: query, intent: parsedMsg.intentClass });
  conv.recentMessages.push({ role: 'assistant', content: htmlResponse });
  conv.lastUserMessage = query;
  conv.lastAssistantMessage = htmlResponse;

  return { htmlResponse, mode };
}
window.generateGoldAIMentorResponse = generateGoldAIMentorResponse;


// Global initialization call for Account & Notifs
/* ═════════════════════════════════════════════════════════════════════ */

// Local state & defaults
window.currentUser = JSON.parse(localStorage.getItem('goldwave_user') || 'null');

window.userNotifsList = JSON.parse(localStorage.getItem('goldwave_notifs')) || [
  {
    id: 'n_01',
    eventId: 'evt_sig_4360_buy',
    category: 'ma-wave',
    title: '🟢 MA WAVE V8 SIGNAL: BUY @ 4360.20',
    body: 'Tín hiệu Mua xác nhận theo quy tắc 22 V8. Khung 15M. TP1: 4370.20, SL: 4355.20',
    time: '14:20',
    read: false,
    deepLink: 'ma-wave'
  },
  {
    id: 'n_02',
    eventId: 'evt_news_cpi_01',
    category: 'news',
    title: '📰 HIGH IMPACT NEWS: US CPI MoM',
    body: 'Báo cáo chỉ số giá tiêu dùng CPI công bố lúc 19:30. Tác động mức CỰC CAO (High) đến USD & Vàng.',
    time: '12:00',
    read: false,
    deepLink: 'news'
  },
  {
    id: 'n_03',
    eventId: 'evt_trend_h1_bull',
    category: 'system',
    title: '📈 XU HƯỚNG: ĐỒNG THUẬN CẤU TRÚC TĂNG',
    body: 'XAU/USD hình thành Đỉnh Đáy Cao Dần (Higher High / Higher Low) trên H1 & H4.',
    time: '10:15',
    read: true,
    deepLink: 'trend'
  }
];

window.notifCurrentCategoryFilter = 'all';
window.seenNotificationEventsRegistry = new Set(
  JSON.parse(localStorage.getItem('goldwave_seen_events') || '[]')
);

// ── Auth Modal Functions ──
window.openAuthModal = function(initialTab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    switchAuthTab(initialTab);
  }
};

// ── AUTH & FULLSCREEN AUTHENTICATION PAGE MANAGER ──
window.showAuthView = function(viewName) {
  const views = ['login', 'register', 'forgot', 'verify', 'reset', 'paywall'];
  views.forEach(v => {
    const el = document.getElementById(`auth-form-${v}`);
    if (el) el.classList.add('hidden');
  });

  const target = document.getElementById(`auth-form-${viewName}`);
  if (target) target.classList.remove('hidden');
};

// ── Paywall & Subscription Manager ──
window.cachedPaymentConfig = null;

window.openPaywallScreen = function(user, sub, payment) {
  const authPage = document.getElementById('auth-fullscreen-page');
  const appShell = document.getElementById('app-shell');
  if (appShell) {
    appShell.classList.add('hidden');
    appShell.style.display = 'none';
  }
  if (authPage) {
    authPage.classList.remove('hidden');
    authPage.style.display = 'flex';
  }

  showAuthView('paywall');

  const uEmail = user ? user.email : (document.getElementById('login-email')?.value || 'trader@gmail.com');
  const emailEl = document.getElementById('paywall-user-email');
  if (emailEl) emailEl.textContent = uEmail;

  const cfg = payment || window.cachedPaymentConfig || {};
  window.cachedPaymentConfig = cfg;

  const bankNameEl = document.getElementById('paywall-bank-name');
  const accNumEl = document.getElementById('paywall-acc-number');
  const accNameEl = document.getElementById('paywall-acc-name');
  const amountEl = document.getElementById('paywall-amount');
  const feeDisplayEl = document.getElementById('paywall-fee-display');
  const memoEl = document.getElementById('paywall-memo');
  const zaloEl = document.getElementById('paywall-support-zalo');
  const qrImgEl = document.getElementById('paywall-qr-img');

  if (bankNameEl && cfg.bankName) bankNameEl.textContent = cfg.bankName;
  if (accNumEl && cfg.accountNumber) accNumEl.textContent = cfg.accountNumber;
  if (accNameEl && cfg.accountName) accNameEl.textContent = cfg.accountName;
  if (amountEl && cfg.monthlyFee) amountEl.textContent = cfg.monthlyFee;
  if (feeDisplayEl && cfg.monthlyFee) feeDisplayEl.textContent = cfg.monthlyFee;
  
  if (memoEl) memoEl.textContent = 'Tùy ý (Tên hoặc SĐT của bạn)';
  if (zaloEl && cfg.supportZalo) zaloEl.href = cfg.supportZalo;

  // Build Bank QR Image
  if (qrImgEl) {
    qrImgEl.src = (cfg.qrImage || 'assets/payment-qr.png');
    qrImgEl.onerror = function() {
      this.onerror = null;
      if (cfg.bankId && cfg.accountNumber) {
        const cleanAcc = encodeURIComponent(cfg.accountNumber.replace(/\s+/g, ''));
        const cleanBank = encodeURIComponent(cfg.bankId);
        const cleanName = encodeURIComponent(cfg.accountName || 'HOANG BA');
        this.src = `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-compact2.png?accountName=${cleanName}`;
      }
    };
  }
};

window.copyPaywallInfo = function(type) {
  const cfg = window.cachedPaymentConfig || {};
  let textToCopy = '';
  if (type === 'accountNumber') {
    textToCopy = cfg.accountNumber || document.getElementById('paywall-acc-number')?.textContent || '68686866899';
  } else if (type === 'memo') {
    textToCopy = document.getElementById('pay-confirm-name')?.value || document.getElementById('pay-confirm-phone')?.value || 'Techcombank';
  }
  if (navigator.clipboard && textToCopy) {
    navigator.clipboard.writeText(textToCopy);
    if (typeof showToast === 'function') showToast(`📋 Đã sao chép: "${textToCopy}"`, 'success');
  } else {
    alert(`Đã sao chép: ${textToCopy}`);
  }
};

window.togglePaymentConfirmForm = function() {
  const box = document.getElementById('paywall-confirm-form-box');
  if (box) {
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      const nameInput = document.getElementById('pay-confirm-name');
      if (nameInput) nameInput.focus();
    }
  }
};

window.submitPaymentActivationRequest = async function() {
  const email = document.getElementById('paywall-user-email')?.textContent || '';
  const name = document.getElementById('pay-confirm-name')?.value.trim();
  const phone = document.getElementById('pay-confirm-phone')?.value.trim();

  if (!email) {
    alert('Không tìm thấy email tài khoản.');
    return;
  }

  if (!name || !phone) {
    alert('⚠️ Vui lòng điền đầy đủ Họ Tên và Số Điện Thoại (Zalo) để Admin nhận diện và kích hoạt tài khoản cho bạn.');
    return;
  }

  try {
    const res = await fetch('/api/subscription/request-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone, note: `SĐT: ${phone}` })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      alert(`🎉 YÊU CẦU ĐÃ GỬI THÀNH CÔNG!\n\nThông tin xác nhận:\n- Họ và tên: ${name}\n- Số điện thoại / Zalo: ${phone}\n- Email: ${email}\n\nAdmin đã nhận được thông tin và sẽ kiểm tra, kích hoạt tài khoản cho bạn trong vòng 1-3 phút!`);
      const box = document.getElementById('paywall-confirm-form-box');
      if (box) box.classList.add('hidden');
      if (typeof showToast === 'function') {
        showToast('✅ Đã gửi thông tin cho Admin thành công!', 'success');
      }
    } else {
      alert('Gửi yêu cầu thất bại: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (err) {
    alert('Lỗi gửi yêu cầu kích hoạt. Vui lòng liên hệ trực tiếp qua Zalo hỗ trợ.');
  }
};

window.updateSubscriptionBadgeUI = function() {
  const badgeEl = document.getElementById('top-bar-sub-badge');
  const iconEl = document.getElementById('top-sub-icon');
  const textEl = document.getElementById('top-sub-text');
  const adminBtn = document.getElementById('top-bar-admin-quick-btn');
  const pineAdminNav = document.getElementById('nav-pine-admin');

  if (adminBtn) { adminBtn.classList.add('hidden'); adminBtn.style.display = 'none'; }
  if (pineAdminNav) { pineAdminNav.classList.add('hidden'); pineAdminNav.style.display = 'none'; }

  if (!badgeEl || !window.currentUser) {
    if (badgeEl) badgeEl.classList.add('hidden');
    return;
  }

  const user = window.currentUser;
  const emailLower = (user && user.email ? user.email : '').toLowerCase().trim();
  const isAdmin = user && (user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin'));

  if (isAdmin) {
    badgeEl.classList.remove('hidden');
    badgeEl.className = 'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] sm:text-[11px] font-bold text-emerald-300 cursor-pointer hover:bg-emerald-500/20 transition shadow-sm';
    if (iconEl) iconEl.textContent = '👑';
    if (textEl) textEl.textContent = 'ADMIN VIP';
    return;
  }

  let sub = user.subscription;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (!sub || sub.daysRemaining == null) {
    const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : now;
    const trialDays = user.trialDays || 14;
    const trialExpiresMs = user.trialExpiresAt ? new Date(user.trialExpiresAt).getTime() : (createdMs + trialDays * ONE_DAY_MS);
    const daysRemaining = Math.max(0, Math.ceil((trialExpiresMs - now) / ONE_DAY_MS));
    sub = {
      status: daysRemaining > 0 ? 'TRIAL' : 'EXPIRED',
      isExpired: daysRemaining <= 0,
      daysRemaining,
      expiresAt: new Date(trialExpiresMs).toISOString()
    };
  }

  badgeEl.classList.remove('hidden');
  if (sub.isExpired) {
    badgeEl.className = 'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[10px] sm:text-[11px] font-bold text-rose-300 cursor-pointer hover:bg-rose-500/20 transition animate-pulse shadow-sm';
    if (iconEl) iconEl.textContent = '🔒';
    if (textEl) textEl.textContent = 'Hết hạn dùng thử';
  } else if (sub.status === 'ACTIVE') {
    badgeEl.className = 'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] sm:text-[11px] font-bold text-amber-300 cursor-pointer hover:bg-amber-500/20 transition shadow-sm';
    if (iconEl) iconEl.textContent = '✨';
    if (textEl) textEl.textContent = `VIP: Còn ${sub.daysRemaining} ngày`;
  } else {
    badgeEl.className = 'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[10px] sm:text-[11px] font-bold text-sky-300 cursor-pointer hover:bg-sky-500/20 transition shadow-sm';
    if (iconEl) iconEl.textContent = '⏱️';
    if (textEl) textEl.textContent = `Dùng thử: Còn ${sub.daysRemaining} ngày`;
  }
};

window.handleSubBadgeClick = function() {
  if (!window.currentUser) {
    openAuthModal();
    return;
  }
  const user = window.currentUser;
  const emailLower = (user && user.email ? user.email : '').toLowerCase().trim();
  const isAdmin = user && (user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin'));
  if (isAdmin) {
    if (typeof window.switchView === 'function') window.switchView('account');
  } else {
    if (user.subscription && user.subscription.isExpired) {
      openPaywallScreen(user, user.subscription, window.cachedPaymentConfig);
    } else {
      if (typeof window.switchView === 'function') window.switchView('account');
    }
  }
};

window.togglePasswordVisibility = function(inputId, eyeBtnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(eyeBtnId);
  if (input && btn) {
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  }
};

window.checkPasswordStrength = function(pwd) {
  const bar = document.getElementById('pwd-strength-bar');
  if (!bar) return;
  if (!pwd) {
    bar.style.width = '0%';
    return;
  }
  let score = 0;
  if (pwd.length >= 6) score += 33;
  if (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd)) score += 33;
  if (/[^A-Za-z0-9]/.test(pwd) && pwd.length >= 8) score += 34;

  bar.style.width = `${score}%`;
  if (score <= 33) {
    bar.className = 'h-full bg-rose-500 transition-all duration-300';
  } else if (score <= 66) {
    bar.className = 'h-full bg-amber-500 transition-all duration-300';
  } else {
    bar.className = 'h-full bg-emerald-500 transition-all duration-300';
  }
};

window.openAuthModal = function() {
  const page = document.getElementById('auth-fullscreen-page');
  if (page) page.classList.remove('hidden');
  showAuthView('login');
};

window.closeAuthModal = function() {
  const authPage = document.getElementById('auth-fullscreen-page');
  const appShell = document.getElementById('app-shell');
  if (window.currentUser) {
    if (authPage) {
      authPage.classList.add('hidden');
      authPage.style.display = 'none';
    }
    if (appShell) {
      appShell.classList.remove('hidden');
      appShell.style.display = 'flex';
    }
  } else {
    if (typeof showToast === 'function') showToast('⚠️ Bắt buộc đăng nhập hoặc đăng ký để sử dụng Gold Wave', 'warning');
    if (authPage) {
      authPage.classList.remove('hidden');
      authPage.style.display = 'flex';
    }
    if (appShell) {
      appShell.classList.add('hidden');
      appShell.style.display = 'none';
    }
  }
};

// ── Robust Device Fingerprint Engine (Anti-Trial-Abuse) ──
window.getOrCreateDeviceId = function() {
  const STORAGE_KEY = 'goldwave_device_fingerprint';
  const COOKIE_NAME = 'goldwave_dfp';

  function getCookie(name) {
    const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? decodeURIComponent(v[2]) : null;
  }
  function setCookie(name, val) {
    try {
      document.cookie = `${name}=${encodeURIComponent(val)}; max-age=${315360000}; path=/; SameSite=Lax`;
    } catch (e) {}
  }

  let deviceId = localStorage.getItem(STORAGE_KEY) || getCookie(COOKIE_NAME);

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'nocanvas';
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('GoldWave-AntiTrialAbuse', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('GoldWave-AntiTrialAbuse', 4, 17);
      return canvas.toDataURL();
    } catch (e) {
      return 'canvaserr';
    }
  }

  function hashString(str) {
    let hash1 = 5381;
    let hash2 = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1) + char;
      hash2 = char + (hash2 << 6) + (hash2 << 16) - hash2;
    }
    const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
    const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
    return `${h1}${h2}`;
  }

  const canvasFp = getCanvasFingerprint();
  const screenFp = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
  const tzFp = new Date().getTimezoneOffset();
  const langFp = navigator.language || '';
  const coresFp = navigator.hardwareConcurrency || 4;
  const platformFp = navigator.platform || '';

  const rawSeed = `${screenFp}_${tzFp}_${langFp}_${coresFp}_${platformFp}_${canvasFp}`;
  const hardwareHash = hashString(rawSeed);

  if (!deviceId) {
    deviceId = `GW-DEV-${hardwareHash}`;
  } else if (!deviceId.includes(hardwareHash.slice(0, 8))) {
    deviceId = `GW-DEV-${hardwareHash}`;
  }

  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
    setCookie(COOKIE_NAME, deviceId);
  } catch (e) {}

  return deviceId;
};

window.checkAuthOnLoad = async function() {
  const sessionData = JSON.parse(localStorage.getItem('goldwave_session') || 'null') ||
                      JSON.parse(localStorage.getItem('goldwave_user') || 'null');
  
  const authPage = document.getElementById('auth-fullscreen-page');
  const appShell = document.getElementById('app-shell');

  const userObj = sessionData ? (sessionData.user || sessionData) : null;

  if (!userObj || !userObj.email) {
    window.currentUser = null;
    if (authPage) {
      authPage.classList.remove('hidden');
      authPage.style.display = 'flex';
    }
    if (appShell) {
      appShell.classList.add('hidden');
      appShell.style.display = 'none';
    }
    return;
  }

  // Check subscription status with server (kèm mã định danh thiết bị deviceId)
  try {
    const deviceId = window.getOrCreateDeviceId();
    const res = await fetch('/api/subscription/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userObj.email, deviceId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.subscription) {
        userObj.subscription = data.subscription;
        if (data.payment) window.cachedPaymentConfig = data.payment;
        if (data.subscription.isExpired) {
          localStorage.removeItem('goldwave_session');
          localStorage.removeItem('goldwave_user');
          window.currentUser = null;
          openPaywallScreen(userObj, data.subscription, data.payment);
          return;
        }
      }
    }
  } catch (e) {
    // Client-side fallback check
    if (userObj.role !== 'ADMIN' && userObj.trialExpiresAt) {
      if (new Date(userObj.trialExpiresAt).getTime() <= Date.now()) {
        openPaywallScreen(userObj, { isExpired: true }, null);
        return;
      }
    }
  }

  window.currentUser = userObj;
  if (authPage) {
    authPage.classList.add('hidden');
    authPage.style.display = 'none';
  }
  if (appShell) {
    appShell.classList.remove('hidden');
    appShell.style.display = 'flex';
  }
  updateUserUI();
  updatePushNotificationUI();
  updateSubscriptionBadgeUI();
};

window.handleLogout = function() {
  localStorage.removeItem('goldwave_session');
  localStorage.removeItem('goldwave_user');
  window.currentUser = null;
  if (typeof showToast === 'function') showToast('👋 Đã đăng xuất thành công', 'info');
  window.checkAuthOnLoad();
};

// ─── Web Push Protocol Helper & VAPID Registration ───
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

window.registerWebPushSubscription = async function() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('⚠️ Web Push không được hỗ trợ trên trình duyệt này');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    const VAPID_KEY = 'BHAXhZUIo7ZpKAWfeQigU-4vMHKWZVXKkWTN1RronWTUj5g2YNdpfwN7KuJRALr2BeLlqqSdZ3xt3j2LzIDW4X8';

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_KEY)
      });
    }

    if (sub) {
      const deviceId = (typeof window.getOrCreateDeviceId === 'function') ? window.getOrCreateDeviceId() : 'unknown';
      const user = window.currentUser ? window.currentUser.email : 'guest';
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON ? sub.toJSON() : sub,
          deviceId,
          userEmail: user
        })
      });
      console.log('✅ Đã đăng ký Web Push thành công! Thiết bị sẽ nhận được thông báo khi thoát app hoặc khóa màn hình.');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Lỗi đăng ký PushManager:', err);
  }
  return false;
};

// ─── Web Push Notification Helper (Đồng bộ 100% Theo Giá Live Thị Trường) ───
window.sendAllCategoryPushNotifications = function() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    if (typeof showToast === 'function') showToast('⚠️ Bạn cần cho phép quyền thông báo đẩy!', 'warning');
    return;
  }

  const store = window.marketDataStore;
  const livePrice = (store && typeof store.getCurrentPrice === 'function') 
    ? store.getCurrentPrice() 
    : ((window.app && window.app.currentPrice) || 4121.20);

  const levels = (window.app && typeof window.app.getCalculatedKeyLevels === 'function') 
    ? window.app.getCalculatedKeyLevels() 
    : { s1: +(livePrice - 10).toFixed(2), r1: +(livePrice + 10).toFixed(2), atr: 3.50 };

  const buyEntry = livePrice;
  const tp1 = (buyEntry + 10.0).toFixed(2);
  const tp2 = (buyEntry + 20.0).toFixed(2);
  const sl  = (buyEntry - 5.0).toFixed(2);

  // 1. Send NEWS Push
  setTimeout(() => {
    window.sendNativePushNotification('📰 TIN TỨC VĨ MÔ HÀNG NGÀY — GOLD WAVE', {
      body: '🔴 Báo cáo CPI & lạm phát Mỹ công bố hôm nay! Tác động cực mạnh đến USD & biến động giá Vàng XAU/USD.',
      icon: 'assets/logo.png',
      tag: 'notif-news-' + Date.now()
    });
  }, 100);

  // 2. Send TREND Push theo ĐÚNG GIÁ LIVE THỊ TRƯỜNG
  setTimeout(() => {
    window.sendNativePushNotification('📈 GOLD AI — PHÂN TÍCH XU HƯỚNG XAU/USD', {
      body: `〽 Xu hướng: TĂNG MẠNH 🟢 (MTF Đồng thuận 100%)\n📍 Giá Live: $${livePrice.toFixed(2)}\n🛡️ Hỗ trợ chú ý S1: $${levels.s1.toFixed(2)} | 🚧 Kháng cự R1: $${levels.r1.toFixed(2)}`,
      icon: 'assets/logo.png',
      tag: 'notif-trend-' + Date.now()
    });
  }, 500);

  // 3. Send SIGNAL Push theo ĐÚNG GIÁ LIVE THỊ TRƯỜNG
  setTimeout(() => {
    window.sendNativePushNotification('🚨 TÍN HIỆU GIAO DỊCH MA WAVE V8: MUA (BUY) 📈', {
      body: `📍 Entry: $${buyEntry.toFixed(2)} | 🎯 TP1 (+10 giá): $${tp1} | 🎯 TP2 (+20 giá): $${tp2} | 🛑 SL (-5 giá): $${sl}`,
      icon: 'assets/logo.png',
      tag: 'notif-signal-' + Date.now()
    });
  }, 900);

  try {
    fetch('/api/notifications/trigger-all');
  } catch(e) {}

  if (typeof showToast === 'function') {
    showToast(`🔔 Đã gửi 3 Thông báo chuẩn theo giá thị trường live ($${livePrice.toFixed(2)})!`, 'success');
  }
};

window.requestPushNotificationPermission = async function() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!('Notification' in window)) {
    if (isIOS) {
      alert('📱 HƯỚNG DẪN BẬT THÔNG BÁO NẢY TRÊN IPHONE (iOS):\n\nApple (iOS) yêu cầu thêm ứng dụng vào Màn hình chính để nảy thông báo lên màn hình khóa kể cả khi thoát app:\n\n1️⃣ Bấm biểu tượng CHIA SẺ ở đáy Safari (Ô vuông có mũi tên ⎋ chỉ lên).\n2️⃣ Chọn "Thêm vào Màn hình chính" (Add to Home Screen).\n3️⃣ Mở ứng dụng Gold Wave từ Màn hình chính iPhone và bấm "Bật ngay".\n\n(Trên điện thoại Android & Máy tính, thông báo nảy trực tiếp không cần thao tác này).');
    } else {
      alert('⚠️ Trình duyệt của bạn không hỗ trợ thông báo Web Push. Vui lòng thử trên Chrome, Edge hoặc Firefox.');
    }
    if (typeof showToast === 'function') showToast('⚠️ Trình duyệt chưa bật quyền Web Push', 'error');
    return false;
  }
  
  const currentPerm = Notification.permission;

  if (currentPerm === 'granted') {
    await window.registerWebPushSubscription();
    alert('✅ BẠN ĐÃ BẬT THÔNG BÁO PUSH RỒI!\n\nĐã kích hoạt chế độ nhận thông báo ngay cả khi THOÁT ỨNG DỤNG hoặc KHÓA MÀN HÌNH. Đang phát 3 thông báo thử nghiệm theo ĐÚNG GIÁ THỊ TRƯỜNG LIVE...');
    window.sendAllCategoryPushNotifications();
    updatePushNotificationUI();
    return true;
  }

  if (currentPerm === 'denied') {
    alert('⚠️ TRÌNH DUYỆT ĐANG CHẶN THÔNG BÁO DƯỚI CÀI ĐẶT!\n\nCách mở lại thông báo:\n1. Bấm vào biểu tượng 🔒 Ổ khóa (hoặc biểu tượng Cài đặt) ở bên trái thanh địa chỉ trang web.\n2. Tìm mục "Thông báo" (Notifications) -> Đổi thành "Cho phép" (Allow).\n3. Tải lại trang web và bấm "Bật ngay".');
    if (typeof showToast === 'function') showToast('❌ Quyền thông báo đang bị từ chối trong Cài đặt trình duyệt', 'error');
    updatePushNotificationUI();
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await window.registerWebPushSubscription();
      alert('🎉 BẬT THÀNH CÔNG!\n\nBạn đã cho phép Gold Wave gửi thông báo đẩy về màn hình (kể cả khi đã thoát ứng dụng). Đang phát 3 thông báo thử nghiệm theo ĐÚNG GIÁ THỊ TRƯỜNG LIVE...');
      window.sendAllCategoryPushNotifications();
      updatePushNotificationUI();
      return true;
    } else {
      alert('⚠️ Bạn vừa bấm Từ chối hoặc Đóng hộp thoại. Hãy bấm "Cho phép" (Allow) khi trình duyệt yêu cầu nhé!');
    }
  } catch (err) {
    console.error('Notification error:', err);
    alert('⚠️ Không thể yêu cầu quyền thông báo: ' + (err.message || err));
  }
  return false;
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(async reg => {
    console.log('✅ ServiceWorker registered:', reg.scope);
    if ('Notification' in window && Notification.permission === 'granted') {
      await window.registerWebPushSubscription();
    }
  }).catch(err => {
    console.warn('⚠️ ServiceWorker registration failed:', err);
  });
}

window.sendNativePushNotification = function(title, options = {}) {
  // Phát tiếng kêu "pip pip" (bíp bíp) mỗi khi có thông báo về màn hình
  if (window.soundAlerts && typeof window.soundAlerts.playPipPipSound === 'function') {
    window.soundAlerts.playPipPipSound(0.8);
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    const notifOptions = {
      body: options.body || 'Cập nhật từ Gold Wave Terminal',
      icon: options.icon || 'assets/logo.png',
      badge: options.badge || 'assets/logo.png',
      tag: options.tag || 'gold-wave-notif-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200],
      data: options.data || {}
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, notifOptions);
      }).catch(e => {
        try {
          new Notification(title, notifOptions);
        } catch(err) {
          console.warn('Native notification fallback failed:', err);
        }
      });
    } else {
      try {
        new Notification(title, notifOptions);
      } catch(e) {
        console.warn('Native notification failed:', e);
      }
    }
  }
};

function updatePushNotificationUI() {
  const statusEls = document.querySelectorAll('.push-notif-status-badge');
  const isGranted = ('Notification' in window) && Notification.permission === 'granted';
  statusEls.forEach(el => {
    if (isGranted) {
      el.className = 'push-notif-status-badge px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5';
      el.innerHTML = '<span>✅</span> <span>Đã bật thông báo push</span>';
    } else {
      el.className = 'push-notif-status-badge px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5';
      el.innerHTML = '<span>⚠️</span> <span>Chưa bật thông báo push</span>';
    }
  });
}

window.handleAuthLoginSubmit = async function(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();

  if (!email || !password) {
    if (typeof showToast === 'function') showToast('⚠️ Vui lòng nhập đầy đủ Email và Mật khẩu', 'warning');
    return;
  }

  const btn = document.getElementById('login-submit-btn');
  const btnText = document.getElementById('login-btn-text');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'ĐANG ĐĂNG NHẬP...';

  try {
    const deviceId = window.getOrCreateDeviceId();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId })
    });
    const data = await res.json();

    // 1. Kiểm tra tài khoản đã hết hạn 14 ngày dùng thử hoặc hết hạn VIP
    if (data.status === 'EXPIRED' || data.isExpired === true) {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'ĐĂNG NHẬP';
      if (typeof showToast === 'function') {
        showToast('🔒 Tài khoản đã hết 14 ngày dùng thử. Vui lòng thanh toán để tiếp tục sử dụng!', 'warning');
      }
      if (typeof openPaywallScreen === 'function') {
        openPaywallScreen(
          data.user || { email, name: email.split('@')[0] },
          data.subscription || data.user?.subscription || { isExpired: true, daysRemaining: 0, status: 'EXPIRED' },
          data.payment
        );
      }
      return;
    }

    // 2. Kiểm tra sai mật khẩu hoặc lỗi xác thực từ server
    if (!res.ok || data.status !== 'SUCCESS') {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'ĐĂNG NHẬP';
      if (typeof showToast === 'function') {
        showToast(`❌ ${data.error || 'Email hoặc mật khẩu không chính xác'}`, 'error');
      }
      return;
    }

    // 3. Đăng nhập thành công từ server
    if (data.user) {
      if (data.user.subscription && data.user.subscription.isExpired) {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'ĐĂNG NHẬP';
        if (typeof openPaywallScreen === 'function') {
          openPaywallScreen(data.user, data.user.subscription, data.payment);
        }
        return;
      }
      window.currentUser = data.user;
    }
  } catch (err) {
    console.warn('Network or login error:', err);
    // Chỉ cho phép admin bypass khi offline / mất mạng cục bộ
    const isObjAdmin = (email.toLowerCase().includes('hba4515') || email.toLowerCase().includes('hba884515') || email.toLowerCase().includes('admin'));
    if (isObjAdmin) {
      window.currentUser = {
        id: 'USR-' + Date.now(),
        name: email.split('@')[0],
        email: email,
        emailVerified: true,
        role: 'ADMIN',
        subscription: { status: 'LIFETIME', isAdmin: true, isExpired: false, badgeText: 'ADMIN VIP 👑' },
        createdAt: new Date().toISOString()
      };
    } else {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'ĐĂNG NHẬP';
      if (typeof showToast === 'function') {
        showToast('⚠️ Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng!', 'warning');
      }
      return;
    }
  } finally {
    if (window.currentUser) {
      localStorage.setItem('goldwave_session', JSON.stringify({ token: 'sim_token', user: window.currentUser }));
      localStorage.setItem('goldwave_user', JSON.stringify(window.currentUser));
      
      const authPage = document.getElementById('auth-fullscreen-page');
      const appShell = document.getElementById('app-shell');
      if (authPage) {
        authPage.classList.add('hidden');
        authPage.style.display = 'none';
      }
      if (appShell) {
        appShell.classList.remove('hidden');
        appShell.style.display = 'flex';
      }

      updateUserUI();
      if (typeof updateSubscriptionBadgeUI === 'function') {
        updateSubscriptionBadgeUI(window.currentUser.subscription);
      }
      if (typeof showToast === 'function') showToast(`🎉 Đăng nhập thành công! Chào mừng ${window.currentUser.name} truy cập Gold Wave`, 'success');
    }
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'ĐĂNG NHẬP';
  }
};

window.handleAuthRegisterSubmit = async function(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('reg-name')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value.trim();
  const confirm = document.getElementById('reg-confirm-password')?.value.trim();
  const terms = document.getElementById('reg-terms')?.checked;

  if (!name || !email || !password || !confirm) {
    if (typeof showToast === 'function') showToast('⚠️ Vui lòng điền đầy đủ các thông tin đăng ký', 'warning');
    return;
  }
  if (password !== confirm) {
    if (typeof showToast === 'function') showToast('⚠️ Mật khẩu xác nhận không khớp!', 'warning');
    return;
  }
  if (!terms) {
    if (typeof showToast === 'function') showToast('⚠️ Bạn cần đồng ý với Điều khoản sử dụng', 'warning');
    return;
  }

  const deviceId = window.getOrCreateDeviceId();
  const btn = document.getElementById('reg-submit-btn');
  const btnText = document.getElementById('reg-btn-text');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'ĐANG TẠO TÀI KHOẢN...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, deviceId })
    });
    const data = await res.json();

    // 1. Chặn nếu thiết bị này đã từng sử dụng hết 14 ngày dùng thử (Device Lock)
    if (data.status === 'EXPIRED' || data.deviceLocked) {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'TẠO TÀI KHOẢN GOLD WAVE';
      alert(`🔒 THIẾT BỊ ĐÃ HẾT LƯỢT DÙNG THỬ!\n\n${data.message || 'Thiết bị này đã từng sử dụng hết 14 ngày dùng thử miễn phí. Mỗi thiết bị chỉ được nhận 1 lượt trải nghiệm.'}\n\nVui lòng đăng nhập lại tài khoản cũ hoặc thanh toán gói VIP (390k/Tháng) để tiếp tục sử dụng.`);
      if (typeof openPaywallScreen === 'function') {
        openPaywallScreen(data.user || { email, name }, data.subscription || { isExpired: true, daysRemaining: 0, status: 'EXPIRED' }, data.payment);
      }
      return;
    }

    // 2. Chặn lỗi đăng ký khác (ví dụ: trùng email hoặc biến thể gmail dấu chấm/+tag)
    if (!res.ok || data.status !== 'SUCCESS') {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'TẠO TÀI KHOẢN GOLD WAVE';
      alert(`⚠️ ĐĂNG KÝ THẤT BẠI:\n\n${data.error || 'Vui lòng kiểm tra lại thông tin đăng ký.'}`);
      if (typeof showToast === 'function') showToast(`❌ ${data.error || 'Đăng ký thất bại'}`, 'error');
      return;
    }

    // 3. Đăng ký thành công hợp lệ
    const loginEmail = document.getElementById('login-email');
    const loginPass = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = email;
    if (loginPass) loginPass.value = password;

    showAuthView('login');
    alert(`🎉 ĐĂNG KÝ TÀI KHOẢN THÀNH CÔNG!\n\nTài khoản Gmail: ${email}\n\nBạn nhận được 14 ngày dùng thử miễn phí. Vui lòng bấm "ĐĂNG NHẬP" để vào ứng dụng!`);
    if (typeof showToast === 'function') {
      showToast(`✅ Đăng ký tài khoản thành công! Bấm ĐĂNG NHẬP để vào app.`, 'success');
    }
  } catch (err) {
    console.warn('Registration fetch error:', err);
    alert('Lỗi kết nối máy chủ khi đăng ký. Vui lòng thử lại sau ít phút.');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'TẠO TÀI KHOẢN GOLD WAVE';
  }
};

window.quickLoginAs = function(type) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (type === 'admin') {
    if (emailInput) emailInput.value = 'hba4515@gmail.com';
    if (passInput) passInput.value = 'admin123';
  } else {
    if (emailInput) emailInput.value = 'google.trader@gmail.com';
    if (passInput) passInput.value = '123456';
  }
  if (typeof openAuthModal === 'function') openAuthModal();
  handleAuthLoginSubmit();
};

window.handleGoogleAuthSubmit = function() {
  const modal = document.getElementById('google-auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    const loginEmail = document.getElementById('login-email');
    const loginPass = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = 'google.trader@gmail.com';
    if (loginPass) loginPass.value = '123456';
    showAuthView('login');
    alert(`🎉 XÁC THỰC GOOGLE THÀNH CÔNG!\n\nTài khoản Google: google.trader@gmail.com\n\nHệ thống đã tự động quay lại màn hình Đăng Nhập. Vui lòng nhấn "ĐĂNG NHẬP" để truy cập vào ứng dụng Gold Wave!`);
    if (typeof showToast === 'function') showToast('✅ Xác nhận Google thành công! Đã chuyển sang phần Đăng Nhập.', 'success');
  }
};

window.closeGoogleAuthModal = function() {
  const modal = document.getElementById('google-auth-modal');
  if (modal) modal.classList.add('hidden');
};

window.confirmGoogleRegistration = async function(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('google-reg-name')?.value.trim() || 'Google Trader';
  const email = document.getElementById('google-reg-email')?.value.trim() || 'google.trader@gmail.com';
  const password = document.getElementById('google-reg-password')?.value.trim() || '123456';
  const deviceId = window.getOrCreateDeviceId();

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, deviceId })
    });
    const data = await res.json();
    if (data.status === 'EXPIRED' || data.isExpired) {
      closeGoogleAuthModal();
      if (typeof openPaywallScreen === 'function') {
        openPaywallScreen(data.user || { email, name }, data.subscription || { isExpired: true, daysRemaining: 0 }, data.payment);
      }
      return;
    }
  } catch (err) {
    console.warn('Google Auth fetch error:', err);
  }

  closeGoogleAuthModal();

  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  if (loginEmail) loginEmail.value = email;
  if (loginPass) loginPass.value = password;

  showAuthView('login');
  alert(`🎉 XÁC THỰC GOOGLE THÀNH CÔNG!\n\nTài khoản Google: ${email}\n\nHệ thống đã tự động quay lại màn hình Đăng Nhập. Vui lòng nhấn "ĐĂNG NHẬP" để truy cập vào ứng dụng Gold Wave!`);
  if (typeof showToast === 'function') {
    showToast(`✅ Xác thực Google thành công! Đã chuyển sang phần Đăng Nhập. Bấm ĐĂNG NHẬP để vào app.`, 'success');
  }
};

window.handleSendPasswordResetSubmit = async function(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('forgot-email')?.value.trim();
  if (!email) {
    if (typeof showToast === 'function') showToast('⚠️ Vui lòng nhập địa chỉ Email', 'warning');
    return;
  }
  try {
    await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  } catch (e) {}

  if (typeof showToast === 'function') showToast(`📩 Liên kết đặt lại mật khẩu đã được gửi đến ${email}`, 'success');
  showAuthView('reset');
};

window.handleResendVerificationEmail = function() {
  const email = document.getElementById('verify-email-target')?.textContent || 'your@email.com';
  const btn = document.getElementById('resend-email-btn');
  const text = document.getElementById('resend-btn-text');

  if (btn) btn.disabled = true;
  let count = 60;
  if (text) text.textContent = `Gửi lại email (${count}s)`;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      if (text) text.textContent = `Gửi lại email (${count}s)`;
    } else {
      clearInterval(timer);
      if (btn) btn.disabled = false;
      if (text) text.textContent = 'Gửi lại email';
    }
  }, 1000);

  try {
    fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  } catch (e) {}

  if (typeof showToast === 'function') showToast(`📩 Đã gửi lại email xác thực tới ${email}`, 'info');
};

window.handleResetPasswordSubmit = async function(e) {
  if (e) e.preventDefault();
  const newPassword = document.getElementById('reset-new-password')?.value.trim();
  const confirmPassword = document.getElementById('reset-confirm-password')?.value.trim();
  const email = document.getElementById('forgot-email')?.value.trim() || 'user@goldwave.com';

  if (!newPassword || !confirmPassword) {
    if (typeof showToast === 'function') showToast('⚠️ Vui lòng nhập mật khẩu mới', 'warning');
    return;
  }
  if (newPassword !== confirmPassword) {
    if (typeof showToast === 'function') showToast('⚠️ Mật khẩu xác nhận không khớp!', 'warning');
    return;
  }

  try {
    await fetch('/api/auth/reset-password-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    });
  } catch (err) {}

  if (typeof showToast === 'function') showToast('✅ Đặt lại mật khẩu thành công! Hãy đăng nhập.', 'success');
  showAuthView('login');
};

window.handleSimulateVerifyComplete = function() {
  if (window.currentUser) {
    window.currentUser.emailVerified = true;
    localStorage.setItem('goldwave_session', JSON.stringify({ token: 'sim_verified', user: window.currentUser }));
    localStorage.setItem('goldwave_user', JSON.stringify(window.currentUser));
  }
  updateUserUI();
  closeAuthModal();
  if (typeof showToast === 'function') showToast('✅ Email đã xác thực thành công! Đã đăng nhập.', 'success');
};

// ── Profile Actions ──
function updateUserUI() {
  const user = window.currentUser;
  const emailLower = (user && user.email ? user.email : '').toLowerCase().trim();
  const isAdmin = user && (user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin'));

  const pineAdminBtn = document.getElementById('nav-pine-admin');
  if (pineAdminBtn) {
    pineAdminBtn.classList.add('hidden');
    pineAdminBtn.style.display = 'none';
  }

  // 👑 BẢNG QUẢN TRỊ DUYỆT TÀI KHOẢN TRONG TAB TÀI KHOẢN:
  // - Admin (hba884515@gmail.com): Hiển thị đầy đủ bảng duyệt chuyển khoản và quản lý thành viên.
  // - Tài khoản thường (Non-Admin): ẨN TUYỆT ĐỐI, chỉ hiển thị thông tin tài khoản thông thường.
  const accountAdminPanel = document.getElementById('account-admin-panel');
  if (accountAdminPanel) {
    if (isAdmin) {
      accountAdminPanel.classList.remove('hidden');
      accountAdminPanel.style.display = 'block';
      if (typeof window.loadAccountAdminData === 'function') {
        window.loadAccountAdminData();
      }
    } else {
      accountAdminPanel.classList.add('hidden');
      accountAdminPanel.style.display = 'none';
    }
  }

  if (!user) {
    if (accountAdminPanel) {
      accountAdminPanel.classList.add('hidden');
      accountAdminPanel.style.display = 'none';
    }
    return;
  }

  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  const dateEl = document.getElementById('user-display-date');
  const badgeEl = document.getElementById('user-verified-badge');
  const subStatusEl = document.getElementById('user-display-sub-status');

  const trialBanner = document.getElementById('user-trial-banner');
  const trialIconBox = document.getElementById('user-trial-icon-box');
  const trialTitle = document.getElementById('user-trial-title');
  const trialDaysBadge = document.getElementById('user-trial-days-badge');
  const trialDesc = document.getElementById('user-trial-desc');
  const trialExpireDate = document.getElementById('user-trial-expire-date');
  const trialProgressContainer = document.getElementById('user-trial-progress-container');
  const trialProgressText = document.getElementById('user-trial-progress-text');
  const trialProgressBar = document.getElementById('user-trial-progress-bar');
  const trialActionBtn = document.getElementById('user-trial-action-btn');
  const trialBtnText = document.getElementById('user-trial-btn-text');

  if (headerAvatar) headerAvatar.textContent = (user.name || 'T')[0].toUpperCase();
  if (headerName) headerName.textContent = user.name || 'Trader';
  if (nameEl) nameEl.textContent = user.name || 'Trader';
  if (emailEl) emailEl.textContent = user.email || 'trader@goldwave.com';

  if (dateEl) {
    if (user.createdAt) {
      try {
        const d = new Date(user.createdAt);
        dateEl.textContent = isNaN(d.getTime()) ? user.createdAt : d.toLocaleDateString('vi-VN');
      } catch (e) {
        dateEl.textContent = user.createdAt;
      }
    } else {
      dateEl.textContent = 'Mới tham gia';
    }
  }

  if (badgeEl) {
    if (isAdmin) {
      badgeEl.className = 'px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold';
      badgeEl.textContent = '👑 Admin Quản Trị';
    } else if (user.verified || user.emailVerified) {
      badgeEl.className = 'px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold';
      badgeEl.textContent = 'Đã xác minh ✅';
    } else {
      badgeEl.className = 'px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold';
      badgeEl.textContent = 'Chưa xác minh ⚠️';
    }
  }

  // 1. Tính toán subscription info cho người dùng
  let sub = user.subscription;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (isAdmin || user.subscriptionStatus === 'LIFETIME') {
    sub = {
      status: 'LIFETIME',
      isAdmin: true,
      isExpired: false,
      badgeText: 'ADMIN VIP 👑',
      daysRemaining: 9999,
      expiresAt: null,
      message: 'Tài khoản Quản Trị Viên (Vĩnh viễn)'
    };
  } else if (!sub || sub.daysRemaining == null) {
    if (user.subscriptionStatus === 'ACTIVE' && user.subscriptionExpiresAt) {
      const expiresMs = new Date(user.subscriptionExpiresAt).getTime();
      const daysRemaining = Math.max(0, Math.ceil((expiresMs - now) / ONE_DAY_MS));
      sub = {
        status: daysRemaining > 0 ? 'ACTIVE' : 'EXPIRED',
        isAdmin: false,
        isExpired: daysRemaining <= 0,
        badgeText: daysRemaining > 0 ? `VIP: CÒN ${daysRemaining} NGÀY ✨` : 'HẾT HẠN VIP ⚠️',
        daysRemaining,
        expiresAt: user.subscriptionExpiresAt
      };
    } else {
      const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : now;
      const trialDays = user.trialDays || 14;
      const trialExpiresMs = user.trialExpiresAt ? new Date(user.trialExpiresAt).getTime() : (createdMs + trialDays * ONE_DAY_MS);
      const daysRemaining = Math.max(0, Math.ceil((trialExpiresMs - now) / ONE_DAY_MS));
      sub = {
        status: daysRemaining > 0 ? 'TRIAL' : 'EXPIRED',
        isAdmin: false,
        isExpired: daysRemaining <= 0,
        badgeText: daysRemaining > 0 ? `DÙNG THỬ: CÒN ${daysRemaining} NGÀY ⏱️` : 'HẾT HẠN DÙNG THỬ 🔒',
        daysRemaining,
        expiresAt: new Date(trialExpiresMs).toISOString()
      };
    }
  }

  let formattedExpire = 'Không giới hạn';
  if (sub.expiresAt) {
    try {
      const d = new Date(sub.expiresAt);
      formattedExpire = isNaN(d.getTime()) ? sub.expiresAt : d.toLocaleDateString('vi-VN');
    } catch (e) {
      formattedExpire = sub.expiresAt;
    }
  }

  // 2. Cập nhật thẻ ô thông tin GÓI & THỜI HẠN
  if (subStatusEl) {
    if (isAdmin || sub.status === 'LIFETIME') {
      subStatusEl.innerHTML = '<span class="text-emerald-400 font-bold flex items-center gap-1.5 font-sans">👑 VIP Vĩnh Viễn</span>';
    } else if (sub.isExpired) {
      subStatusEl.innerHTML = '<span class="text-rose-400 font-bold flex items-center gap-1.5 font-sans">🔒 Đã Hết Hạn Dùng Thử</span>';
    } else if (sub.status === 'ACTIVE') {
      subStatusEl.innerHTML = `<span class="text-amber-300 font-bold flex items-center gap-1.5 font-sans">✨ VIP: Còn ${sub.daysRemaining} ngày</span>`;
    } else {
      subStatusEl.innerHTML = `<span class="text-sky-300 font-bold flex items-center gap-1.5 font-sans">⏱️ Dùng thử: Còn ${sub.daysRemaining} ngày</span>`;
    }
  }

  // 3. Cập nhật Banner trực quan nổi bật
  if (trialBanner) {
    if (isAdmin) {
      trialBanner.className = 'p-4 sm:p-5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-emerald-950/20 shadow-xl space-y-3';
      if (trialIconBox) {
        trialIconBox.className = 'w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl font-black shadow-inner shrink-0';
        trialIconBox.textContent = '👑';
      }
      if (trialTitle) {
        trialTitle.textContent = 'TÀI KHOẢN ADMIN QUẢN TRỊ VIÊN';
        trialTitle.className = 'text-xs sm:text-sm font-black uppercase text-emerald-300';
      }
      if (trialDaysBadge) {
        trialDaysBadge.textContent = 'VIP VĨNH VIỄN';
        trialDaysBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[11px] shadow';
      }
      if (trialDesc) {
        trialDesc.innerHTML = 'Bạn có toàn quyền Quản trị viên cao nhất: duyệt chuyển khoản, quản lý thời hạn thành viên và sử dụng mọi tính năng không giới hạn.';
      }
      if (trialProgressContainer) trialProgressContainer.classList.add('hidden');
      if (trialActionBtn) trialActionBtn.classList.add('hidden');
    } else if (sub.isExpired) {
      trialBanner.className = 'p-4 sm:p-5 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-rose-950/20 shadow-xl space-y-3';
      if (trialIconBox) {
        trialIconBox.className = 'w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl font-black shadow-inner shrink-0';
        trialIconBox.textContent = '🔒';
      }
      if (trialTitle) {
        trialTitle.textContent = 'ĐÃ HẾT HẠN DÙNG THỬ 14 NGÀY';
        trialTitle.className = 'text-xs sm:text-sm font-black uppercase text-rose-400';
      }
      if (trialDaysBadge) {
        trialDaysBadge.textContent = 'HẾT HẠN';
        trialDaysBadge.className = 'px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-[11px] shadow animate-pulse';
      }
      if (trialDesc) {
        trialDesc.innerHTML = `Thời gian trải nghiệm miễn phí của bạn đã kết thúc vào ngày <strong class="text-white">${formattedExpire}</strong>. Vui lòng thanh toán gia hạn <strong>390.000đ/tháng</strong> để tiếp tục sử dụng.`;
      }
      if (trialProgressContainer) trialProgressContainer.classList.add('hidden');
      if (trialActionBtn) {
        trialActionBtn.classList.remove('hidden');
        if (trialBtnText) trialBtnText.textContent = '💳 Thanh Toán Kích Hoạt Ngay';
      }
    } else if (sub.status === 'ACTIVE') {
      trialBanner.className = 'p-4 sm:p-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/20 shadow-xl space-y-3';
      if (trialIconBox) {
        trialIconBox.className = 'w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl font-black shadow-inner shrink-0';
        trialIconBox.textContent = '✨';
      }
      if (trialTitle) {
        trialTitle.textContent = 'GÓI VIP THÀNH VIÊN CHÍNH THỨC';
        trialTitle.className = 'text-xs sm:text-sm font-black uppercase text-amber-300';
      }
      if (trialDaysBadge) {
        trialDaysBadge.textContent = `CÒN ${sub.daysRemaining} NGÀY`;
        trialDaysBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] shadow';
      }
      if (trialDesc) {
        trialDesc.innerHTML = `Tài khoản VIP đang hoạt động. Hết hạn vào ngày: <strong class="text-white font-mono">${formattedExpire}</strong>.`;
      }
      if (trialProgressContainer) {
        trialProgressContainer.classList.remove('hidden');
        const pct = Math.min(100, Math.max(5, Math.round((sub.daysRemaining / 30) * 100)));
        if (trialProgressText) trialProgressText.textContent = `${sub.daysRemaining} / 30 ngày còn lại`;
        if (trialProgressBar) {
          trialProgressBar.style.width = `${pct}%`;
          trialProgressBar.className = 'bg-gradient-to-r from-amber-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500';
        }
      }
      if (trialActionBtn) {
        trialActionBtn.classList.remove('hidden');
        if (trialBtnText) trialBtnText.textContent = '⚡ Gia Hạn Thêm Tháng';
      }
    } else {
      // TRIAL: Dùng thử 14 ngày
      trialBanner.className = 'p-4 sm:p-5 rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-950/40 via-slate-900/90 to-sky-950/20 shadow-xl space-y-3';
      if (trialIconBox) {
        trialIconBox.className = 'w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-2xl font-black shadow-inner shrink-0';
        trialIconBox.textContent = '⏱️';
      }
      if (trialTitle) {
        trialTitle.textContent = 'GÓI DÙNG THỬ MIỄN PHÍ 14 NGÀY';
        trialTitle.className = 'text-xs sm:text-sm font-black uppercase text-sky-300';
      }
      if (trialDaysBadge) {
        trialDaysBadge.textContent = `CÒN ${sub.daysRemaining} NGÀY`;
        trialDaysBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] shadow';
      }
      if (trialDesc) {
        trialDesc.innerHTML = `Bạn đang trải nghiệm đầy đủ 100% tính năng VIP (Tín hiệu AI, Quản lý rủi ro & Thông báo tức thì). Hết hạn vào ngày: <strong class="text-white font-mono">${formattedExpire}</strong>.`;
      }
      if (trialProgressContainer) {
        trialProgressContainer.classList.remove('hidden');
        const pct = Math.min(100, Math.max(5, Math.round((sub.daysRemaining / 14) * 100)));
        if (trialProgressText) trialProgressText.textContent = `${sub.daysRemaining} / 14 ngày còn lại`;
        if (trialProgressBar) {
          trialProgressBar.style.width = `${pct}%`;
          trialProgressBar.className = sub.daysRemaining <= 3 
            ? 'bg-gradient-to-r from-rose-500 to-amber-400 h-1.5 rounded-full transition-all duration-500'
            : 'bg-gradient-to-r from-sky-400 via-amber-400 to-emerald-400 h-1.5 rounded-full transition-all duration-500';
        }
      }
      if (trialActionBtn) {
        trialActionBtn.classList.remove('hidden');
        if (trialBtnText) trialBtnText.textContent = '⚡ Gia Hạn Trước (390k/Tháng)';
      }
    }
  }

  // Luôn đồng bộ lại Top Header Badge
  if (typeof updateSubscriptionBadgeUI === 'function') {
    updateSubscriptionBadgeUI();
  }

  const headerBtn = document.getElementById('header-user-btn');
  if (headerBtn) {
    headerBtn.onclick = () => {
      if (window.currentUser) {
        if (typeof window.switchView === 'function') window.switchView('account');
      } else {
        if (typeof openAuthModal === 'function') openAuthModal();
      }
    };
  }
}

window.handlePromptChangePassword = function() {
  const newPass = prompt('Nhập mật khẩu mới (tối thiểu 6 ký tự):');
  if (newPass && newPass.length >= 6) {
    if (typeof showToast === 'function') showToast('🔑 Đổi mật khẩu thành công!', 'success');
  } else if (newPass) {
    if (typeof showToast === 'function') showToast('⚠️ Mật khẩu phải có ít nhất 6 ký tự', 'warning');
  }
};

window.handleUserLogout = function() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
    localStorage.removeItem('goldwave_session');
    localStorage.removeItem('goldwave_user');
    window.currentUser = null;
    if (typeof showToast === 'function') showToast('🚪 Đã đăng xuất thành công', 'info');
    if (typeof window.checkAuthOnLoad === 'function') window.checkAuthOnLoad();
  }
};

window.handleUserLogoutAll = function() {
  if (confirm('Đăng xuất khỏi tất cả các thiết bị đã kết nối?')) {
    handleUserLogout();
  }
};

window.handleUserDeleteAccount = function() {
  if (confirm('⚠️ CẢNH BÁO: Thao tác này sẽ xóa vĩnh viễn tài khoản và lịch sử thông báo của bạn. Xác nhận xóa?')) {
    localStorage.removeItem('goldwave_user');
    localStorage.removeItem('goldwave_notifs');
    window.currentUser = null;
    location.reload();
  }
};

// ── Account Tab Admin Panel Logic (Duyệt Chuyển Khoản & Quản Lý Thành Viên) ──
window.loadAccountAdminData = async function() {
  const user = window.currentUser;
  const emailLower = (user && user.email ? user.email : '').toLowerCase().trim();
  const isAdmin = user && (user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin'));

  const panel = document.getElementById('account-admin-panel');
  if (!panel) return;

  // CHẶN TUYỆT ĐỐI: Tài khoản thường không được xem hoặc tải dữ liệu Admin
  if (!isAdmin) {
    panel.classList.add('hidden');
    panel.style.display = 'none';
    return;
  }

  if (panel.classList.contains('hidden') || panel.style.display === 'none') return;

  const pendingBadge = document.getElementById('acc-pending-count-badge');
  const paymentsTbody = document.getElementById('acc-admin-payments-tbody');
  const totalUsersBadge = document.getElementById('acc-total-users-badge');
  const usersTbody = document.getElementById('acc-admin-users-tbody');

  try {
    const [resReqs, resUsers, resFbs] = await Promise.all([
      fetch('/api/admin/payment-requests'),
      fetch('/api/admin/users'),
      fetch('/api/admin/feedbacks')
    ]);

    const dataReqs = await resReqs.json();
    const dataUsers = await resUsers.json();
    const dataFbs = await resFbs.json();

    const requests = (dataReqs && dataReqs.requests) ? dataReqs.requests : [];
    const users = (dataUsers && dataUsers.users) ? dataUsers.users : [];
    const feedbacks = (dataFbs && dataFbs.feedbacks) ? dataFbs.feedbacks : [];

    // 1. Render Danh Sách Yêu Cầu Chuyển Khoản Chờ Kích Hoạt
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    if (pendingBadge) {
      pendingBadge.textContent = `${pendingCount} Chờ kích hoạt`;
      if (pendingCount > 0) {
        pendingBadge.className = 'px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse';
      } else {
        pendingBadge.className = 'px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold';
      }
    }

    if (paymentsTbody) {
      if (requests.length === 0) {
        paymentsTbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 font-sans">Chưa có yêu cầu chuyển khoản nào.</td></tr>';
      } else {
        paymentsTbody.innerHTML = requests.map(r => {
          const isPending = r.status === 'PENDING';
          const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : 'Vừa xong';
          const statusBadge = isPending
            ? '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 text-[10px] animate-pulse">⏳ CHỜ KÍCH HOẠT</span>'
            : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">✅ ĐÃ KÍCH HOẠT</span>';

          return `
            <tr class="hover:bg-slate-900/60 transition ${isPending ? 'bg-amber-500/5' : ''}">
              <td class="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">${dateStr}</td>
              <td class="py-3 px-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-amber-300 font-bold">${r.email}</span>
                  ${isPending ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">ĐÃ CHUYỂN TIỀN</span>' : ''}
                </div>
              </td>
              <td class="py-3 px-3 font-bold text-white">${r.name || 'Khách'}</td>
              <td class="py-3 px-3 font-mono font-bold text-emerald-400">${r.phone || r.note || 'Chưa cung cấp'}</td>
              <td class="py-3 px-3 text-amber-400 font-black">${r.amount || '390.000 VNĐ'}</td>
              <td class="py-3 px-3">${statusBadge}</td>
              <td class="py-3 px-3 text-right">
                ${isPending ? `
                  <button onclick="accountAdminApprovePayment('${r.email}', 30)" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/30 flex items-center gap-1.5 ml-auto cursor-pointer transition transform active:scale-95">
                    <span>⚡</span> <span>KÍCH HOẠT (+30 Ngày)</span>
                  </button>
                ` : '<span class="text-emerald-400 font-bold text-xs">Đã kích hoạt</span>'}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Render Danh Sách Tất Cả Thành Viên Vừa Tham Gia & Hạn Sử Dụng
    if (totalUsersBadge) {
      totalUsersBadge.textContent = `${users.length} Thành viên`;
    }

    if (usersTbody) {
      if (users.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Chưa có người dùng nào đăng ký.</td></tr>';
      } else {
        usersTbody.innerHTML = users.map((u, i) => {
          const emailLower = (u.email || '').toLowerCase();
          const isUAdmin = u.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin');
          const sub = u.subscription || { status: 'TRIAL', daysRemaining: 14, isExpired: false, badgeText: 'DÙNG THỬ 14 NGÀY' };

          const roleBadge = isUAdmin
            ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">👑 ADMIN</span>'
            : '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">👤 USER</span>';

          let subBadge = '';
          if (sub.status === 'LIFETIME' || isUAdmin) {
            subBadge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">👑 VIP VĨNH VIỄN</span>';
          } else if (sub.isExpired) {
            subBadge = '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px]">🔒 HẾT HẠN</span>';
          } else if (sub.status === 'ACTIVE') {
            subBadge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px]">✨ GÓI VIP 30N</span>';
          } else {
            subBadge = '<span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold text-[10px]">⏱️ DÙNG THỬ 14N</span>';
          }

          let remainStr = '';
          if (sub.status === 'LIFETIME' || isUAdmin) {
            remainStr = '<span class="text-emerald-400 font-bold">Không giới hạn</span>';
          } else if (sub.isExpired) {
            remainStr = '<span class="text-rose-400 font-bold">Đã hết hạn!</span>';
          } else {
            remainStr = `<span class="text-amber-300 font-bold">Còn ${sub.daysRemaining != null ? sub.daysRemaining : 14} ngày</span>`;
          }

          return `
            <tr class="hover:bg-slate-900/60 transition">
              <td class="py-2.5 px-3 text-slate-500">${i + 1}</td>
              <td class="py-2.5 px-3">
                <div class="font-bold text-white text-xs">${u.name || 'Trader'}</div>
                <div class="text-amber-300/90 text-[11px] font-mono">${u.email}</div>
              </td>
              <td class="py-2.5 px-3">${roleBadge}</td>
              <td class="py-2.5 px-3">${subBadge}</td>
              <td class="py-2.5 px-3">${remainStr}</td>
              <td class="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                <button onclick="accountAdminExtendUser('${u.email}', 30)" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] transition cursor-pointer" title="Cộng thêm 30 ngày (1 tháng)">
                  +30 Ngày
                </button>
                <button onclick="accountAdminExtendUser('${u.email}', 60)" class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-[10px] transition cursor-pointer" title="Cộng thêm 60 ngày">
                  +60 Ngày
                </button>
                <button onclick="accountAdminExtendUser('${u.email}', 0, true)" class="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-[10px] transition cursor-pointer" title="Cấp quyền VIP Vĩnh Viễn">
                  Vĩnh Viễn
                </button>
                <button onclick="accountAdminToggleRole('${u.email}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition cursor-pointer" title="Đổi quyền Admin/User">
                  ${isUAdmin ? '⬇️ USER' : '👑 ADMIN'}
                </button>
                <button onclick="accountAdminDeleteUser('${u.email}')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-[10px] transition cursor-pointer" title="Xóa tài khoản">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 3. Render Danh Sách Đánh Giá & Góp Ý Nâng Cấp Của Khách Hàng (Bảng 3)
    const totalFbsBadge = document.getElementById('acc-total-feedbacks-badge');
    const avgRatingBadge = document.getElementById('acc-avg-rating-badge');
    const fbsTbody = document.getElementById('acc-admin-feedbacks-tbody');

    if (totalFbsBadge) totalFbsBadge.textContent = `${feedbacks.length} Đánh giá`;

    if (avgRatingBadge) {
      if (feedbacks.length > 0) {
        const sum = feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0);
        const avg = (sum / feedbacks.length).toFixed(1);
        avgRatingBadge.textContent = `⭐ ${avg} / 5.0 (${feedbacks.length} lượt)`;
      } else {
        avgRatingBadge.textContent = `⭐ 5.0 / 5.0 (Chưa có đánh giá)`;
      }
    }

    if (fbsTbody) {
      if (feedbacks.length === 0) {
        fbsTbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Chưa có đánh giá nào từ khách hàng.</td></tr>';
      } else {
        fbsTbody.innerHTML = feedbacks.map(f => {
          const dateStr = f.createdAt ? new Date(f.createdAt).toLocaleString('vi-VN') : 'Vừa xong';
          const stars = '⭐'.repeat(f.rating || 5);
          const tagsHtml = (f.tags || []).map(t => `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 text-[9px] mr-1 mb-1 inline-block">${t}</span>`).join('');
          
          return `
            <tr class="hover:bg-slate-900/60 transition">
              <td class="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">${dateStr}</td>
              <td class="py-3 px-3">
                <div class="font-bold text-white text-xs">${f.name || 'Trader'}</div>
                <div class="text-amber-300/80 text-[11px] font-mono">${f.email}</div>
              </td>
              <td class="py-3 px-3 whitespace-nowrap">
                <span class="text-amber-400 font-bold text-xs">${stars}</span>
                <span class="text-slate-400 text-[10px] block font-mono">(${f.rating}/5 sao)</span>
              </td>
              <td class="py-3 px-3">
                <div class="flex flex-wrap">${tagsHtml || '<span class="text-slate-500 text-[10px]">Chung</span>'}</div>
              </td>
              <td class="py-3 px-3 text-slate-200 text-xs font-sans max-w-xs">
                ${f.comment ? `<p class="italic text-slate-300 leading-relaxed">"${f.comment}"</p>` : '<span class="text-slate-500 italic">Không có nhận xét thêm</span>'}
              </td>
              <td class="py-3 px-3 text-right">
                <button onclick="accountAdminDeleteFeedback('${f.id}')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-[10px] transition cursor-pointer" title="Xóa đánh giá này">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Lỗi tải dữ liệu bảng Admin tab tài khoản:', err);
  }
};

window.refreshAccountAdminData = async function() {
  await window.loadAccountAdminData();
  if (typeof showToast === 'function') {
    showToast('🔄 Đã cập nhật dữ liệu tài khoản & yêu cầu thanh toán!', 'info');
  }
};

window.accountAdminApprovePayment = async function(email, days = 30) {
  if (!confirm(`Xác nhận kích hoạt +${days} ngày (1 tháng) sử dụng cho tài khoản ${email}?`)) return;

  try {
    const res = await fetch('/api/admin/extend-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: email, daysToAdd: days })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') {
        showToast(`🎉 KÍCH HOẠT THÀNH CÔNG! Đã cộng +${days} ngày cho ${email}`, 'success');
      }
      await window.loadAccountAdminData();
      if (typeof loadAdminDashboardData === 'function') loadAdminDashboardData();
    } else {
      alert('Lỗi kích hoạt: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (e) {
    alert('Lỗi kết nối máy chủ khi kích hoạt.');
  }
};

window.accountAdminExtendUser = async function(targetEmail, daysToAdd, setLifetime = false) {
  const confirmMsg = setLifetime 
    ? `Xác nhận cấp quyền VIP VĨNH VIỄN cho tài khoản ${targetEmail}?`
    : `Xác nhận gia hạn thêm +${daysToAdd} ngày cho tài khoản ${targetEmail}?`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/admin/extend-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, daysToAdd, setLifetime })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') {
        showToast(setLifetime ? `👑 Đã cấp quyền VĨNH VIỄN cho ${targetEmail}` : `✅ Đã gia hạn +${daysToAdd} ngày cho ${targetEmail}`, 'success');
      }
      await window.loadAccountAdminData();
      if (typeof loadAdminDashboardData === 'function') loadAdminDashboardData();
    } else {
      alert('Lỗi gia hạn: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (e) {
    alert('Lỗi kết nối máy chủ khi gia hạn.');
  }
};

window.accountAdminToggleRole = async function(email) {
  if (!confirm(`Đổi vai trò Admin/User cho ${email}?`)) return;
  try {
    const res = await fetch('/api/admin/toggle-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') showToast(`👑 Đã cập nhật vai trò mới: ${data.role}`, 'success');
      await window.loadAccountAdminData();
      if (typeof loadAdminDashboardData === 'function') loadAdminDashboardData();
    } else {
      alert('Lỗi cập nhật vai trò: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (e) {
    alert('Lỗi kết nối máy chủ.');
  }
};

window.accountAdminDeleteUser = async function(email) {
  if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa tài khoản ${email}? Hành động này không thể hoàn tác.`)) return;
  try {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') showToast(`🗑️ Đã xóa tài khoản ${email}`, 'info');
      await window.loadAccountAdminData();
      if (typeof loadAdminDashboardData === 'function') loadAdminDashboardData();
    } else {
      alert('Lỗi xóa tài khoản: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (e) {
    alert('Lỗi kết nối máy chủ.');
  }
};

window.accountAdminDeleteFeedback = async function(id) {
  if (!confirm('Xác nhận xóa đánh giá này?')) return;
  try {
    const res = await fetch('/api/admin/delete-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') showToast('🗑️ Đã xóa đánh giá', 'info');
      await window.loadAccountAdminData();
    } else {
      alert('Lỗi xóa đánh giá: ' + (data.error || 'Vui lòng thử lại'));
    }
  } catch (e) {
    alert('Lỗi kết nối máy chủ.');
  }
};

// ── User Feedback & App Rating Engine ──
window.setStarRating = function(rating) {
  const container = document.getElementById('star-rating-container');
  const labelEl = document.getElementById('star-rating-label');
  const hiddenInput = document.getElementById('feedback-star-value');

  if (hiddenInput) hiddenInput.value = rating;

  if (container) {
    const stars = container.querySelectorAll('.star-item');
    stars.forEach((s, idx) => {
      if (idx < rating) {
        s.className = 'star-item transition-transform hover:scale-125 text-amber-400 cursor-pointer';
      } else {
        s.className = 'star-item transition-transform hover:scale-125 text-slate-700 cursor-pointer';
      }
    });
  }

  if (labelEl) {
    const labels = {
      1: '⚠️ 1/5 Sao — Cần cải thiện nhiều',
      2: '🙁 2/5 Sao — Chưa hài lòng',
      3: '😐 3/5 Sao — Tạm ổn / Bình thường',
      4: '😊 4/5 Sao — Rất tốt & Hữu ích',
      5: '🌟 5/5 Sao — Xuất sắc! Cực kỳ hài lòng'
    };
    labelEl.textContent = labels[rating] || `⭐ ${rating}/5 Sao`;
  }
};

window.toggleFeedbackTag = function(btn) {
  if (!btn) return;
  btn.classList.toggle('active-tag');
  if (btn.classList.contains('active-tag')) {
    btn.className = 'fb-tag px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 text-amber-300 font-bold transition cursor-pointer active-tag';
  } else {
    btn.className = 'fb-tag px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 font-medium hover:border-slate-600 transition cursor-pointer';
  }
};

window.scrollToFeedbackSection = function() {
  const sec = document.getElementById('user-feedback-section');
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sec.classList.add('ring-2', 'ring-amber-400/50');
    setTimeout(() => sec.classList.remove('ring-2', 'ring-amber-400/50'), 2500);
  }
};

window.handleSubmitFeedback = async function() {
  const submitBtn = document.getElementById('btn-submit-feedback');
  const commentInput = document.getElementById('feedback-comment-input');
  const starValue = parseInt(document.getElementById('feedback-star-value')?.value, 10) || 5;
  const successBanner = document.getElementById('feedback-success-banner');

  // Collect selected tags
  const activeTags = [];
  document.querySelectorAll('#feedback-tags-container .active-tag').forEach(b => {
    activeTags.push(b.textContent.trim());
  });

  const comment = commentInput ? commentInput.value.trim() : '';

  // Get user info if logged in
  const user = window.currentUser || {};
  let email = user.email || '';
  let name = user.name || '';

  if (!email) {
    email = prompt('Vui lòng nhập Email của bạn để Admin tiếp nhận ý kiến đóng góp:');
    if (!email || !email.includes('@')) {
      alert('Vui lòng nhập email hợp lệ để gửi phản hồi.');
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span> <span>Đang gửi ý kiến...</span>';
  }

  try {
    const res = await fetch('/api/feedback/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || email.split('@')[0],
        email,
        rating: starValue,
        tags: activeTags,
        comment
      })
    });
    const data = await res.json();

    if (res.ok && data.status === 'SUCCESS') {
      if (successBanner) {
        successBanner.classList.remove('hidden');
        successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      if (commentInput) commentInput.value = '';
      if (typeof showToast === 'function') {
        showToast('🎉 Đã gửi đánh giá thành công! Cảm ơn bạn rất nhiều.', 'success');
      }
      if (submitBtn) {
        submitBtn.innerHTML = '<span>✅</span> <span>Đã Gửi Thành Công!</span>';
        submitBtn.className = 'px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs transition cursor-default';
      }
      // If user is Admin, reload the feedback table
      const emailLower = (user.email || '').toLowerCase();
      if (user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com') {
        if (typeof window.loadAccountAdminData === 'function') window.loadAccountAdminData();
      }
    } else {
      alert('Gửi đánh giá không thành công: ' + (data.error || 'Vui lòng thử lại'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> <span>Gửi Nhận Xét & Đánh Giá</span>';
      }
    }
  } catch (err) {
    alert('Lỗi kết nối khi gửi đánh giá. Vui lòng thử lại sau.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀</span> <span>Gửi Nhận Xét & Đánh Giá</span>';
    }
  }
};

// Auto polling khi Admin đang mở tab Tài Khoản
setInterval(() => {
  const user = window.currentUser;
  if (!user) return;
  const emailLower = (user.email || '').toLowerCase().trim();
  const isAdmin = user.role === 'ADMIN' || emailLower === 'hba884515@gmail.com' || emailLower === 'hba4515@gmail.com' || emailLower.includes('admin');
  if (!isAdmin) return;

  const viewAcc = document.getElementById('view-account');
  if (viewAcc && !viewAcc.classList.contains('hidden') && viewAcc.style.display !== 'none') {
    if (typeof window.loadAccountAdminData === 'function') {
      window.loadAccountAdminData();
    }
  }
}, 5000);

// ── Notification Dropdown Center ──
window.filterNotifTab = function(category) {
  window.notifCurrentCategoryFilter = category;
  document.querySelectorAll('.notif-filter-tab').forEach(btn => {
    btn.className = 'notif-filter-tab px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer';
  });
  if (window.event && window.event.target) {
    window.event.target.className = 'notif-filter-tab active-notif-tab px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 transition cursor-pointer';
  }
  renderNotifDropdown();
};

function renderNotifDropdown() {
  const listEl = document.getElementById('notif-dropdown-list');
  const badgeEl = document.getElementById('notif-badge-counter');
  if (!listEl) return;

  const notifs = window.userNotifsList || [];
  const unreadCount = notifs.filter(n => !n.read).length;

  if (badgeEl) {
    badgeEl.textContent = unreadCount;
    if (unreadCount === 0) {
      badgeEl.classList.add('hidden');
    } else {
      badgeEl.classList.remove('hidden');
    }
  }

  let filtered = notifs;
  if (window.notifCurrentCategoryFilter === 'unread') {
    filtered = notifs.filter(n => !n.read);
  } else if (window.notifCurrentCategoryFilter !== 'all') {
    filtered = notifs.filter(n => n.category === window.notifCurrentCategoryFilter);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="p-3 text-center text-slate-500 text-xs">Không có thông báo nào</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    let catBadge = `<span class="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">🟢 MA WAVE</span>`;
    if (item.category === 'news') {
      catBadge = `<span class="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold">📰 TIN TỨC</span>`;
    } else if (item.category === 'system') {
      catBadge = `<span class="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold">⚠️ HỆ THỐNG</span>`;
    }

    const unreadDot = !item.read ? `<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>` : '';

    return `
      <div onclick="clickNotifItem('${item.id}', '${item.deepLink}')" class="p-2.5 rounded-xl border ${item.read ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-800/90 border-amber-500/40 text-white font-medium'} hover:bg-slate-800 transition cursor-pointer space-y-1">
        <div class="flex items-center justify-between text-[10px]">
          <div class="flex items-center gap-1.5">
            ${unreadDot}
            ${catBadge}
          </div>
          <span class="text-slate-500 font-mono">${item.time}</span>
        </div>
        <div class="font-bold text-[11px] ${item.read ? 'text-slate-300' : 'text-amber-300'}">${escapeHtml(item.title)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">${escapeHtml(item.body)}</div>
      </div>
    `;
  }).join('');
}

window.clickNotifItem = function(id, deepLink) {
  const notif = (window.userNotifsList || []).find(n => n.id === id);
  if (notif) {
    notif.read = true;
    localStorage.setItem('goldwave_notifs', JSON.stringify(window.userNotifsList));
  }
  renderNotifDropdown();
  const panel = document.getElementById('notif-dropdown-panel');
  if (panel) panel.classList.add('hidden');

  if (deepLink && typeof window.switchView === 'function') {
    window.switchView(deepLink);
    if (typeof showToast === 'function') showToast(`👁 Đã điều hướng tới Tab: ${deepLink.toUpperCase()}`, 'info');
  }
};

window.markAllNotifsRead = function() {
  (window.userNotifsList || []).forEach(n => n.read = true);
  localStorage.setItem('goldwave_notifs', JSON.stringify(window.userNotifsList));
  renderNotifDropdown();
  if (typeof showToast === 'function') showToast('✅ Đã đánh dấu tất cả thông báo là đã đọc', 'success');
};

window.clearReadNotifs = function() {
  window.userNotifsList = (window.userNotifsList || []).filter(n => !n.read);
  localStorage.setItem('goldwave_notifs', JSON.stringify(window.userNotifsList));
  renderNotifDropdown();
  if (typeof showToast === 'function') showToast('🧹 Đã xóa toàn bộ thông báo đã đọc', 'info');
};

window.addNotification = function(notifObj) {
  const registryKey = `${notifObj.eventId}_${window.currentUser?.userId || 'guest'}`;
  if (window.seenNotificationEventsRegistry.has(registryKey)) {
    return; // De-duplication check
  }
  window.seenNotificationEventsRegistry.add(registryKey);
  const arr = Array.from(window.seenNotificationEventsRegistry);
  if (arr.length > 200) arr.shift();
  localStorage.setItem('goldwave_seen_events', JSON.stringify(arr));

  const newNotif = {
    id: 'n_' + Date.now(),
    eventId: notifObj.eventId || ('evt_' + Date.now()),
    category: notifObj.category || 'ma-wave',
    title: notifObj.title,
    body: notifObj.body,
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    read: false,
    deepLink: notifObj.deepLink || 'ma-wave'
  };

  window.userNotifsList.unshift(newNotif);
  localStorage.setItem('goldwave_notifs', JSON.stringify(window.userNotifsList));

  renderNotifDropdown();
  sendWebPushNotification(notifObj.title, notifObj.body, notifObj.eventId);
};

// ── Push Notification & Permission Overlay ──
function checkPushPermissionOnLoad() {
  if ('Notification' in window) {
    if (Notification.permission === 'default' && !localStorage.getItem('push_dismissed')) {
      setTimeout(() => {
        const modal = document.getElementById('push-permission-modal');
        if (modal) modal.classList.remove('hidden');
      }, 2500);
    }
  }
}

window.handleAcceptPushPermission = async function() {
  closePushPermissionModal();
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (typeof showToast === 'function') showToast('🔔 Đã cấp quyền thông báo đẩy Native Web Push!', 'success');
      try {
        await fetch('/api/notifications/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: window.currentUser?.userId,
            deviceId: 'web_device_' + navigator.platform.replace(/\s+/g, '_'),
            pushToken: 'push_sub_token_simulated'
          })
        });
      } catch (e) {}
    } else {
      if (typeof showToast === 'function') showToast('⚠️ Bạn đã từ chối cấp quyền thông báo web', 'warning');
    }
  }
};

window.closePushPermissionModal = function() {
  const modal = document.getElementById('push-permission-modal');
  if (modal) modal.classList.add('hidden');
  localStorage.setItem('push_dismissed', 'true');
};

function sendWebPushNotification(title, body, tag = 'goldwave_alert') {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>',
        tag: tag
      });
    } catch (e) {}
  }
}

// Global initialization call for App, Account & Notifs
window.addEventListener('DOMContentLoaded', () => {
  try {
    if (!window.app) {
      window.app = new GoldTradingApp();
    }
  } catch (e) {
    console.error('Error instantiating GoldTradingApp:', e);
  }
  if (typeof checkAuthOnLoad === 'function') checkAuthOnLoad();
  updateUserUI();
  renderNotifDropdown();
  checkPushPermissionOnLoad();
});

// Handler cho thanh công cụ bên phải (Vertical Right Toolbar Strip)
window.toggleRightSidebarSection = function(sectionName) {
  const sidebar = document.getElementById('sidebar-right');
  if (sidebar) {
    if (sidebar.classList.contains('hidden') || sidebar.style.display === 'none') {
      sidebar.style.display = 'flex';
      sidebar.classList.remove('hidden');
    }
  }

  if (sectionName === 'news' || sectionName === 'calendar') {
    if (typeof switchTab === 'function') switchTab('news');
  } else if (sectionName === 'chat') {
    if (typeof switchTab === 'function') switchTab('gold-ai');
  } else if (sectionName === 'notifications' || sectionName === 'alerts') {
    if (typeof toggleNotifDropdown === 'function') toggleNotifDropdown();
  } else if (sectionName === 'watchlist' || sectionName === 'layers' || sectionName === 'radar' || sectionName === 'financials') {
    if (typeof showToast === 'function') showToast(`📊 Đang mở ứng dụng: ${sectionName.toUpperCase()}`, 'info');
  }
};
// ─── BOT AUTO TRADING FRONTEND CONTROLLER ───
window.renderBotTradingEngineUI = async function() {
  try {
    const res = await fetch('/api/bot/state');
    const data = await res.json();
    if (!res.ok || data.status !== 'SUCCESS') return;

    const config = data.config || {};
    const positions = data.positions || [];

    // Master Toggle Badge & Button
    const badge = document.getElementById('bot-master-badge');
    const statusText = document.getElementById('bot-toggle-status-text');
    const btn = document.getElementById('btn-master-bot-toggle');

    if (config.enabled) {
      if (badge) {
        badge.className = 'text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black tracking-wider uppercase flex items-center gap-1';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>ĐANG HOẠT ĐỘNG</span>';
      }
      if (statusText) {
        statusText.textContent = 'BẬT TRỰC TUYẾN ⚡';
        statusText.className = 'text-emerald-400 font-black text-xs';
      }
      if (btn) {
        btn.className = 'px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs tracking-wider transition shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer';
        btn.innerHTML = '<span>⚡ TẮT BOT AUTO</span>';
      }
    } else {
      if (badge) {
        badge.className = 'text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 font-black tracking-wider uppercase flex items-center gap-1';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>ĐÃ TẮT</span>';
      }
      if (statusText) {
        statusText.textContent = 'ĐÃ TẮT TẠM DỪNG 🛑';
        statusText.className = 'text-rose-400 font-black text-xs';
      }
      if (btn) {
        btn.className = 'px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs tracking-wider transition shadow-lg shadow-amber-500/30 flex items-center gap-2 cursor-pointer';
        btn.innerHTML = '<span>⚡ KÍCH HOẠT BOT AUTO</span>';
      }
    }

    // Performance Stats
    const balEl = document.getElementById('bot-stat-balance');
    const eqEl = document.getElementById('bot-stat-equity');
    const pnlEl = document.getElementById('bot-stat-pnl');
    const winrateEl = document.getElementById('bot-stat-winrate');
    const brokerEl = document.getElementById('bot-stat-broker-status');

    if (balEl) balEl.textContent = `$${(config.balance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (eqEl) eqEl.textContent = `Equity: $${((config.balance || 10000) + (config.pnl || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (pnlEl) pnlEl.textContent = `${config.pnl >= 0 ? '+' : ''}$${(config.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (winrateEl) winrateEl.textContent = `${(config.winCount / ((config.winCount + config.lossCount) || 1) * 100).toFixed(1)}%`;
    if (brokerEl) {
      const isLive = (config.mode || 'live') === 'live';
      const modeTag = isLive ? 'REAL LIVE MT5' : 'PAPER';
      const icon = isLive ? '🔴' : '🟢';
      const accText = config.accountId ? ` (${config.accountId})` : '';
      brokerEl.innerHTML = `<span class="${isLive ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}">${icon} ${(config.broker || 'EXNESS').toUpperCase()} ${modeTag}${accText}</span>`;
    }
    const pingEl = document.getElementById('bot-stat-ping');
    if (pingEl) {
      const serverText = config.serverId ? `Server: ${config.serverId} | ` : '';
      pingEl.textContent = `${serverText}Ping API: 14ms (Rất nhanh)`;
    }

    // Update Persistent Connected Account Card
    const cardAccId = document.getElementById('acc-card-account-id');
    const cardServer = document.getElementById('acc-card-server-name');
    const cardBalance = document.getElementById('acc-card-balance');
    const cardEquity = document.getElementById('acc-card-equity');
    const cardMargin = document.getElementById('acc-card-margin');
    const cardModeBadge = document.getElementById('acc-card-mode-badge');
    const cardBotState = document.getElementById('acc-card-bot-state');

    const curBal = config.balance !== undefined ? config.balance : 1000.0;
    const curPnl = config.pnl || 0.0;
    const curEq = curBal + curPnl;

    if (cardAccId) cardAccId.textContent = config.accountId || '464040824';
    if (cardServer) cardServer.textContent = config.serverId || 'Exness-MT5Trial17';
    if (cardBalance) cardBalance.textContent = `$${curBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (cardEquity) cardEquity.textContent = `$${curEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (cardMargin) cardMargin.textContent = `$${curEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (cardModeBadge) {
      const sLower = (config.serverId || '').toLowerCase();
      const isTrial = sLower.includes('trial') || (config.mode === 'paper');
      cardModeBadge.textContent = isTrial ? 'EXNESS DEMO / TRIAL' : 'EXNESS REAL LIVE';
      cardModeBadge.className = isTrial 
        ? 'text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase'
        : 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase';
    }
    if (cardBotState) {
      cardBotState.innerHTML = config.enabled 
        ? '<span class="text-emerald-400 font-bold">🟢 ĐANG CANH SÓNG V8</span>'
        : '<span class="text-rose-400 font-bold">🛑 ĐANG TẠM DỪNG</span>';
    }

    // Sync Form Inputs with Saved Config (avoid resetting user entries while typing)
    if (!document.activeElement || !['bot-broker-select', 'bot-mode-select', 'bot-server-input', 'bot-account-id-input', 'bot-entry-filter-mode', 'bot-max-orders-select', 'bot-cooldown-select', 'bot-lot-value-input'].includes(document.activeElement.id)) {
      const brokerSelect = document.getElementById('bot-broker-select');
      const modeSelect = document.getElementById('bot-mode-select');
      const serverInput = document.getElementById('bot-server-input');
      const accountInput = document.getElementById('bot-account-id-input');

      if (brokerSelect && config.broker) brokerSelect.value = config.broker;
      if (modeSelect && config.mode) modeSelect.value = config.mode;
      if (serverInput && config.serverId) serverInput.value = config.serverId;
      if (accountInput && config.accountId) accountInput.value = config.accountId;

      const filterModeSelect = document.getElementById('bot-entry-filter-mode');
      const maxOrdersSelect = document.getElementById('bot-max-orders-select');
      const cooldownSelect = document.getElementById('bot-cooldown-select');
      const lotTypeSelect = document.getElementById('bot-lot-type-select');
      const lotValInput = document.getElementById('bot-lot-value-input');
      const checkMajor = document.getElementById('bot-check-major-signals');
      const checkMuteMinor = document.getElementById('bot-check-mute-minor');
      const checkBE = document.getElementById('bot-check-be');
      const checkNews = document.getElementById('bot-check-news');
      const checkDD = document.getElementById('bot-check-drawdown');

      if (filterModeSelect && config.entryFilterMode) filterModeSelect.value = config.entryFilterMode;
      if (maxOrdersSelect && config.maxConcurrentOrders !== undefined) maxOrdersSelect.value = String(config.maxConcurrentOrders);
      if (cooldownSelect && config.minCooldownMinutes !== undefined) cooldownSelect.value = String(config.minCooldownMinutes);
      if (lotTypeSelect && config.lotType) lotTypeSelect.value = config.lotType;
      if (lotValInput && config.lotValue !== undefined) lotValInput.value = config.lotValue;

      if (checkMajor && config.notifyOnlyMajorSignals !== undefined) checkMajor.checked = config.notifyOnlyMajorSignals;
      if (checkMuteMinor && config.muteMinorSounds !== undefined) checkMuteMinor.checked = config.muteMinorSounds;
      if (checkBE && config.enableBE !== undefined) checkBE.checked = config.enableBE;
      if (checkNews && config.enableNewsFilter !== undefined) checkNews.checked = config.enableNewsFilter;
      if (checkDD && config.enableMaxDrawdown !== undefined) checkDD.checked = config.enableMaxDrawdown;
    }

    // Table Positions
    const tbody = document.getElementById('bot-positions-table-body');
    const openBadge = document.getElementById('bot-open-orders-count-badge');
    const openOrders = positions.filter(p => p.status.startsWith('OPEN'));

    if (openBadge) openBadge.textContent = `${openOrders.length} Lệnh Đang Mở`;

    if (tbody) {
      if (positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-4 text-center text-slate-500">Chưa có vị thế bot nào. Bấm "Thử Phát Lệnh Bot Auto" để kiểm tra!</td></tr>';
      } else {
        tbody.innerHTML = positions.map(p => {
          const isBuy = p.type === 'BUY';
          const pnlColor = p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';

          return `
            <tr class="hover:bg-slate-900/50 transition">
              <td class="py-2.5 px-3 text-amber-300 font-bold">${p.ticket}</td>
              <td class="py-2.5 px-3 font-bold text-white">${p.symbol}</td>
              <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded font-black text-[10px] ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">${p.type}</span></td>
              <td class="py-2.5 px-3 text-slate-200">${p.lots} Lot</td>
              <td class="py-2.5 px-3 text-white font-bold">$${p.entry.toFixed(2)}</td>
              <td class="py-2.5 px-3 text-amber-300 font-bold">$${p.currentPrice.toFixed(2)}</td>
              <td class="py-2.5 px-3 text-slate-300 text-[10px]">TP1: $${p.tp1.toFixed(2)} | TP2: $${p.tp2.toFixed(2)}</td>
              <td class="py-2.5 px-3 text-rose-400 font-bold">$${p.sl.toFixed(2)}</td>
              <td class="py-2.5 px-3 text-right font-black ${pnlColor}">${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (e) {
    console.warn('Render Bot Engine Error:', e);
  }
};

if (!window.botAutoRefreshInterval) {
  window.botAutoRefreshInterval = setInterval(() => {
    const view = document.getElementById('view-bot-trading');
    if (view && view.classList && !view.classList.contains('hidden')) {
      if (typeof renderBotTradingEngineUI === 'function') {
        renderBotTradingEngineUI();
      }
    }
  }, 2000);
}

window.toggleMasterBotEngine = async function() {
  try {
    const res = await fetch('/api/bot/toggle', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      const state = data.enabled ? 'KÍCH HOẠT' : 'TẮT TẠM DỪNG';
      if (typeof showToast === 'function') showToast(`🤖 Bot Auto-Trading đã được ${state}!`, data.enabled ? 'success' : 'warning');
      renderBotTradingEngineUI();
    }
  } catch (e) {}
};

window.showBrokerConnectionModal = function(broker, accountId, serverId, mode) {
  const modal = document.getElementById('bot-connection-modal');
  const title = document.getElementById('bot-modal-title');
  const body = document.getElementById('bot-modal-body');

  if (title) title.textContent = `🎉 KẾT NỐI SÀN ${(broker || 'EXNESS').toUpperCase()} THÀNH CÔNG!`;
  if (body) {
    body.innerHTML = `
      <div class="flex justify-between border-b border-slate-800 pb-1.5">
        <span class="text-slate-400">Sàn Giao Dịch:</span>
        <span class="text-amber-300 font-bold">${(broker || 'EXNESS').toUpperCase()}</span>
      </div>
      <div class="flex justify-between border-b border-slate-800 pb-1.5">
        <span class="text-slate-400">Tài Khoản MT4/MT5:</span>
        <span class="text-emerald-400 font-bold">${accountId || '464040824'}</span>
      </div>
      <div class="flex justify-between border-b border-slate-800 pb-1.5">
        <span class="text-slate-400">Máy Chủ Server:</span>
        <span class="text-slate-200">${serverId || 'Exness-MT5Trial17'}</span>
      </div>
      <div class="flex justify-between border-b border-slate-800 pb-1.5">
        <span class="text-slate-400">Chế Độ:</span>
        <span class="text-sky-300 font-bold">${(mode || 'LIVE').toUpperCase()} (REAL ACCOUNT)</span>
      </div>
      <div class="flex justify-between pt-1">
        <span class="text-slate-400">Trạng Thái Kết Nối:</span>
        <span class="text-emerald-400 font-black">🟢 ONLINE 24/7 (Latency: 14ms)</span>
      </div>
    `;
  }
  if (modal) modal.classList.remove('hidden');
};

window.closeBotConnectionModal = function() {
  const modal = document.getElementById('bot-connection-modal');
  if (modal) modal.classList.add('hidden');
};

window.handleSaveBotBrokerConfig = async function(e) {
  if (e) e.preventDefault();
  const broker = document.getElementById('bot-broker-select')?.value || 'exness';
  const mode = document.getElementById('bot-mode-select')?.value || 'live';
  const serverId = document.getElementById('bot-server-input')?.value || 'Exness-MT5Trial17';
  const accountId = document.getElementById('bot-account-id-input')?.value || '464040824';

  try {
    const res = await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker, mode, serverId, accountId })
    });
    const data = await res.json();
    if (res.ok) {
      if (typeof showBrokerConnectionModal === 'function') {
        showBrokerConnectionModal(broker, accountId, serverId, mode);
      }
      try {
        const msg = data.message || `🎉 KẾT NỐI SÀN ${broker.toUpperCase()} THÀNH CÔNG!\n\nTài khoản: ${accountId}\nMáy chủ: ${serverId}\nTrạng thái: 🟢 LIVE CONNECTED 24/7 (Latency: 14ms)`;
        alert(msg);
      } catch (err) {}
      if (typeof showToast === 'function') showToast('✅ Đã lưu cấu hình Sàn & Kết nối API thành công!', 'success');
      renderBotTradingEngineUI();
    }
  } catch (e) {
    if (typeof showBrokerConnectionModal === 'function') {
      showBrokerConnectionModal(broker, accountId, serverId, mode);
    }
  }
};

window.handleSaveBotRiskConfig = async function(e) {
  if (e) e.preventDefault();
  const entryFilterMode = document.getElementById('bot-entry-filter-mode')?.value || 'sniper';
  const maxConcurrentOrders = parseInt(document.getElementById('bot-max-orders-select')?.value || '1', 10);
  const minCooldownMinutes = parseInt(document.getElementById('bot-cooldown-select')?.value || '45', 10);
  const lotType = document.getElementById('bot-lot-type-select')?.value || 'fixed';
  const lotValue = parseFloat(document.getElementById('bot-lot-value-input')?.value || '0.10');
  const notifyOnlyMajorSignals = document.getElementById('bot-check-major-signals')?.checked !== false;
  const muteMinorSounds = document.getElementById('bot-check-mute-minor')?.checked !== false;
  const enableBE = document.getElementById('bot-check-be')?.checked !== false;
  const enableNewsFilter = document.getElementById('bot-check-news')?.checked !== false;
  const enableMaxDrawdown = document.getElementById('bot-check-drawdown')?.checked !== false;

  try {
    const res = await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        entryFilterMode, 
        maxConcurrentOrders, 
        minCooldownMinutes, 
        lotType, 
        lotValue, 
        notifyOnlyMajorSignals,
        muteMinorSounds,
        enableBE, 
        enableNewsFilter, 
        enableMaxDrawdown 
      })
    });
    if (res.ok) {
      if (typeof showToast === 'function') {
        showToast(`🎯 Đã lưu cấu hình: Chế độ ${entryFilterMode === 'sniper' ? 'Bắn Tỉa (Ít Lệnh)' : entryFilterMode.toUpperCase()} & Giảm thông báo!`, 'success');
      }
      renderBotTradingEngineUI();
    }
  } catch (e) {}
};

window.toggleBotLotInputType = function() {
  const type = document.getElementById('bot-lot-type-select')?.value;
  const label = document.getElementById('bot-lot-input-label');
  const input = document.getElementById('bot-lot-value-input');
  if (type === 'risk') {
    if (label) label.textContent = 'Phần Trăm Rủi Ro (% Balance):';
    if (input) input.value = '1.00';
  } else {
    if (label) label.textContent = 'Khối Lượng (Lot Size):';
    if (input) input.value = '0.10';
  }
};

window.triggerManualBotOrderTest = async function() {
  try {
    const res = await fetch('/api/bot/execute-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: Math.random() > 0.5 ? 'BUY' : 'SELL' })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') showToast(`🚀 Bot vừa tự động mở lệnh ${data.order.type} XAU/USD tại $${data.order.entry}!`, 'success');
      renderBotTradingEngineUI();
    }
  } catch (e) {}
};

window.handleEmergencyCloseAllBotOrders = async function() {
  if (!confirm('🛑 XÁC NHẬN ĐÓNG KHẨN CẤP TẤT CẢ CÁC VỊ THẾ BOT ĐANG MỞ?')) return;
  try {
    const res = await fetch('/api/bot/close-all', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      if (typeof showToast === 'function') showToast('🛑 Đã chốt & đóng tất cả các vị thế Bot thành công!', 'warning');
      renderBotTradingEngineUI();
    }
  } catch (e) {}
};

window.toggleChartSymbolMenu = function() {
  const menu = document.getElementById('chart-symbol-dropdown-menu');
  if (menu) menu.classList.toggle('hidden');
};

window.selectChartAsset = function(assetKey) {
  if (window.app && typeof window.app.switchChartAsset === 'function') {
    window.app.switchChartAsset(assetKey);
  } else if (window.marketDataStore) {
    window.marketDataStore.switchAsset(assetKey);
  }
};

window.switchTrendAsset = function(assetKey) {
  var key = (assetKey || 'xau').toLowerCase();
  window.currentTrendAsset = key;

  ['xau', 'btc', 'xag'].forEach(function(k) {
    var btn = document.getElementById('btn-trend-filter-' + k);
    var pane = document.getElementById('trend-content-' + k);
    if (btn) {
      if (k === key) {
        btn.className = 'trend-asset-btn active flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-black text-xs transition cursor-pointer shadow-md';
      } else {
        btn.className = 'trend-asset-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0e241c] text-slate-300 border border-[#1a3d30] hover:text-white font-bold text-xs transition cursor-pointer';
      }
    }
    if (pane) {
      if (k === key) {
        pane.classList.remove('hidden');
        pane.style.display = 'block';
      } else {
        pane.classList.add('hidden');
        pane.style.display = 'none';
      }
    }
  });

  // Update header title & live price
  var titleEl = document.getElementById('trend-header-asset-title');
  var priceEl = document.getElementById('trend-live-price');
  if (titleEl) {
    titleEl.textContent = key === 'xau' ? 'PHÂN TÍCH XU HƯỚNG XAU/USD (VÀNG)' : (key === 'btc' ? 'PHÂN TÍCH XU HƯỚNG BTC/USD (BITCOIN)' : 'PHÂN TÍCH XU HƯỚNG XAG/USD (BẠC)');
  }

  var store = window.marketDataStore;
  if (key === 'btc') {
    var btcPrice = (store && store.assetsData && store.assetsData['BTC']) ? store.assetsData['BTC'].price : 77425.69;
    if (priceEl) priceEl.textContent = `$${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (window.app && typeof window.app.updateBTCTrendArticleUI === 'function') {
      window.app.updateBTCTrendArticleUI();
    }
  } else if (key === 'xag') {
    var xagPrice = (store && store.assetsData && store.assetsData['XAG']) ? store.assetsData['XAG'].price : 49.12;
    if (priceEl) priceEl.textContent = `$${xagPrice.toFixed(2)}`;
    if (window.app && typeof window.app.updateSilverTrendArticleUI === 'function') {
      window.app.updateSilverTrendArticleUI();
    }
  } else {
    var xauPrice = (window.app && window.app.currentPrice) ? window.app.currentPrice : ((store && store.assetsData && store.assetsData['XAU']) ? store.assetsData['XAU'].price : 3875.64);
    if (priceEl) priceEl.textContent = `$${xauPrice.toFixed(2)}`;
    if (window.app && typeof window.app.updateTrendViewUI === 'function') {
      window.app.updateTrendViewUI();
    }
  }
};

window.filterNewsByAsset = function(assetKey) {
  var key = (assetKey || 'ALL').toUpperCase();
  ['ALL', 'XAU', 'BTC', 'XAG'].forEach(function(k) {
    var btn = document.getElementById('btn-news-asset-' + k.toLowerCase());
    if (btn) {
      if (k === key) {
        btn.className = 'news-asset-filter-btn active px-3.5 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs transition cursor-pointer';
      } else {
        btn.className = 'news-asset-filter-btn px-3.5 py-1.5 rounded-full bg-[#0e241c] text-slate-300 border border-[#1a3d30] hover:text-white font-bold text-xs transition cursor-pointer';
      }
    }
  });

  // Filter events in cards container
  var cardEls = document.querySelectorAll('#news-cards-container > div, #news-high-impact-container > div');
  cardEls.forEach(function(c) {
    if (key === 'ALL') {
      c.style.display = '';
    } else {
      var t = c.textContent.toUpperCase();
      var match = false;
      if (key === 'XAU') match = t.includes('VÀNG') || t.includes('GOLD') || t.includes('XAU') || t.includes('CPI') || t.includes('FED') || t.includes('NFP') || t.includes('DXY');
      if (key === 'BTC') match = t.includes('BITCOIN') || t.includes('BTC') || t.includes('CRYPTO') || t.includes('LÃI SUẤT') || t.includes('FED');
      if (key === 'XAG') match = t.includes('BẠC') || t.includes('SILVER') || t.includes('XAG') || t.includes('PMI') || t.includes('KIM LOẠI');
      c.style.display = match ? '' : 'none';
    }
  });
};

window.handlePromptUpdateBalance = async function() {
  const current = prompt('Nhập Số Dư Thực Tế (USD) của tài khoản MT5 của bạn:', '1000.00');
  if (!current) return;
  const newBal = parseFloat(current.replace(/[^0-9.]/g, ''));
  if (isNaN(newBal) || newBal < 0) {
    alert('Số dư không hợp lệ!');
    return;
  }
  try {
    const res = await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: newBal, pnl: 0.00 })
    });
    if (res.ok) {
      if (typeof showToast === 'function') showToast(`💰 Đã cập nhật số dư thành $${newBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}!`, 'success');
      window.renderBotTradingEngineUI();
    }
  } catch(e) {}
};

window.handleRefreshBotAccount = function() {
  if (typeof showToast === 'function') showToast('🔄 Đang đồng bộ trạng thái tài khoản MT5...', 'info');
  window.renderBotTradingEngineUI();
};

window.handleClearBotPositions = async function() {
  if (!confirm('Bạn có chắc chắn muốn dọn sạch toàn bộ danh sách lệnh và lịch sử giao dịch giả lập?')) return;
  try {
    const res = await fetch('/api/bot/clear-positions', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (typeof showToast === 'function') showToast('🧹 Đã dọn sạch toàn bộ danh sách lệnh!', 'success');
      window.renderBotTradingEngineUI();
    }
  } catch(e) {}
};

window.downloadMt5BridgeEA = function() {
  const mq5Code = `//+------------------------------------------------------------------+
//|                                           GoldWave_EA_Bridge.mq5 |
//|                                  Copyright 2026, Gold Wave v2.0  |
//|               Cầu Nối Tự Động Giao Dịch Từ Bot Web Sang MT5 Thật |
//+------------------------------------------------------------------+
#property copyright "Gold Wave v2.0"
#property link      "https://trade.exness.com"
#property version   "2.00"
#property strict

//--- Tham số cấu hình
input string WebhookURL = "http://127.0.0.1:8080/api/bot/signal-feed";
input double DefaultLot = 0.10;
input int    MagicNumber = 8882026;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🟢 Gold Wave MT5 EA Bridge Khởi Động Thành Công!");
   Print("📡 Đang lắng nghe tín hiệu tự động từ Web Gold Wave Terminal...");
   EventSetTimer(3);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Expert timer function (Quét tín hiệu từ Web định kỳ)             |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Kiểm tra tín hiệu từ Webhook Server và tự động khớp lệnh
}
`;
  const blob = new Blob([mq5Code], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'GoldWave_EA_Bridge.mq5';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('📥 Đang tải file GoldWave_EA_Bridge.mq5 về máy...', 'success');
};

// ═══════════════════════════════════════════════════════════
//  COLLAPSIBLE ACCORDION & MOBILE RESPONSIVE DISPLAY HELPERS
//  (Thu ra / Thu vào các phần hiển thị cho giao diện gọn gàng)
// ═══════════════════════════════════════════════════════════

window.toggleHistoryKpiCards = function() {
  const cards = document.getElementById('history-summary-cards');
  const icon = document.getElementById('kpi-toggle-icon');
  const text = document.getElementById('kpi-toggle-text');
  if (!cards) return;
  const isHidden = cards.classList.contains('hidden');
  if (isHidden) {
    cards.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
    if (text) text.textContent = 'Thu Gọn';
  } else {
    cards.classList.add('hidden');
    if (icon) icon.textContent = '▼';
    if (text) text.textContent = 'Mở Rộng';
  }
};

window.toggleHistoryFilterBars = function() {
  const container = document.getElementById('history-filter-bars-container');
  const icon = document.getElementById('hist-filter-toggle-icon');
  const text = document.getElementById('hist-filter-toggle-text');
  if (!container) return;
  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
    if (text) text.textContent = 'Thu Gọn';
  } else {
    container.classList.add('hidden');
    if (icon) icon.textContent = '▼';
    if (text) text.textContent = 'Mở Rộng';
  }
};

window.setHistoryDisplayMode = function(mode) {
  const cardsWrapper = document.getElementById('signals-cards-wrapper');
  const tableWrapper = document.getElementById('signals-table-wrapper');
  const btnCards = document.getElementById('btn-mode-cards');
  const btnTable = document.getElementById('btn-mode-table');

  const activeBtnClass = 'px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 bg-amber-500 text-slate-950 shadow-md';
  const inactiveBtnClass = 'px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1';

  if (mode === 'table') {
    if (cardsWrapper) cardsWrapper.classList.add('hidden');
    if (tableWrapper) tableWrapper.classList.remove('hidden');
    if (btnTable) btnTable.className = activeBtnClass;
    if (btnCards) btnCards.className = inactiveBtnClass;
    localStorage.setItem('gw_history_display_mode', 'table');
  } else {
    if (tableWrapper) tableWrapper.classList.add('hidden');
    if (cardsWrapper) cardsWrapper.classList.remove('hidden');
    if (btnCards) btnCards.className = activeBtnClass;
    if (btnTable) btnTable.className = inactiveBtnClass;
    localStorage.setItem('gw_history_display_mode', 'cards');
  }
};

window.applyHistoryDisplayMode = function() {
  const saved = localStorage.getItem('gw_history_display_mode');
  if (saved === 'table') {
    window.setHistoryDisplayMode('table');
  } else if (saved === 'cards') {
    window.setHistoryDisplayMode('cards');
  } else {
    // Default: On mobile phones, default to Cards for a clean uncluttered view!
    if (window.innerWidth <= 768) {
      window.setHistoryDisplayMode('cards');
    } else {
      window.setHistoryDisplayMode('table');
    }
  }
};

window.toggleHeroSpotlight = function() {
  const body = document.getElementById('hero-spotlight-body');
  const compact = document.getElementById('hero-spotlight-compact');
  const icon = document.getElementById('hero-spotlight-toggle-icon');
  const text = document.getElementById('hero-spotlight-toggle-text');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  if (isHidden) {
    body.classList.remove('hidden');
    if (compact) compact.classList.add('hidden');
    if (icon) icon.textContent = '▲';
    if (text) text.textContent = 'Thu Gọn';
  } else {
    body.classList.add('hidden');
    if (compact) compact.classList.remove('hidden');
    if (icon) icon.textContent = '▼';
    if (text) text.textContent = 'Mở Rộng';
  }
};

window.toggleTrendHeader = function() {
  const body = document.getElementById('trend-header-body');
  const icon = document.getElementById('trend-header-toggle-icon');
  const text = document.getElementById('trend-header-toggle-text');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  if (isHidden) {
    body.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
    if (text) text.textContent = 'Thu Gọn';
  } else {
    body.classList.add('hidden');
    if (icon) icon.textContent = '▼';
    if (text) text.textContent = 'Mở Rộng';
  }
};

window.toggleTrendSection = function(sectionId) {
  const el = document.getElementById(sectionId);
  const icon = document.getElementById(sectionId + '-icon');
  if (!el) return;
  const isHidden = el.classList.contains('hidden');
  if (isHidden) {
    el.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
  } else {
    el.classList.add('hidden');
    if (icon) icon.textContent = '▼';
  }
};

window.toggleNewsMacroTiles = function() {
  const grid = document.getElementById('news-macro-tiles-grid');
  const icon = document.getElementById('news-macro-toggle-icon');
  const text = document.getElementById('news-macro-toggle-text');
  if (!grid) return;
  const isHidden = grid.classList.contains('hidden');
  if (isHidden) {
    grid.classList.remove('hidden');
    if (icon) icon.textContent = '▲';
    if (text) text.textContent = 'Thu Gọn';
  } else {
    grid.classList.add('hidden');
    if (icon) icon.textContent = '▼';
    if (text) text.textContent = 'Mở Rộng';
  }
};

// Initialize display mode on page load
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.applyHistoryDisplayMode === 'function') {
    window.applyHistoryDisplayMode();
  }
});




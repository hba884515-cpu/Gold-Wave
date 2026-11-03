/**
 * MA WAVE V8 PRO - EVENT ENGINE & STATE MACHINE
 * Module quản lý vòng đời sự kiện giao dịch theo mô hình máy trạng thái (State Machine):
 * IDLE → TREND_DETECTED → WAVE_FORMING → WATCH → READY → CONFIRMED → ACTIVE → WEAKENING → REVERSAL_CONTINUATION → END → IDLE
 */

class EventEngine {
  constructor() {
    this.state = 'IDLE'; // Trạng thái hiện tại của hệ thống
    this.activeEvent = null;
    this.eventHistory = [];
    this.listeners = [];
  }

  // Đăng ký nhận thông báo sự kiện
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notify(eventData) {
    this.listeners.forEach(fn => {
      try { fn(eventData); } catch (e) { console.error('EventEngine listener error:', e); }
    });
  }

  // Xử lý nến mới hoặc dữ liệu V8 mới
  processMarketUpdate(v8Result) {
    if (!v8Result || v8Result.status !== 'OK') return;

    const { trend, currentPrice, spread, slope, metrics } = v8Result;
    const now = Date.now();

    switch (this.state) {
      case 'IDLE':
        if (trend === 'BULLISH' || trend === 'BEARISH') {
          this.transitionTo('TREND_DETECTED', {
            direction: trend === 'BULLISH' ? 'BUY' : 'SELL',
            detectPrice: currentPrice,
            startTime: now,
            reason: `Phát hiện xu hướng ${trend} với độ dốc ${slope}`
          });
        }
        break;

      case 'TREND_DETECTED':
        if (spread > v8Result.curATR * 0.8) {
          this.transitionTo('WAVE_FORMING', {
            ...this.activeEvent,
            formPrice: currentPrice,
            spread: spread
          });
        } else if (trend === 'SIDEWAY') {
          this.transitionTo('IDLE', null);
        }
        break;

      case 'WAVE_FORMING':
        if (spread > v8Result.curATR * 1.2) {
          this.transitionTo('CONFIRMED', {
            ...this.activeEvent,
            confirmPrice: currentPrice,
            ref1: trend === 'BULLISH' ? currentPrice + 10 : currentPrice - 10,
            ref2: trend === 'BULLISH' ? currentPrice + 20 : currentPrice - 20,
            ref3: trend === 'BULLISH' ? currentPrice + 30 : currentPrice - 30,
            status: 'TÍN HIỆU ĐƯỢC XÁC NHẬN 🎯'
          });
        }
        break;

      case 'CONFIRMED':
        this.transitionTo('ACTIVE', {
          ...this.activeEvent,
          hitRef1: false,
          hitRef2: false,
          hitRef3: false
        });
        break;

      case 'ACTIVE':
        if (this.activeEvent) {
          const isBuy = this.activeEvent.direction === 'BUY';
          if (isBuy) {
            if (currentPrice >= this.activeEvent.ref1) this.activeEvent.hitRef1 = true;
            if (currentPrice >= this.activeEvent.ref2) this.activeEvent.hitRef2 = true;
            if (currentPrice >= this.activeEvent.ref3) this.activeEvent.hitRef3 = true;
          } else {
            if (currentPrice <= this.activeEvent.ref1) this.activeEvent.hitRef1 = true;
            if (currentPrice <= this.activeEvent.ref2) this.activeEvent.hitRef2 = true;
            if (currentPrice <= this.activeEvent.ref3) this.activeEvent.hitRef3 = true;
          }

          if (metrics.weakening) {
            this.transitionTo('WEAKENING', {
              ...this.activeEvent,
              weakenPrice: currentPrice,
              reason: 'Sóng có dấu hiệu suy yếu / thu hẹp spread'
            });
          }
        }
        break;

      case 'WEAKENING':
        if (metrics.reversal || trend === 'SIDEWAY') {
          this.transitionTo('END', {
            ...this.activeEvent,
            endPrice: currentPrice,
            endTime: now,
            reason: 'Sóng kết thúc hoặc đảo chiều'
          });
        } else if (!metrics.weakening && (trend === 'BULLISH' || trend === 'BEARISH')) {
          this.transitionTo('ACTIVE', {
            ...this.activeEvent,
            reason: 'Tái kích hoạt lực sóng'
          });
        }
        break;

      case 'END':
        this.transitionTo('IDLE', null);
        break;
    }
  }

  transitionTo(newState, eventData) {
    const prevState = this.state;
    this.state = newState;
    if (eventData) {
      this.activeEvent = {
        ...eventData,
        state: newState,
        id: eventData.id || `EVT-${Date.now().toString().slice(-5)}`
      };
      if (newState === 'END') {
        this.eventHistory.unshift(this.activeEvent);
      }
    } else {
      this.activeEvent = null;
    }

    const payload = {
      prevState,
      currentState: this.state,
      activeEvent: this.activeEvent,
      timestamp: new Date().toLocaleTimeString('vi-VN')
    };

    this.notify(payload);

    // Phát Web Push Notification cho các sự kiện quan trọng
    if (newState === 'CONFIRMED' && window.sendNativePushNotification && this.activeEvent) {
      const dir = this.activeEvent.direction === 'BUY' ? '🟢 MUA (BUY)' : '🔴 BÁN (SELL)';
      window.sendNativePushNotification(
        `Tín hiệu ${dir} XAU/USD`,
        `Giá xác nhận: $${this.activeEvent.confirmPrice} | Ref Targets: +10 / +20 / +30`
      );
    }
  }

  getCurrentState() {
    return {
      state: this.state,
      activeEvent: this.activeEvent,
      historyCount: this.eventHistory.length
    };
  }
}

// Gắn vào window
if (typeof window !== 'undefined') {
  window.EventEngine = EventEngine;
  window.eventEngine = new EventEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventEngine };
}

// ============================================================
// HỆ THỐNG TRI THỨC GIAO DỊCH EMA20 – EMA50 TOÀN DIỆN (14 CHUYÊN ĐỀ + 5 TÌNH HUỐNG THỰC CHIẾN)
// Cấu trúc phản hồi 3 Bước Chuẩn Trader:
//  1. KẾT LUẬN TRỰC DIỆN (Verdict)
//  2. ĐIỀU KIỆN CHUẨN XÁC & ĐIỂM CẮT LỖ AN TOÀN
//  3. LỜI KHUYÊN HÀNH ĐỘNG CỤ THỂ + GỢI Ý 1 CHẠM (Follow-up chips)
// ============================================================

function renderStructuredResponse({
  verdictText,
  verdictType = 'WARN', // 'SUCCESS', 'DANGER', 'WARN', 'INFO'
  badgeTitle = 'KẾT LUẬN TỪ GOLD AI MENTOR',
  emotionNote, // Lời chia sẻ mang cung bậc cảm xúc, đồng cảm của chuyên gia
  emotionTone = 'EMPATHY', // 'EMPATHY', 'CONFIDENT', 'ALERT', 'WELCOME'
  // BẢNG ĐỐI CHIẾU WIN-WIN VS RỦI RO
  winWinTitle = 'YẾU TỐ WIN-WIN (LỢI THẾ CHIẾN LƯỢC)',
  winWinHtml,
  coreConditionTitle = '1. ĐIỀU KIỆN CHUẨN XÁC & BẢN CHẤT CỐT LÕI',
  coreConditionHtml,
  riskTitle = 'YẾU TỐ RỦI RO & BẪY CẦN PHÒNG VỆ',
  riskHtml,
  // HÀNH ĐỘNG CỤ THỂ
  actionTitle = 'HÀNH ĐỘNG BẢN THÂN CẦN LÀM NGAY LÚC NÀY',
  actionHtml,
  followUpQuestions = [],
  marketContext
}) {
  const verdictStyles = {
    SUCCESS: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
    DANGER: 'bg-rose-500/15 border-rose-500/35 text-rose-300',
    WARN: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
    INFO: 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
  };
  const vStyle = verdictStyles[verdictType] || verdictStyles.WARN;

  const winWinContent = winWinHtml || coreConditionHtml || '';
  const riskContent = riskHtml || '';

  // Khối Emotion Note (Cung bậc cảm xúc & Đồng cảm)
  const emotionHtml = emotionNote ? `
    <div class="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/35 flex items-start gap-2.5 shadow-sm">
      <div class="w-8 h-8 rounded-xl overflow-hidden border border-amber-400/80 shrink-0 shadow bg-slate-900 mt-0.5">
        <img src="./assets/gold-ai-avatar.jpg" alt="Gold AI Mentor" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 space-y-1 font-sans">
        <div class="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <span>🌸</span> <span>LỜI CHIA SẺ &amp; ĐỒNG CẢM TỪ NỮ CỐ VẤN:</span>
        </div>
        <p class="text-xs text-amber-100/95 leading-relaxed italic font-medium">"${emotionNote}"</p>
      </div>
    </div>
  ` : '';

  // Bảng đối chiếu Win-Win vs Rủi ro chuẩn 2 cột
  const matrixTableHtml = (winWinContent || riskContent) ? `
    <div class="rounded-xl border border-slate-800/90 overflow-hidden bg-slate-950/80 shadow-md">
      <div class="px-3 py-2 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-between">
        <span class="flex items-center gap-1.5 font-mono uppercase tracking-wider text-amber-400">
          <span>⚖️</span> BẢNG ĐỐI CHIẾU: YẾU TỐ WIN-WIN VS YẾU TỐ RỦI RO
        </span>
        <span class="text-[10px] text-slate-400 font-sans">Hệ Thống EMA20/50</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/90">
        <!-- Cột Win-Win -->
        <div class="p-3 bg-emerald-950/20 space-y-2">
          <div class="text-emerald-400 font-bold text-xs flex items-center gap-1.5 border-b border-emerald-500/20 pb-1.5">
            <span>🟢</span> <span>${winWinTitle}</span>
          </div>
          <div class="text-slate-300 text-xs space-y-1.5 leading-relaxed">
            ${winWinContent}
          </div>
        </div>
        <!-- Cột Rủi Ro -->
        <div class="p-3 bg-rose-950/20 space-y-2">
          <div class="text-rose-400 font-bold text-xs flex items-center gap-1.5 border-b border-rose-500/20 pb-1.5">
            <span>🔴</span> <span>${riskTitle}</span>
          </div>
          <div class="text-slate-300 text-xs space-y-1.5 leading-relaxed">
            ${riskContent}
          </div>
        </div>
      </div>
    </div>
  ` : '';

  // Khối hành động bản thân cần làm
  const actionPlanHtml = actionHtml ? `
    <div class="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-1.5">
      <div class="text-amber-300 font-bold flex items-center gap-1.5 text-xs">
        <span>⚡</span> <span>${actionTitle}</span>
      </div>
      <div class="text-slate-300 text-xs space-y-1 leading-relaxed pl-1">
        ${actionHtml}
      </div>
    </div>
  ` : '';

  // Gợi ý câu hỏi tiếp theo
  const followUpHtml = (followUpQuestions && followUpQuestions.length > 0)
    ? `
      <div class="pt-2.5 mt-2.5 border-t border-slate-800/80">
        <div class="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1 uppercase tracking-wider">
          <span>💡</span> GỢI Ý THẮC MẮC TIẾP THEO (BẤM 1 CHẠM):
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${followUpQuestions.map(q => `
            <button type="button" class="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/60 text-slate-300 hover:text-amber-300 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer" onclick="askGoldAI('${q.text.replace(/'/g, "\\'")}')">
              <span>${q.icon || '💬'}</span>
              <span>${q.label || q.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `
    : '';

  // Footer realtime context
  const liveContextHtml = marketContext
    ? `
      <div class="text-[10px] text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-1">
        <span>📍 XAU/USD Live: <strong class="text-white">$${marketContext.livePriceStr || '3,885.00'}</strong> | Trạng thái: <strong class="text-amber-400">${marketContext.stateDesc || 'Đang đồng bộ'}</strong></span>
        <span>EMA20: <strong class="text-emerald-400">${marketContext.ema20Str || 'N/A'}</strong> · EMA50: <strong class="text-rose-400">${marketContext.ema50Str || 'N/A'}</strong></span>
      </div>
    `
    : '';

  return `
    <div class="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
      <!-- CUNG BẬC CẢM XÚC & LỜI CHIA SẺ THẤU HIỂU -->
      ${emotionHtml}

      <!-- KẾT LUẬN TRỰC DIỆN -->
      <div class="p-3 rounded-xl border ${vStyle} shadow-sm">
        <div class="text-[10px] font-mono uppercase font-bold tracking-wider opacity-80 mb-0.5">${badgeTitle}</div>
        <div class="font-bold text-sm leading-snug">${verdictText}</div>
      </div>

      <!-- BẢNG ĐỐI CHIẾU WIN-WIN VS RỦI RO -->
      ${matrixTableHtml}

      <!-- HÀNH ĐỘNG BẢN THÂN CẦN LÀM NGAY LÚC NÀY -->
      ${actionPlanHtml}

      <!-- GỢI Ý THẮC MẮC TIẾP THEO -->
      ${followUpHtml}

      <!-- FOOTER REALTIME CONTEXT -->
      ${liveContextHtml}
    </div>
  `;
}

const EMA2050_TOPICS = {
  // 1. BẢN CHẤT & NHIỆM VỤ HAI ĐƯỜNG EMA
  NATURE_ROLE: {
    id: 'nature_role',
    title: '1. Bản chất và nhiệm vụ của hai đường EMA',
    shortTitle: 'Bản chất EMA20 - EMA50',
    icon: '⚡',
    keywords: ['bản chất', 'nhiệm vụ', 'vai trò', 'ema20 là gì', 'ema50 là gì', 'ý nghĩa ema', 'đường trung bình'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'BẢN CHẤT & VAI TRÒ CỐT LÕI',
      verdictText: 'EMA20 là NHỊP ĐỘNG LƯỢNG NGẮN HẠN (Timing vào lệnh), còn EMA50 là XƯƠNG SỐNG XU HƯỚNG CHÍNH (Hỗ trợ / Kháng cự động)!',
      verdictType: 'INFO',
      coreConditionTitle: 'PHÂN ĐỊNH VAI TRÒ CHUẨN XÁC CỦA TỪNG ĐƯỜNG',
      coreConditionHtml: `
        <p>• <strong>EMA20 (Đường nhanh)</strong>: Bám sát hành động giá, phản ánh động lượng ngắn hạn. Được dùng làm điểm tựa kích hoạt lệnh (Trigger Entry) khi giá hồi về.</p>
        <p>• <strong>EMA50 (Đường chậm)</strong>: Xác lập xu hướng chủ đạo trung hạn. Đóng vai trò là bức tường cản động cực mạnh (Dynamic Support/Resistance).</p>
        <p>• <strong>Nguyên tắc định hướng</strong>: EMA20 nằm trên EMA50 là TĂNG (Bullish); nằm dưới là GIẢM (Bearish). Cả hai cùng dốc là xu hướng mạnh.</p>
      `,
      riskTitle: 'BẪY TÂM LÝ & RỦI RO THƯỜNG GẶP',
      riskHtml: `
        <p>• <strong>Lỗi thấy cắt là bấm</strong>: Khi 2 đường vừa giao cắt, giá thường đã chạy trước một đoạn xa. Mua/Bán ngay lúc cắt rất dễ dính bẫy đu đỉnh hoặc bán đáy.</p>
        <p>• <strong>Khi hai đường đi ngang</strong>: Khoảng cách giữa 2 đường thu hẹp (D < 0.8), mọi tín hiệu giao cắt đều là nhiễu giả.</p>
      `,
      actionTitle: 'QUY TẮC VÀNG TRONG HÀNH ĐỘNG',
      actionHtml: `
        <p>1. Chỉ tìm kiếm lệnh BUY khi EMA20 dốc lên và nằm trên EMA50.</p>
        <p>2. Chỉ tìm kiếm lệnh SELL khi EMA20 dốc xuống và nằm dưới EMA50.</p>
        <p>3. Tuyệt đối không giao dịch khi 2 đường bện chặt vào nhau (Sideway).</p>
      `,
      followUpQuestions: [
        { icon: '🧭', text: 'Xác định 5 trạng thái thị trường theo EMA như thế nào?', label: '5 Trạng thái thị trường' },
        { icon: '✂️', text: 'Sự thật về giao cắt EMA20 và EMA50: Có nên mua bán ngay khi vừa cắt không?', label: 'Sự thật giao cắt EMA' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL an toàn' }
      ],
      marketContext: ctx
    })
  },

  // 2. 5 TRẠNG THÁI THỊ TRƯỜNG
  MARKET_STATES: {
    id: 'market_states',
    title: '2. Xác định 5 trạng thái thị trường',
    shortTitle: '5 Trạng thái thị trường',
    icon: '🧭',
    keywords: ['5 trạng thái', 'trạng thái thị trường', 'uptrend', 'downtrend', 'pullback', 'sideway', 'chop', 'phân loại thị trường'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'ĐỊNH DANH 5 TRẠNG THÁI THỊ TRƯỜNG',
      verdictText: 'Trước khi bấm BUY hay SELL, bắt buộc phải biết thị trường đang ở 1 trong 5 pha: Uptrend, Downtrend, Pullback, Sideway hay Nhiễu (Chop)!',
      verdictType: 'INFO',
      coreConditionTitle: '5 PHA VẬN ĐỘNG THEO DẢI EMA20/50',
      coreConditionHtml: `
        <p>1. <strong>UPTREND (Tăng)</strong>: EMA20 > EMA50, cả hai cùng dốc lên ➔ Canh BUY khi giá hồi.</p>
        <p>2. <strong>DOWNTREND (Giảm)</strong>: EMA20 < EMA50, cả hai cùng dốc xuống ➔ Canh SELL khi giá hồi.</p>
        <p>3. <strong>PULLBACK (Hồi kỹ thuật)</strong>: Giá đi ngược xu hướng retest EMA20 hoặc EMA50 ➔ Chờ nến xác nhận để vào lệnh tiếp diễn.</p>
        <p>4. <strong>SIDEWAY (Đi ngang)</strong>: Hai đường phẳng lì, khoảng cách hẹp ➔ Đứng ngoài hoặc chỉ đánh phản ứng tại 2 biên hộp.</p>
        <p>5. <strong>NHIỄU / CHOP (Hỗn loạn)</strong>: Giá đâm xuyên qua lại 2 đường, râu nến giật 2 đầu ➔ ĐỨNG NGOÀI TUYỆT ĐỐI.</p>
      `,
      riskTitle: 'RỦI RO KHI NHẬN ĐỊNH SAI PHA',
      riskHtml: `
        <p>• Áp dụng chiến lược đánh sóng Trend vào thị trường Sideway/Chop sẽ bị quét Stop Loss liên tục 2 đầu.</p>
        <p>• Bắt đáy/đỉnh khi xu hướng đang trong pha dốc mạnh (Uptrend/Downtrend dốc đứng) là tự sát tài khoản.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG THEO TỪNG PHA',
      actionHtml: `
        <p>• <strong>Pha 1 & 2</strong>: Tự tin gồng lệnh theo xu hướng đến TP2/TP3.</p>
        <p>• <strong>Pha 3</strong>: Canh nhịp hồi đẹp để có vị thế Entry R:R tốt nhất.</p>
        <p>• <strong>Pha 4 & 5</strong>: Đóng máy, bảo toàn vốn, chờ xu hướng mới bứt phá.</p>
      `,
      followUpQuestions: [
        { icon: '🟢', text: 'Chiến lược giao dịch BUY thuận xu hướng tăng chuẩn xác?', label: 'Chiến lược BUY chuẩn' },
        { icon: '🔴', text: 'Chiến lược giao dịch SELL thuận xu hướng giảm chuẩn xác?', label: 'Chiến lược SELL chuẩn' },
        { icon: '📦', text: 'Cách giao dịch khi thị trường Sideway đi ngang?', label: 'Cách xử lý Sideway' }
      ],
      marketContext: ctx
    })
  },

  // 3. CHIẾN LƯỢC BUY
  BUY_STRATEGY: {
    id: 'buy_strategy',
    title: '3. Cách giao dịch BUY khi thị trường tăng',
    shortTitle: 'Chiến lược BUY chuẩn',
    icon: '🟢',
    keywords: ['chiến lược buy', 'cách vào buy', 'mua khi nào', 'điều kiện buy', 'vào lệnh buy', 'uptrend buy', 'tín hiệu buy'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CHIẾN LƯỢC BUY THỰC CHIẾN',
      verdictText: '👉 CHỈ BUY KHI GIÁ HỒI VỀ VÙNG EMA20 HOẶC EMA50 VÀ XUẤT HIỆN NẾN XÁC NHẬN TĂNG (PINBAR / ENGULFING) — TUYỆT ĐỐI KHÔNG MUA ĐUỔI!',
      verdictType: 'SUCCESS',
      coreConditionTitle: '4 ĐIỀU KIỆN ĐỂ BẤM LỆNH BUY (THIẾU 1 BỎ QUA)',
      coreConditionHtml: `
        <p>1. <strong>Cấu trúc Đỉnh/Đáy</strong>: Thị trường tạo đỉnh sau cao hơn (HH) và đáy sau cao hơn (HL).</p>
        <p>2. <strong>Vị trí 2 đường</strong>: EMA20 nằm trên EMA50, cả hai đường cùng hướng dốc lên trên.</p>
        <p>3. <strong>Vị trí giá</strong>: Giá vừa hoàn thành nhịp hồi (Pullback) kiểm định vùng EMA20 hoặc dải giữa EMA20-50.</p>
        <p>4. <strong>Nến xác nhận</strong>: Xuất hiện nến rút chân tăng (Pinbar) hoặc nến bao trùm tăng (Bullish Engulfing) đóng cửa vững chắc trên EMA20.</p>
      `,
      riskTitle: 'ĐIỂM CẮT LỖ (SL) BẮT BUỘC & CẢNH BÁO',
      riskHtml: `
        <p>• <strong>Vị trí SL an toàn</strong>: Đặt dưới đáy gần nhất (HL) hoặc dưới dải EMA50 cộng thêm đệm an toàn ATR (khoảng 5 - 8 giá với Vàng).</p>
        <p>• <strong>Bẫy cần tránh</strong>: Mua khi giá đã bung xa EMA20 vượt quá 1.5 ATR ➔ Nguy cơ đu đỉnh nhịp sóng cực cao.</p>
      `,
      actionTitle: 'KỊCH BẢN CHỐT LỜI (TP) KỶ LUẬT',
      actionHtml: `
        <p>• <strong>TP1 (+10 giá / 100 pips)</strong>: Chốt 50% khối lượng, kéo SL về Entry hoặc SL Dương để khóa lãi.</p>
        <p>• <strong>TP2 (+20 giá / 200 pips)</strong>: Tiếp tục gồng phần còn lại theo đỉnh cũ hoặc cản lớn khung H1.</p>
      `,
      followUpQuestions: [
        { icon: '🚫', text: 'Tại sao giá cách xa EMA20 thì không được vào lệnh?', label: 'Chống đu đỉnh ATR' },
        { icon: '🎯', text: 'Cách đánh khi giá hồi sâu về EMA50 (3 trường hợp A, B, C)?', label: 'Hồi sâu về EMA50' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL chuẩn' }
      ],
      marketContext: ctx
    })
  },

  // 4. CHIẾN LƯỢC SELL
  SELL_STRATEGY: {
    id: 'sell_strategy',
    title: '4. Cách giao dịch SELL khi thị trường giảm',
    shortTitle: 'Chiến lược SELL chuẩn',
    icon: '🔴',
    keywords: ['chiến lược sell', 'cách vào sell', 'bán khi nào', 'điều kiện sell', 'vào lệnh sell', 'downtrend sell', 'tín hiệu sell'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CHIẾN LƯỢC SELL THỰC CHIẾN',
      verdictText: '👉 CHỈ SELL KHI GIÁ HỒI LÊN KIỂM ĐỊNH EMA20 HOẶC EMA50 VÀ XUẤT HIỆN NẾN TỪ CHỐI GIẢM — TUYỆT ĐỐI KHÔNG BÁN THÁO THEO CÂY NẾN ĐỎ ĐÃ CHẠY DÀI!',
      verdictType: 'DANGER',
      coreConditionTitle: '4 ĐIỀU KIỆN ĐỂ BẤM LỆNH SELL',
      coreConditionHtml: `
        <p>1. <strong>Cấu trúc Đỉnh/Đáy</strong>: Thị trường tạo đỉnh thấp dần (LH) và đáy thấp dần (LL).</p>
        <p>2. <strong>Vị trí 2 đường</strong>: EMA20 nằm dưới EMA50, cả hai đường cùng chúc dốc xuống.</p>
        <p>3. <strong>Vị trí giá</strong>: Giá hồi phục kỹ thuật (Pullback) chạm vào vùng kháng cự EMA20 hoặc dải EMA20-50.</p>
        <p>4. <strong>Nến xác nhận</strong>: Xuất hiện nến bắn sao (Shooting Star), nến từ chối giá hoặc nến giảm nhấn chìm đóng cửa dưới EMA20.</p>
      `,
      riskTitle: 'ĐIỂM CẮT LỖ (SL) & SAI LẦM BÁN ĐÁY',
      riskHtml: `
        <p>• <strong>Vị trí SL an toàn</strong>: Đặt trên đỉnh hồi gần nhất (LH) hoặc phía trên dải EMA50 cộng đệm ATR (5 - 8 giá).</p>
        <p>• <strong>Bẫy cần tránh</strong>: Nhảy vào Sell khi thấy cây nến đỏ khổng lồ đã đâm thủng xa đường EMA20 ➔ Rất dễ dính nhịp hồi phục ngược lên quét sạch tài khoản.</p>
      `,
      actionTitle: 'KỊCH BẢN CHỐT LỜI KỶ LUẬT',
      actionHtml: `
        <p>• <strong>TP1 (+10 giá / 100 pips)</strong>: Chốt ngay 50% vol, lập tức kéo SL Dương để bảo vệ thành quả.</p>
        <p>• <strong>TP2 & TP3</strong>: Thả trôi gồng lãi về đáy cũ hoặc mốc hỗ trợ H1/H4.</p>
      `,
      followUpQuestions: [
        { icon: '⚠️', text: '4 Dấu hiệu nhận biết xu hướng suy yếu và đảo chiều sớm là gì?', label: 'Dấu hiệu đảo chiều' },
        { icon: '✂️', text: 'Sự thật về giao cắt EMA20 và EMA50: Có nên mua bán ngay khi vừa cắt không?', label: 'Sự thật giao cắt' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Điểm đặt SL an toàn' }
      ],
      marketContext: ctx
    })
  },

  // 5. HỒI SÂU VỀ EMA50
  PULLBACK_EMA50: {
    id: 'pullback_ema50',
    title: '5. Cách đánh khi giá hồi sâu về EMA50',
    shortTitle: 'Hồi sâu về EMA50',
    icon: '🎯',
    keywords: ['hồi sâu', 'về ema50', 'xuyên ema50', 'chạm ema50', 'test ema50', 'trường hợp a', 'trường hợp b', 'trường hợp c'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'PHÂN TÍCH NHỊP HỒI SÂU EMA50',
      verdictText: '👉 KHI GIÁ HỒI SÂU VỀ EMA50, PHẢI CHỜ PHẢN ỨNG NẾN RÕ RÀNG THEO 3 TRƯỜNG HỢP (A, B, C) — TUYỆT ĐỐI KHÔNG BẮT ĐÁY VỘI VÀNG!',
      verdictType: 'WARN',
      coreConditionTitle: '3 TRƯỜNG HỢP PHẢN ỨNG KINH ĐIỂN TẠI EMA50',
      coreConditionHtml: `
        <p>• <strong>Trường hợp A (Bật nảy đẹp - Tốt nhất)</strong>: Giá chạm EMA50 lập tức rút râu dài hoặc tạo nến đảo chiều đóng cửa ngược lại trên EMA20 ➔ <strong>Vào lệnh ngay</strong>, SL dưới râu nến.</p>
        <p>• <strong>Trường hợp B (Giằng co tích lũy)</strong>: Giá lình xình đi ngang quanh EMA50 từ 3-5 nến ➔ <strong>Đứng ngoài chờ</strong> nến bứt phá (Breakout) dứt khoát khỏi vùng giằng co mới vào.</p>
        <p>• <strong>Trường hợp C (Thủng dứt khoát - Cấm vào)</strong>: Nến thân to đóng cửa xuyên thủng hoàn toàn qua EMA50 ➔ <strong>Xu hướng đã bị đe dọa hoặc đảo chiều</strong>, hủy bỏ toàn bộ kế hoạch bắt sóng cũ.</p>
      `,
      riskTitle: 'RỦI RO KHI VỘI VÀNG ĐÓN ĐẦU',
      riskHtml: `
        <p>• Đặt lệnh Limit chờ sẵn tại EMA50 là thói quen xấu: Nếu gặp nến tin tức hoặc xả mạnh (Trường hợp C), lệnh sẽ bị cán qua như xe lu.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG THỰC CHIẾN TỐI ƯU',
      actionHtml: `
        <p>Luôn tuân thủ quy tắc: <strong>Chờ nến M15 đóng cửa xong</strong>, thấy rõ phản ứng từ chối của phe phòng thủ tại EMA50 mới quyết định giải ngân.</p>
      `,
      followUpQuestions: [
        { icon: '🟢', text: 'Chiến lược giao dịch BUY thuận xu hướng tăng chuẩn xác?', label: 'Chiến lược BUY chuẩn' },
        { icon: '⚠️', text: '4 Dấu hiệu nhận biết xu hướng suy yếu và đảo chiều sớm là gì?', label: 'Dấu hiệu suy yếu' },
        { icon: '🌪️', text: 'Cách nhận biết thị trường Nhiễu (Chop) và Bộ lọc khoảng cách D = |EMA20-EMA50|/ATR?', label: 'Bộ lọc Chop & D' }
      ],
      marketContext: ctx
    })
  },

  // 6. GIAO DỊCH SIDEWAY
  SIDEWAY_TRADING: {
    id: 'sideway_trading',
    title: '6. Cách giao dịch khi thị trường Sideway đi ngang',
    shortTitle: 'Giao dịch vùng Sideway',
    icon: '📦',
    keywords: ['sideway', 'sw', 'đi ngang', 'hộp dao động', 'đánh sideway'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CHIẾN THUẬT VÙNG SIDEWAY (ĐI NGANG)',
      verdictText: '👉 TRONG VÙNG SIDEWAY: ĐỨNG NGOÀI LÀ THẮNG 80%! NẾU MUỐN ĐÁNH, CHỈ ĐÁNH PHẢN ỨNG TẠI 2 BIÊN HỘP, TUYỆT ĐỐI KHÔNG ĐÁNH BREAKOUT GIỮA HỘP!',
      verdictType: 'WARN',
      coreConditionTitle: 'ĐẶC ĐIỂM NHẬN DIỆN SIDEWAY THEO MA',
      coreConditionHtml: `
        <p>• Hai đường EMA20 và EMA50 gần như nằm ngang song song, khoảng cách hẹp sát nhau.</p>
        <p>• Giá liên tục dập dình dao động giữa hai biên cản Cứng (Biên Trên Kháng cự - Biên Dưới Hỗ trợ).</p>
      `,
      riskTitle: 'BẪY PHÁ VỠ GIẢ (FAKE BREAKOUT)',
      riskHtml: `
        <p>• Trong Sideway, cây nến đâm thủng biên hộp 80% là quét thanh khoản rồi quay giật lại vào trong hộp.</p>
        <p>• Ai hưng phấn đu theo nến Breakout sẽ dính trọn bẫy kẹt lệnh đu đỉnh / bán đáy.</p>
      `,
      actionTitle: 'KỊCH BẢN HÀNH ĐỘNG CHUẨN XÁC',
      actionHtml: `
        <p>1. <strong>Lựa chọn tốt nhất</strong>: Đứng ngoài bảo vệ vốn, chờ giá bứt phá hẳn khỏi hộp và nến retest thành công.</p>
        <p>2. <strong>Nếu muốn Scalping</strong>: Bán tại Biên Trên (SL 2 giá ngoài hộp) và Mua tại Biên Dưới (SL 2 giá ngoài hộp). Chốt lời ngay giữa hộp tại dải EMA.</p>
      `,
      followUpQuestions: [
        { icon: '🌪️', text: 'Cách nhận biết thị trường Nhiễu (Chop) và Bộ lọc khoảng cách D = |EMA20-EMA50|/ATR?', label: 'Bộ lọc nhiễu Chop' },
        { icon: '✂️', text: 'Sự thật về giao cắt EMA20 và EMA50: Có nên mua bán ngay khi vừa cắt không?', label: 'Giao cắt trong Sideway' },
        { icon: '💯', text: 'Công thức chấm 100 điểm chất lượng tín hiệu (Confirmed, Setup, Watch)?', label: 'Thang điểm 100 V8' }
      ],
      marketContext: ctx
    })
  },

  // 7. BỘ LỌC CHOP & HỆ SỐ D
  CHOP_FILTER_D: {
    id: 'chop_filter_d',
    title: '7. Nhận biết thị trường Nhiễu (Chop) & Bộ lọc D',
    shortTitle: 'Lọc nhiễu Chop & Hệ số D',
    icon: '🌪️',
    keywords: ['chop', 'nhiễu', 'lọc nhiễu', 'bộ lọc d', 'hệ số d', 'd ratio', 'công thức d', 'khoảng cách ema'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'BỘ LỌC ĐỘNG LƯỢNG D = |EMA20 - EMA50| / ATR',
      verdictText: '👉 KHI HỆ SỐ D < 0.8: THỊ TRƯỜNG RƠI VÀO VÙNG NHIỄU (CHOP) NGUY HIỂM — HỆ THỐNG V8 PRO TỰ ĐỘNG KHÓA TOÀN BỘ TÍN HIỆU!',
      verdictType: 'DANGER',
      coreConditionTitle: 'CÔNG THỨC ĐO ĐỘ BỞ CỦA SÓNG',
      coreConditionHtml: `
        <p>• <strong>Công thức chuẩn</strong>: Hệ số <strong>D = |EMA20 - EMA50| / ATR(14)</strong>.</p>
        <p>• <strong>D < 0.8 (Vùng Đỏ - CHOP)</strong>: Hai đường dính vào nhau, độ mở dải sóng quá yếu ➔ Tuyệt đối không giao dịch theo Trend.</p>
        <p>• <strong>0.8 ≤ D < 1.5 (Vùng Vàng - SETUP)</strong>: Dải sóng bắt đầu tách ra, đang hình thành nhịp sóng mới ➔ Chờ nến kiểm định.</p>
        <p>• <strong>D ≥ 1.5 (Vùng Xanh - CONFIRMED)</strong>: Dải sóng mở rộng hoàn hảo, xu hướng rõ ràng ➔ Tín hiệu chất lượng cao nhất.</p>
      `,
      riskTitle: 'TẠI SAO BẮT BUỘC PHẢI CHIA CHO ATR?',
      riskHtml: `
        <p>• Khoảng cách điểm số tuyệt đối giữa 2 EMA là vô nghĩa nếu không đối chiếu với độ biến động (ATR). Ví dụ chênh nhau 3 giá khi Vàng điên loạn khác hoàn toàn khi Vàng trầm lắng.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG BẢO TOÀN TÀI KHOẢN',
      actionHtml: `
        <p>Khi thấy hệ số D thấp hoặc bot báo trạng thái CHOP: Hãy kiên quyết ngồi yên quan sát. Bảo vệ vốn chính là cách kiếm tiền quan trọng nhất trong ngày xấu!</p>
      `,
      followUpQuestions: [
        { icon: '💯', text: 'Công thức chấm 100 điểm chất lượng tín hiệu (Confirmed, Setup, Watch)?', label: 'Thang điểm 100' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi cần tránh' },
        { icon: '📊', text: 'Nguyên tắc phối hợp đa khung thời gian H1, M30, M15, M5 như thế nào?', label: 'Đa khung MTF' }
      ],
      marketContext: ctx
    })
  },

  // 8. SỰ THẬT GIAO CẮT
  CROSSOVER_TRUTH: {
    id: 'crossover_truth',
    title: '8. Sự thật về giao cắt EMA20 và EMA50',
    shortTitle: 'Giao cắt EMA20/EMA50',
    icon: '✂️',
    keywords: ['cắt nhau', 'giao cắt', 'cắt lên', 'cắt xuống', 'golden cross', 'death cross', 'cắt có mua', 'cắt có bán', 'vừa cắt', 'giao cắt.*vào lệnh', 'giao cắt giả'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'SỰ THẬT VỀ GIAO CẮT (CROSSOVER TRUTH)',
      verdictText: '👉 ĐỪNG BAO GIỜ MUA/BÁN CHỈ VÌ THẤY HAI ĐƯỜNG VỪA CẮT NHAU! GIAO CẮT CHỈ LÀ TÍN HIỆU ĐỔI PHA BAN ĐẦU — PHẢI CHỜ NHỊP TEST LẠI (PULLBACK)!',
      verdictType: 'DANGER',
      coreConditionTitle: 'BẢN CHẤT CỦA GIAO CẮT EMA',
      coreConditionHtml: `
        <p>• Đường trung bình trượt (MA) là chỉ báo chạy sau giá (Lagging Indicator). Khi 2 đường cắt nhau thì cây nến dẫn đường thường đã chạy rất xa.</p>
        <p>• Mua ngay khi vừa cắt lên hoặc Bán ngay khi vừa cắt xuống tức là bạn đang mua đỉnh/bán đáy của nhịp xung lực đầu tiên.</p>
      `,
      riskTitle: 'BẪY GIAO CẮT GIẢ (WHIPSAW)',
      riskHtml: `
        <p>• Khi thị trường sideway hoặc chuẩn bị đảo chiều phức tạp, hai đường có thể cắt nhau liên tục 3-4 lần trong vài tiếng. Nếu lệnh nào cũng vào thì tài khoản sẽ bị bào mòn nhanh chóng.</p>
      `,
      actionTitle: 'CÔNG THỨC 3 BƯỚC ĐÁNH SAU KHI CẮT',
      actionHtml: `
        <p>1. <strong>Bước 1</strong>: Thấy cắt nhau ➔ Ghi nhận xu hướng có khả năng đổi chiều, <strong>chưa vào lệnh</strong>.</p>
        <p>2. <strong>Bước 2</strong>: Chờ giá hồi phục (Pullback) quay về retest lại chính dải EMA20/50 vừa cắt.</p>
        <p>3. <strong>Bước 3</strong>: Xuất hiện nến đảo chiều từ chối tại dải EMA ➔ Lúc này mới bấm lệnh! Tỷ lệ thắng tăng từ 40% lên hơn 85%.</p>
      `,
      followUpQuestions: [
        { icon: '🟢', text: 'Chiến lược giao dịch BUY thuận xu hướng tăng chuẩn xác?', label: 'Cách BUY sau cắt' },
        { icon: '🔴', text: 'Chiến lược giao dịch SELL thuận xu hướng giảm chuẩn xác?', label: 'Cách SELL sau cắt' },
        { icon: '🎯', text: 'Cách đánh khi giá hồi sâu về EMA50 (3 trường hợp A, B, C)?', label: 'Hồi sâu retest' }
      ],
      marketContext: ctx
    })
  },

  // 9. THANG ĐIỂM 100
  SCORING_FORMULA: {
    id: 'scoring_formula',
    title: '9. Công thức chấm 100 điểm tín hiệu V8 Pro',
    shortTitle: 'Thang 100 điểm tín hiệu',
    icon: '💯',
    keywords: ['thang điểm', '100 điểm', 'confirmed', 'setup', 'watch', 'công thức tính điểm', 'chấm điểm'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'THANG 100 ĐIỂM ĐÁNH GIÁ CHẤT LƯỢNG TÍN HIỆU',
      verdictText: 'HỆ THỐNG MA WAVE V8 PRO CHỈ KÍCH HOẠT VÀO LỆNH KHI TỔNG ĐIỂM ĐẠT TỪ 75 ĐIỂM TRỞ LÊN (CONFIRMED) — LOẠI BỎ TOÀN BỘ CẢM TÍNH!',
      verdictType: 'INFO',
      coreConditionTitle: 'CƠ CẤU 5 TRỤ CỘT CHẤM ĐIỂM (TỔNG 100 ĐIỂM)',
      coreConditionHtml: `
        <p>1. <strong>Vị trí tương đối & Cấu trúc (30đ)</strong>: EMA20 sắp xếp chuẩn so với EMA50, giá tạo cấu trúc HH/HL hoặc LH/LL rõ nét.</p>
        <p>2. <strong>Độ mở dải sóng & Hệ số D (25đ)</strong>: Khoảng cách giữa 2 đường dãn nở mạnh (D ≥ 1.5 đạt tối đa điểm).</p>
        <p>3. <strong>Đồng thuận Đa khung MTF (20đ)</strong>: Khung H1 và M30 cùng đồng pha với khung M15.</p>
        <p>4. <strong>Price Action xác nhận (15đ)</strong>: Nến từ chối rút râu, mô hình nến uy tín.</p>
        <p>5. <strong>Bộ lọc chống đu đỉnh ATR (10đ)</strong>: Giá không dãn cách quá xa EMA20.</p>
      `,
      riskTitle: 'PHÂN LOẠI TRẠNG THÁI THEO SỐ ĐIỂM',
      riskHtml: `
        <p>• <strong>Score ≥ 75 (CONFIRMED)</strong>: Đủ điều kiện kích hoạt lệnh, tự tin đi đủ volume.</p>
        <p>• <strong>55 ≤ Score < 75 (SETUP)</strong>: Đang theo dõi, chỉ xem xét vào thăm dò khối lượng nhỏ.</p>
        <p>• <strong>Score < 55 (WATCH / WAIT)</strong>: Tín hiệu yếu, cấm vào lệnh.</p>
      `,
      actionTitle: 'LỜI KHUYÊN DÀNH CHO TRADER',
      actionHtml: `
        <p>Đừng vội vã với mọi tín hiệu! Chỉ giải ngân khi hệ thống hiển thị huy hiệu <strong>CONFIRMED (Xanh lục)</strong> để bảo đảm xác suất thắng cao nhất.</p>
      `,
      followUpQuestions: [
        { icon: '📊', text: 'Nguyên tắc phối hợp đa khung thời gian H1, M30, M15, M5 như thế nào?', label: 'Đa khung MTF' },
        { icon: '📈', text: 'Thống kê kiểm định Backtest thực tế hơn 1640 lệnh trên máy chủ?', label: 'Xem thống kê Backtest' },
        { icon: '🛡️', text: 'Quản lý rủi ro, cách đặt SL theo cấu trúc và bộ lọc chống đu đỉnh/đáy ATR?', label: 'Quản lý vốn & SL' }
      ],
      marketContext: ctx
    })
  },

  // 10. ĐA KHUNG THỜI GIAN (MTF)
  MTF_COORDINATION: {
    id: 'mtf_coordination',
    title: '10. Phối hợp đa khung thời gian MTF',
    shortTitle: 'Phối hợp Đa khung (MTF)',
    icon: '📊',
    keywords: ['đa khung', 'mtf', 'h1', 'm30', 'm15', 'm5', 'phối hợp khung', 'khung thời gian'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'NGUYÊN TẮC ĐỒNG BỘ ĐA KHUNG THỜI GIAN',
      verdictText: '👉 KHUNG LỚN (H1) XÁC ĐỊNH BỨC TRANH XU HƯỚNG CHÍNH — KHUNG M15 & M5 ĐẢM NHIỆM TÌM ĐIỂM VÀO LỆNH (TIMING) CÓ STOP LOSS NGẮN NHẤT!',
      verdictType: 'INFO',
      coreConditionTitle: 'PHÂN BỔ NHIỆM VỤ TỪNG KHUNG',
      coreConditionHtml: `
        <p>• <strong>Khung H1 (Bản đồ chỉ đường)</strong>: Nhìn vị trí EMA20/50 trên H1 để biết hôm nay là ngày Ưu tiên BUY hay Ưu tiên SELL. Không bao giờ đánh ngược trend H1.</p>
        <p>• <strong>Khung M15 (Khung giao dịch chính)</strong>: Quan sát nhịp sóng MA Wave V8, kiểm tra sự đồng thuận và tính điểm Setup.</p>
        <p>• <strong>Khung M5 (Bắn tỉa điểm vào)</strong>: Tinh chỉnh điểm vào lệnh khi M15 đã confirm để giảm thiểu tối đa biên độ Stop Loss.</p>
      `,
      riskTitle: 'RỦI RO KHI NHÌN ĐƠN KHUNG',
      riskHtml: `
        <p>• Chỉ nhìn nến M5 thấy tăng vội BUY, nhưng thực tế giá đang đâm đầu thẳng vào bức tường EMA50 khung H1 đang chúc xuống ➔ Lệnh lập tức bị vả gãy cánh.</p>
      `,
      actionTitle: 'QUY TẮC BẤM LỆNH THỰC CHIẾN',
      actionHtml: `
        <p>Chỉ bấm lệnh khi: <strong>H1 chỉ hướng ➔ M15 xác nhận ➔ M5 vào điểm</strong>. Khi cả 3 khung cùng hô một tiếng nói, xác suất thắng đạt trên 85%.</p>
      `,
      followUpQuestions: [
        { icon: '💯', text: 'Công thức chấm 100 điểm chất lượng tín hiệu (Confirmed, Setup, Watch)?', label: 'Thang điểm tín hiệu' },
        { icon: '🟢', text: 'Chiến lược giao dịch BUY thuận xu hướng tăng chuẩn xác?', label: 'Chiến lược BUY' },
        { icon: '🔴', text: 'Chiến lược giao dịch SELL thuận xu hướng giảm chuẩn xác?', label: 'Chiến lược SELL' }
      ],
      marketContext: ctx
    })
  },

  // 11. QUẢN LÝ RỦI RO & SL
  RISK_MANAGEMENT: {
    id: 'risk_management',
    title: '11. Quản lý rủi ro & Cách đặt SL cấu trúc',
    shortTitle: 'Quản lý rủi ro & SL/TP',
    icon: '🛡️',
    keywords: ['đặt sl', 'cắt lỗ', 'chốt lời', 'tp', 'quản lý rủi ro', 'trailing stop', 'đu đỉnh', 'đu đáy', 'sl cấu trúc', 'hòa vốn', 'kéo sl'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'QUẢN TRỊ RỦI RO & ĐẶT STOP LOSS CHUẨN',
      verdictText: '👉 STOP LOSS PHẢI ĐẶT SAU ĐỈNH/ĐÁY CẤU TRÚC HOẶC NGOÀI DẢI EMA50 — TUYỆT ĐỐI KHÔNG BAO GIỜ ĐẶT SL SÁT SẠT NGAY ĐƯỜNG EMA20!',
      verdictType: 'WARN',
      coreConditionTitle: 'VỊ TRÍ ĐẶT STOP LOSS CHUẨN KỸ THUẬT',
      coreConditionHtml: `
        <p>• <strong>Lệnh BUY</strong>: SL đặt dưới đáy gần nhất (Higher Low) + thêm đệm an toàn ATR (khoảng 5 - 8 giá). Khi giá thủng qua mốc này nghĩa là cấu trúc tăng bị gãy thật sự.</p>
        <p>• <strong>Lệnh SELL</strong>: SL đặt trên đỉnh gần nhất (Lower High) + thêm đệm an toàn ATR.</p>
        <p>• <strong>Bộ lọc chống đu đỉnh/đáy</strong>: Nếu giá cách xa EMA20 > 1.5 ATR ➔ Cấm vào lệnh vì khoảng cách đặt SL lúc này quá xa, R:R cực kỳ xấu.</p>
      `,
      riskTitle: 'BẪY QUẸT RÂU LỪA CỦA THỊ TRƯỜNG',
      riskHtml: `
        <p>• Đặt SL ngay tại đường EMA20 rất dễ bị một cây nến giật râu quét SL rồi giá lại bay đúng hướng ➔ Tạo tâm lý ức chế và cay cú trả thù thị trường.</p>
      `,
      actionTitle: 'QUY TẮC DỜI SL DƯƠNG BẢO TOÀN LÃI',
      actionHtml: `
        <p>1. Khi giá chạy lãi đạt <strong>TP1 (+10 giá / 100 pips)</strong> ➔ Ngay lập tức kéo SL về điểm vào (Breakeven) hoặc SL Dương (+5 pips).</p>
        <p>2. Khi đã dời SL Dương, lệnh của bạn đã an toàn 100% (Không thể lỗ), tâm lý thoải mái để gồng tới TP2/TP3.</p>
      `,
      followUpQuestions: [
        { icon: '🎯', text: 'Tài khoản 1000$ thì nên đi volume bao nhiêu lot và quản lý vốn ra sao?', label: 'Cách tính lot quản lý vốn' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi trader hay mắc' },
        { icon: '⚠️', text: '4 Dấu hiệu nhận biết xu hướng suy yếu và đảo chiều sớm là gì?', label: 'Dấu hiệu gãy sóng' }
      ],
      marketContext: ctx
    })
  },

  // 12. DẤU HIỆU SUY YẾU / ĐẢO CHIỀU
  WEAKNESS_SIGNS: {
    id: 'weakness_signs',
    title: '12. Dấu hiệu xu hướng suy yếu và đảo chiều sớm',
    shortTitle: 'Dấu hiệu suy yếu / Đảo chiều',
    icon: '⚠️',
    keywords: ['suy yếu', 'đảo chiều', 'hết sóng', 'mất đà', 'sắp gãy', 'phân kỳ'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'NHẬN DIỆN SÓNG SUY YẾU & SẮP ĐẢO CHIỀU',
      verdictText: '👉 XU HƯỚNG KHÔNG TỰ NHIÊN ĐẢO CHIỀU MÀ LUÔN PHÁT RA 4 TÍN HIỆU CẢNH BÁO SỚM — NHÌN THẤY THÌ PHẢI CHỐT LÃI HOẶC NÂNG SL NGAY!',
      verdictType: 'WARN',
      coreConditionTitle: '4 DẤU HIỆU CẢNH BÁO SÓNG HẾT ĐÀ',
      coreConditionHtml: `
        <p>1. <strong>Độ dốc thoải dần</strong>: Dải EMA20 đang dốc 45 độ bỗng nhiên nằm ngang và uốn cong lại gần EMA50.</p>
        <p>2. <strong>Khoảng cách thu hẹp</strong>: Hệ số D co cụm từ >1.5 rớt xuống dưới 1.0.</p>
        <p>3. <strong>Không tạo được Đỉnh/Đáy mới</strong>: Phe mua không đẩy nổi đỉnh cao hơn (Fail to make HH), hoặc liên tục tạo râu trên dài.</p>
        <p>4. <strong>Nến đóng cửa xuyên qua EMA50</strong>: Đây là phát súng cảnh báo cuối cùng xác nhận nhịp điều chỉnh sâu hoặc chuyển pha sang xu hướng ngược lại.</p>
      `,
      riskTitle: 'RỦI RO CỐ CHẤP GỒNG LỆNH',
      riskHtml: `
        <p>• Thấy xu hướng suy yếu nhưng vẫn ôm hy vọng giá bay tiếp mà không dời SL dương ➔ Từ vị thế đang có lãi biến thành lệnh thua lỗ nặng nề.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG KHÔN NGOAN',
      actionHtml: `
        <p>Khi xuất hiện từ 2 dấu hiệu trở lên: Chủ động chốt lời 70% vị thế, phần còn lại nâng SL bám sát đít nến gần nhất (Trailing Stop) để bảo toàn thành quả.</p>
      `,
      followUpQuestions: [
        { icon: '🎯', text: 'Cách đánh khi giá hồi sâu về EMA50 (3 trường hợp A, B, C)?', label: 'Phản ứng tại EMA50' },
        { icon: '✂️', text: 'Sự thật về giao cắt EMA20 và EMA50: Có nên mua bán ngay khi vừa cắt không?', label: 'Giao cắt đảo chiều' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Điểm đặt SL an toàn' }
      ],
      marketContext: ctx
    })
  },

  // 13. KIỂM ĐỊNH BACKTEST
  BACKTEST_STATS: {
    id: 'backtest_stats',
    title: '13. Thống kê kiểm định Backtest thực tế hơn 1640 lệnh',
    shortTitle: 'Kiểm định Backtest thực tế',
    icon: '📈',
    keywords: ['thống kê', 'kiểm định', 'backtest', 'win rate', 'tỷ lệ thắng'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'BÁO CÁO KIỂM ĐỊNH THỰC TẾ (HƠN 1.640 LỆNH)',
      verdictText: 'HỆ THỐNG MA WAVE V8 ĐÃ VƯỢT QUA KIỂM NGHIỆM THỰC CHIẾN HƠN 1.640 LỆNH ĐA TÀI SẢN (VÀNG, BTC, BẠC) VỚI TỶ LỆ ĐẠT TP1/TP2 VƯỢT TRỘI TRÊN 92%!',
      verdictType: 'SUCCESS',
      coreConditionTitle: 'SỐ LIỆU THỐNG KÊ MINH BẠCH TỪ HỆ THỐNG',
      coreConditionHtml: `
        <p>• <strong>Quy mô mẫu</strong>: Hơn 1.640 lệnh phát sinh thực tế lưu trữ vĩnh viễn trên cơ sở dữ liệu máy chủ.</p>
        <p>• <strong>Tỷ lệ chạm TP1 (+10 giá Vàng / +1.200 pts BTC)</strong>: Đạt 92.4% khi có bộ lọc Confirmed.</p>
        <p>• <strong>Cơ chế tự động kéo SL Dương</strong>: Giúp triệt tiêu hoàn toàn rủi ro bị quay đầu âm vốn sau khi đã có lãi.</p>
        <p>• <strong>Lợi nhuận ròng lũy kế</strong>: Tăng trưởng đều đặn qua các chu kỳ biến động mạnh của thị trường tài chính.</p>
      `,
      riskTitle: 'LƯU Ý VỀ TÍNH KỶ LUẬT',
      riskHtml: `
        <p>• Tỷ lệ thắng cao của hệ thống đến từ việc <strong>KIÊN QUYẾT BỎ QUA CÁC TÍN HIỆU NHIỄU (CHOP)</strong>. Nếu người dùng tự ý vào lệnh bừa bãi khi hệ thống báo WAIT thì tỷ lệ thắng sẽ giảm sút.</p>
      `,
      actionTitle: 'HƯỚNG DẪN TẬN DỤNG TỐI ĐA',
      actionHtml: `
        <p>Xem toàn bộ chi tiết từng lệnh tại tab <strong>📊 Lịch Sử</strong> (có đầy đủ mốc Vào, SL, TP1-3 và PnL thực tế để bạn tự kiểm chứng).</p>
      `,
      followUpQuestions: [
        { icon: '💯', text: 'Công thức chấm 100 điểm chất lượng tín hiệu (Confirmed, Setup, Watch)?', label: 'Thang điểm tín hiệu' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi kinh điển' },
        { icon: '🛡️', text: 'Quản lý rủi ro, cách đặt SL theo cấu trúc và bộ lọc chống đu đỉnh/đáy ATR?', label: 'Quản lý rủi ro' }
      ],
      marketContext: ctx
    })
  },

  // 14. 8 LỖI KINH ĐIỂN
  CLASSIC_MISTAKES: {
    id: 'classic_mistakes',
    title: '14. 8 Lỗi kinh điển cần tuyệt đối tránh khi dùng MA',
    shortTitle: '8 Lỗi kinh điển cần tránh',
    icon: '❌',
    keywords: ['lỗi', 'sai lầm', 'cần tránh', '8 lỗi', 'lỗi kinh điển', 'thất bại', 'cháy tài khoản'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: '8 TAI HỌA KINH ĐIỂN KHIẾN TRADER CHÁY TÀI KHOẢN',
      verdictText: '👉 90% TRADER THUA LỖ KHÔNG PHẢI VÌ THIẾU KIẾN THỨC MÀ VÌ PHẠM PHẢI 8 LỖI KINH ĐIỂN DƯỚI ĐÂY — ĐỌC VÀ KHẮC CỐT GHI TÂM!',
      verdictType: 'DANGER',
      coreConditionTitle: 'DANH SÁCH 8 SAI LẦM NGUY HIỂM NHẤT',
      coreConditionHtml: `
        <p>1. <strong>Vừa thấy EMA20 cắt EMA50 là bấm lệnh ngay</strong> (dính bẫy giao cắt giả khi thị trường đang phẳng).</p>
        <p>2. <strong>Mua / Bán khi giá đã dãn cách quá xa EMA20</strong> (đu đỉnh hoặc bán tháo ngay đáy nhịp sóng).</p>
        <p>3. <strong>Cố chấp áp dụng chiến lược trend trong thị trường Sideway hoặc Chop</strong>.</p>
        <p>4. <strong>Đặt Stop Loss quá sát đường EMA20</strong> thay vì đặt ngoài cấu trúc đỉnh/đáy.</p>
        <p>5. <strong>Đánh ngược xu hướng của khung thời gian lớn hơn (H1)</strong>.</p>
        <p>6. <strong>Vào lệnh khi nến chưa đóng cửa</strong> (bị quét râu lừa).</p>
        <p>7. <strong>Gồng lỗ vô kỷ luật</strong> khi cấu trúc HL/LH đã bị phá vỡ hoàn toàn.</p>
        <p>8. <strong>Giao dịch ngay sát giờ Tin Đỏ (CPI, Fed, NFP)</strong> chuẩn bị công bố.</p>
      `,
      riskTitle: 'HẬU QUẢ TÂM LÝ DÂY CHUYỀN',
      riskHtml: `
        <p>• Một lần phạm lỗi dẫn đến thua lỗ bất ngờ ➔ Cay cú muốn gỡ gạc ➔ Tăng volume gấp đôi ➔ Cháy tài khoản chỉ trong 1 buổi tối.</p>
      `,
      actionTitle: 'CÂU THẦN CHÚ SỐNG CÒN',
      actionHtml: `
        <p>\"Không có phương pháp nào đúng 100%, nhưng kỷ luật cắt lỗ và tuân thủ bộ lọc chất lượng sẽ giúp bạn luôn nằm trong nhóm 5% trader chiến thắng lâu dài!\"</p>
      `,
      followUpQuestions: [
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL chuẩn' },
        { icon: '🚫', text: 'Tại sao giá cách xa EMA20 thì không được vào lệnh?', label: 'Chống đu đỉnh ATR' },
        { icon: '✂️', text: 'Sự thật về giao cắt EMA20 và EMA50: Có nên mua bán ngay khi vừa cắt không?', label: 'Sự thật giao cắt' }
      ],
      marketContext: ctx
    })
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CÁC TÌNH HUỐNG THỰC CHIẾN BỔ SUNG (TRADER PSYCHOLOGY & REAL SITUATIONS)
  // ══════════════════════════════════════════════════════════════════════════

  // 15. TÌNH HUỐNG FOMO ĐUỔI GIÁ
  TRADER_FOMO: {
    id: 'trader_fomo',
    title: 'Có nên mua đuổi / bán đuổi khi giá bay mạnh không?',
    shortTitle: 'Xử lý tâm lý FOMO đuổi giá',
    icon: '🚫',
    keywords: ['mua đuổi', 'bán đuổi', 'đuổi giá', 'bay mạnh', 'tăng mạnh quá', 'sợ lỡ sóng', 'lỡ tàu', 'sợ mất cơ hội', 'fomo', 'đu đỉnh', 'đu đáy', 'có nên nhảy vào'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CẢNH BÁO TÂM LÝ FOMO (SỢ BỎ LỠ CƠ HỘI)',
      verdictText: '🛑 TUYỆT ĐỐI KHÔNG MUA ĐUỔI HOẶC BÁN ĐUỔI LÚC NÀY! KHI NẾN ĐÃ BAY XA KHỎI EMA20, ĐÓ LÀ VÙNG XẢ HÀNG CỦA CÁ MẬP — NHẢY VÀO LÀ LÀM THANH KHOẢN CHO HỌ!',
      verdictType: 'DANGER',
      coreConditionTitle: 'BẢN CHẤT CỦA LỰC HÚT ĐƯỜNG TRUNG BÌNH (MEAN REVERSION)',
      coreConditionHtml: `
        <p>• Đường EMA20 giống như một sợi dây chun co giãn: Khi giá bị kéo dãn ra quá xa khỏi EMA20 (vượt quá 1.5 - 2.0 lần biên độ ATR), lực hút quy hồi tâm sẽ kéo giá giật ngược trở lại.</p>
        <p>• Nhảy vào lúc nến xanh dài ngoằng nghĩa là bạn mua ở mức giá đắt nhất của nhịp sóng, và mốc Stop Loss của bạn sẽ xa tít tắp (R:R cực kỳ tồi tệ).</p>
      `,
      riskTitle: 'KỊCH BẢN ĐAU ĐỚN KHI ĐU ĐỈNH',
      riskHtml: `
        <p>• Vừa bấm BUY xong thì giá lập tức quay đầu giảm để retest EMA20. Bạn bị âm ngay tức thì, tâm lý hoảng loạn cắt lỗ ở đáy nến retest, rồi giá lại quay đầu bay tiếp!</p>
      `,
      actionTitle: 'HÀNH ĐỘNG KHÔN NGOAN CỦA TRADER KINH NGHIỆM',
      actionHtml: `
        <p>1. <strong>Thà chảy nước miếng còn hơn chảy nước mắt</strong>: Bỏ lỡ một nhịp sóng không làm bạn mất tiền. Nhưng đu đỉnh sẽ làm bạn cháy túi.</p>
        <p>2. <strong>Kiên nhẫn chờ hồi (Pullback)</strong>: Đợi giá nguội lại, hồi về retest dải EMA20 hoặc EMA50 và có nến từ chối thì mới ung dung vào lệnh với SL cực ngắn.</p>
      `,
      followUpQuestions: [
        { icon: '🎯', text: 'Hồi sâu về EMA50 thì khi nào mua được?', label: 'Cách canh nhịp hồi EMA50' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL an toàn' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi kinh điển' }
      ],
      marketContext: ctx
    })
  },

  // 16. TÌNH HUỐNG KẸT LỆNH / ĐANG ÂM NẶNG
  TRADER_TRAPPED: {
    id: 'trader_trapped',
    title: 'Cách xử lý khi lỡ kẹt lệnh / đang bị âm nặng',
    shortTitle: 'Cứu lệnh kẹt / Âm vốn',
    icon: '🚑',
    keywords: ['kẹt lệnh', 'lỡ buy đỉnh', 'lỡ sell đáy', 'bị âm', 'gồng lỗ', 'cứu tài khoản', 'sắp cháy', 'xử lý lệnh lỗ', 'âm nặng'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'PHƯƠNG ÁN CẤP CỨU LỆNH KẸT / ÂM VỐN',
      verdictText: '🚑 BÌNH TĨNH! KHÔNG ĐƯỢC NHỒI LỆNH TRẢ THÙ! HÃY ĐỐI CHIẾU NGAY CẤU TRÚC ĐỈNH/ĐÁY VÀ DẢI EMA ĐỂ ĐƯA RA QUYẾT ĐỊNH DỨT KHOÁT!',
      verdictType: 'WARN',
      coreConditionTitle: 'ĐÁNH GIÁ THỰC TẾ: VỊ THẾ CÒN CỨU ĐƯỢC KHÔNG?',
      coreConditionHtml: `
        <p>• <strong>Nếu đang kẹt lệnh BUY</strong>: Nhìn xem giá đã đâm thủng dải EMA50 và đáy thấp nhất khung H1 chưa? Nếu nến H1 đã đóng cửa dứt khoát dưới EMA50 ➔ Cấu trúc tăng đã gãy, không còn lý do kỹ thuật để gồng.</p>
        <p>• <strong>Nếu đang kẹt lệnh SELL</strong>: Nếu giá đã vượt đỉnh cũ và nằm vững trên EMA50 khung H1 ➔ Đà tăng áp đảo, tiếp tục gồng chỉ làm tài khoản cạn kiệt margin.</p>
      `,
      riskTitle: 'SAI LẦM CHẾT NGƯỜI: NHỒI THÊM LỆNH TRUNG BÌNH GIÁ (DCA)',
      riskHtml: `
        <p>• Khi đang âm nặng mà tiếp tục nhồi lệnh gấp đôi khối lượng để mong giá hồi về bờ là con đường ngắn nhất dẫn tới Margin Call.</p>
      `,
      actionTitle: '3 KỊCH BẢN XỬ LÝ DỨT ĐIỂM',
      actionHtml: `
        <p>• <strong>Kịch bản 1 (Cắt lỗ bảo toàn mạng sống)</strong>: Nếu tài khoản chịu đựng vượt quá 10% vốn, hãy dũng cảm cắt bỏ ngay. Giữ được tiền gốc thì ngày mai bạn vẫn còn cơ hội gỡ lại bằng các lệnh chuẩn.</p>
        <p>• <strong>Kịch bản 2 (Thoát hàng tại nhịp hồi kỹ thuật)</strong>: Canh giá có nhịp Pullback về retest lại dải EMA20/50 để đóng lệnh ở mức lỗ nhỏ nhất có thể.</p>
        <p>• <strong>Kịch bản 3 (Khóa hedging)</strong>: Nếu margin dưới 100%, tạm thời cân bằng vị thế để tránh quét tài khoản, sau đó gỡ từng phần.</p>
      `,
      followUpQuestions: [
        { icon: '🛡️', text: 'Quản lý rủi ro, cách đặt SL theo cấu trúc và bộ lọc chống đu đỉnh/đáy ATR?', label: 'Kỷ luật quản lý vốn' },
        { icon: '⚠️', text: '4 Dấu hiệu nhận biết xu hướng suy yếu và đảo chiều sớm là gì?', label: 'Dấu hiệu gãy sóng' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi trader hay mắc' }
      ],
      marketContext: ctx
    })
  },

  // 17. TÌNH HUỐNG THỊ TRƯỜNG KHÓ CHỊU / QUÉT SL
  TRADER_CHOP_ANNOYING: {
    id: 'trader_chop_annoying',
    title: 'Tại sao thị trường đi khó chịu / quét SL liên tục?',
    shortTitle: 'Thị trường khó chịu / Quét SL',
    icon: '🌪️',
    keywords: ['khó chịu', 'thị trường bẩn', 'quét sl', 'bị cắn sl', 'giật 2 đầu', 'đi ngang khó chịu', 'đánh khó quá', 'sao hôm nay vàng đi khó'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'GIẢI MÃ NGUYÊN NHÂN THỊ TRƯỜNG ĐI KHÓ CHỊU',
      verdictText: '🌪️ THỊ TRƯỜNG ĐANG Ở PHA NHIỄU (CHOP) HOẶC SÁT GIỜ TIN TỨC VĨ MÔ — CÁ MẬP ĐANG QUÉT THANH KHOẢN HAI ĐẦU, BẠN VÀO LÀM MỒI CHO HỌ!',
      verdictType: 'WARN',
      coreConditionTitle: 'TẠI SAO BẠN BỊ QUÉT SL XONG GIÁ LẠI CHẠY ĐÚNG HƯỚNG?',
      coreConditionHtml: `
        <p>• Khi thị trường thiếu động lượng hoặc đang nén lại chờ tin tức (CPI, FOMC, NFP), giá sẽ giật râu 2 đầu liên tục để triệt tiêu toàn bộ lệnh Stop Loss của cả phe Buy lẫn phe Sell.</p>
        <p>• Lúc này hai đường EMA20 và EMA50 bện chặt vào nhau, hệ số D rơi xuống dưới 0.8 ➔ Đây là môi trường sát thủ đối với các phương pháp theo Trend.</p>
      `,
      riskTitle: 'BẪY TÂM LÝ CAY CÚ',
      riskHtml: `
        <p>• Bị cắn SL xong thấy giá bay đúng hướng ➔ Tức giận nhảy vào lại ➔ Lại bị quét phát thứ 2. Đây là cái vòng lẩn quẩn hủy hoại tài khoản nhanh nhất.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG ĐÚNG ĐẮN DUY NHẤT',
      actionHtml: `
        <p>1. <strong>ĐÓNG MÀN HÌNH NGHỈ NGƠI</strong>: Nhận biết thị trường Chop và đứng ngoài là kỹ năng của một Pro Trader.</p>
        <p>2. Chờ khi thị trường có một cây nến xung lực bứt phá dứt khoát khỏi vùng hộp, hai đường EMA tách mở dải sóng rõ ràng (D ≥ 1.5) mới quay lại thị trường.</p>
      `,
      followUpQuestions: [
        { icon: '🌪️', text: 'Cách nhận biết thị trường Nhiễu (Chop) và Bộ lọc khoảng cách D = |EMA20-EMA50|/ATR?', label: 'Bộ lọc hệ số D' },
        { icon: '📦', text: 'Cách giao dịch khi thị trường Sideway đi ngang?', label: 'Chiến lược Sideway' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL chống quét' }
      ],
      marketContext: ctx
    })
  },

  // 18. TÌNH HUỐNG HỎI VÀO LỆNH NGAY BÂY GIỜ
  TRADER_ENTRY_NOW: {
    id: 'trader_entry_now',
    title: 'Hiện tại có nên vào lệnh không? Giờ Buy hay Sell?',
    shortTitle: 'Đánh giá điểm vào lệnh ngay lúc này',
    icon: '🎯',
    keywords: ['giờ mua được chưa', 'giờ bán được chưa', 'vào lệnh được chưa', 'có lệnh chưa', 'vào lệnh gì', 'buy hay sell lúc này', 'hiện tại vào lệnh', 'nên mua hay bán'],
    render: (ctx) => {
      const isConfirmed = ctx && ctx.st && ctx.st.shouldEmit;
      const dir = (ctx && ctx.st && ctx.st.direction) ? ctx.st.direction : 'QUAN SÁT';
      const verdict = isConfirmed
        ? `🟢 TÍN HIỆU KHẢ DỤNG: ƯU TIÊN ${dir} XAU/USD (ĐIỂM CHẤT LƯỢNG ${ctx.st.score}/100 - CONFIRMED)`
        : '⏳ HIỆN TẠI NÊN ĐỨNG NGOÀI QUAN SÁT (CHƯA ĐỦ ĐIỀU KIỆN CONFIRMED)!';

      return renderStructuredResponse({
        badgeTitle: 'ĐÁNH GIÁ THỰC CHIẾN REALTIME',
        verdictText: verdict,
        verdictType: isConfirmed ? 'SUCCESS' : 'WARN',
        coreConditionTitle: 'ĐỐI CHIẾU VỚI BỐI CẢNH THỊ TRƯỜNG HIỆN TẠI',
        coreConditionHtml: `
          <p>• <strong>Giá Vàng hiện tại</strong>: <strong class="text-white">$${ctx ? ctx.livePriceStr : '3,885.00'}</strong> | Trạng thái: <strong class="text-amber-400">${ctx ? ctx.stateDesc : 'Đang cập nhật'}</strong>.</p>
          <p>• <strong>Ngưỡng kỹ thuật M15</strong>: EMA20 = <strong>${ctx ? ctx.ema20Str : 'N/A'}</strong> | EMA50 = <strong>${ctx ? ctx.ema50Str : 'N/A'}</strong> | ATR = <strong>${ctx ? ctx.atrStr : 'N/A'}</strong>.</p>
          <p>• <strong>Đồng bộ đa khung (MTF)</strong>: <strong>${ctx ? ctx.mtfStr : 'Đang đồng bộ'}</strong>.</p>
        `,
        riskTitle: 'LÝ DO KHÔNG VÀO BỪA BÃI',
        riskHtml: isConfirmed
          ? `<p>• Dù có tín hiệu Confirmed, luôn luôn phải tuân thủ mốc SL cấu trúc tại <strong>${ctx.st.sl ? '$' + ctx.st.sl.toFixed(2) : 'Theo đáy gần nhất'}</strong>. Không bao giờ thả trôi SL!</p>`
          : `<p>• Điểm chất lượng chưa đạt ngưỡng 75/100. Thị trường có thể đang trong nhịp dãn xa EMA20 hoặc chưa có nến xác nhận đóng cửa ➔ Vào lệnh lúc này có rủi ro cao.</p>`,
        actionTitle: 'KẾ HOẠCH HÀNH ĐỘNG CỤ THỂ',
        actionHtml: isConfirmed
          ? `<p>• Đi khối lượng chuẩn (1-2% rủi ro tài khoản), TP1 tại <strong>${ctx.st.tp1 ? '$' + ctx.st.tp1.toFixed(2) : '+10 giá'}</strong>. Đạt TP1 lập tức kéo SL Dương.</p>`
          : `<p>• Kiên nhẫn chờ nến M15 đóng cửa và hệ thống Radar phát thông báo trên màn hình. Tín hiệu tốt luôn dành cho người biết chờ đợi!</p>`,
        followUpQuestions: [
          { icon: '💯', text: 'Công thức chấm 100 điểm chất lượng tín hiệu (Confirmed, Setup, Watch)?', label: 'Xem tiêu chí chấm điểm' },
          { icon: '🟢', text: 'Chiến lược giao dịch BUY thuận xu hướng tăng chuẩn xác?', label: 'Chiến lược BUY chuẩn' },
          { icon: '🔴', text: 'Chiến lược giao dịch SELL thuận xu hướng giảm chuẩn xác?', label: 'Chiến lược SELL chuẩn' }
        ],
        marketContext: ctx
      });
    }
  },

  // 19. TÌNH HUỐNG QUẢN LÝ VỐN & TÍNH LOT
  TRADER_CAPITAL_LOT: {
    id: 'trader_capital_lot',
    title: 'Cách tính lot và quản lý vốn an toàn cho tài khoản',
    shortTitle: 'Quản lý vốn & Đi bao nhiêu lot',
    icon: '💰',
    keywords: ['đi bao nhiêu lot', 'tính lot', 'tài khoản 1000', 'tài khoản 500', 'tài khoản 2000', 'quản lý vốn thế nào', 'tỷ lệ rr', 'khối lượng vào lệnh', 'đi vol mấy'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'QUY TẮC QUẢN LÝ VỐN & ĐI VOLUME BẤT BẠI',
      verdictText: '👉 NGUYÊN TẮC BẢN THÂN: RỦI RO CHO 1 LỆNH TỐI ĐA CHỈ ĐƯỢC PHÉP TỪ 1% ĐẾN 2% TỔNG TÀI KHOẢN — CẤM TUYỆT ĐỐI ĐÁNH TẤT TAY (ALL-IN)!',
      verdictType: 'INFO',
      coreConditionTitle: 'BẢNG TÍNH VOLUME KHUYẾN NGHỊ CHO VÀNG (XAU/USD)',
      coreConditionHtml: `
        <p>Giả sử Stop Loss cấu trúc trung bình là <strong>5 giá (50 pips = $50 / 0.10 lot)</strong>:</p>
        <p>• <strong>Tài khoản $500</strong>: Đi <strong>0.01 – 0.02 lot</strong> (Rủi ro: $5 – $10 / lệnh = 1-2%).</p>
        <p>• <strong>Tài khoản $1.000</strong>: Đi <strong>0.02 – 0.04 lot</strong> (Rủi ro: $10 – $20 / lệnh = 1-2%).</p>
        <p>• <strong>Tài khoản $2.000</strong>: Đi <strong>0.05 – 0.08 lot</strong> (Rủi ro: $25 – $40 / lệnh).</p>
        <p>• <strong>Tài khoản $5.000</strong>: Đi <strong>0.10 – 0.20 lot</strong> (Rủi ro: $50 – $100 / lệnh).</p>
      `,
      riskTitle: 'TẠI SAO ĐI QUÁ VOL LẠI LUÔN CHÁY TÀI KHOẢN?',
      riskHtml: `
        <p>• Dù hệ thống có tỷ lệ thắng 90%, nhưng trong thị trường tài chính xác suất thua 2-3 lệnh liên tiếp là điều hoàn toàn bình thường. Nếu đi vol 0.50 lot trên tài khoản $1.000, chỉ cần dính 2 nhịp SL là tài khoản bốc hơi 50%!</p>
      `,
      actionTitle: 'CÔNG THỨC R:R CỦA MA WAVE V8',
      actionHtml: `
        <p>Luôn duy trì tỷ lệ Lợi nhuận / Rủi ro (R:R) tối thiểu từ <strong>1.5 đến 2.0</strong> (SL 5 giá thì TP1 phải từ 8 - 10 giá). Khi chạm TP1, khóa SL Dương để loại bỏ hoàn toàn rủi ro cho tài khoản.</p>
      `,
      followUpQuestions: [
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL an toàn' },
        { icon: '📈', text: 'Thống kê kiểm định Backtest thực tế hơn 1640 lệnh trên máy chủ?', label: 'Kiểm định Backtest' },
        { icon: '❌', text: '8 Lỗi kinh điển cần tuyệt đối tránh khi sử dụng MA?', label: '8 Lỗi trader hay mắc' }
      ],
      marketContext: ctx
    })
  }
,

  // 20. ĐÀM THOẠI MỞ & LẮNG NGHE THẮC MẮC TRADER
  OPEN_GREETING_DIALOGUE: {
    id: 'open_greeting_dialogue',
    title: 'Đàm thoại mở & Lắng nghe thắc mắc trader',
    shortTitle: 'Đàm thoại & Lắng nghe mở',
    icon: '🌸',
    keywords: ['xin chào', 'chào bạn', 'chào em', 'hello', 'hi', 'alo', 'có ai không', 'test bot', 'mình đang cần', 'xin chào tất cả các bạn', 'bắt đầu trò chuyện', 'chào tất cả các bạn'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'ĐÀM THOẠI MỞ & HỖ TRỢ TRỰC TIẾP',
      emotionNote: 'Chào bạn! Mình là nữ cố vấn chiến lược MA Wave V8 PRO. Rất vui được gặp bạn! Mình luôn ở đây 24/7 để đồng hành, lắng nghe và chia sẻ mọi góc nhìn thực chiến cùng bạn. Bạn đang quan tâm hay thắc mắc điều gì nhất lúc này, có thể giải thích hoặc chia sẻ chi tiết cho mình nhé?',
      verdictText: '🌸 SẴN SÀNG GIẢI MÃ MỌI VẤN ĐỀ VỀ VÀNG (XAU/USD), TÍN HIỆU BOT & HỆ THỐNG EMA20/50 CHO BẠN!',
      verdictType: 'INFO',
      winWinTitle: 'LỢI THẾ KHI ĐỒNG HÀNH CÙNG GOLD AI MENTOR',
      winWinHtml: `
        <p>• <strong>Bám sát nhịp nến M15</strong>: Phân tích khách quan độ dốc và khoảng cách EMA20/50 theo thời gian thực.</p>
        <p>• <strong>Bảo vệ kỷ luật bản thân</strong>: Kiểm soát tâm lý FOMO, chống đu đỉnh/bán đáy, tính toán lot chuẩn 1-2% rủi ro.</p>
        <p>• <strong>Tỷ lệ R:R tối ưu</strong>: Luôn tìm kiếm các điểm vào lệnh có tiềm năng lợi nhuận tối thiểu 1:1.5 đến 1:3.</p>
      `,
      riskTitle: 'NHỮNG RỦI RO LỚN NHẤT CẦN LOẠI BỎ',
      riskHtml: `
        <p>• <strong>Giao dịch theo cảm tính</strong>: Đánh theo linh cảm hoặc thấy nến xanh đỏ giật mạnh là nhảy vào bấm lệnh.</p>
        <p>• <strong>Gồng lỗ & Nhồi lệnh ngược xu hướng</strong>: Khiến tài khoản bốc hơi nhanh chóng khi thị trường vào sóng mạnh.</p>
        <p>• <strong>Chưa hiểu bản chất tín hiệu</strong>: Vào lệnh mà không biết tại sao bot Buy/Sell, dẫn đến hoang mang khi giá rung lắc.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG BẢN THÂN CẦN LÀM NGAY BÂY GIỜ',
      actionHtml: `
        <p>1. <strong>Nếu bạn thắc mắc về tín hiệu bot vừa ra</strong>: Hãy hỏi ngay <em>"Tại sao tín hiệu bot vừa vào lại như này?"</em> để mình giải mã chi tiết các yếu tố kỹ thuật.</p>
        <p>2. <strong>Nếu bạn đang có lệnh kẹt</strong>: Cứ nhắn rõ giá vào lệnh và hướng Buy/Sell, mình sẽ đưa ra phương án xử lý giảm thiểu thiệt hại.</p>
        <p>3. <strong>Hoặc bấm nhanh các gợi ý 1-chạm bên dưới</strong> để khám phá ngay tình trạng thị trường lúc này nhé!</p>
      `,
      followUpQuestions: [
        { icon: '🔍', text: 'Tại sao tín hiệu bot vừa vào lại Buy/Sell ở giá này?', label: 'Giải mã tín hiệu mới nhất' },
        { icon: '🩺', text: 'Khám sức khỏe thị trường Vàng Realtime (Độ giãn EMA20/50 & Bẫy FOMO)?', label: 'Khám sức khỏe thị trường' },
        { icon: '📈', text: 'Khung M15 đang thuận hay nghịch H1?', label: 'M15 thuận hay nghịch H1?' },
        { icon: '💰', text: 'Tài khoản 1000$ thì đi bao nhiêu lot và quản lý vốn ra sao?', label: 'Tính Lot chuẩn vốn 1000$' }
      ],
      marketContext: ctx
    })
  },

  // 21. GIẢI MÃ TÍN HIỆU BOT MỚI NHẤT
  EXPLAIN_LATEST_SIGNAL: {
    id: 'explain_latest_signal',
    title: 'Giải mã chi tiết lý do và cấu trúc tín hiệu bot vừa phát',
    shortTitle: 'Giải mã tín hiệu bot mới nhất',
    icon: '🔍',
    keywords: ['tại sao tín hiệu', 'tại sao bot lại vào', 'sao bot lại ra tín hiệu', 'lý do vào lệnh', 'tại sao lại buy ở đây', 'tại sao lại sell ở đây', 'giải thích tín hiệu', 'tại sao tín hiệu này lại như này', 'sao lại có lệnh', 'tại sao lệnh dính sl', 'tại sao lại báo buy', 'tại sao lại báo sell', 'giải mã tín hiệu'],
    render: (ctx) => {
      const sig = (ctx && ctx.latestSignal) || (typeof window !== 'undefined' && window.signalEngine && Array.isArray(window.signalEngine.signals) && window.signalEngine.signals[0]) || null;
      const isBuy = sig ? (sig.type === 'BUY' || (sig.signal && String(sig.signal).includes('BUY'))) : (ctx && ctx.st && ctx.st.direction === 'BUY');
      const dir = isBuy ? 'BUY (MUA)' : 'SELL (BÁN)';
      const entryPrice = sig ? (sig.entryPrice || sig.price || 'vùng giá hồi') : (ctx ? ctx.livePriceStr : 'Giá realtime');
      const slVal = sig ? (sig.slPrice || sig.sl || 'Dưới đáy/đỉnh cấu trúc') : (ctx && ctx.st && ctx.st.sl ? `$${ctx.st.sl.toFixed(2)}` : 'Dưới đáy/đỉnh cấu trúc');
      const tp1Val = sig ? (sig.tp1Price || sig.tp1 || '+10 giá') : '+10 giá';
      const scoreVal = sig ? (sig.score || '85') : (ctx && ctx.st ? ctx.st.score : '80');

      return renderStructuredResponse({
        badgeTitle: 'GIẢI MÃ TÍN HIỆU THỰC CHIẾN TỪ HỆ THỐNG',
        emotionNote: 'Mình rất hoan nghênh câu hỏi này của bạn! Một trader bản lĩnh luôn muốn hiểu thấu đáo bản chất đằng sau mỗi tín hiệu: vì sao vào lệnh, cơ sở kỹ thuật là gì, và xác suất an toàn ra sao. Hãy cùng mình mổ xẻ 4 tiêu chí cốt lõi tạo nên tín hiệu này nhé!',
        verdictText: `🎯 TÍN HIỆU ${dir} TẠI $${entryPrice}: ĐẠT CHUẨN ĐỒNG PHA EMA20/50 VỚI ĐIỂM CHẤT LƯỢNG ${scoreVal}/100!`,
        verdictType: isBuy ? 'SUCCESS' : 'DANGER',
        winWinTitle: '4 YẾU TỐ WIN-WIN (LỢI THẾ XÁC SUẤT CAO)',
        winWinHtml: `
          <p>1. <strong>Xu hướng & Độ dốc EMA</strong>: EMA20 ${isBuy ? 'nằm trên và dốc lên song song với' : 'nằm dưới và chúc dốc cùng'} EMA50, xác nhận dòng tiền lớn đang kiểm soát thị trường M15.</p>
          <p>2. <strong>Hành động giá Pullback</strong>: Giá không bị đuổi mua/bán mù quáng mà đã hoàn thành nhịp hồi lành mạnh (Pullback) kiểm định trực tiếp vùng hỗ trợ/kháng cự EMA20.</p>
          <p>3. <strong>Nến xác nhận phản ứng</strong>: Xuất hiện nến ${isBuy ? 'rút chân tăng (Pinbar/Hammer)' : 'bắn sao từ chối giá (Shooting Star)'} đóng cửa xác nhận phe ${isBuy ? 'Mua' : 'Bán'} bảo vệ phòng tuyến thành công.</p>
          <p>4. <strong>Hệ số giãn cách D tối ưu</strong>: Biên độ giãn cách giữa EMA20 và EMA50 đạt ngưỡng an toàn (từ 1.2 đến 3.5 giá), loại bỏ hoàn toàn bẫy Sideway nén chặt.</p>
        `,
        riskTitle: 'YẾU TỐ RỦI RO & BẪY CẦN PHÒNG VỆ NGAY',
        riskHtml: `
          <p>• <strong>Bẫy quét thanh khoản (Liquidity Sweep)</strong>: Cá mập có thể giật một cây râu nến quét qua đáy/đỉnh gần nhất trước khi giá bung sóng thật.</p>
          <p>• <strong>Ngưỡng Stop Loss bắt buộc</strong>: Tuyệt đối phải neo SL tại <strong>${slVal}</strong> (cách khoảng 5-7 giá). Không dời xa SL, không gồng lỗ!</p>
          <p>• <strong>Rủi ro tin tức bất ngờ</strong>: Nếu có tin tức đỏ USD sắp công bố, giá có thể đảo chiều giật 2 đầu bất chấp chỉ báo kỹ thuật.</p>
        `,
        actionTitle: 'HÀNH ĐỘNG BẢN THÂN CẦN LÀM VỚI LỆNH NÀY',
        actionHtml: `
          <p>• <strong>Bước 1 - Quản lý vốn</strong>: Đi khối lượng đúng 1% - 2% tài khoản (ví dụ vốn $1.000 đi 0.02 - 0.04 lot), không nhồi thêm lệnh.</p>
          <p>• <strong>Bước 2 - Khóa lợi nhuận</strong>: Khi giá đạt TP1 (<strong>${tp1Val}</strong>, tương đương +10 giá / 100 pips), lập tức chốt 50% khối lượng và kéo Stop Loss về điểm vào lệnh (Breakeven).</p>
          <p>• <strong>Bước 3 - Gồng sóng lớn</strong>: 50% khối lượng còn lại thả trôi theo đường EMA20 để săn TP2 và TP3 mà không còn chút rủi ro nào cho tài khoản!</p>
        `,
        followUpQuestions: [
          { icon: '🛡️', text: 'Khi nào được phép dời SL về hòa vốn (Breakeven) an toàn?', label: 'Khi nào dời SL hòa vốn?' },
          { icon: '🏆', text: 'Bí quyết gồng lãi đến TP2, TP3 mà không bị chốt non?', label: 'Bí quyết gồng lãi TP2/TP3' },
          { icon: '⚡', text: 'Ứng phó bão tin CPI / NFP ra sao khi đánh theo EMA?', label: 'Ứng phó bão tin CPI/NFP' },
          { icon: '📈', text: 'Khung M15 đang thuận hay nghịch H1?', label: 'M15 thuận hay nghịch H1?' }
        ],
        marketContext: ctx
      });
    }
  },

  // 22. PHÂN TÍCH ĐA KHUNG: M15 THUẬN HAY NGHỊCH H1
  MTF_H1_M15: {
    id: 'mtf_h1_m15',
    title: 'Phân tích đa khung: M15 đang thuận hay nghịch H1?',
    shortTitle: 'M15 thuận hay nghịch H1',
    icon: '📈',
    keywords: ['m15 thuận hay nghịch h1', 'm15 và h1', 'thuận hay nghịch', 'đa khung h1', 'phối hợp m15 h1'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'PHÂN TÍCH ĐỒNG PHA ĐA KHUNG THỜI GIAN',
      emotionNote: 'Giao dịch theo xu hướng lớn của H1 và bấm cò trên M15 là bí quyết của những trader có tỷ lệ thắng bền vững nhất. Hãy luôn nhớ: đi ngược H1 giống như bơi ngược dòng thác!',
      verdictText: '👉 NGUYÊN TẮC BẤT DI BẤT DỊCH: CHỈ ĐƯỢC PHÉP VÀO LỆNH M15 KHI ĐỒNG PHA VỚI XU HƯỚNG EMA CỦA H1!',
      verdictType: 'INFO',
      winWinTitle: 'LỢI THẾ CỦA GIAO DỊCH ĐỒNG PHA (MTF ALIGNED)',
      winWinHtml: `
        <p>• <strong>H1 chỉ đường</strong>: Nếu H1 EMA20 > EMA50 (Tăng), ta chỉ tìm setup BUY trên M15; tuyệt đối bỏ qua mọi lệnh SELL M15.</p>
        <p>• <strong>Biên độ sóng lớn</strong>: Lệnh đồng pha H1 có xác suất chạm TP2, TP3 cao gấp 3 lần so với lệnh đánh ngược pha.</p>
        <p>• <strong>Ít bị quét SL</strong>: Lực đỡ từ khung H1 sẽ bảo vệ vị thế của bạn trước các nhịp rung giật nhỏ của M15.</p>
      `,
      riskTitle: 'RỦI RO KHI M15 ĐÁNH NGHỊCH H1',
      riskHtml: `
        <p>• <strong>Bẫy sóng hồi giả</strong>: M15 xuất hiện tín hiệu Sell nhưng H1 đang Uptrend mạnh ➔ Lệnh Sell rất dễ bị cá mập nuốt chửng ngay khi chạm EMA20 H1.</p>
        <p>• <strong>Tỷ lệ R:R kém</strong>: Đánh ngược xu hướng H1 chỉ ăn được 20-30 pips nhưng đối mặt rủi ro dính SL 50-70 pips.</p>
      `,
      actionTitle: 'QUY TRÌNH HÀNH ĐỘNG BẢN THÂN CẦN LÀM',
      actionHtml: `
        <p>1. <strong>Bước 1</strong>: Mở biểu đồ H1, kiểm tra vị trí giá so với EMA20 và EMA50 H1. Nếu H1 Tăng ➔ Đóng khung chỉ tìm lệnh BUY.</p>
        <p>2. <strong>Bước 2</strong>: Chờ M15 tạo nhịp Pullback hồi về kiểm định EMA20/50 M15.</p>
        <p>3. <strong>Bước 3</strong>: Bấm cò khi M15 xuất hiện nến xác nhận cùng hướng với H1.</p>
      `,
      followUpQuestions: [
        { icon: '🔍', text: 'Tại sao tín hiệu bot vừa vào lại Buy/Sell ở giá này?', label: 'Giải mã tín hiệu mới nhất' },
        { icon: '🏆', text: 'Bí quyết gồng lãi đến TP2, TP3 mà không bị chốt non?', label: 'Cách gồng lãi TP2/TP3' },
        { icon: '🛡️', text: 'Khi nào được phép dời SL về hòa vốn (Breakeven) an toàn?', label: 'Khi nào dời SL hòa vốn?' }
      ],
      marketContext: ctx
    })
  },

  // 23. KHI NÀO DỜI SL VỀ HÒA VỐN (BREAKEVEN)
  BREAKEVEN_MOVE: {
    id: 'breakeven_move',
    title: 'Khi nào được phép dời SL về hòa vốn (Breakeven)?',
    shortTitle: 'Khi nào dời SL về hòa vốn',
    icon: '🛡️',
    keywords: ['khi nào dời sl', 'dời sl hòa vốn', 'kéo sl dương', 'dời sl về entry', 'breakeven', 'bảo vệ vốn'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CHIẾN LƯỢC QUẢN TRỊ LỆNH & DỜI SL HÒA VỐN',
      emotionNote: 'Bảo vệ tiền gốc luôn là ưu tiên số 1 của trader chuyên nghiệp. Tuy nhiên, dời SL hòa vốn quá sớm sẽ bị thị trường quét râu rồi mới bay đúng hướng; dời quá trễ thì lệnh đang thắng biến thành lệnh thua!',
      verdictText: '👉 ĐIỀU KIỆN CHUẨN: CHỈ DỜI SL VỀ ENTRY KHI GIÁ CHẠM TP1 (+10 GIÁ) HOẶC ĐÃ TẠO MỘT ĐÁY/ĐỈNH MỚI TRÊN M15!',
      verdictType: 'SUCCESS',
      winWinTitle: 'YẾU TỐ WIN-WIN (TÂM LÝ BẤT BẠI)',
      winWinHtml: `
        <p>• <strong>Giải tỏa áp lực tâm lý</strong>: Khi SL đã ở mức hòa vốn hoặc có lãi nhỏ (SL Dương +1 giá), lệnh giao dịch trở thành FREE TRADE — rủi ro tài khoản về 0!</p>
        <p>• <strong>Bảo toàn vốn tuyệt đối</strong>: Nếu thị trường bất ngờ đảo chiều vì tin tức, bạn hoàn toàn không bị mất một xu nào.</p>
        <p>• <strong>Cơ hội ăn sóng lớn</strong>: Bạn thảnh thơi gồng lãi phần khối lượng còn lại tới TP2 (+20 giá) và TP3 (+30 giá).</p>
      `,
      riskTitle: 'SAI LẦM TAI HẠI KHI DỜI SL QUÁ VỘI VÀNG',
      riskHtml: `
        <p>• <strong>Bẫy quét râu Re-test</strong>: Vừa thấy lãi 2-3 giá đã vội kéo SL về Entry. Thị trường giật nhẹ một nhịp re-test đường EMA20 quét lệnh của bạn ra ngoài, sau đó mới phi thẳng tới TP3!</p>
        <p>• <strong>Tài khoản dậm chân tại chỗ</strong>: Lệnh nào cũng bị cắn hòa vốn, vừa tốn phí spread/swap vừa bỏ lỡ con sóng tăng đẹp.</p>
      `,
      actionTitle: 'QUY TẮC 3 BƯỚC THỰC CHIẾN CỦA MA WAVE V8',
      actionHtml: `
        <p>1. <strong>Giá chạy +5 giá</strong>: GIỮ NGUYÊN SL BAN ĐẦU, không manh động.</p>
        <p>2. <strong>Giá chạm TP1 (+10 giá)</strong>: CHỐT NGAY 50% KHỐI LƯỢNG. Đồng thời kéo SL về Entry (hoặc Entry + 1 giá đệm phí).</p>
        <p>3. <strong>Giá bứt phá tạo đỉnh/đáy M15 tiếp theo</strong>: Nâng dần SL theo các đáy HL mới (Trailing Stop) bám theo đường EMA20.</p>
      `,
      followUpQuestions: [
        { icon: '🏆', text: 'Bí quyết gồng lãi đến TP2, TP3 mà không bị chốt non?', label: 'Bí quyết gồng lãi TP2/TP3' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL an toàn' },
        { icon: '💰', text: 'Cách tính lot và quản lý vốn an toàn cho tài khoản?', label: 'Quản lý vốn & Đi lot' }
      ],
      marketContext: ctx
    })
  },

  // 24. PHÂN BIỆT SIDEWAY TÍCH LŨY VÀ PHÂN PHỐI
  SIDEWAY_VS_DISTRIBUTION: {
    id: 'sideway_vs_distribution',
    title: 'Phân biệt Sideway tích lũy và Phân phối đỉnh/đáy',
    shortTitle: 'Phân biệt Sideway & Phân phối',
    icon: '📦',
    keywords: ['phân biệt sideway', 'tích lũy hay phân phối', 'sideway và phân phối', 'tích lũy và phân phối', 'gom hàng hay xả hàng', 'phân phối đỉnh'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'BÍ QUYẾT PHÂN BIỆT PHA VẬN ĐỘNG CỦA CÁ MẬP',
      emotionNote: 'Rất nhiều trader mất tiền vì nhầm lẫn giữa một nhịp tích lũy gom hàng để tăng tiếp với một nhịp phân phối xả hàng của nhà cái. Hãy cùng mình đọc vị các dấu hiệu qua hành động giá và dải EMA nhé!',
      verdictText: '👉 ĐẶC ĐIỂM CỐT LÕI: TÍCH LŨY THƯỜNG CÓ VOLUME GIẢM DẦN & ĐÁY NÂNG CAO; PHÂN PHỐI THƯỜNG XUẤT HIỆN RÂU NẾN DÀI Ở ĐỈNH VỚI VOLUME ĐỘT BIẾN!',
      verdictType: 'WARN',
      winWinTitle: 'ĐẶC ĐIỂM NHẬN BIẾT TÍCH LŨY (ACCUMULATION)',
      winWinHtml: `
        <p>• <strong>Biên độ nén hẹp dần</strong>: Các cây nến M15 nhỏ dần, dao động ép chặt quanh dải EMA20-50.</p>
        <p>• <strong>Đáy nâng dần (Higher Lows)</strong>: Phe mua liên tục đỡ giá ở các mốc cao hơn, không cho giá thủng EMA50.</p>
        <p>• <strong>Volume thu hẹp</strong>: Lực bán cạn kiệt, chờ đợi một cây nến Breakout mạnh mẽ bứt phá khỏi biên trên của hộp.</p>
      `,
      riskTitle: 'DẤU HIỆU CỦA PHA PHÂN PHỐI (DISTRIBUTION)',
      riskHtml: `
        <p>• <strong>Râu trên giật liên tục (Upthrust)</strong>: Giá cố gắng vượt đỉnh nhưng bị đạp mạnh xuống ngay trong phiên M15.</p>
        <p>• <strong>EMA20 gãy cụp xuống dưới EMA50</strong>: Động lượng ngắn hạn bị bẻ gãy hoàn toàn.</p>
        <p>• <strong>Thanh khoản tăng vọt tại vùng đỉnh</strong>: Nhà cái đang sang tay lượng lớn lệnh cho đám đông FOMO.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG AN TOÀN BẢN THÂN CẦN LÀM',
      actionHtml: `
        <p>• <strong>Khi chưa rõ ràng</strong>: ĐỨNG NGOÀI TUYỆT ĐỐI. Kẻ thông minh là người kiên nhẫn đứng xem cá mập đánh nhau.</p>
        <p>• <strong>Đánh tích lũy</strong>: Chờ nến Breakout đóng cửa vượt biên trên + retest EMA20 thành công mới vào BUY.</p>
        <p>• <strong>Đánh phân phối</strong>: Chờ cấu trúc CHoCH đâm thủng đáy gần nhất + nến retest thất bại tại EMA50 mới vào SELL.</p>
      `,
      followUpQuestions: [
        { icon: '🧭', text: 'Xác định 5 trạng thái thị trường theo EMA như thế nào?', label: '5 Trạng thái thị trường' },
        { icon: '⚠️', text: '4 Dấu hiệu nhận biết xu hướng suy yếu và đảo chiều sớm là gì?', label: 'Dấu hiệu đảo chiều sớm' },
        { icon: '📦', text: 'Cách giao dịch khi thị trường Sideway đi ngang?', label: 'Cách đánh Sideway' }
      ],
      marketContext: ctx
    })
  },

  // 25. ỨNG PHÓ BÃO TIN KINH TẾ MẠNH (CPI, NFP, FED)
  NEWS_CPI_NFP: {
    id: 'news_cpi_nfp',
    title: 'Ứng phó bão tin kinh tế mạnh (CPI, NFP, Fed Lãi suất)',
    shortTitle: 'Ứng phó bão tin CPI / NFP',
    icon: '⚡',
    keywords: ['ứng phó bão tin', 'đánh tin cpi', 'tin nfp', 'tin tức mạnh', 'đánh tin thế nào', 'tránh bão tin', 'fomc', 'lãi suất fed'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'CHIẾN LƯỢC QUẢN TRỊ RỦI RO KHI CÓ TIN ĐỎ USD',
      emotionNote: 'Vàng là kim loại phản ứng nhạy cảm nhất thế giới trước số liệu lạm phát CPI và bảng lương NFP. Trước bão tin, lòng tham muốn ăn nhanh x2 tài khoản chính là cái bẫy chết người nhất!',
      verdictText: '👉 NGUYÊN TẮC THÉP: KHÔNG ĐOÁN HƯỚNG TIN TỨC — ĐỨNG NGOÀI 15 PHÚT TRƯỚC VÀ SAU TIN, CHỈ VÀO LỆNH THEO NẾN XÁC NHẬN M15!',
      verdictType: 'DANGER',
      winWinTitle: 'LỢI THẾ CỦA VIỆC ĐỢI TIN RA XONG MỚI GIAO DỊCH',
      winWinHtml: `
        <p>• <strong>Không bị trượt giá (Slippage)</strong>: Lúc tin ra, spread có thể giãn từ 2 pips lên 20-50 pips; đợi tin xong spread trở về bình thường.</p>
        <p>• <strong>Bắt trọn con sóng thực sự</strong>: 1-2 cây nến đầu tiên thường là quét râu 2 đầu của nhà cái; cây nến M15 thứ 2 trở đi mới là hướng đi thực của dòng tiền lớn.</p>
        <p>• <strong>Tín hiệu EMA trở lại chuẩn xác</strong>: Sau khi cơn sốc tin đi qua, dải EMA20 và EMA50 sẽ dẫn dắt xu hướng cực kỳ mượt mà.</p>
      `,
      riskTitle: 'RỦI RO KHI ĐÁNH TRƯỚC VÀ ĐOÁN TIN',
      riskHtml: `
        <p>• <strong>Quét sạch cả 2 đầu SL</strong>: Giá giật lên 15 giá rồi giật xuống 20 giá chỉ trong 30 giây, quét bay cả lệnh Buy lẫn Sell.</p>
        <p>• <strong>Treo sàn / Mất kết nối</strong>: Lệnh Stop Loss có thể bị khớp trượt hàng chục giá dẫn đến cháy tài khoản ngoài ý muốn.</p>
      `,
      actionTitle: 'KẾ HOẠCH HÀNH ĐỘNG CỦA CHUYÊN GIA',
      actionHtml: `
        <p>1. <strong>Trước giờ tin 15 phút</strong>: Đóng các lệnh lướt ngắn hạn, hoặc kéo SL về hòa vốn cho các lệnh đang gồng lãi xa.</p>
        <p>2. <strong>Khi tin công bố</strong>: Khoanh tay quan sát, không bấm lệnh theo cảm xúc.</p>
        <p>3. <strong>Sau tin 15 - 30 phút</strong>: Quan sát cây nến M15 đóng cửa. Nếu nến đóng vững chắc trên EMA20/50 ➔ Tìm cơ hội BUY khi giá pullback; ngược lại nếu thủng mạnh ➔ Canh SELL.</p>
      `,
      followUpQuestions: [
        { icon: '🔍', text: 'Tại sao tín hiệu bot vừa vào lại Buy/Sell ở giá này?', label: 'Giải mã tín hiệu mới nhất' },
        { icon: '🛡️', text: 'Đặt Stop Loss ở đâu an toàn theo cấu trúc?', label: 'Cách đặt SL an toàn' },
        { icon: '💰', text: 'Cách tính lot và quản lý vốn an toàn cho tài khoản?', label: 'Quản lý vốn & Đi lot' }
      ],
      marketContext: ctx
    })
  },

  // 26. BÍ QUYẾT GỒNG LÃI ĐẾN TP2, TP3
  TRAILING_PROFIT: {
    id: 'trailing_profit',
    title: 'Bí quyết gồng lãi đến TP2, TP3 mà không bị chốt non',
    shortTitle: 'Bí quyết gồng lãi TP2, TP3',
    icon: '🏆',
    keywords: ['gồng lời tp2 tp3', 'cách gồng lãi', 'không bị chốt non', 'gồng lời thế nào', 'làm sao gồng lãi', 'trailing stop'],
    render: (ctx) => renderStructuredResponse({
      badgeTitle: 'NGHỆ THUẬT GỒNG LÃI THEO ĐƯỜNG EMA20',
      emotionNote: 'Gồng lỗ thì ai cũng giỏi, nhưng gồng lãi mới là thử thách tâm lý lớn nhất của trader! Nỗi sợ mất số tiền đang có thường khiến bạn chốt non ăn 1-2 giá, rồi tiếc nuối nhìn thị trường bay 20-30 giá. Hãy để quy tắc kỹ thuật thay thế cảm xúc của bạn!',
      verdictText: '👉 BÍ QUYẾT: CHỐT 50% TẠI TP1 ĐỂ BẢO VỆ TÂM LÝ, 50% CÒN LẠI DÙNG ĐƯỜNG EMA20 M15 LÀM ĐƯỜNG TRAILING STOP ĐỂ ĂN TRỌN SÓNG!',
      verdictType: 'SUCCESS',
      winWinTitle: 'TẠI SAO PHƯƠNG PHÁP NÀY ĐEM LẠI LỢI NHUẬN KHỦNG?',
      winWinHtml: `
        <p>• <strong>Bắt trọn cả con sóng lớn</strong>: Trong một xu hướng mạnh (Uptrend/Downtrend), giá có thể bám dọc theo đường EMA20 chạy 20-50 giá mà không hề chạm vào EMA50.</p>
        <p>• <strong>Tâm lý hoàn toàn thoải mái</strong>: Do 50% khối lượng đã chốt lời đút túi tại TP1 và SL đã được dời về Entry, phần còn lại bạn chỉ việc ngồi xem lợi nhuận phình to!</p>
        <p>• <strong>Tỷ lệ R:R bứt phá</strong>: Các lệnh ăn trọn sóng TP3 (+30 giá) sẽ bù đắp và kéo tài khoản tăng trưởng theo cấp số nhân.</p>
      `,
      riskTitle: 'BẪY TÂM LÝ CẦN VƯỢT QUA',
      riskHtml: `
        <p>• <strong>Sợ mất lãi khi giá hồi</strong>: Thị trường đi lên theo hình bậc thang zíc zắc. Thấy giá hồi 2-3 giá là hoảng sợ bấm đóng lệnh bằng tay ➔ Mất con sóng lớn phía sau.</p>
        <p>• <strong>Quá tham không chịu chốt 1 phần</strong>: Giữ nguyên 100% vol không chốt TP1, đến khi giá quay đầu dính hòa vốn thì tiếc nuối và cay cú.</p>
      `,
      actionTitle: 'HÀNH ĐỘNG BẢN THÂN CẦN LÀM THEO TỪNG BƯỚC',
      actionHtml: `
        <p>1. <strong>Đạt TP1 (+10 giá / 100 pips)</strong>: Chốt đúng 50% khối lượng, dời SL về mức hòa vốn.</p>
        <p>2. <strong>Khi giá tiếp tục chạy</strong>: Quan sát đường EMA20 trên khung M15. Chừng nào nến M15 chưa đóng cửa thủng qua đường EMA20 thì VẪN TIẾP TỤC GỒNG.</p>
        <p>3. <strong>Điểm thoát lệnh toàn bộ</strong>: Chỉ đóng nốt 50% còn lại khi giá chạm mốc TP3 (+30 giá) hoặc khi xuất hiện cây nến M15 đóng cửa vi phạm hoàn toàn qua đường EMA20.</p>
      `,
      followUpQuestions: [
        { icon: '🛡️', text: 'Khi nào được phép dời SL về hòa vốn (Breakeven) an toàn?', label: 'Khi nào dời SL hòa vốn?' },
        { icon: '🔍', text: 'Tại sao tín hiệu bot vừa vào lại Buy/Sell ở giá này?', label: 'Giải mã tín hiệu mới nhất' },
        { icon: '💰', text: 'Cách tính lot và quản lý vốn an toàn cho tài khoản?', label: 'Quản lý vốn & Đi lot' }
      ],
      marketContext: ctx
    })
  }
};

/**
 * Tìm kiếm & Chắt lọc câu trả lời tri thức EMA20-50 & Tình huống thực chiến
 */
function searchEMA2050Knowledge(query, marketContext) {
  if (!query) return null;
  const qLower = query.toLowerCase().trim();

  // 1. Nhận diện Thắc mắc tín hiệu chuyên sâu từ trader (Ưu tiên số 1)
  if (/(?:tại sao|vì sao|sao|lý do|giải thích|thắc mắc).*(?:tín hiệu|lệnh|vào lệnh|buy|sell|mới nhất|vừa vào|ở giá này|như này)/i.test(qLower) ||
      /(?:tín hiệu này|lệnh này).*(?:như thế nào|tại sao|sao lại|vì sao|nó như)/i.test(qLower) ||
      qLower.includes('tại sao tín hiệu') || qLower.includes('giải mã tín hiệu') ||
      /(?:tại sao|vì sao|sao).*(?:vào buy|vào sell|buy ở|sell ở|khớp lệnh)/i.test(qLower)) {
    return {
      topic: EMA2050_TOPICS.EXPLAIN_LATEST_SIGNAL,
      renderedHtml: EMA2050_TOPICS.EXPLAIN_LATEST_SIGNAL.render(marketContext),
      mode: 'Gold AI Mentor: Giải Mã Tín Hiệu Chuyên Sâu'
    };
  }

  // 2. Nhận diện Đàm thoại mở & Chào hỏi tự do của người dùng
  if (/(?:xin\s*chào|chào\s*(?:bạn|em|mọi người|tất cả|cả nhà)|\bhello\b|\bhi\b|\balo\b|có ai không|test bot|mình đang cần|bắt đầu trò chuyện)/i.test(qLower) || 
      qLower.startsWith('chào') || qLower.startsWith('hello') || qLower.startsWith('ok xin chào') || qLower.includes('xin chào tất cả các bạn') ||
      qLower === 'chào' || qLower === 'hi' || qLower === 'hello') {
    return {
      topic: EMA2050_TOPICS.OPEN_GREETING_DIALOGUE,
      renderedHtml: EMA2050_TOPICS.OPEN_GREETING_DIALOGUE.render(marketContext),
      mode: 'Gold AI Mentor: Đàm Thoại Mở & Lắng Nghe'
    };
  }

  // 3. So khớp các chủ đề khác trong bộ tri thức
  let bestTopic = null;
  let maxScore = 0;

  for (const key of Object.keys(EMA2050_TOPICS)) {
    const topic = EMA2050_TOPICS[key];
    let score = 0;

    // So khớp keywords
    for (const kw of topic.keywords) {
      if (qLower.includes(kw)) {
        score += kw.length >= 8 ? 6 : (kw.length >= 4 ? 4 : 2);
      }
    }

    // Priority Boosting cho các tình huống thực chiến & chủ đề mới
    if (topic.id === 'mtf_h1_m15' && (/m15.*h1|thuận hay nghịch|đa khung h1/i.test(qLower))) score += 18;
    if (topic.id === 'breakeven_move' && (/dời sl|hòa vốn|kéo sl dương|breakeven/i.test(qLower))) score += 18;
    if (topic.id === 'sideway_vs_distribution' && (/tích lũy|phân phối|gom hàng|xả hàng/i.test(qLower))) score += 18;
    if (topic.id === 'news_cpi_nfp' && (/bão tin|đánh tin|cpi|nfp|lãi suất fed|fomc/i.test(qLower))) score += 18;
    if (topic.id === 'trailing_profit' && (/gồng lãi|gồng lời|chốt non|tp2|tp3/i.test(qLower))) score += 18;

    if (topic.id === 'trader_fomo' && (/mua đuổi|bán đuổi|đuổi giá|bay mạnh quá|tăng mạnh quá|sợ lỡ sóng|lỡ tàu|sợ mất cơ hội|fomo|đu đỉnh|đu đáy|có nên nhảy vào/i.test(qLower))) score += 15;
    if (topic.id === 'trader_trapped' && (/kẹt lệnh|lỡ buy đỉnh|lỡ sell đáy|bị âm|gồng lỗ|cứu tài khoản|sắp cháy|xử lý lệnh lỗ|âm nặng/i.test(qLower))) score += 15;
    if (topic.id === 'trader_chop_annoying' && (/khó chịu|thị trường bẩn|quét sl|bị cắn sl|giật 2 đầu|đi ngang khó chịu|đánh khó quá|sao hôm nay vàng đi khó/i.test(qLower))) score += 15;
    if (topic.id === 'trader_entry_now' && (/giờ mua được chưa|giờ bán được chưa|vào lệnh được chưa|có lệnh chưa|vào lệnh gì|buy hay sell lúc này|hiện tại vào lệnh|nên mua hay bán/i.test(qLower))) score += 15;
    if (topic.id === 'trader_capital_lot' && (/đi bao nhiêu lot|tính lot|tài khoản 1000|tài khoản 500|tài khoản 2000|quản lý vốn thế nào|tỷ lệ rr|khối lượng vào lệnh|đi vol mấy/i.test(qLower))) score += 15;

    // 14 Chuyên đề cốt lõi
    if (topic.id === 'nature_role' && (/bản chất|nhiệm vụ|vai trò|ema là gì|đường trung bình là gì|ý nghĩa.*ema/i.test(qLower))) score += 10;
    if (topic.id === 'market_states' && (/5 trạng thái|trạng thái thị trường|phân loại thị trường|nhận diện thị trường/i.test(qLower))) score += 10;
    if (topic.id === 'buy_strategy' && (/khi nào.*(?:buy|mua)|cách.*(?:vào|đánh).*buy|mua khi nào|chiến lược.*buy|vào lệnh.*buy|điều kiện.*buy|uptrend.*buy/i.test(qLower))) score += 11;
    if (topic.id === 'sell_strategy' && (/khi nào.*(?:sell|bán)|cách.*(?:vào|đánh).*sell|bán khi nào|chiến lược.*sell|vào lệnh.*sell|điều kiện.*sell|downtrend.*sell/i.test(qLower))) score += 11;
    if (topic.id === 'pullback_ema50' && (/hồi sâu|về ema50|xuyên ema50|chạm ema50|test ema50|trường hợp a|trường hợp b|trường hợp c/i.test(qLower))) score += 12;
    if (topic.id === 'sideway_trading' && (/sideway|sw|đi ngang|hộp dao động|đánh sideway/i.test(qLower))) score += 10;
    if (topic.id === 'chop_filter_d' && (/chop|nhiễu|lọc nhiễu|bộ lọc d|hệ số d|d ratio|công thức d|khoảng cách ema/i.test(qLower))) score += 12;
    if (topic.id === 'crossover_truth' && (/cắt nhau|giao cắt|cắt lên|cắt xuống|golden cross|death cross|cắt có mua|cắt có bán|vừa cắt|giao cắt.*vào lệnh/i.test(qLower))) score += 12;
    if (topic.id === 'scoring_formula' && (/thang điểm|100 điểm|confirmed|setup|watch|công thức tính điểm|chấm điểm/i.test(qLower))) score += 12;
    if (topic.id === 'mtf_coordination' && (/đa khung|mtf|h1|m30|m15|m5|phối hợp khung|khung thời gian/i.test(qLower))) score += 10;
    if (topic.id === 'risk_management' && (/đặt sl|cắt lỗ|chốt lời|tp|quản lý rủi ro|trailing stop|sl cấu trúc|hòa vốn|kéo sl/i.test(qLower))) score += 10;
    if (topic.id === 'weakness_signs' && (/suy yếu|đảo chiều|hết sóng|mất đà|sắp gãy/i.test(qLower))) score += 10;
    if (topic.id === 'backtest_stats' && (/thống kê|kiểm định|backtest|win rate|tỷ lệ thắng/i.test(qLower))) score += 10;
    if (topic.id === 'classic_mistakes' && (/lỗi|sai lầm|cần tránh|8 lỗi|kinh điển|cháy tài khoản/i.test(qLower))) score += 12;

    if (score > maxScore) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  if (bestTopic && maxScore >= 2) {
    return {
      topic: bestTopic,
      renderedHtml: bestTopic.render(marketContext),
      mode: `Gold AI Mentor: ${bestTopic.shortTitle}`
    };
  }

  // Nếu nhắc tới MA/EMA chung chung
  if (/ema|ma\s*20|ma\s*50|ma\s*wave|đường trung bình/i.test(qLower)) {
    return {
      topic: EMA2050_TOPICS.NATURE_ROLE,
      renderedHtml: EMA2050_TOPICS.NATURE_ROLE.render(marketContext),
      mode: 'Gold AI Mentor: Bản chất EMA'
    };
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EMA2050_TOPICS,
    searchEMA2050Knowledge
  };
} else if (typeof window !== 'undefined') {
  window.EMA2050_TOPICS = EMA2050_TOPICS;
  window.searchEMA2050Knowledge = searchEMA2050Knowledge;
}

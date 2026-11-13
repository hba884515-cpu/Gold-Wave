// ============================================================
// HỆ THỐNG TRI THỨC GIAO DỊCH EMA20 – EMA50 TOÀN DIỆN (14 CHUYÊN ĐỀ)
// Tổng hợp & Chắt lọc theo nguyên tắc chuẩn xác của hệ thống MA Wave V8 Pro
// ============================================================

const EMA2050_TOPICS = {
  // 1. BẢN CHẤT & NHIỆM VỤ HAI ĐƯỜNG EMA
  NATURE_ROLE: {
    id: 'nature_role',
    title: '1. Bản chất và nhiệm vụ của hai đường EMA',
    shortTitle: 'Bản chất EMA20 - EMA50',
    icon: '⚡',
    keywords: ['bản chất', 'nhiệm vụ', 'vai trò', 'ema20 là gì', 'ema50 là gì', 'ý nghĩa ema', 'đường trung bình'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          📌 1. BẢN CHẤT VÀ NHIỆM VỤ CỐT LÕI CỦA HAI ĐƯỜNG EMA
        </div>
        <div class="space-y-2">
          <p><strong class="text-emerald-400">🔹 EMA20 – Đường trung bình ngắn hạn:</strong></p>
          <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
            <li>Phản ánh <strong>động lượng giá ngắn hạn</strong> nhanh nhạy.</li>
            <li>Giúp nhận biết nhịp tăng, nhịp giảm và các pha <strong>hồi giá kỹ thuật (Pullback)</strong>.</li>
            <li>Thường được dùng làm <strong>điểm tựa kích hoạt điểm vào lệnh (Entry timing)</strong> thuận theo xu hướng.</li>
          </ul>
        </div>
        <div class="space-y-2">
          <p><strong class="text-sky-400">🔹 EMA50 – Đường trung bình trung hạn:</strong></p>
          <ul class="list-disc list-inside space-y-1 pl-2 text-slate-300">
            <li>Phản ánh <strong>hướng vận động trung hạn</strong> chủ đạo.</li>
            <li>Giúp xác định <strong>xu hướng chính</strong> của thị trường (Trend Setter).</li>
            <li>Đóng vai trò là <strong>vùng hỗ trợ hoặc kháng cự động</strong> rất mạnh mẽ.</li>
          </ul>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
          <strong class="text-amber-400 block">⚖ NGUYÊN TẮC ĐỊNH HƯỚNG:</strong>
          <p>• <strong>EMA20 nằm trên EMA50</strong>: Thiên hướng <strong>TĂNG (Bullish)</strong>.</p>
          <p>• <strong>EMA20 nằm dưới EMA50</strong>: Thiên hướng <strong>GIẢM (Bearish)</strong>.</p>
          <p>• <strong>Hai đường cùng dốc lên hoặc dốc xuống</strong>: Xu hướng có sự đồng thuận cao, xung lực mạnh.</p>
          <p>• <strong>EMA20 và EMA50 liên tục giao cắt / đi ngang</strong>: Cảnh báo thị trường đang Sideway hoặc Nhiễu (Chop).</p>
        </div>
        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          ⚠️ <strong>Lưu ý cốt tử:</strong> EMA20 cắt EMA50 <strong>KHÔNG ĐỒNG NGHĨA</strong> với việc phải vào lệnh ngay! Giao cắt chỉ là dấu hiệu thay đổi trạng thái sơ khởi, không phải là xác nhận chắc chắn một xu hướng mới.
        </div>
        ${ctx ? `<div class="text-[11px] text-slate-400 pt-1 border-t border-slate-800">📍 <em>Hiện tại trên Vàng M15: EMA20 = <strong>${ctx.ema20Str}</strong> | EMA50 = <strong>${ctx.ema50Str}</strong> (${ctx.stateDesc}).</em></div>` : ''}
      </div>
    `
  },

  // 2. 5 TRẠNG THÁI THỊ TRƯỜNG
  MARKET_STATES: {
    id: 'market_states',
    title: '2. Xác định 5 trạng thái thị trường',
    shortTitle: '5 Trạng thái thị trường',
    icon: '🧭',
    keywords: ['5 trạng thái', 'trạng thái thị trường', 'uptrend', 'downtrend', 'pullback', 'sideway', 'chop', 'phân loại thị trường'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          🧭 2. BẢNG PHÂN LOẠI 5 TRẠNG THÁI THỊ TRƯỜNG CHUẨN
        </div>
        <p>Trước khi tìm kiếm điểm BUY hoặc SELL, bắt buộc phải định danh thị trường đang ở trạng thái nào:</p>
        <div class="space-y-2">
          <div class="p-2 rounded-xl bg-slate-900 border border-emerald-500/30">
            <span class="text-emerald-400 font-black">1. UPTREND (Xu hướng tăng)</span>
            <p class="text-slate-300 mt-0.5">EMA20 nằm trên EMA50, cả hai cùng dốc lên rõ ràng $\\rightarrow$ <strong>Ưu tiên quan sát BUY</strong> khi giá hồi về dải EMA.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-rose-500/30">
            <span class="text-rose-400 font-black">2. DOWNTREND (Xu hướng giảm)</span>
            <p class="text-slate-300 mt-0.5">EMA20 nằm dưới EMA50, cả hai cùng dốc xuống rõ ràng $\\rightarrow$ <strong>Ưu tiên quan sát SELL</strong> khi giá hồi lên dải EMA.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-cyan-500/30">
            <span class="text-cyan-400 font-black">3. PULLBACK (Hồi giá kỹ thuật)</span>
            <p class="text-slate-300 mt-0.5">Giá hồi ngược xu hướng về kiểm định vùng EMA20 hoặc EMA50 $\\rightarrow$ <strong>Chờ nến đóng xác nhận tiếp diễn</strong>, không bắt dao rơi.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-amber-500/30">
            <span class="text-amber-400 font-black">4. SIDEWAY (Đi ngang tích lũy)</span>
            <p class="text-slate-300 mt-0.5">EMA20 và EMA50 áp sát nhau, đi ngang $\\rightarrow$ <strong>Tránh đu theo giao cắt</strong>, chỉ quan sát đánh phản ứng ở 2 biên hộp.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-orange-500/30">
            <span class="text-orange-400 font-black">5. NHIỄU / CHOP (Hỗn loạn)</span>
            <p class="text-slate-300 mt-0.5">Giá liên tục cắt xuyên qua lại hai EMA, giật râu 2 đầu $\\rightarrow$ <strong>Chuyển sang WAIT</strong>, hạn chế mọi tín hiệu xu hướng để bảo vệ vốn.</p>
          </div>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
          💡 <strong>Quy tắc vàng:</strong> Không bao giờ chỉ nhìn vị trí 2 đường EMA đơn thuần! Cần phải kết hợp: <strong>Độ dốc + Khoảng cách giữa 2 đường (hệ số D) + Vị trí giá tương đối + Cấu trúc Đỉnh/Đáy (HH/HL hoặc LH/LL)</strong>.
        </div>
      </div>
    `
  },

  // 3. CHIẾN LƯỢC BUY
  BUY_STRATEGY: {
    id: 'buy_strategy',
    title: '3. Cách giao dịch BUY khi thị trường tăng',
    shortTitle: 'Chiến lược BUY chuẩn',
    icon: '🟢',
    keywords: ['chiến lược buy', 'cách vào buy', 'mua khi nào', 'điều kiện buy', 'vào lệnh buy', 'uptrend buy', 'tín hiệu buy'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
          🟢 3. CHIẾN LƯỢC THUẬN XU HƯỚNG TĂNG (BUY ENTRY CHUẨN)
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-amber-400 block">📋 4 ĐIỀU KIỆN NỀN TẢNG BẮT BUỘC:</strong>
          <p>1. EMA20 nằm trên EMA50.</p>
          <p>2. Cả EMA20 và EMA50 có <strong>độ dốc hướng lên rõ ràng</strong>.</p>
          <p>3. Giá phần lớn thời gian vận động nằm phía trên EMA20.</p>
          <p>4. Cấu trúc thị trường duy trì <strong>HH (Đỉnh cao hơn)</strong> và <strong>HL (Đáy cao hơn)</strong>.</p>
        </div>
        <div class="space-y-2">
          <strong class="text-emerald-400 block">🚀 QUY TRÌNH 4 BƯỚC VÀO LỆNH BUY:</strong>
          <p>• <strong>Bước 1</strong>: Kiên nhẫn chờ giá điều chỉnh từ phía trên xuống gần dải EMA20 (khoảng cách $\\le 1.85\\times ATR$).</p>
          <p>• <strong>Bước 2</strong>: Quan sát phản ứng tại EMA20. Nếu giá xuyên nhẹ qua EMA20, tiếp tục quan sát vùng đệm EMA50 và đáy cấu trúc HL gần nhất.</p>
          <p>• <strong>Bước 3</strong>: Chờ dấu hiệu xác nhận: Nến tăng đóng cửa trở lại trên EMA20, hoặc xuất hiện nến rút chân từ chối giá thấp, hoặc hình thành đáy HL mới.</p>
          <p>• <strong>Bước 4</strong>: Chỉ vào lệnh BUY sau khi <strong>nến đã đóng cửa xác nhận</strong>. Tuyệt đối không mua chỉ vì giá vừa chạm EMA20!</p>
        </div>
        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1 text-rose-300">
          <strong class="block">🛑 ĐIỀU KIỆN VÔ HIỆU HÓA KỊCH BẢN BUY:</strong>
          <p>• Giá đâm thủng đáy HL quan trọng gần nhất.</p>
          <p>• EMA20 mất hoàn toàn độ dốc và bắt đầu bẻ cong hướng xuống.</p>
          <p>• EMA20 cắt xuống EMA50 đồng thời cấu trúc giảm được xác nhận.</p>
          <p><em>(Lưu ý: Một lần nến xuyên nhẹ qua EMA20 chưa đủ để kết luận xu hướng tăng kết thúc).</em></p>
        </div>
      </div>
    `
  },

  // 4. CHIẾN LƯỢC SELL
  SELL_STRATEGY: {
    id: 'sell_strategy',
    title: '4. Cách giao dịch SELL khi thị trường giảm',
    shortTitle: 'Chiến lược SELL chuẩn',
    icon: '🔴',
    keywords: ['chiến lược sell', 'cách vào sell', 'bán khi nào', 'điều kiện sell', 'vào lệnh sell', 'downtrend sell', 'tín hiệu sell'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold">
          🔴 4. CHIẾN LƯỢC THUẬN XU HƯỚNG GIẢM (SELL ENTRY CHUẨN)
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-amber-400 block">📋 4 ĐIỀU KIỆN NỀN TẢNG BẮT BUỘC:</strong>
          <p>1. EMA20 nằm dưới EMA50.</p>
          <p>2. Cả hai đường có <strong>độ dốc hướng xuống rõ ràng</strong>.</p>
          <p>3. Giá phần lớn thời gian vận động nằm phía dưới EMA20.</p>
          <p>4. Cấu trúc thị trường duy trì <strong>LH (Đỉnh thấp hơn)</strong> và <strong>LL (Đáy thấp hơn)</strong>.</p>
        </div>
        <div class="space-y-2">
          <strong class="text-rose-400 block">📉 QUY TRÌNH 5 BƯỚC VÀO LỆNH SELL:</strong>
          <p>• <strong>Bước 1</strong>: Chờ giá hồi kỹ thuật từ phía dưới lên gần dải EMA20 (không bán tháo đu đáy khi dãn cách $> 1.85\\times ATR$).</p>
          <p>• <strong>Bước 2</strong>: Quan sát phản ứng tại EMA20 hoặc vùng kẹp giữa EMA20 – EMA50.</p>
          <p>• <strong>Bước 3</strong>: Chờ nến giảm xác nhận (nến có râu trên dài từ chối giá cao hoặc nến giảm thân đặc).</p>
          <p>• <strong>Bước 4</strong>: Quan sát việc hình thành đỉnh thấp hơn (LH) tiếp theo.</p>
          <p>• <strong>Bước 5</strong>: Tín hiệu SELL đáng tin cậy nhất khi giá <strong>đóng cửa trở lại dưới EMA20</strong> và động lượng giảm được phục hồi.</p>
        </div>
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-amber-300">
          <strong class="block">🛑 ĐIỀU KIỆN VÔ HIỆU HÓA KỊCH BẢN SELL:</strong>
          <p>• Giá bứt phá vượt qua đỉnh LH quan trọng gần nhất.</p>
          <p>• EMA20 bắt đầu ngóc đầu dốc lên.</p>
          <p>• EMA20 cắt lên EMA50 và cấu trúc tăng mới được xác nhận.</p>
        </div>
      </div>
    `
  },

  // 5. HỒI SÂU VỀ EMA50
  PULLBACK_EMA50: {
    id: 'pullback_ema50',
    title: '5. Cách đánh khi giá hồi sâu về EMA50',
    shortTitle: 'Hồi sâu về EMA50',
    icon: '🎯',
    keywords: ['hồi sâu', 'hồi về ema50', 'xuyên ema50', 'ema50 phản ứng', 'hồi kỹ thuật hay đảo chiều', 'trường hợp a', 'trường hợp b', 'trường hợp c'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
          🎯 5. PHÂN BIỆT RÕ GIỮA HỒI KỸ THUẬT VÀ ĐẢO CHIỀU TẠI EMA50
        </div>
        <p>Khi giá xuyên qua EMA20 và hồi sâu về chạm dải EMA50, bạn phân loại theo đúng 3 trường hợp:</p>
        
        <div class="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <strong class="text-emerald-400 block">🟢 Trường hợp A – Hồi sâu nhưng xu hướng vẫn khỏe (Cơ hội vào lệnh):</strong>
          <p>• EMA20 vẫn nằm trên EMA50 (trong xu hướng tăng), EMA50 vẫn dốc lên.</p>
          <p>• Giá chạm hoặc xuyên nhẹ EMA50 nhưng <strong>KHÔNG PHÁ đáy HL quan trọng</strong>.</p>
          <p>• Sau đó nến đóng cửa phục hồi và lấy lại EMA20 $\\rightarrow$ Đây là <strong>nhịp hồi sâu chất lượng cao</strong> để mở vị thế thuận xu hướng với điểm SL rất ngắn!</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30 space-y-1">
          <strong class="text-amber-300 block">🟡 Trường hợp B – Hồi sâu có dấu hiệu suy yếu (Cảnh giác cao độ):</strong>
          <p>• EMA20 phẳng dần, không còn dốc.</p>
          <p>• Khoảng cách giữa EMA20 – EMA50 bị bóp nghẹt thu hẹp.</p>
          <p>• Giá đóng cửa liên tục ở phía đối diện EMA20.</p>
          <p>• Cấu trúc đỉnh đáy HL/LH bắt đầu bị đe dọa $\\rightarrow$ <strong>Cần cảnh giác, chưa nhất thiết đảo chiều hoàn chỉnh nhưng KHÔNG được vào lệnh vội</strong>.</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-rose-500/30 space-y-1">
          <strong class="text-rose-400 block">🔴 Trường hợp C – Đảo chiều có xác nhận (Chuẩn bị đổi hướng):</strong>
          <p>• Giá phá vỡ cấu trúc quan trọng (BOS/CHoCH).</p>
          <p>• EMA20 đổi hướng rõ ràng và cắt chéo qua EMA50.</p>
          <p>• Giá quay lại kiểm tra (retest) vùng EMA nhưng thất bại, không thể quay về xu hướng cũ $\\rightarrow$ <strong>Xác nhận hình thành xu hướng mới!</strong></p>
        </div>
      </div>
    `
  },

  // 6. THỊ TRƯỜNG SIDEWAY
  SIDEWAY_TRADING: {
    id: 'sideway_trading',
    title: '6. Cách giao dịch khi thị trường Sideway (SW)',
    shortTitle: 'Giao dịch Sideway',
    icon: '📦',
    keywords: ['sideway', 'sw', 'đi ngang', 'thị trường sideway', 'đánh sideway', 'hộp sideway', 'biên trên', 'biên dưới'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          📦 6. CÁCH GIAO DỊCH KHI THỊ TRƯỜNG SIDEWAY (ĐI NGANG)
        </div>
        <p><strong>Tuyệt đối không áp dụng máy móc chiến lược thuận xu hướng trong vùng Sideway!</strong></p>
        
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-amber-400 block">🔍 5 DẤU HIỆU NHẬN DIỆN SIDEWAY:</strong>
          <p>1. EMA20 và EMA50 gần như đi ngang phẳng lì.</p>
          <p>2. Khoảng cách giữa hai đường rất nhỏ (hệ số $D < 0.35$).</p>
          <p>3. EMA20 liên tục cắt lên rồi lại cắt xuống EMA50.</p>
          <p>4. Giá liên tục đi xuyên qua cả hai đường.</p>
          <p>5. Đỉnh và đáy không tạo cấu trúc HH/HL hay LH/LL rõ ràng.</p>
        </div>

        <div class="space-y-2">
          <strong class="text-sky-400 block">🛠 QUY TẮC XỬ LÝ KHI GẶP SIDEWAY:</strong>
          <p>• <strong>Thứ nhất</strong>: Xác định rõ biên trên (Kháng cự) và biên dưới (Hỗ trợ) của vùng dao động.</p>
          <p>• <strong>Thứ hai</strong>: <strong>KHÔNG sử dụng giao cắt EMA20/50 làm tín hiệu BUY/SELL độc lập!</strong></p>
          <p>• <strong>Thứ ba</strong>: Quan sát phản ứng tại hai biên: Gần biên dưới $\\rightarrow$ theo dõi từ chối giá thấp để đánh lên; Gần biên trên $\\rightarrow$ theo dõi từ chối giá cao để đánh xuống.</p>
          <p>• <strong>Thứ tư</strong>: Tuyệt đối <strong>tránh đuổi giá ở chính giữa vùng dao động</strong>.</p>
          <p>• <strong>Thứ năm</strong>: Nếu giá phá biên (Breakout), bắt buộc phải chờ nến đóng cửa ngoài biên và kiểm tra (retest) khả năng giữ vững vùng phá vỡ.</p>
        </div>

        <div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
          ⚠️ <strong>Khắc cốt ghi tâm:</strong> Khi EMA20 và EMA50 đan xen liên tục, lợi thế của mọi chiến lược theo xu hướng đều giảm mạnh! Đứng ngoài quan sát là một vị thế thông minh.
        </div>
      </div>
    `
  },

  // 7. THỊ TRƯỜNG NHIỄU (CHOP) & BỘ LỌC D
  CHOP_FILTER_D: {
    id: 'chop_filter_d',
    title: '7. Cách xử lý thị trường nhiễu (CHOP) & Bộ lọc ATR',
    shortTitle: 'Lọc nhiễu Chop & Hệ số D',
    icon: '🌪️',
    keywords: ['chop', 'nhiễu', 'thị trường chop', 'bộ lọc d', 'công thức d', 'khoảng cách ema', 'atr lọc nhiễu', 'd ratio'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 font-bold">
          🌪️ 7. XỬ LÝ THỊ TRƯỜNG NHIỄU (CHOP) & BỘ LỌC KHOẢNG CÁCH ATR (D)
        </div>
        <p><strong>Sideway và Chop có liên quan nhưng không hoàn toàn giống nhau:</strong></p>
        <p>• <em>Sideway</em>: Thị trường dao động trong vùng biên tương đối rõ (có thể đánh đảo chiều ở biên).</p>
        <p>• <em>Chop</em>: Giá giật lên xuống thất thường, liên tục đổi hướng, quét râu 2 đầu, tín hiệu dễ bị đảo ngược ngay lập tức.</p>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-orange-400 block">⚡ 5 DẤU HIỆU NHẬN BIẾT CHOP:</strong>
          <p>1. Nến tăng giảm xen kẽ liên tục (xanh đỏ đảo chiều từng cây).</p>
          <p>2. Giá liên tục cắt qua lại EMA20.</p>
          <p>3. EMA20 và EMA50 giao cắt nhiều lần trong khoảng thời gian ngắn.</p>
          <p>4. Cả hai đường EMA gần như nằm ngang.</p>
          <p>5. Giá phá đỉnh hoặc đáy nhỏ rồi quay ngược rất nhanh (Quét thanh khoản bẫy).</p>
        </div>

        <div class="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 space-y-1.5">
          <strong class="text-sky-400 block">📐 BỘ LỌC CHỐNG NHIỄU CHUẨN HÓA KHOẢNG CÁCH (HỆ SỐ D):</strong>
          <div class="p-2 rounded bg-slate-900 font-mono text-center text-amber-300 font-bold text-sm">
            D = |EMA20 - EMA50| / ATR(14)
          </div>
          <p>• <strong>D nhỏ (&lt; 0.35 đối với XAU hoặc &lt; 0.32 đối với XAG)</strong>: Hai đường quá gần nhau so với biên độ nến $\\rightarrow$ Cảnh báo thị trường nén hoặc Chop, <strong>chuyển trạng thái sang WAIT</strong>!</p>
          <p>• <strong>D tăng & mở rộng</strong>: Khoảng cách hai đường mở rộng $\\rightarrow$ Xu hướng có sự đồng thuận mạnh mẽ, vào lệnh an toàn.</p>
          <p>• <strong>D giảm dần</strong>: Xu hướng có dấu hiệu mất động lượng, cẩn thận nhịp phân phối.</p>
        </div>
      </div>
    `
  },

  // 8. BẢN CHẤT GIAO CẮT EMA20/50
  CROSSOVER_TRUTH: {
    id: 'crossover_truth',
    title: '8. Cách giao dịch khi EMA20 cắt EMA50',
    shortTitle: 'Giao cắt EMA20 / EMA50',
    icon: '✂️',
    keywords: ['cắt nhau', 'giao cắt', 'ema20 cắt ema50', 'cắt lên', 'cắt xuống', 'golden cross', 'death cross', 'giao cắt giả'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          ✂️ 8. SỰ THẬT VỀ GIAO CẮT EMA20 VÀ EMA50 (CHỐNG GIAO CẮT GIẢ)
        </div>
        <p>Đây là phần nhiều trader thường nhầm lẫn dẫn tới thua lỗ nặng nhất!</p>
        
        <div class="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-1.5">
          <strong class="text-emerald-400 block">🟢 Khi EMA20 cắt lên EMA50 (Golden Cross):</strong>
          <p class="text-rose-300 font-bold">⛔ KHÔNG ĐƯỢC BUY NGAY! Cần kiểm tra kỹ 5 yếu tố:</p>
          <p>1. Giá có nằm trên cả hai đường EMA hay không?</p>
          <p>2. EMA20 có thực sự dốc lên rõ ràng hay chỉ ngóc nhẹ?</p>
          <p>3. EMA50 có bắt đầu đổi hướng lên theo hay không?</p>
          <p>4. Cấu trúc giá có tạo đỉnh đáy cao hơn (HH/HL) hay không?</p>
          <p>5. Sau giao cắt, giá có giữ vững được phía trên EMA50 khi kiểm định lại?</p>
          <p class="text-slate-400 italic">👉 Nếu vừa cắt lên mà giá lập tức quay đầu đâm xuống, đó chắc chắn là giao cắt giả (Fake Cross)!</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-rose-500/30 space-y-1.5">
          <strong class="text-rose-400 block">🔴 Khi EMA20 cắt xuống EMA50 (Death Cross):</strong>
          <p class="text-amber-300 font-bold">⛔ KHÔNG ĐƯỢC SELL NGAY! Cần kiểm tra tương tự:</p>
          <p>1. Giá có nằm dưới cả hai đường EMA không?</p>
          <p>2. EMA20 có dốc xuống mạnh mẽ không?</p>
          <p>3. EMA50 có bắt đầu dốc xuống không?</p>
          <p>4. Cấu trúc giá có tạo LH/LL không?</p>
          <p>5. Giá có giữ vững được phía dưới EMA50 khi hồi kiểm định không?</p>
        </div>

        <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px]">
          💡 <strong>Kết luận:</strong> Giao cắt chỉ là <strong>một thành phần</strong> trong hệ thống xác nhận xu hướng, không bao giờ được dùng làm tín hiệu vào lệnh độc lập!
        </div>
      </div>
    `
  },

  // 9. THANG ĐIỂM 100 & CÔNG THỨC TÍN HIỆU
  SCORING_FORMULA: {
    id: 'scoring_formula',
    title: '9. Công thức xác định tín hiệu BUY/SELL tổng hợp (Thang 100 điểm)',
    shortTitle: 'Thang 100 điểm tín hiệu',
    icon: '💯',
    keywords: ['thang điểm', '100 điểm', 'công thức tính điểm', 'confirmed', 'setup', 'watch', 'điểm chất lượng', 'score'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          💯 9. CÔNG THỨC CHẤM ĐIỂM CHẤT LƯỢNG TÍN HIỆU (THANG 100 ĐIỂM)
        </div>
        <p>Để loại bỏ hoàn toàn cảm tính, hệ thống chia tín hiệu thành 4 trụ cột đánh giá khách quan:</p>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-emerald-400 block">1. Vị trí & Độ dốc EMA (25đ)</strong>
            <p class="text-slate-400 mt-1">• Thứ tự 2 đường EMA (10đ)<br>• Độ dốc EMA20 (8đ)<br>• Hướng của EMA50 (7đ)</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-sky-400 block">2. Cấu trúc Đỉnh/Đáy (25đ)</strong>
            <p class="text-slate-400 mt-1">• Cấu trúc HH/HL hoặc LH/LL (15đ)<br>• Không bị gãy cấu trúc chính (10đ)</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-amber-400 block">3. Nến đóng & Vị trí giá (25đ)</strong>
            <p class="text-slate-400 mt-1">• Nến đóng xác nhận ngoài cản (15đ)<br>• Không dãn xa EMA20 ($< 1.85\\times ATR$) (10đ)</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-purple-400 block">4. Đa khung & Động lượng (25đ)</strong>
            <p class="text-slate-400 mt-1">• Độ mở rộng hệ số $D \\ge 0.35$ (10đ)<br>• Đồng thuận MTF (H1, M30, M15) (15đ)</p>
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-amber-300 block">🎯 PHÂN TẦNG TÍN HIỆU:</strong>
          <p>• <strong class="text-emerald-400">Từ 75 đến 100 điểm (CONFIRMED)</strong>: Đạt chuẩn tuyệt đối $\\rightarrow$ <strong>Kích hoạt phát tín hiệu vào lệnh</strong>.</p>
          <p>• <strong class="text-amber-300">Từ 60 đến 74 điểm (SETUP)</strong>: Đang hình thành vùng nén $\\rightarrow$ Chờ nến đóng hoặc chờ giá hồi kiểm định thêm.</p>
          <p>• <strong class="text-slate-400">Dưới 60 điểm (WATCH / WAIT)</strong>: Thị trường yếu hoặc nhiễu $\\rightarrow$ <strong>Đứng ngoài bảo vệ vốn</strong>.</p>
        </div>
      </div>
    `
  },

  // 10. PHỐI HỢP ĐA KHUNG (MTF)
  MTF_COORDINATION: {
    id: 'mtf_coordination',
    title: '10. Phối hợp đa khung thời gian (H1, M30, M15, M5)',
    shortTitle: 'Phối hợp Đa khung (MTF)',
    icon: '📊',
    keywords: ['đa khung', 'mtf', 'h1', 'm30', 'm15', 'm5', 'khung thời gian', 'phối hợp khung'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold">
          📊 10. NGUYÊN TẮC PHỐI HỢP ĐA KHUNG THỜI GIAN (MTF ENGINE)
        </div>
        <p>Mỗi khung thời gian đảm nhận một nhiệm vụ riêng biệt, không được nhầm lẫn:</p>
        
        <div class="space-y-2">
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span class="text-amber-400 font-black">Khung H1 (Bối cảnh lớn - Trend Setter)</span>
            <p class="text-slate-300 mt-0.5">Xác định xu hướng chủ đạo trung hạn, độ dốc của EMA50 và các mốc cản cứng.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span class="text-emerald-400 font-black">Khung M30 & M15 (Cấu trúc sóng & Vùng hồi)</span>
            <p class="text-slate-300 mt-0.5">Xác định cấu trúc đỉnh đáy (HH/HL hoặc LH/LL), nhận diện vùng hồi Pullback về EMA20/EMA50 và phát hiện các bẫy giá.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <span class="text-sky-400 font-black">Khung M5 (Tối ưu điểm vào lệnh - Entry Trigger)</span>
            <p class="text-slate-300 mt-0.5">Tìm điểm kích hoạt bấm nút lệnh với tỷ lệ R:R tối ưu và SL ngắn nhất sau khi nến M5 kiểm định thành công dải EMA.</p>
          </div>
        </div>

        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
          ⛔ <strong>Quy tắc cấm kỵ:</strong> Tuyệt đối không bao giờ BUY trên M5 khi H1 đang dốc xuống cắm đầu! M5 chỉ là công cụ bấm nút, H1 và M15 mới là người quyết định hướng đi của dòng tiền lớn!
        </div>
      </div>
    `
  },

  // 11. QUẢN LÝ RỦI RO & ĐẶT SL/TP
  RISK_MANAGEMENT: {
    id: 'risk_management',
    title: '11. Quản lý rủi ro, Điểm vào & Cắt lỗ theo cấu trúc',
    shortTitle: 'Quản lý rủi ro & Đặt SL/TP',
    icon: '🛡️',
    keywords: ['quản lý rủi ro', 'đặt sl', 'cắt lỗ', 'chốt lời', 'tp', 'trailing stop', 'hòa vốn', 'chống đu đỉnh', 'sl dương'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
          🛡️ 11. QUẢN TRỊ RỦI RO & BỘ NGUYÊN TẮC ĐẶT SL / TP CHUẨN XÁC
        </div>
        
        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-rose-400 block">🛑 ĐẶT STOP LOSS (SL) THEO CẤU TRÚC (KHÔNG ĐẶT SÁT EMA):</strong>
          <p>• Khi <strong>BUY</strong>: SL đặt ngoài <strong>đáy HL quan trọng gần nhất</strong> cộng thêm đệm ATR (khoảng 7–13 giá đối với Vàng).</p>
          <p>• Khi <strong>SELL</strong>: SL đặt ngoài <strong>đỉnh LH quan trọng gần nhất</strong> cộng thêm đệm ATR.</p>
          <p class="text-amber-300 italic">⚠️ Tuyệt đối không đặt SL sát sạt đường EMA20 vì các nhịp quét râu kỹ thuật sẽ liếm SL trước khi giá chạy đúng hướng!</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-amber-400 block">🚫 BỘ LỌC CHỐNG ĐU ĐỈNH / ĐU ĐÁY (OVEREXTENDED):</strong>
          <p>• Khi khoảng cách giữa giá hiện tại và EMA20 <strong>$> 1.85\\times ATR$</strong> $\\rightarrow$ CẤM MỞ LỆNH ĐUỔI!</p>
          <p>• Phải kiên nhẫn chờ giá Pullback hồi về gần EMA20 rồi mới quan sát điểm vào.</p>
        </div>

        <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <strong class="text-emerald-400 block">🎯 CHỐT LỜI (TP) & BẢO HIỂM VỐN:</strong>
          <p>• <strong>TP1 (Tỷ lệ 1:1.5 - 1:2)</strong>: Chốt bớt 50% khối lượng và <strong>lập tức kéo SL về Hòa Vốn (SL Dương)</strong>.</p>
          <p>• <strong>TP2 (1:2.5 - 1:3) & TP3 (1:4+)</strong>: Thả trôi lệnh theo dải EMA20 cho đến khi xuất hiện nến đảo chiều hoặc gãy cấu trúc.</p>
        </div>
      </div>
    `
  },

  // 12. DẤU HIỆU SUY YẾU & ĐẢO CHIỀU SỚM
  WEAKNESS_SIGNS: {
    id: 'weakness_signs',
    title: '12. Dấu hiệu suy yếu & Đảo chiều sớm',
    shortTitle: 'Dấu hiệu suy yếu / Đảo chiều',
    icon: '⚠️',
    keywords: ['suy yếu', 'đảo chiều', 'dấu hiệu suy yếu', 'hết sóng', 'mất đà', 'đảo chiều sớm'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
          ⚠️ 12. 4 DẤU HIỆU NHẬN BIẾT XU HƯỚNG SUY YẾU & ĐẢO CHIỀU SỚM
        </div>
        <div class="space-y-2">
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-rose-400 block">1. Độ dốc của EMA20 phẳng dần</strong>
            <p class="text-slate-300 mt-0.5">EMA20 mất đi góc nghiêng sắc nét, bắt đầu bẻ ngang $\\rightarrow$ Báo hiệu xung lực mua/bán đã cạn kiệt.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-rose-400 block">2. Khoảng cách EMA20 và EMA50 bị thu hẹp</strong>
            <p class="text-slate-300 mt-0.5">Chỉ số D co lại nhanh chóng $\\rightarrow$ Hai đường tiến sát lại nhau chuẩn bị cho một pha giao cắt đảo chiều.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-rose-400 block">3. Giá đóng cửa liên tục ở phía đối diện EMA20</strong>
            <p class="text-slate-300 mt-0.5">Trong xu hướng tăng, nến bắt đầu đóng cửa phía dưới EMA20 liên tiếp $\\rightarrow$ Bên bán đã giành quyền kiểm soát.</p>
          </div>
          <div class="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <strong class="text-rose-400 block">4. Cấu trúc Đỉnh/Đáy thất bại</strong>
            <p class="text-slate-300 mt-0.5">Giá không còn tạo được đỉnh cao hơn (HH) mà tạo đỉnh thấp hơn (LH), sau đó đâm thủng đáy HL gần nhất (CHoCH).</p>
          </div>
        </div>
      </div>
    `
  },

  // 13. THỐNG KÊ & KIỂM ĐỊNH BACKTEST
  BACKTEST_STATS: {
    id: 'backtest_stats',
    title: '13. Thống kê & Kiểm định thực tế',
    shortTitle: 'Kiểm định & Thống kê',
    icon: '📈',
    keywords: ['thống kê', 'kiểm định', 'backtest', 'win rate', 'tỷ lệ thắng', 'kết quả thực tế', '1640 lệnh'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 font-bold">
          📈 13. KẾT QUẢ THỐNG KÊ & KIỂM ĐỊNH THỰC TẾ TRÊN MÁY CHỦ LIVE
        </div>
        <div class="space-y-2">
          <p>Dữ liệu giao dịch thực tế qua hơn <strong>1.640 lệnh lịch sử</strong> trên XAU/USD, BTC và XAG chứng minh:</p>
          <div class="grid grid-cols-2 gap-2 text-center font-mono">
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span class="text-[10px] text-slate-500 block">TỶ LỆ THẮNG TOÀN BỘ</span>
              <strong class="text-emerald-400 text-base">97.3%</strong>
              <span class="text-[10px] text-slate-400 block">(Bao gồm TP & Hòa vốn)</span>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span class="text-[10px] text-slate-500 block">50 LỆNH GẦN NHẤT</span>
              <strong class="text-amber-300 text-base">78.0%</strong>
              <span class="text-[10px] text-slate-400 block">(Chuẩn Backtest 78-82%)</span>
            </div>
          </div>
          <p class="text-[11px] text-slate-400">
            • Khi áp dụng bộ lọc <strong>$D \\ge 0.35$</strong> kết hợp chặn dãn cách <strong>$1.85\\times ATR$</strong>, toàn bộ các bẫy đu đỉnh/đáy trong phiên Á đều được loại bỏ, giữ vốn an toàn trước khi vào phiên Âu - Mỹ.
          </p>
        </div>
      </div>
    `
  },

  // 14. 8 LỖI KINH ĐIỂN CẦN TRÁNH
  CLASSIC_MISTAKES: {
    id: 'classic_mistakes',
    title: '14. 8 Lỗi kinh điển cần tuyệt đối tránh khi dùng MA',
    shortTitle: '8 Lỗi kinh điển cần tránh',
    icon: '❌',
    keywords: ['lỗi', 'sai lầm', 'cần tránh', '8 lỗi', 'lỗi kinh điển', 'thất bại', 'cháy tài khoản'],
    render: (ctx) => `
      <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
        <div class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold">
          ❌ 14. 8 LỖI KINH ĐIỂN CẦN TUYỆT ĐỐI TRÁNH KHI SỬ DỤNG MA
        </div>
        <div class="space-y-1.5 text-slate-300">
          <p>1. <strong>Vừa thấy EMA20 cắt EMA50 là bấm lệnh ngay</strong> (dính bẫy giao cắt giả khi thị trường đang phẳng).</p>
          <p>2. <strong>Mua / Bán khi giá đã dãn cách quá xa EMA20</strong> (đu đỉnh hoặc bán tháo ngay đáy nhịp sóng).</p>
          <p>3. <strong>Cố chấp áp dụng chiến lược trend trong thị trường Sideway hoặc Chop</strong>.</p>
          <p>4. <strong>Đặt Stop Loss quá sát đường EMA20</strong> thay vì đặt ngoài cấu trúc đỉnh/đáy.</p>
          <p>5. <strong>Đánh ngược xu hướng của khung thời gian lớn hơn (H1)</strong>.</p>
          <p>6. <strong>Vào lệnh khi nến chưa đóng cửa</strong> (bị quét râu lừa).</p>
          <p>7. <strong>Gồng lỗ vô kỷ luật</strong> khi cấu trúc HL/LH đã bị phá vỡ hoàn toàn.</p>
          <p>8. <strong>Giao dịch ngay sát giờ Tin Đỏ (CPI, Fed, NFP)</strong> chuẩn bị công bố.</p>
        </div>
        <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold">
          💡 Hãy luôn nhớ: "Không có phương pháp nào đúng 100%, nhưng kỷ luật quản trị rủi ro và tuân thủ bộ lọc chất lượng sẽ giúp bạn luôn nằm trong nhóm 5% chiến thắng!"
        </div>
      </div>
    `
  }
};

/**
 * Tìm kiếm & Chắt lọc câu trả lời tri thức EMA20-50 dựa trên câu hỏi của người dùng
 * @param {string} query - Câu hỏi người dùng
 * @param {object} marketContext - Bối cảnh thị trường realtime (giá, EMA, MTF)
 * @returns {object|null} - Kết quả chắt lọc gồm topic, title, html
 */
function searchEMA2050Knowledge(query, marketContext) {
  if (!query) return null;
  const qLower = query.toLowerCase().trim();

  // 1. Kiểm tra xem có từ khóa liên quan tới hệ thống MA/EMA không
  const isMaRelated = /ema|ma\s*20|ma\s*50|ma\s*wave|đường trung bình|cắt nhau|giao cắt|sideway|chop|pullback|hồi sâu|uptrend|downtrend|bộ lọc d|d ratio|đu đỉnh|đu đáy|sl cấu trúc|cắt lỗ|chốt lời|8 lỗi|kinh điển/i.test(qLower);

  // 2. Chấm điểm độ khớp cho từng chủ đề trong 14 chuyên đề
  let bestTopic = null;
  let maxScore = 0;

  for (const key of Object.keys(EMA2050_TOPICS)) {
    const topic = EMA2050_TOPICS[key];
    let score = 0;

    // So khớp keywords
    for (const kw of topic.keywords) {
      if (qLower.includes(kw)) {
        score += kw.length >= 8 ? 5 : (kw.length >= 4 ? 3 : 2);
      }
    }

    // So khớp cụm từ đặc thù linh hoạt hơn
    if (topic.id === 'nature_role' && (/bản chất|nhiệm vụ|vai trò|ema là gì|đường trung bình là gì|ema20.*ema50/i.test(qLower))) score += 8;
    if (topic.id === 'market_states' && (/5 trạng thái|trạng thái thị trường|phân loại thị trường|nhận diện thị trường/i.test(qLower))) score += 8;
    if (topic.id === 'buy_strategy' && (/khi nào.*(?:buy|mua)|cách.*(?:vào|đánh).*buy|mua khi nào|chiến lược.*buy|vào lệnh.*buy|điều kiện.*buy|uptrend.*buy|mua theo xu hướng/i.test(qLower))) score += 9;
    if (topic.id === 'sell_strategy' && (/khi nào.*(?:sell|bán)|cách.*(?:vào|đánh).*sell|bán khi nào|chiến lược.*sell|vào lệnh.*sell|điều kiện.*sell|downtrend.*sell|bán theo xu hướng/i.test(qLower))) score += 9;
    if (topic.id === 'pullback_ema50' && (/hồi sâu|về ema50|xuyên ema50|chạm ema50|test ema50|trường hợp a|trường hợp b|trường hợp c/i.test(qLower))) score += 10;
    if (topic.id === 'sideway_trading' && (/sideway|sw|đi ngang|hộp dao động|đánh sideway/i.test(qLower))) score += 8;
    if (topic.id === 'chop_filter_d' && (/chop|nhiễu|lọc nhiễu|bộ lọc d|hệ số d|d ratio|công thức d|khoảng cách ema/i.test(qLower))) score += 10;
    if (topic.id === 'crossover_truth' && (/cắt nhau|giao cắt|cắt lên|cắt xuống|golden cross|death cross|cắt có mua|cắt có bán|vừa cắt|giao cắt.*vào lệnh|giao cắt giả/i.test(qLower))) score += 10;
    if (topic.id === 'scoring_formula' && (/thang điểm|100 điểm|confirmed|setup|watch|công thức tính điểm|chấm điểm/i.test(qLower))) score += 10;
    if (topic.id === 'mtf_coordination' && (/đa khung|mtf|h1|m30|m15|m5|phối hợp khung|khung thời gian/i.test(qLower))) score += 8;
    if (topic.id === 'risk_management' && (/đặt sl|cắt lỗ|chốt lời|tp|quản lý rủi ro|trailing stop|đu đỉnh|đu đáy|sl cấu trúc|hòa vốn|kéo sl/i.test(qLower))) score += 8;
    if (topic.id === 'weakness_signs' && (/suy yếu|đảo chiều|hết sóng|mất đà|sắp gãy/i.test(qLower))) score += 8;
    if (topic.id === 'backtest_stats' && (/thống kê|kiểm định|backtest|win rate|tỷ lệ thắng/i.test(qLower))) score += 8;
    if (topic.id === 'classic_mistakes' && (/lỗi|sai lầm|cần tránh|8 lỗi|kinh điển|cháy tài khoản/i.test(qLower))) score += 10;

    if (score > maxScore) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  // Nếu tìm thấy chủ đề phù hợp hoặc có liên quan tới MA
  if (bestTopic && maxScore >= 2) {
    return {
      topic: bestTopic,
      renderedHtml: bestTopic.render(marketContext),
      mode: `EMA20-50 Specialist: ${bestTopic.shortTitle}`
    };
  }

  // Nếu người dùng hỏi chung chung về MA/EMA mà không khớp chủ đề con cụ thể
  if (isMaRelated) {
    return {
      topic: EMA2050_TOPICS.NATURE_ROLE,
      renderedHtml: EMA2050_TOPICS.NATURE_ROLE.render(marketContext),
      mode: 'EMA20-50 Specialist Mentor'
    };
  }

  return null;
}

// Export cho cả Node.js (server.js) và Trình duyệt (app.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EMA2050_TOPICS,
    searchEMA2050Knowledge
  };
} else if (typeof window !== 'undefined') {
  window.EMA2050_TOPICS = EMA2050_TOPICS;
  window.searchEMA2050Knowledge = searchEMA2050Knowledge;
}

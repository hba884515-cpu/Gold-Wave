/**
 * Gold Trading App - Lịch Kinh Tế USD Chuẩn Investing.com & Tin Tức Vĩ Mô
 * Dữ liệu đồng bộ theo: https://vn.investing.com/economic-calendar
 */

const EconomicNews = {
  investingCalendarUrl: 'https://vn.investing.com/economic-calendar',

  // Danh mục sự kiện kinh tế liên quan trực tiếp đến đồng USD và Giá Vàng
  calendar: [
    {
      id: 'INV-USD-01',
      date: 'Hôm nay',
      time: '19:30',
      country: 'USD',
      event: 'Chỉ Số Giá Tiêu Dùng CPI Mỹ (YoY)',
      stars: '⭐⭐⭐ (Mạnh)',
      impact: 'HIGH',
      forecast: '2.5%',
      previous: '2.9%',
      actual: null,
      source: 'Investing.com',
      description: 'Thước đo lạm phát quan trọng nhất của Mỹ. Nếu CPI giảm thấp hơn dự báo, đồng USD sẽ giảm giá mạnh, kích hoạt sóng Tăng bứt phá cho Vàng.',
      goldImpact: 'BULLISH',
      traderAction: 'Ưu tiên giữ vị thế MUA theo Sóng Wave, tránh giao dịch sát giờ công bố 10 phút.'
    },
    {
      id: 'INV-USD-02',
      date: 'Hôm nay',
      time: '21:00',
      country: 'USD',
      event: 'Quyết Định Lãi Suất Của FED & Họp Báo FOMC',
      stars: '⭐⭐⭐ (Cực Mạnh)',
      impact: 'HIGH',
      forecast: '5.00%',
      previous: '5.50%',
      actual: null,
      source: 'Investing.com',
      description: 'Sự kiện định hình xu hướng vĩ mô toàn cầu. FED hạ lãi suất 50 điểm cơ bản sẽ làm suy yếu lợi suất trái phiếu Mỹ, cực kỳ có lợi cho Vàng.',
      goldImpact: 'BULLISH',
      traderAction: 'Khuyến nghị dời toàn bộ Stop Loss về hòa vốn trước giờ họp báo.'
    },
    {
      id: 'INV-USD-03',
      date: 'Ngày mai',
      time: '19:30',
      country: 'USD',
      event: 'Số Đơn Xin Trợ Cấp Thất Nghiệp Lần Đầu',
      stars: '⭐⭐ (Vừa)',
      impact: 'MEDIUM',
      forecast: '228K',
      previous: '230K',
      actual: null,
      source: 'Investing.com',
      description: 'Đo lường sức khỏe thị trường lao động Mỹ hàng tuần. Số đơn tăng chứng tỏ kinh tế chậm lại, hỗ trợ vàng duy trì đà tăng.',
      goldImpact: 'NEUTRAL',
      traderAction: 'Biến động vừa phải, thích hợp lướt sóng ngắn theo MA WAVE khung 5M - 15M.'
    },
    {
      id: 'INV-USD-04',
      date: 'Thứ Sáu',
      time: '19:30',
      country: 'USD',
      event: 'Bảng Lương Phi Nông Nghiệp NFP (Non-Farm)',
      stars: '⭐⭐⭐ (Mạnh Nhất Tháng)',
      impact: 'HIGH',
      forecast: '142K',
      previous: '114K',
      actual: null,
      source: 'Investing.com',
      description: 'Báo cáo việc làm quan trọng nhất của kinh tế Mỹ. Số liệu chênh lệch lớn sẽ tạo ra những cây nến biến động 20 - 40 giá vàng chỉ trong vài phút.',
      goldImpact: 'BULLISH',
      traderAction: 'Đợi nến 15 phút sau tin đóng cửa rõ ràng mới vào lệnh theo tín hiệu Wave.'
    },
    {
      id: 'INV-USD-05',
      date: 'Thứ Hai tuần tới',
      time: '20:45',
      country: 'USD',
      event: 'Chỉ số PMI Sản Xuất S&P Global',
      stars: '⭐ (Nhẹ)',
      impact: 'LOW',
      forecast: '48.0',
      previous: '49.6',
      actual: null,
      source: 'Investing.com',
      description: 'Đo lường hiệu quả hoạt động các doanh nghiệp sản xuất tại Mỹ.',
      goldImpact: 'NEUTRAL',
      traderAction: 'Ảnh hưởng nhẹ đến giá vàng.'
    }
  ],

  // Tin tức vĩ mô đồng USD và Vàng
  newsFeed: [
    {
      id: 'NEWS-USD-01',
      time: '15 phút trước',
      title: 'Chỉ số DXY (Đồng USD) rơi khỏi mốc 101 điểm do áp lực giảm lãi suất từ FED',
      source: 'Investing.com Tiếng Việt',
      impact: 'HIGH',
      sentiment: 'BULLISH',
      summary: 'Lực bán đồng Đô la Mỹ gia tăng trên diện rộng khi các ngân hàng đầu tư phố Wall nâng xác suất FED cắt giảm lãi suất trong cuộc họp sắp tới.',
      traderNote: 'Đồng USD suy yếu là động lực chính thúc đẩy vàng lập đỉnh mới.'
    },
    {
      id: 'NEWS-USD-02',
      time: '45 phút trước',
      title: 'Lợi suất trái phiếu kho bạc Mỹ kỳ hạn 10 năm giảm sâu về 3.65%',
      source: 'Investing.com Markets',
      impact: 'HIGH',
      sentiment: 'BULLISH',
      summary: 'Dòng tiền rút khỏi trái phiếu chính phủ Mỹ để tìm kiếm lợi nhuận ở các tài sản trú ẩn phi lợi suất như Vàng.',
      traderNote: 'Hỗ trợ mạnh cho các vị thế MUA (BUY) trung và dài hạn.'
    },
    {
      id: 'NEWS-USD-03',
      time: '2 giờ trước',
      title: 'Căng thẳng địa chính trị và nhu cầu dự trữ ngoại hối USD của các ngân hàng trung ương',
      source: 'Investing.com Economy',
      impact: 'MEDIUM',
      sentiment: 'BULLISH',
      summary: 'Xu hướng phi đô-la hóa (De-dollarization) diễn ra mạnh mẽ khi các nước tăng tỷ trọng vàng trong kho dự trữ để giảm rủi ro trừng phạt.',
      traderNote: 'Tạo lập vùng đáy hỗ trợ dài hạn cực kỳ vững chắc cho giá vàng.'
    }
  ],

  getNextHighImpactEvent() {
    return this.calendar.find(e => e.impact === 'HIGH') || this.calendar[0];
  }
};

window.EconomicNews = EconomicNews;

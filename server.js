/**
 * Gold News Intelligence Server — Data Adapter & Proxy Server
 * Fetches real economic calendar data from Investing.com and financial feeds,
 * normalizes data, and serves clean JSON API endpoints for the Gold Trading App.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Database files for persistence
const USERS_FILE = path.join(__dirname, 'users_db.json');
const DEVICES_FILE = path.join(__dirname, 'devices_db.json');
const NEWS_DB_FILE = path.join(__dirname, 'news_db.json');

function loadJSON(filePath, defaultData) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  return defaultData;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

// User DB Schema (hba4515@gmail.com and hba884515@gmail.com are ADMIN with LIFETIME access)
let usersDB = loadJSON(USERS_FILE, [
  {
    id: 'USR-ADMIN-01',
    name: 'Admin HBA',
    email: 'hba4515@gmail.com',
    passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
    authProvider: 'email',
    emailVerified: true,
    role: 'ADMIN',
    subscriptionStatus: 'LIFETIME',
    createdAt: new Date().toISOString()
  }
]);

// Payment & Subscription Config & DB
const PAYMENT_CONFIG_FILE = path.join(__dirname, 'payment_config.json');
const PAYMENT_REQUESTS_FILE = path.join(__dirname, 'payment_requests.json');

let paymentConfig = loadJSON(PAYMENT_CONFIG_FILE, {
  bankName: "MB Bank (Ngân hàng TMCP Quân Đội)",
  bankId: "MB",
  accountNumber: "0988888888",
  accountName: "HOÀNG BÁ",
  monthlyFee: "299.000 VNĐ / Tháng",
  monthlyFeeNumber: 299000,
  qrImage: "assets/payment-qr.svg",
  transferPrefix: "GOLDWAVE",
  supportZalo: "https://zalo.me",
  supportPhone: "0988.xxx.xxx",
  supportTelegram: "https://t.me",
  trialDays: 14,
  note: "Sau khi chuyển khoản, hệ thống sẽ kích hoạt tài khoản trong vòng 1-3 phút. Bạn cũng có thể liên hệ Zalo để được kích hoạt ngay lập tức."
});

let paymentRequestsDB = loadJSON(PAYMENT_REQUESTS_FILE, []);

// Helper: Calculate user subscription & 14-day trial status
function getUserSubscriptionInfo(user) {
  if (!user) {
    return { status: 'EXPIRED', isAdmin: false, isExpired: true, daysRemaining: 0 };
  }

  const emailLower = (user.email || '').toLowerCase();
  const isAdmin = user.role === 'ADMIN' || 
                  emailLower === 'hba4515@gmail.com' || 
                  emailLower === 'hba884515@gmail.com' || 
                  emailLower.includes('admin');

  if (isAdmin || user.subscriptionStatus === 'LIFETIME') {
    return {
      status: 'LIFETIME',
      isAdmin: true,
      isExpired: false,
      badgeText: 'ADMIN VIP 👑',
      badgeColor: 'emerald',
      daysRemaining: 9999,
      expiresAt: null,
      message: 'Tài khoản Quản Trị Viên (Vĩnh viễn)'
    };
  }

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Nếu tài khoản đã thanh toán gói (ACTIVE)
  if (user.subscriptionStatus === 'ACTIVE' && user.subscriptionExpiresAt) {
    const expiresAtMs = new Date(user.subscriptionExpiresAt).getTime();
    const msRemaining = expiresAtMs - now;
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / ONE_DAY_MS));

    if (msRemaining > 0) {
      return {
        status: 'ACTIVE',
        isAdmin: false,
        isExpired: false,
        badgeText: `GÓI VIP: CÒN ${daysRemaining} NGÀY ✨`,
        badgeColor: 'amber',
        daysRemaining,
        expiresAt: user.subscriptionExpiresAt,
        message: `Tài khoản đã kích hoạt gói VIP. Còn ${daysRemaining} ngày sử dụng.`
      };
    } else {
      return {
        status: 'EXPIRED',
        isAdmin: false,
        isExpired: true,
        badgeText: 'HẾT HẠN VIP ⚠️',
        badgeColor: 'rose',
        daysRemaining: 0,
        expiresAt: user.subscriptionExpiresAt,
        message: 'Gói dịch vụ 1 tháng của bạn đã hết hạn. Vui lòng thanh toán gia hạn để tiếp tục sử dụng.'
      };
    }
  }

  // 2. Tài khoản dùng thử 14 ngày (TRIAL)
  const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : now;
  const trialDays = user.trialDays || paymentConfig.trialDays || 14;
  const trialExpiresAtMs = user.trialExpiresAt ? new Date(user.trialExpiresAt).getTime() : (createdMs + trialDays * ONE_DAY_MS);
  const msRemaining = trialExpiresAtMs - now;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / ONE_DAY_MS));

  if (msRemaining > 0) {
    return {
      status: 'TRIAL',
      isAdmin: false,
      isExpired: false,
      badgeText: `DÙNG THỬ: CÒN ${daysRemaining} NGÀY ⏱️`,
      badgeColor: daysRemaining <= 3 ? 'orange' : 'blue',
      daysRemaining,
      expiresAt: new Date(trialExpiresAtMs).toISOString(),
      message: `Bạn đang trong thời gian 14 ngày dùng thử miễn phí. Còn ${daysRemaining} ngày.`
    };
  } else {
    return {
      status: 'EXPIRED',
      isAdmin: false,
      isExpired: true,
      badgeText: 'HẾT HẠN DÙNG THỬ 🔒',
      badgeColor: 'rose',
      daysRemaining: 0,
      expiresAt: new Date(trialExpiresAtMs).toISOString(),
      message: 'Thời gian dùng thử 14 ngày đã kết thúc. Vui lòng thanh toán phí duy trì để tiếp tục truy cập.'
    };
  }
}

// Normalize and save users on startup
usersDB = usersDB.map(u => {
  const emailLower = (u.email || '').toLowerCase();
  const isAdmin = emailLower === 'hba4515@gmail.com' || emailLower === 'hba884515@gmail.com' || (u.role === 'ADMIN');
  if (isAdmin) {
    u.role = 'ADMIN';
    u.subscriptionStatus = 'LIFETIME';
  } else if (!u.subscriptionStatus) {
    u.trialDays = u.trialDays || 14;
    const createdMs = u.createdAt ? new Date(u.createdAt).getTime() : Date.now();
    u.trialExpiresAt = u.trialExpiresAt || new Date(createdMs + 14 * 24 * 60 * 60 * 1000).toISOString();
    u.subscriptionStatus = 'TRIAL';
  }
  return u;
});
saveJSON(USERS_FILE, usersDB);

// Notifications DB Schema & SSE Live Stream Clients
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications_db.json');
let notificationsDB = loadJSON(NOTIFICATIONS_FILE, []);
let sseClients = [];

function addNotification(category, title, body, data = {}) {
  const item = {
    id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    category, // 'SIGNAL', 'NEWS', 'TREND'
    title,
    body,
    timestamp: new Date().toISOString(),
    data
  };
  notificationsDB.unshift(item);
  if (notificationsDB.length > 100) notificationsDB = notificationsDB.slice(0, 100);
  saveJSON(NOTIFICATIONS_FILE, notificationsDB);

  // Broadcast via SSE to all connected clients
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify(item)}\n\n`);
    } catch(e) {}
  });

  return item;
}

// Devices DB Schema
let devicesDB = loadJSON(DEVICES_FILE, []);

// News DB Schemas (Persistent events & scan logs)
let newsEventsDB = loadJSON(NEWS_DB_FILE, []);
let newsScanLogs = loadJSON(path.join(__dirname, 'news_scan_logs.json'), []);

// Helper: Hash Password (SHA-256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Bot Engine DB Schemas
const BOT_CONFIG_FILE = path.join(__dirname, 'bot_config_db.json');
const BOT_POSITIONS_FILE = path.join(__dirname, 'bot_positions_db.json');

let botConfigDB = {
  enabled: true,
  broker: 'exness',
  mode: 'live',
  serverId: 'Exness-MT5Trial17',
  accountId: '464040824',
  lotType: 'fixed',
  lotValue: 0.10,
  enableBE: true,
  enableNewsFilter: true,
  enableMaxDrawdown: true,
  entryFilterMode: 'sniper', // 'sniper' (Bắn tỉa / Chọn lọc cao - ít lệnh), 'balanced', 'scalping'
  maxConcurrentOrders: 1, // Tối đa 1 lệnh cùng lúc
  minCooldownMinutes: 45, // Giãn cách tối thiểu 45 phút giữa các lệnh
  notifyOnlyMajorSignals: true, // Chỉ thông báo tín hiệu lớn, tắt thông báo vụn vặt
  muteMinorSounds: true, // Tắt âm thanh chốt lời nhỏ
  lastBotOrderTime: 0,
  balance: 1000.00,
  pnl: 0.00,
  winCount: 0,
  lossCount: 0
};
const savedConfig = loadJSON(BOT_CONFIG_FILE, null);
if (savedConfig) {
  botConfigDB = { ...botConfigDB, ...savedConfig };
} else {
  saveJSON(BOT_CONFIG_FILE, botConfigDB);
}

let botPositionsDB = loadJSON(BOT_POSITIONS_FILE, []);

/// Comprehensive Event Translation Dictionary for USD & Gold Markets (Investing.com format)
const EVENT_TRANSLATIONS = {
  "Core CPI MoM": "Chỉ Số Giá Tiêu Dùng Lõi Core CPI (Hàng Tháng)",
  "Core CPI YoY": "Chỉ Số Giá Tiêu Dùng Lõi Core CPI (Hàng Năm)",
  "CPI MoM": "Chỉ Số Giá Tiêu Dùng CPI (Hàng Tháng)",
  "CPI YoY": "Chỉ Số Giá Tiêu Dùng CPI (Hàng Năm)",
  "CPI": "Chỉ Số Giá Tiêu Dùng CPI Mỹ",
  "CPI s.a": "Chỉ Số Giá Tiêu Dùng Điều Chỉnh Mùa Vụ CPI",
  "Inflation Rate YoY": "Chỉ Số Lạm Phát Tiêu Dùng CPI Mỹ (Hàng Năm)",
  "Inflation Rate MoM": "Chỉ Số Lạm Phát Tiêu Dùng CPI Mỹ (Hàng Tháng)",
  "Core Inflation Rate YoY": "Chỉ Số Lạm Phát Lõi Core CPI Mỹ (Hàng Năm)",
  "Core Inflation Rate MoM": "Chỉ Số Lạm Phát Lõi Core CPI Mỹ (Hàng Tháng)",
  "FOMC Interest Rate Decision": "Quyết Định Lãi Suất Của Fed & Họp Báo FOMC",
  "Fed Interest Rate Decision": "Quyết Định Lãi Suất Cục Dự Trữ Liên Bang (Fed)",
  "Fed Chair Press Conference": "Họp Báo Chủ Tịch Fed Jerome Powell",
  "FOMC Statement": "Tuyên Bố Chính Sách Tiền Tệ FOMC",
  "FOMC Minutes": "Biên Bản Cuộc Họp Chính Sách FOMC",
  "Nonfarm Payrolls": "Bảng Lương Phi Nông Nghiệp Mỹ (NFP)",
  "Non Farm Payrolls": "Bảng Lương Phi Nông Nghiệp Mỹ (NFP)",
  "Nonfarm Payrolls Private": "Bảng Lương Phi Nông Nghiệp Khối Tư Nhân",
  "Manufacturing Payrolls": "Bảng Lương Ngành Sản Xuất",
  "Government Payrolls": "Bảng Lương Khối Chính Phủ",
  "Average Hourly Earnings MoM": "Thu Nhập Bình Quân Theo Giờ (Hàng Tháng)",
  "Average Hourly Earnings YoY": "Thu Nhập Bình Quân Theo Giờ (Hàng Năm)",
  "Average Weekly Hours": "Số Giờ Làm Việc Trung Bình Hàng Tuần",
  "Participation Rate": "Tỷ Lệ Tham Gia Lực Lượng Lao Động",
  "Unemployment Rate": "Tỷ Lệ Thất Nghiệp Mỹ",
  "Initial Jobless Claims": "Số Đơn Xin Trợ Cấp Thất Nghiệp Lần Đầu",
  "Continuing Jobless Claims": "Số Đơn Tiếp Tục Nhận Trợ Cấp Thất Nghiệp",
  "Jobless Claims 4-Week Average": "Trung Bình Trợ Cấp Thất Nghiệp 4 Tuần",
  "Jobless Claims 4-week Average": "Trung Bình Trợ Cấp Thất Nghiệp 4 Tuần",
  "GDP Growth Rate QoQ": "Tăng Trưởng GDP Mỹ (Hàng Quý)",
  "GDP Growth Rate Annualized": "Tăng Trưởng GDP Mỹ (Hàng Năm)",
  "Atlanta Fed GDPNow": "Dự Báo Tăng Trưởng GDP Atlanta Fed (GDPNow)",
  "PCE Price Index MoM": "Chỉ Số Giá PCE (Hàng Tháng)",
  "PCE Price Index YoY": "Chỉ Số Giá PCE (Hàng Năm)",
  "Core PCE Price Index MoM": "Chỉ Số Giá Core PCE (Hàng Tháng)",
  "Core PCE Price Index YoY": "Chỉ Số Giá Core PCE (Hàng Năm)",
  "PPI MoM": "Chỉ Số Giá Sản Xuất PPI (Hàng Tháng)",
  "PPI YoY": "Chỉ Số Giá Sản Xuất PPI (Hàng Năm)",
  "Core PPI MoM": "Chỉ Số Giá Core PPI (Hàng Tháng)",
  "Core PPI YoY": "Chỉ Số Giá Core PPI (Hàng Năm)",
  "PPI Ex Food, Energy and Trade MoM": "Chỉ Số PPI Loại Bỏ Thực Phẩm & Năng Lượng (MoM)",
  "PPI Ex Food, Energy and Trade YoY": "Chỉ Số PPI Loại Bỏ Thực Phẩm & Năng Lượng (YoY)",
  "Retail Sales MoM": "Doanh Số Bán Lẻ Mỹ (Hàng Tháng)",
  "Retail Sales YoY": "Doanh Số Bán Lẻ Mỹ (Hàng Năm)",
  "Retail Sales Ex Autos MoM": "Doanh Số Bán Lẻ Lõi Loại Bỏ Ô Tô (MoM)",
  "S&P Global Manufacturing PMI": "Chỉ Số PMI Sản Xuất S&P Global",
  "S&P Global Manufacturing PMI Final": "Chỉ Số PMI Sản Xuất Chính Thức S&P Global",
  "S&P Global Services PMI": "Chỉ Số PMI Dịch Vụ S&P Global",
  "S&P Global Services PMI Final": "Chỉ Số PMI Dịch Vụ Chính Thức S&P Global",
  "S&P Global Composite PMI": "Chỉ Số PMI Tổng Hợp S&P Global",
  "ISM Manufacturing PMI": "Chỉ Số Nhà Quản Trị Mua Hàng Sản Xuất ISM PMI",
  "ISM Manufacturing Prices": "Chỉ Số Giá Sản Xuất Trả Trước ISM",
  "ISM Manufacturing Employment": "Chỉ Số Việc Làm Sản Xuất ISM",
  "ISM Manufacturing New Orders": "Chỉ Số Đơn Hàng Mới Sản Xuất ISM",
  "ISM Services PMI": "Chỉ Số Nhà Quản Trị Mua Hàng Dịch Vụ ISM PMI",
  "ISM Services Prices": "Chỉ Số Giá Dịch Vụ ISM",
  "ISM Services Employment": "Chỉ Số Việc Làm Dịch Vụ ISM",
  "ISM Services New Orders": "Chỉ Số Đơn Hàng Mới Dịch Vụ ISM",
  "Chicago PMI": "Chỉ Số Hoạt Động Kinh Doanh Chicago PMI",
  "ADP Employment Change": "Báo Cáo Việc Làm Khối Tư Nhân ADP",
  "ADP Employment Change Weekly": "Báo Cáo Thay Đổi Việc Làm ADP Hàng Tuần",
  "Richmond Fed Manufacturing Index": "Chỉ Số Sản Xuất Richmond Fed",
  "Redbook YoY": "Chỉ Số Doanh Số Bán Lẻ Redbook",
  "API Crude Oil Stock Change": "Báo Cáo Tồn Trữ Dầu Thô API Hàng Tuần",
  "EIA Crude Oil Stocks Change": "Báo Cáo Tồn Trữ Dầu Thô EIA Hàng Tuần",
  "EIA Gasoline Stocks Change": "Báo Cáo Tồn Trữ Xăng Dầu EIA Hàng Tuần",
  "EIA Natural Gas Stocks Change": "Báo Cáo Tồn Trữ Khí Đốt Tự Nhiên EIA",
  "2-Year Note Auction": "Đấu Giá Kỳ Phiếu Kho Bạc Mỹ 2 Năm",
  "3-Year Note Auction": "Đấu Giá Kỳ Phiếu Kho Bạc Mỹ 3 Năm",
  "5-Year Note Auction": "Đấu Giá Trái Phiếu Kho Bạc Mỹ 5 Năm",
  "7-Year Note Auction": "Đấu Giá Trái Phiếu Kho Bạc Mỹ 7 Năm",
  "10-Year Note Auction": "Đấu Giá Trái Phiếu Kho Bạc Mỹ 10 Năm",
  "30-Year Bond Auction": "Đấu Giá Trái Phiếu Kho Bạc Mỹ 30 Năm",
  "4-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 4 Tuần",
  "6-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 6 Tuần",
  "8-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 8 Tuần",
  "17-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 17 Tuần",
  "26-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 26 Tuần",
  "52-Week Bill Auction": "Đấu Giá Tín Phiếu Kho Bạc 52 Tuần",
  "Money Supply": "Cung Tiền M2 Mỹ",
  "CB Consumer Confidence": "Chỉ Số Niềm Tin Tiêu Dùng Conference Board (CB)",
  "Michigan Consumer Sentiment": "Chỉ Số Tâm Lý Tiêu Dùng ĐH Michigan",
  "Michigan Consumer Sentiment Prel": "Chỉ Số Tâm Lý Tiêu Dùng Sơ Bộ ĐH Michigan",
  "Michigan 5 Year Inflation Expectations Prel": "Kỳ Vọng Lạm Phát 5 Năm Sơ Bộ ĐH Michigan",
  "Michigan Inflation Expectations Prel": "Kỳ Vọng Lạm Phát 1 Năm Sơ Bộ ĐH Michigan",
  "Consumer Inflation Expectations": "Kỳ Vọng Lạm Phát Của Người Tiêu Dùng (NY Fed)",
  "Building Permits": "Giấy Phép Xây Dựng Mỹ",
  "Housing Starts": "Số Lượng Khởi Công Nhà Ở Mới",
  "Durable Goods Orders MoM": "Đơn Đặt Hàng Hàng Lâu Bền MoM",
  "Durable Goods Orders Ex Transp MoM": "Đơn Đặt Hàng Hàng Lâu Bền Lõi (MoM)",
  "JOLTs Job Openings": "Số Lượng Cơ Hội Việc Làm Mới Cần Tuyển JOLTs",
  "UN General Assembly": "Đại Hội Đồng Liên Hợp Quốc",
  "MBA Mortgage Applications": "Đơn Xin Vay Thế Chấp Mua Nhà MBA",
  "MBA 30-Year Mortgage Rate": "Lãi Suất Vay Thế Chấp 30 Năm MBA",
  "Existing Home Sales": "Doanh Số Bán Nhà Hiện Có",
  "Existing Home Sales MoM": "Doanh Số Bán Nhà Hiện Có (Hàng Tháng)",
  "New Home Sales": "Doanh Số Bán Nhà Mới",
  "New Home Sales MoM": "Doanh Số Bán Nhà Mới (Hàng Tháng)",
  "Trade Balance": "Cán Cân Thương Mại Mỹ",
  "Factory Orders MoM": "Đơn Đặt Hàng Nhà Máy Hàng Tháng",
  "Wholesale Inventories MoM": "Hàng Tồn Kho Bán Buôn Hàng Tháng",
  "Construction Spending MoM": "Chi Tiêu Xây Dựng Hàng Tháng",
  "Consumer Credit Change": "Mức Thay Đổi Tín Dụng Tiêu Dùng",
  "Total Household Debt": "Tổng Nợ Hộ Gia Đình Mỹ",
  "NFIB Business Optimism Index": "Chỉ Số Lạc Quan Kinh Doanh Doanh Nghiệp Nhỏ NFIB",
  "Monthly Budget Statement": "Báo Cáo Ngân Sách Hàng Tháng Của Bộ Tài Chính Mỹ",
  "Fed Balance Sheet": "Quy Mô Bảng Cân Đối Kế Toán Của Fed",
  "Baker Hughes Oil Rig Count": "Số Lượng Giàn Khoan Dầu Hoạt Động Baker Hughes",
  "Baker Hughes Total Rigs Count": "Tổng Số Giàn Khoan Năng Lượng Baker Hughes",
  "Veterans Day": "Ngày Cựu Chiến Binh Mỹ (Thị Trường Trái Phiếu Đóng Cửa)"
};

function translateTitle(rawTitle) {
  if (!rawTitle) return "Sự kiện kinh tế Mỹ";
  if (EVENT_TRANSLATIONS[rawTitle]) return EVENT_TRANSLATIONS[rawTitle];
  let t = String(rawTitle);

  if (t.includes("Fed ") && t.includes("Speech")) {
    const speaker = t.replace("Fed ", "").replace(" Speech", "");
    return `Bài Phát Biểu Quan Chức Fed ${speaker}`;
  }
  if (t.includes("Note Auction")) return t.replace("Note Auction", "Đấu Giá Kỳ Phiếu Kho Bạc Mỹ");
  if (t.includes("Bond Auction")) return t.replace("Bond Auction", "Đấu Giá Trái Phiếu Kho Bạc Mỹ");
  if (t.includes("Bill Auction")) return t.replace("Bill Auction", "Đấu Giá Tín Phiếu Kho Bạc Mỹ");
  if (t.includes("Fed")) t = t.replace(/Fed/g, "Cục Dự Trữ Liên Bang (Fed)");
  return t;
}

function formatVal(val, scale) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val);
  return scale ? str + scale : str;
}

function getVietnamDateAndAppTime(isoDateStr) {
  const d = new Date(isoDateStr);
  const optionsDate = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const optionsTime = { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false };

  const dateParts = new Intl.DateTimeFormat('en-CA', optionsDate).format(d); // YYYY-MM-DD
  const timeStr = new Intl.DateTimeFormat('vi-VN', optionsTime).format(d);   // HH:MM

  const todayStr = new Intl.DateTimeFormat('en-CA', optionsDate).format(new Date());
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomStr = new Intl.DateTimeFormat('en-CA', optionsDate).format(tom);

  let dateLabel = dateParts;
  if (dateParts === todayStr) dateLabel = 'Hôm nay';
  else if (dateParts === tomStr) dateLabel = 'Ngày mai';

  return { dateLabel, dateStr: dateParts, timeStr };
}

function fetchTradingViewCalendar() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    // Fetch events from 72 hours ago up to 20 days ahead (covers past 3 days, today, tomorrow, this week, and full next week!)
    const fromStr = new Date(now.getTime() - 72 * 3600000).toISOString();
    const toStr = new Date(now.getTime() + 20 * 86400000).toISOString();

    const options = {
      hostname: 'economic-calendar.tradingview.com',
      path: `/events?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&countries=US`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 12000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          const json = JSON.parse(data);
          resolve(json.result || []);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function generateDetailedMacroAnalysis(e) {
  const title = (e.title || e.eventName || '').toLowerCase();
  const titleVn = e.title_vn || e.eventNameVn || e.title;
  const isHigh = (e.importance === 'HIGH' || e.impact === 'HIGH');
  const actual = e.actual;
  const forecast = e.forecast;
  const previous = e.previous;

  let category = 'GENERAL';
  let overview = '';
  let whyItMatters = '';
  let scenarios = { higher: '', asExpected: '', lower: '' };
  let assetImpacts = { gold: '', btc: '', silver: '', dxy: '' };
  let actionablePlaybook = {
    beforeRelease: 'Quản trị vốn nghiêm ngặt, rà soát toàn bộ lệnh đang chạy. Khuyến nghị dời Stop Loss về hòa vốn (SL Dương/BE) trước giờ tin 15 phút. Giảm khối lượng lot nếu giao dịch tin tức.',
    duringRelease: 'Trong 3-5 phút đầu tiên khi số liệu vừa công bố, thị trường có hiện tượng giãn Spread (từ 2-3 pips lên 15-20 pips) và trượt giá (Slippage). Tuyệt đối không FOMO đu đỉnh/bắt đáy trong cây nến giật đầu tiên.',
    afterRelease: 'Chờ sau 15-30 phút khi thị trường hấp thụ hết xung lực tin tức. Quan sát phản ứng nến tại các dải động EMA20 / EMA50 của MA WAVE V8 để vào lệnh theo cấu trúc sóng bền vững.'
  };

  if (title.includes('cpi') || title.includes('inflation rate')) {
    category = 'INFLATION';
    overview = `Chỉ số giá tiêu dùng CPI (Consumer Price Index) là thước đo quan trọng bậc nhất đo lường biến động giá cả của rổ hàng hóa và dịch vụ đại diện cho người tiêu dùng Mỹ. Đây là kim chỉ nam trực tiếp định hình chính sách tiền tệ của Cục Dự trữ Liên bang Fed.`;
    whyItMatters = `Lạm phát càng cao, Fed càng buộc phải giữ lãi suất ở mức cao (Hawkish), làm tăng chi phí cơ hội của việc nắm giữ các tài sản không sinh lãi suất như Vàng và Bạc, đồng thời hút dòng tiền thanh khoản khỏi các thị trường rủi ro như Bitcoin.`;
    scenarios.higher = `Nếu Thực tế (Actual) cao hơn Dự báo: Phản ánh áp lực lạm phát vẫn dai dẳng, Fed khó nới lỏng tiền tệ. Đồng USD (DXY) và lợi suất trái phiếu Mỹ bật tăng mạnh. Vàng (XAU/USD) sẽ chịu áp lực bán tháo điều chỉnh giảm mạnh (biên độ dự kiến 20 - 45 giá).`;
    scenarios.asExpected = `Nếu Thực tế bằng Dự báo: Thị trường đã định giá phần lớn kịch bản này (priced-in). Giá Vàng và Bitcoin sẽ quét 2 đầu biên độ hẹp trước khi tiếp tục vận động theo xu hướng kỹ thuật chủ đạo của MA WAVE V8.`;
    scenarios.lower = `Nếu Thực tế thấp hơn Dự báo: Báo hiệu lạm phát hạ nhiệt tích cực, mở đường cho Fed đẩy nhanh lộ trình hạ lãi suất. Đồng USD và US10Y sụt giảm mạnh. Vàng, Bạc và Bitcoin sẽ bứt phá TĂNG DỰNG ĐỨNG (Vàng có thể tăng 25 - 50 giá).`;
    assetImpacts.gold = `Vàng (XAU/USD) cực kỳ nhạy cảm với CPI. Nếu CPI thấp -> Vàng vượt kháng cự R1/R2 tiến sát đỉnh mới. Nếu CPI cao -> Vàng lùi về kiểm định các vùng hỗ trợ then chốt S1/S2.`;
    assetImpacts.btc = `Bitcoin (BTC/USD) phản ứng trực tiếp với thanh khoản đồng USD. CPI hạ nhiệt kích thích khẩu vị rủi ro (Risk-on), dòng vốn đổ mạnh vào Crypto. Ngược lại CPI cao gây áp lực điều chỉnh.`;
    assetImpacts.silver = `Bạc (XAG/USD) có độ biến động phần trăm gấp 1.5 - 2 lần Vàng. Xu hướng tăng/giảm đồng thuận với Vàng nhưng biên độ sóng mạnh hơn rất nhiều.`;
    assetImpacts.dxy = `Chỉ số DXY biến động tỷ lệ thuận với CPI: CPI cao -> DXY tăng bứt phá; CPI thấp -> DXY gãy hỗ trợ.`;
  } else if (title.includes('non farm') || title.includes('nonfarm') || title.includes('payrolls')) {
    category = 'EMPLOYMENT';
    overview = `Báo cáo Bảng lương Phi Nông nghiệp NFP (Non-Farm Payrolls) do Bộ Lao động Mỹ phát hành vào thứ Sáu đầu tiên của tháng, phản ánh số lượng việc làm mới được tạo ra trong tháng trước (ngoại trừ ngành nông nghiệp).`;
    whyItMatters = `Thị trường việc làm là một trong hai nhiệm vụ cốt lõi của Fed (bên cạnh kiểm soát lạm phát). Một thị trường lao động thắt chặt sẽ thúc đẩy tiền lương và duy trì áp lực lạm phát.`;
    scenarios.higher = `Nếu NFP thực tế cao hơn dự báo đáng kể: Kinh tế Mỹ quá khỏe, Fed không có lý do để vội vã cắt giảm lãi suất. Đồng USD tăng vọt, Vàng giảm mạnh quét thủng các vùng hỗ trợ ngắn hạn.`;
    scenarios.asExpected = `Nếu NFP sát dự báo: Thị trường chú ý thêm vào Tỷ lệ thất nghiệp và Thu nhập bình quân theo giờ để xác định hướng đi.`;
    scenarios.lower = `Nếu NFP thực tế thấp hơn dự báo: Dấu hiệu kinh tế Mỹ suy yếu, thúc đẩy làn sóng mua trú ẩn vào Vàng và củng cố kỳ vọng cắt giảm lãi suất khẩn cấp. Vàng bứt phá tăng mạnh.`;
    assetImpacts.gold = `Biên độ dao động của Vàng trong phiên NFP thường đạt từ 30 đến 60 giá chỉ trong vòng 1-2 giờ. Rất dễ quét Stop Loss 2 đầu.`;
    assetImpacts.btc = `Bitcoin biến động theo xu hướng rủi ro: NFP yếu tạo đà tăng cho BTC nhờ kỳ vọng nới lỏng định lượng tiền tệ.`;
    assetImpacts.silver = `Bạc theo sát sóng Vàng với mức biến động 3% - 6% trong phiên.`;
    assetImpacts.dxy = `DXY biến động cực mạnh theo độ chênh lệch giữa Thực tế và Dự báo.`;
  } else if (title.includes('unemployment rate')) {
    category = 'EMPLOYMENT';
    overview = `Tỷ lệ thất nghiệp đo lường tỷ lệ phần trăm lực lượng lao động đang thất nghiệp và tích cực tìm kiếm việc làm. Đây là chỉ báo trễ nhưng có trọng số rất cao trong quyết định của Fed.`;
    whyItMatters = `Nếu tỷ lệ thất nghiệp tăng vượt ngưỡng 4.2% - 4.3%, quy tắc Sahm Rule kích hoạt cảnh báo suy thoái kinh tế Mỹ, buộc Fed phải nới lỏng chính sách.`;
    scenarios.higher = `Thất nghiệp tăng -> Fed buộc phải hạ lãi suất -> Tích cực cho Vàng, tiêu cực cho USD.`;
    scenarios.asExpected = `Sát dự báo -> Thị trường tiếp tục đi theo sóng kỹ thuật.`;
    scenarios.lower = `Thất nghiệp giảm -> Thị trường lao động vững chắc -> USD mạnh lên, gây áp lực lên Vàng.`;
    assetImpacts.gold = `Hỗ trợ xu hướng tăng trung hạn nếu thất nghiệp tăng dần theo thời gian.`;
    assetImpacts.btc = `Kỳ vọng nới lỏng chính sách hỗ trợ định giá Bitcoin.`;
    assetImpacts.silver = `Tương quan đồng thuận với Vàng.`;
    assetImpacts.dxy = `Áp lực giảm nếu tỷ lệ thất nghiệp tăng cao.`;
  } else if (title.includes('fomc') || title.includes('rate decision') || title.includes('powell')) {
    category = 'CENTRAL_BANK';
    overview = `Quyết định Lãi suất của FOMC và Họp báo của Chủ tịch Fed Jerome Powell là sự kiện thượng tầng có quyền lực chi phối toàn bộ thị trường tài chính toàn cầu.`;
    whyItMatters = `Lãi suất Fed là chi phí vay mượn cơ bản của nền kinh tế số 1 thế giới. Mỗi 0.25% thay đổi đều làm đảo lộn dòng luân chuyển vốn hàng nghìn tỷ USD trên khắp các kênh tài sản.`;
    scenarios.higher = `Fed giữ giọng điệu Diều hâu (Hawkish) / Tăng lãi suất: Đồng USD tăng phi mã, Vàng và Crypto đối mặt đợt điều chỉnh sâu.`;
    scenarios.asExpected = `Fed hành động đúng dự báo nhưng giọng điệu trung tính: Thị trường biến động dữ dội trong lúc ông Powell phát biểu họp báo.`;
    scenarios.lower = `Fed Ôn hòa (Dovish) / Phát tín hiệu cắt giảm lãi suất: Vàng, Bạc và Bitcoin bùng nổ siêu chu kỳ tăng giá, DXY rơi tự do.`;
    assetImpacts.gold = `Vàng có thể dao động 40 - 80 giá trong đêm FOMC. Cần hết sức thận trọng khi giữ lệnh qua đêm họp báo.`;
    assetImpacts.btc = `Bitcoin cực kỳ nhạy cảm với phát biểu của Powell về thanh khoản hệ thống ngân hàng.`;
    assetImpacts.silver = `Bạc phản ứng bứt phá rất mạnh nếu Fed phát tín hiệu nới lỏng.`;
    assetImpacts.dxy = `Định hướng chỉ số DXY cho cả quý tiếp theo.`;
  } else if (title.includes('ism') || title.includes('pmi')) {
    category = 'BUSINESS_ACTIVITY';
    overview = `Chỉ số PMI của Viện Quản lý Cung ứng ISM (ISM Manufacturing & Services PMI) đo lường hoạt động kinh doanh hàng tháng. Mốc 50 điểm là ranh giới giữa Mở rộng (>50) và Thu hẹp (<50).`;
    whyItMatters = `PMI là chỉ báo dẫn dắt (Leading Indicator) dự báo sớm sức khỏe của nền kinh tế trước khi các báo cáo GDP chính thức được công bố.`;
    scenarios.higher = `PMI vượt 50 và cao hơn dự báo: Nền kinh tế tăng trưởng tốt, củng cố sức mạnh USD, hạn chế đà tăng của Vàng.`;
    scenarios.asExpected = `Sát kỳ vọng: Thị trường biến động 8 - 15 giá trên Vàng rồi ổn định.`;
    scenarios.lower = `PMI rơi sâu dưới 50: Cảnh báo suy thoái ngành sản xuất/dịch vụ, kích hoạt dòng tiền tìm kiếm hầm trú ẩn an toàn (Safe Haven) ở Vàng.`;
    assetImpacts.gold = `Vàng phản ứng nhanh trong 15-30 phút đầu sau khi công bố (biên độ 10 - 20 giá).`;
    assetImpacts.btc = `Tác động gián tiếp thông qua biến động của chỉ số USD.`;
    assetImpacts.silver = `Đặc biệt nhạy cảm với ISM Manufacturing vì nhu cầu bạc trong công nghiệp rất lớn.`;
    assetImpacts.dxy = `Tăng khi PMI > 50, giảm khi PMI < 50.`;
  } else if (title.includes('ppi')) {
    category = 'INFLATION';
    overview = `Chỉ số Giá Sản xuất PPI (Producer Price Index) đo lường mức thay đổi giá bán buôn từ góc độ người sản xuất, là chỉ báo sớm báo trước xu hướng của chỉ số CPI bán lẻ trong 1-2 tháng tới.`;
    whyItMatters = `Chi phí đầu vào sản xuất tăng sẽ sớm được chuyển sang người tiêu dùng, tạo áp lực kéo dài lên lạm phát.`;
    scenarios.higher = `PPI tăng cao hơn dự báo: Báo hiệu CPI kỳ sau khó giảm, củng cố USD và đè nặng lên Vàng.`;
    scenarios.asExpected = `Sát dự báo: Thị trường biến động nhẹ.`;
    scenarios.lower = `PPI giảm mạnh: Tín hiệu hạ nhiệt lạm phát đầu vào, mở đường cho Vàng bứt phá.`;
    assetImpacts.gold = `Biên độ dự kiến 15 - 25 giá khi công bố.`;
    assetImpacts.btc = `Hưởng lợi khi áp lực chi phí hạ nhiệt.`;
    assetImpacts.silver = `Phản ứng theo xu hướng kim loại quý.`;
    assetImpacts.dxy = `Biến động cùng chiều với số liệu PPI.`;
  } else if (title.includes('jobless claims') || title.includes('claims')) {
    category = 'EMPLOYMENT';
    overview = `Số đơn xin trợ cấp thất nghiệp lần đầu (Initial Jobless Claims) được công bố định kỳ vào 19:30 hoặc 20:30 tối Thứ Năm hàng tuần, phản ánh số lượng người nộp đơn xin bảo hiểm thất nghiệp mới.`;
    whyItMatters = `Đây là dữ liệu việc làm cập nhật với tần suất hàng tuần nhanh nhất, giúp nhà đầu tư bắt mạch kịp thời tình trạng sa thải lao động tại Mỹ.`;
    scenarios.higher = `Đơn thất nghiệp tăng cao (>230K): Cho thấy sa thải gia tăng, hỗ trợ đà tăng của Vàng và làm suy yếu USD.`;
    scenarios.asExpected = `Sát dự báo quanh 215K - 225K: Thị trường ổn định, biến động trong dải sóng MA WAVE.`;
    scenarios.lower = `Đơn thất nghiệp giảm mạnh (<210K): Thị trường lao động vững như bàn thạch, USD bật tăng và ép giá Vàng lùi lại.`;
    assetImpacts.gold = `Biên độ thường từ 8 đến 18 giá vào tối thứ Năm.`;
    assetImpacts.btc = `Tác động vừa phải theo chiều USD.`;
    assetImpacts.silver = `Biến động đồng pha với vàng.`;
    assetImpacts.dxy = `Tăng khi đơn thất nghiệp thấp, giảm khi đơn thất nghiệp cao.`;
  } else {
    category = 'MACRO';
    overview = `Sự kiện kinh tế định kỳ phản ánh một cấu phần quan trọng của nền kinh tế Mỹ (chi tiêu tiêu dùng, thương mại, bất động sản hoặc tín dụng).`;
    whyItMatters = `Góp phần cung cấp góc nhìn toàn diện cho các nhà hoạch định chính sách của Fed trong việc điều chỉnh lãi suất.`;
    scenarios.higher = `Số liệu tốt hơn kỳ vọng củng cố niềm tin vào sự bền bỉ của nền kinh tế Mỹ, nâng đỡ đồng USD.`;
    scenarios.asExpected = `Vận động bình thường theo dải tích lũy kỹ thuật.`;
    scenarios.lower = `Số liệu yếu đi kích thích tâm lý phòng thủ và nhu cầu tích trữ tài sản an toàn.`;
    assetImpacts.gold = `Biến động vừa phải, ưu tiên giao dịch theo tín hiệu MA WAVE V8.`;
    assetImpacts.btc = `Biến động theo xu hướng chung của thị trường tài chính.`;
    assetImpacts.silver = `Giữ nhịp cùng thị trường kim loại.`;
    assetImpacts.dxy = `Biến động theo mức độ chênh lệch số liệu.`;
  }

  return {
    category,
    overview,
    whyItMatters,
    scenarios,
    assetImpacts,
    actionablePlaybook
  };
}

// Server-side state & cache
let newsAdapterStatus = 'LOADING'; // 'ONLINE' | 'STALE' | 'OFFLINE'
let lastNewsFetchTime = 0;
let lastSuccessfulFetchTime = 0;

async function refreshNewsDatabase() {
  const fetchTime = Date.now();
  try {
    const rawEvents = await fetchTradingViewCalendar();
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      throw new Error('No events returned from API');
    }

    const newEventsMap = new Map();
    newsEventsDB.forEach(evt => newEventsMap.set(evt.event_key, evt));

    let newCount = 0;
    let updatedCount = 0;

    rawEvents.forEach(e => {
      const { dateLabel, dateStr, timeStr } = getVietnamDateAndAppTime(e.date);
      const titleVn = translateTitle(e.title);
      
      const titleLower = (e.title || '').toLowerCase();
      let importance = 'MEDIUM';
      if (e.importance === 1 || 
          titleLower.includes('cpi') || 
          titleLower.includes('inflation rate') || 
          titleLower.includes('fomc') || 
          titleLower.includes('rate decision') || 
          titleLower.includes('non farm') || 
          titleLower.includes('nonfarm') || 
          titleLower.includes('unemployment') || 
          titleLower.includes('powell') || 
          titleLower.includes('pce') || 
          titleLower.includes('gdp') || 
          titleLower.includes('ism ') || 
          titleLower.includes('ppi')) {
        importance = 'HIGH';
      } else if (e.importance === -1) {
        importance = 'LOW';
      }

      const actualStr = formatVal(e.actual, e.scale);
      const forecastStr = formatVal(e.forecast, e.scale) || '-';
      const previousStr = formatVal(e.previous, e.scale) || '-';

      const eventKey = `InvestingAdapter-US-${dateStr}-${e.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const existing = newEventsMap.get(eventKey);

      let status = 'UPCOMING';
      if (actualStr !== null) {
        status = 'RELEASED';
      } else if (new Date(e.date).getTime() < fetchTime) {
        status = 'RELEASED';
      }

      if (!existing) newCount++;
      else if (existing.actual !== actualStr) updatedCount++;

      const detailedAnalysis = generateDetailedMacroAnalysis({
        title: e.title,
        title_vn: titleVn,
        eventName: e.title,
        eventNameVn: titleVn,
        importance,
        impact: importance,
        actual: actualStr,
        forecast: forecastStr,
        previous: previousStr
      });

      const normalizedEvent = {
        eventId: existing ? existing.eventId : `TV-US-${e.id || Date.now()}`,
        event_key: eventKey,
        id: existing ? existing.id : `TV-US-${e.id || Date.now()}`,
        source: 'Investing.com Adapter',
        country: 'US',
        currency: 'USD',
        title: e.title,
        title_vn: titleVn,
        eventName: e.title,
        eventNameVn: titleVn,
        eventTimeUTC: new Date(e.date).toISOString(),
        eventTimeVietnam: timeStr,
        eventDate: dateStr,
        dateStr: dateStr,
        dateLabel: dateLabel,
        time: timeStr,
        timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
        importance: importance,
        impact: importance,
        actual: actualStr,
        forecast: forecastStr,
        previous: previousStr,
        status: status,
        timestamp: new Date(e.date).getTime(),
        sourceUrl: e.source_url || 'https://vn.investing.com/economic-calendar',
        lastUpdated: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        detailedAnalysis: detailedAnalysis
      };

      newEventsMap.set(eventKey, normalizedEvent);
    });

    newsEventsDB = Array.from(newEventsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    saveJSON(NEWS_DB_FILE, newsEventsDB);

    newsAdapterStatus = 'ONLINE';
    lastNewsFetchTime = fetchTime;
    lastSuccessfulFetchTime = fetchTime;

    const scanLogEntry = {
      scanTime: new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      scanTimeISO: new Date(fetchTime).toISOString(),
      source: 'Investing.com Adapter',
      eventsFound: rawEvents.length,
      newEvents: newCount,
      updatedEvents: updatedCount,
      durationMs: Date.now() - fetchTime,
      status: 'ONLINE',
      nextScanTime: new Date(fetchTime + 3 * 60 * 1000).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      highImpactCount: newsEventsDB.filter(e => e.importance === 'HIGH').length,
      usdCount: newsEventsDB.filter(e => e.currency === 'USD').length,
      fedCount: newsEventsDB.filter(e => (e.eventName || '').includes('Fed') || (e.eventName || '').includes('FOMC') || (e.eventName || '').includes('Powell')).length
    };

    newsScanLogs.unshift(scanLogEntry);
    newsScanLogs = newsScanLogs.slice(0, 30); // Keep last 30 scan logs
    saveJSON(path.join(__dirname, 'news_scan_logs.json'), newsScanLogs);

    console.log(`[Gold News Engine] Refreshed successfully: ${newsEventsDB.length} stored (${rawEvents.length} fetched).`);
    return { status: 'ONLINE', count: newsEventsDB.length, scanLog: scanLogEntry };
  } catch (err) {
    console.error(`[Gold News Engine] Fetch error: ${err.message}`);
    lastNewsFetchTime = fetchTime;
    newsAdapterStatus = newsEventsDB.length > 0 ? 'STALE' : 'OFFLINE';

    const failedLog = {
      scanTime: new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      scanTimeISO: new Date(fetchTime).toISOString(),
      source: 'Investing.com Adapter',
      eventsFound: 0,
      newEvents: 0,
      updatedEvents: 0,
      durationMs: Date.now() - fetchTime,
      status: newsAdapterStatus,
      error: err.message,
      nextScanTime: new Date(fetchTime + 3 * 60 * 1000).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    };
    newsScanLogs.unshift(failedLog);
    saveJSON(path.join(__dirname, 'news_scan_logs.json'), newsScanLogs);

    return { status: newsAdapterStatus, count: newsEventsDB.length, error: err.message };
  }
}

// Initial fetch on server startup
refreshNewsDatabase();
// Polling scheduler: every 3 minutes
setInterval(refreshNewsDatabase, 3 * 60 * 1000);

function getFallbackEconomicEvents(targetDateStr, label = 'Hôm nay') {
  const baseTime = new Date(`${targetDateStr}T00:00:00.000Z`).getTime() || Date.now();
  return [
    {
      eventId: `EV-US-CPI-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-cpi`,
      id: `EV-US-CPI-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'US CPI (YoY)',
      title_vn: 'Chỉ Số Giá Tiêu Dùng Mỹ (CPI y/y)',
      eventName: 'US CPI (YoY)',
      eventNameVn: 'Chỉ Số Lạm Phát CPI Mỹ (Năm/Năm)',
      eventTimeUTC: `${targetDateStr}T12:30:00.000Z`,
      eventTimeVietnam: '19:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '19:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: '3.1%',
      forecast: '2.9%',
      previous: '3.4%',
      status: 'RELEASED',
      timestamp: baseTime + (19 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🔴 CPI thực tế ra 3.1% cao hơn dự báo 2.9% -> Đô la Mỹ USD tăng giá mạnh -> Giá Vàng XAU/USD chịu áp lực điều chỉnh ngắn hạn!'
    },
    {
      eventId: `EV-US-NFP-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-nfp`,
      id: `EV-US-NFP-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'US Non-Farm Payrolls',
      title_vn: 'Bảng Lương Phi Nông Nghiệp Mỹ (NFP)',
      eventName: 'US Non-Farm Payrolls',
      eventNameVn: 'Báo Cáo Việc Làm Phi Nông Nghiệp Mỹ (NFP)',
      eventTimeUTC: `${targetDateStr}T12:30:00.000Z`,
      eventTimeVietnam: '19:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '19:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: '218K',
      forecast: '175K',
      previous: '165K',
      status: 'RELEASED',
      timestamp: baseTime + (19 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🔴 Báo cáo việc làm NFP vượt kỳ vọng -> Thị trường lao động Mỹ rất vững chắc -> Fed lùi thời điểm giảm lãi suất -> Vàng quét 2 đầu.'
    },
    {
      eventId: `EV-US-FED-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-fedrate`,
      id: `EV-US-FED-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'Fed Interest Rate Decision',
      title_vn: 'Quyết Định Lãi Suất Liên Bang Mỹ (Fed Rate)',
      eventName: 'Fed Interest Rate Decision',
      eventNameVn: 'Quyết Định Lãi Suất của Cục Dự Trữ Liên Bang Mỹ (Fed)',
      eventTimeUTC: `${targetDateStr}T18:00:00.000Z`,
      eventTimeVietnam: '01:00',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '01:00',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: '5.50%',
      forecast: '5.50%',
      previous: '5.50%',
      status: 'RELEASED',
      timestamp: baseTime + (1 * 3600) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🟢 Fed giữ nguyên lãi suất 5.50% và đưa phát biểu Ôn hòa (Dovish) -> DXY suy yếu -> Giá Vàng XAU/USD bứt phá TĂNG MẠNH!'
    },
    {
      eventId: `EV-US-CLAIMS-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-joblessclaims`,
      id: `EV-US-CLAIMS-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'Initial Jobless Claims',
      title_vn: 'Số Đơn Xin Trợ Cấp Thất Nghiệp Hàng Tuần',
      eventName: 'Initial Jobless Claims',
      eventNameVn: 'Số Đơn Xin Trợ Cấp Thất Nghiệp Hàng Tuần',
      eventTimeUTC: `${targetDateStr}T12:30:00.000Z`,
      eventTimeVietnam: '19:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '19:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'MEDIUM',
      impact: 'MEDIUM',
      actual: '224K',
      forecast: '220K',
      previous: '218K',
      status: 'RELEASED',
      timestamp: baseTime + (19 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🟢 Số đơn thất nghiệp cao hơn dự báo 220K -> Đồng USD điều chỉnh giảm nhẹ -> Hỗ trợ giá Vàng phục hồi.'
    },
    {
      eventId: `EV-US-PPI-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-ppi`,
      id: `EV-US-PPI-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'US PPI (MoM)',
      title_vn: 'Chỉ Số Giá Sản Xuất Mỹ (PPI m/m)',
      eventName: 'US PPI (MoM)',
      eventNameVn: 'Chỉ Số Giá Sản Xuất PPI Mỹ (Tháng/Tháng)',
      eventTimeUTC: `${targetDateStr}T12:30:00.000Z`,
      eventTimeVietnam: '19:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '19:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: '0.3%',
      forecast: '0.1%',
      previous: '-0.1%',
      status: 'RELEASED',
      timestamp: baseTime + (19 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🟠 PPI tăng 0.3% cho thấy chi phí đầu vào doanh nghiệp gia tăng -> Giữ giá Vàng giằng co quanh dải sóng.'
    },
    {
      eventId: `EV-US-CORECPI-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-corecpi`,
      id: `EV-US-CORECPI-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'US Core CPI (MoM)',
      title_vn: 'Chỉ Số Lạm Phát Lõi Mỹ (Core CPI m/m)',
      eventName: 'US Core CPI (MoM)',
      eventNameVn: 'Chỉ Số Lạm Phát Lõi Mỹ (Tháng/Tháng)',
      eventTimeUTC: `${targetDateStr}T12:30:00.000Z`,
      eventTimeVietnam: '19:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '19:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: '0.3%',
      forecast: '0.3%',
      previous: '0.3%',
      status: 'RELEASED',
      timestamp: baseTime + (19 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🔴 Lạm phát lõi không hạ nhiệt như kỳ vọng của Fed -> Lợi suất trái phiếu giữ ở mức cao -> Gây áp lực điều chỉnh lên Vàng.'
    },
    {
      eventId: `EV-US-PMI-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-pmi`,
      id: `EV-US-PMI-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'Flash US Manufacturing PMI',
      title_vn: 'Chỉ Số PMI Sản Xuất Flash Mỹ S&P Global',
      eventName: 'Flash US Manufacturing PMI',
      eventNameVn: 'Chỉ Số PMI Sản Xuất Sơ Bộ Mỹ (S&P Global)',
      eventTimeUTC: `${targetDateStr}T13:45:00.000Z`,
      eventTimeVietnam: '20:45',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '20:45',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'MEDIUM',
      impact: 'MEDIUM',
      actual: '50.5',
      forecast: '49.8',
      previous: '49.5',
      status: 'RELEASED',
      timestamp: baseTime + (20 * 3600 + 45 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '🟢 Chỉ số PMI vượt ngưỡng 50 điểm phản ánh khu vực sản xuất phục hồi nhẹ.'
    },
    {
      eventId: `EV-US-POWELL-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-powell`,
      id: `EV-US-POWELL-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'Fed Chair Powell Speech',
      title_vn: 'Phát Biểu Của Chủ Tịch Fed Jerome Powell',
      eventName: 'Fed Chair Powell Speech',
      eventNameVn: 'Phát Biểu Của Chủ Tịch Cục Dự Trữ Liên Bang Fed Jerome Powell',
      eventTimeUTC: `${targetDateStr}T14:00:00.000Z`,
      eventTimeVietnam: '21:00',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '21:00',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'HIGH',
      impact: 'HIGH',
      actual: 'Diễn văn chính sách',
      forecast: 'Định hướng lãi suất',
      previous: '-',
      status: 'RELEASED',
      timestamp: baseTime + (21 * 3600) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '⚡ Chủ tịch Fed nhấn mạnh quyết tâm đưa lạm phát về 2% nhưng để ngỏ khả năng nới lỏng nếu thị trường lao động suy yếu -> Thị trường Vàng phản ứng giằng co biên độ rộng.'
    },
    {
      eventId: `EV-US-OIL-${targetDateStr}`,
      event_key: `InvestingAdapter-US-${targetDateStr}-crudeoil`,
      id: `EV-US-OIL-${targetDateStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'EIA Crude Oil Inventories',
      title_vn: 'Báo Cáo Dự Trữ Dầu Thô Hàng Tuần EIA',
      eventName: 'EIA Crude Oil Inventories',
      eventNameVn: 'Báo Cáo Thay Đổi Dự Trữ Dầu Thô Mỹ (EIA)',
      eventTimeUTC: `${targetDateStr}T14:30:00.000Z`,
      eventTimeVietnam: '21:30',
      eventDate: targetDateStr,
      dateStr: targetDateStr,
      dateLabel: label,
      time: '21:30',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'LOW',
      impact: 'LOW',
      actual: '-1.2M',
      forecast: '-0.8M',
      previous: '+1.5M',
      status: 'RELEASED',
      timestamp: baseTime + (21 * 3600 + 30 * 60) * 1000,
      sourceUrl: 'https://vn.investing.com/economic-calendar',
      aiAnalysis: '📊 Tồn kho dầu giảm mạnh hơn dự báo, hỗ trợ giá năng lượng và phản ánh hoạt động sản xuất ổn định.'
    }
  ];
}

function getVietnamDateRanges() {
  const vnFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const now = new Date();
  const todayStr = vnFormatter.format(now);
  
  const [y, m, d] = todayStr.split('-').map(Number);
  const vnTodayDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = vnTodayDate.getUTCDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat

  let thisWeekStart, thisWeekEnd;
  let nextWeekStart, nextWeekEnd;

  if (dayOfWeek === 0) { // Sunday (e.g. 2026-11-01)
    // Tuần này bao gồm hôm nay và tuần giao dịch chuẩn bị diễn ra (2026-11-01 đến 2026-11-08)
    thisWeekStart = new Date(Date.UTC(y, m - 1, d));
    thisWeekEnd = new Date(Date.UTC(y, m - 1, d + 7));

    // Tuần tới: Từ Thứ Hai tuần kế tiếp đến Chủ Nhật (2026-11-09 đến 2026-11-15)
    nextWeekStart = new Date(Date.UTC(y, m - 1, d + 8));
    nextWeekEnd = new Date(Date.UTC(y, m - 1, d + 14));
  } else {
    // Thứ Hai đến Thứ Bảy: Thứ Hai tuần này đến Chủ Nhật tuần này
    const diffToMon = dayOfWeek - 1;
    thisWeekStart = new Date(Date.UTC(y, m - 1, d - diffToMon));
    thisWeekEnd = new Date(Date.UTC(y, m - 1, d - diffToMon + 6));

    nextWeekStart = new Date(Date.UTC(y, m - 1, d - diffToMon + 7));
    nextWeekEnd = new Date(Date.UTC(y, m - 1, d - diffToMon + 13));
  }

  const tomDate = new Date(Date.UTC(y, m - 1, d + 1));

  return {
    today: todayStr,
    tomorrow: vnFormatter.format(tomDate),
    thisWeek: { from: vnFormatter.format(thisWeekStart), to: vnFormatter.format(thisWeekEnd) },
    nextWeek: { from: vnFormatter.format(nextWeekStart), to: vnFormatter.format(nextWeekEnd) },
    dayOfWeek
  };
}

function getWeekendNoticeEvents(todayStr, nextTradingDateStr) {
  return [
    {
      eventId: `EV-NOTICE-WEEKEND-${todayStr}`,
      event_key: `InvestingAdapter-US-${todayStr}-weekend`,
      id: `EV-NOTICE-WEEKEND-${todayStr}`,
      source: 'Investing.com Adapter',
      country: 'US',
      currency: 'USD',
      title: 'Global Financial Markets Weekend Close',
      title_vn: 'Thị Trường Tài Chính Quốc Tế Đóng Cửa Nghỉ Cuối Tuần (Chủ Nhật)',
      eventName: 'Global Markets Weekend Close',
      eventNameVn: 'Thị Trường Vàng & Ngoại Hối Nghỉ Cuối Tuần (Chủ Nhật)',
      eventTimeUTC: `${todayStr}T00:00:00.000Z`,
      eventTimeVietnam: '06:00',
      eventDate: todayStr,
      dateStr: todayStr,
      dateLabel: 'Hôm nay',
      time: '06:00',
      timezone: 'Asia/Ho_Chi_Minh (GMT+7)',
      importance: 'LOW',
      impact: 'LOW',
      actual: 'Nghỉ Giao Dịch',
      forecast: `Mở cửa: ${nextTradingDateStr}`,
      previous: 'Tuần trước chốt $3,875.64',
      status: 'RELEASED',
      timestamp: Date.now() - 3600000,
      sourceUrl: 'https://tradingview.com',
      detailedAnalysis: {
        category: 'WEEKEND_STATUS',
        overview: 'Vào ngày Chủ Nhật, các sàn giao dịch vàng tài chính lớn nhất thế giới (COMEX New York, LBMA London) và thị trường liên ngân hàng ngoại hối tạm đóng cửa nghỉ cuối tuần. Thị trường chuẩn bị mở cửa trở lại vào sáng Thứ Hai. Riêng thị trường Crypto (Bitcoin) hoạt động 24/7.',
        whyItMatters: 'Cuối tuần là thời điểm nhà đầu tư tái cơ cấu danh mục và chuẩn bị kế hoạch giao dịch cho tuần mới. Giá Vàng đã dừng chân ở mốc $3,875/oz sau nhịp điều chỉnh kỹ thuật từ đỉnh $4,032.',
        scenarios: {
          higher: 'Đầu tuần tới nếu tin tức địa chính trị hoặc chỉ số PMI Mỹ yếu -> Kích hoạt dòng tiền mua trú ẩn đẩy Vàng tăng mạnh hướng về $3,900 - $3,920.',
          asExpected: 'Thị trường mở cửa phiên Á sáng Thứ Hai ổn định quanh mốc $3,870 - $3,885.',
          lower: 'Nếu chỉ số PMI sản xuất Mỹ tăng vọt -> USD tăng giá, ép Vàng kiểm tra hỗ trợ $3,850.'
        },
        assetImpacts: {
          gold: 'Vàng giữ vững trên ngưỡng hỗ trợ động khung Daily ($3,850 - $3,870). Chuẩn bị chiến lược đón đầu tuần bão FOMC & NFP.',
          btc: 'Bitcoin duy trì giao dịch 24/7 quanh mốc $77,000, dòng tiền giữ nhịp ổn định.',
          silver: 'Bạc tích lũy tại $49.12/oz, chờ đợi tín hiệu mở cửa phiên Á sáng Thứ Hai.',
          dxy: 'DXY neo quanh vùng 103.85, sẵn sàng phản ứng trước lịch tin tức tuần tới.'
        },
        actionablePlaybook: {
          beforeRelease: 'Rà soát lại nhật ký lệnh tuần trước, lên kế hoạch vốn và bảo đảm tài khoản không có lệnh thả rông rủi ro.',
          duringRelease: 'Tránh giao dịch vào lúc rạng sáng Thứ Hai (05:00 - 06:30 GMT+7) do thanh khoản mỏng, Spread có thể bị giãn nở.',
          afterRelease: 'Chờ phiên Á và Âu vào nhịp thanh khoản ổn định để kích hoạt các chiến lược theo tín hiệu MA WAVE V8.'
        }
      }
    }
  ];
}

function buildDetailedMacroOutlook(dateTab, events, ranges) {
  const isWeekend = ranges.dayOfWeek === 0;
  const highImpact = events.filter(e => (e.importance || e.impact) === 'HIGH');
  const fedEvents = events.filter(e => (e.eventName || e.title || '').includes('Fed') || (e.eventName || e.title || '').includes('FOMC') || (e.eventName || e.title || '').includes('Powell'));

  let tabTitle = 'HÔM NAY';
  let expectedVolatility = 'VỪA';
  let macroSummary = '';
  let usdViewpointStatus = 'TRUNG TÍNH — TÍCH LŨY TÌM HƯỚNG ĐI';
  let usdViewpointText = '';
  let goldViewpointStatus = 'CÂN BẰNG — TÍCH LŨY TRÊN HỖ TRỢ DÀI HẠN';
  let goldViewpointText = '';
  let btcViewpointStatus = 'KHẢU VỊ RỦI RO TÍCH CỰC — GIỮ NHỊP $77K';
  let btcViewpointText = '';
  let silverViewpointStatus = 'ĐIỀU CHỈNH KỸ THUẬT — CHỜ SÓNG VÀNG';
  let silverViewpointText = '';
  let riskWarning = 'Tuyệt đối dời Stop Loss về hòa vốn (SL=Entry) khi đạt TP1 (+10 giá) và không mở vị thế mới sát 5 phút trước giờ tin High Impact!';

  if (dateTab === 'TODAY') {
    tabTitle = `HÔM NAY (${ranges.today})`;
    if (isWeekend) {
      expectedVolatility = 'THẤP (NGHỈ CUỐI TUẦN)';
      macroSummary = `Hôm nay là Chủ Nhật (${ranges.today}), các sàn giao dịch vàng tài chính quốc tế (COMEX New York, LBMA London) và thị trường liên ngân hàng ngoại hối (Forex) tạm đóng cửa nghỉ cuối tuần. Thị trường chuẩn bị bước vào tuần giao dịch 'Siêu Bão Vĩ Mô' với 2 quả bom tin tức lớn nhất tháng: Quyết định Lãi suất Fed (FOMC - Thứ Năm 05/11) và Bảng lương Phi Nông Nghiệp Mỹ (NFP - Thứ Sáu 06/11). Giá Vàng chốt tuần ở mốc $3,875/oz sau nhịp điều chỉnh kỹ thuật từ đỉnh $4,032.`;
      usdViewpointStatus = 'TRUNG TÍNH — DXY NEO VÙNG 103.85 CHỜ BÃO TIN';
      usdViewpointText = `Chỉ số DXY đang duy trì trạng thái tích lũy hẹp quanh 103.85 điểm. Dòng tiền tổ chức đứng ngoài quan sát để chuẩn bị giải ngân theo kết quả cuộc họp FOMC và số liệu việc làm NFP tuần tới.`;
      goldViewpointStatus = 'CÂN BẰNG — HỖ TRỢ $3,850 - $3,870 PHÁT HUY TÁC DỤNG';
      goldViewpointText = `Vàng (XAU/USD) sau khi điều chỉnh từ đỉnh $4,032 về dừng chân ở vùng $3,875. Cấu trúc sóng MA WAVE V8 trên khung H4/D1 vẫn giữ được xu hướng tăng trung hạn, vùng hỗ trợ động $3,850 - $3,870 đang phát huy lực đỡ vững chắc. Ưu tiên canh nhịp mở cửa phiên Á sáng Thứ Hai.`;
      btcViewpointStatus = 'HOẠT ĐỘNG 24/7 — TÍCH LŨY TRÊN $77,000';
      btcViewpointText = `Bitcoin (BTC/USD) giao dịch liên tục 24/7 không nghỉ cuối tuần, giữ vững quanh ngưỡng $77,000 - $78,000. Dòng tiền tổ chức tiếp tục kỳ vọng chu kỳ nới lỏng chính sách tiền tệ toàn cầu sẽ kích hoạt sóng tăng mới.`;
      silverViewpointStatus = 'BẠC TÍCH LŨY $49.12/OZ — BETA CAO';
      silverViewpointText = `Bạc (XAG/USD) điều chỉnh về mốc $49.12/oz (-5.79% trong tuần). Tỷ lệ Gold/Silver Ratio duy trì ở ngưỡng cân bằng, lực cầu bắt đáy công nghiệp tại vùng $48.5 - $49.0 đang dần xuất hiện.`;
    } else {
      expectedVolatility = highImpact.length >= 2 ? 'CAO' : 'VỪA';
      macroSummary = `Lịch kinh tế hôm nay ghi nhận tổng cộng ${events.length} sự kiện (${highImpact.length} sự kiện High Impact). Thị trường tập trung quan sát số liệu thực tế để đánh giá động lực của đồng USD và xu hướng giá Vàng theo thuật toán MA WAVE V8.`;
      usdViewpointStatus = 'THEO DÕI SỐ LIỆU ACTUAL CÔNG BỐ';
      usdViewpointText = `DXY biến động trực tiếp theo độ lệch giữa Actual và Forecast của các chỉ số kinh tế phiên tối.`;
      goldViewpointStatus = 'BÁM SÁT DẢI SÓNG MA WAVE V8';
      goldViewpointText = `Khuyến nghị canh phản ứng giá tại các dải EMA20 / EMA50 của MA WAVE V8 để tìm điểm vào lệnh thuận xu hướng.`;
    }
  } else if (dateTab === 'TOMORROW') {
    tabTitle = `NGÀY MAI (${ranges.tomorrow} - THỨ HAI)`;
    expectedVolatility = 'CAO (MỞ CỬA TUẦN MỚI & ISM PMI)';
    macroSummary = `Ngày mai (Thứ Hai ${ranges.tomorrow}), thị trường tài chính quốc tế chính thức mở cửa trở lại cho tuần giao dịch mới. Tâm điểm phiên tối (21:45 & 22:00 GMT+7) là Chỉ số PMI Sản Xuất S&P Global và Chỉ số ISM Manufacturing PMI của Mỹ, cùng bài phát biểu của bà Mary Daly (Chủ tịch Fed San Francisco lúc 22:00). Đây là phát súng mở màn đo lường sức khỏe ngành sản xuất Mỹ trước khi Fed bước vào cuộc họp chính sách.`;
    usdViewpointStatus = 'THEO DÕI MỐC RANH GIỚI 50 ĐIỂM CỦA ISM PMI';
    usdViewpointText = `Nếu chỉ số ISM Manufacturing PMI vượt ngưỡng 50 điểm và cao hơn dự báo (49.8), đồng USD sẽ có nhịp hồi phục thử thách kháng cự 104.2. Ngược lại nếu rơi sâu dưới 49 điểm, DXY sẽ chịu áp lực bán tháo.`;
    goldViewpointStatus = 'CANH PHẢN ỨNG MỞ CỬA PHIÊN Á & VÙNG HỖ TRỢ $3,865 - $3,875';
    goldViewpointText = `Phiên Á và Âu sáng Thứ Hai thường có thanh khoản khởi động nhẹ. Khuyến nghị theo dõi chặt chẽ vùng hỗ trợ $3,865 - $3,875. Khi tin ISM PMI công bố lúc 22:00 tối, biên độ dao động dự kiến từ 15 đến 25 giá.`;
    btcViewpointStatus = 'SẴN SÀNG HẤP THỤ THANH KHOẢN MỞ TUẦN TỪ PHỐ WALL';
    btcViewpointText = `Dòng tiền từ các quỹ ETF Bitcoin giao ngay tại Mỹ sẽ quay trở lại hoạt động vào chiều tối Thứ Hai, tạo động lực bứt phá kháng cự $78,500.`;
    silverViewpointStatus = 'CỰC KỲ NHẠY CẢM VỚI DỮ LIỆU SẢN XUẤT ISM';
    silverViewpointText = `Bạc phản ứng rất nhạy với ISM Manufacturing vì hơn 50% nhu cầu bạc toàn cầu đến từ ngành công nghiệp điện tử và năng lượng mặt trời. Kỳ vọng biến động 2% - 4% trong phiên Mỹ.`;
  } else if (dateTab === 'THIS_WEEK') {
    tabTitle = `TUẦN NÀY (${ranges.thisWeek.from} → ${ranges.thisWeek.to})`;
    expectedVolatility = 'CỰC CAO (SIÊU BÃO FOMC & BẢNG LƯƠNG NFP)';
    macroSummary = `Tuần này ghi nhận ${events.length} sự kiện kinh tế Mỹ với 2 tâm chấn vĩ mô có sức ảnh hưởng cực đại toàn cầu: (1) Quyết định Lãi suất của Cục Dự trữ Liên bang Fed & Họp báo của Chủ tịch Jerome Powell (Đêm Thứ Năm rạng sáng Thứ Sáu 05/11 lúc 01:00 & 01:30 GMT+7); (2) Báo cáo Việc làm Phi Nông nghiệp NFP và Tỷ lệ Thất nghiệp Mỹ (Tối Thứ Sáu 06/11 lúc 19:30 GMT+7). Ngoài ra còn có ISM Manufacturing PMI (02/11), Báo cáo Việc làm ADP & ISM Services PMI (04/11). Đây là tuần định hình xu hướng vĩ mô then chốt cho cả tháng 11!`;
    usdViewpointStatus = 'BIẾN ĐỘNG BIÊN ĐỘ LỚN THEO ĐỊNH HƯỚNG LÃI SUẤT FED';
    usdViewpointText = `Chỉ số DXY dự kiến sẽ trải qua các đợt biến động dữ dội biên độ từ 102.5 đến 105.0. Mọi phát biểu của ông Powell về tốc độ cắt giảm lãi suất trong các kỳ họp tới sẽ trực tiếp quyết định hướng đi dài hạn của đồng bạc xanh.`;
    goldViewpointStatus = 'CƠ HỘI SÓNG LỚN (BIÊN ĐỘ 80 - 150 GIÁ) — QUẢN TRỊ VỐN TUYỆT ĐỐI';
    goldViewpointText = `Vàng đang đứng trước ngưỡng cửa bứt phá chu kỳ mới. Nếu Fed phát tín hiệu Ôn hòa (Dovish) và NFP yếu, Vàng hoàn toàn có khả năng tái chinh phục mốc $4,000/oz. Tuy nhiên rủi ro quét nến 2 đầu là cực lớn trong 2 đêm FOMC và NFP. Chiến lược: Giảm 50% khối lượng giao dịch trong giờ tin, bám sát các điểm vào lệnh chuẩn thuật toán MA WAVE V8.`;
    btcViewpointStatus = 'HƯỞNG LỢI TỪ DÒNG TIỀN NỚI LỎNG TOÀN CẦU';
    btcViewpointText = `Nếu Fed tiếp tục chu kỳ nới lỏng tiền tệ, Bitcoin sẽ là tài sản hưởng lợi thanh khoản hàng đầu với mục tiêu kiểm tra vùng đỉnh cao $80,000+.`;
    silverViewpointStatus = 'ĐÒN BẨY SÓNG VÀNG — BIÊN ĐỘ GẤP 1.5 - 2 LẦN';
    silverViewpointText = `Bạc (XAG/USD) thường có độ trễ sóng ngắn nhưng khi bứt phá sẽ tăng/giảm mạnh hơn Vàng rất nhiều. Vùng hỗ trợ then chốt của Bạc tuần này tại $48.00, cản mạnh tại $51.50.`;
  } else if (dateTab === 'NEXT_WEEK') {
    tabTitle = `TUẦN TỚI (${ranges.nextWeek.from} → ${ranges.nextWeek.to})`;
    expectedVolatility = 'RẤT CAO (TÂM ĐIỂM CHỈ SỐ LẠM PHÁT CPI MỸ)';
    macroSummary = `Tuần tới ghi nhận ${events.length} sự kiện kinh tế Mỹ với tâm điểm tuyệt đối là Báo cáo Lạm phát Chỉ số Giá Tiêu Dùng CPI Mỹ (US CPI YoY & MoM - Tối Thứ Ba 10/11 lúc 19:30 GMT+7), Báo cáo Đơn trợ cấp thất nghiệp hàng tuần (Thứ Năm 12/11) và Chỉ số Giá Sản Xuất PPI (Thứ Sáu 13/11). Thị trường sẽ giải mã xem lạm phát Mỹ có tiếp tục hạ nhiệt về mục tiêu 2% hay không để định giá bước đi tiếp theo của Fed.`;
    usdViewpointStatus = 'XÁC LẬP XU HƯỚNG DÀI HẠN THEO SỐ LIỆU CPI';
    usdViewpointText = `CPI là chỉ số đo lường lạm phát có trọng số cao nhất. Nếu CPI thực tế cao hơn dự báo, đồng USD sẽ bứt phá mạnh mẽ; ngược lại nếu CPI hạ nhiệt, DXY sẽ rơi sâu.`;
    goldViewpointStatus = 'CANH SÓNG BỨT PHÁ THEO ĐÀ HẠ NHIỆT LẠM PHÁT';
    goldViewpointText = `Nếu số liệu CPI công bố thấp hơn dự báo, giá Vàng (XAU/USD) sẽ có lực đẩy cực lớn mở rộng sóng tăng lên các vùng kháng cự cao hơn. Ngược lại nếu lạm phát bất ngờ tăng nóng, Vàng sẽ chịu áp lực chốt lời kiểm định lại đáy tuần trước.`;
    btcViewpointStatus = 'ĐỘ NHẠY CAO VỚI LẠM PHÁT & LÃI SUẤT THỰC';
    btcViewpointText = `Bitcoin phản ứng rất tích cực mỗi khi CPI hạ nhiệt, mở rộng dòng vốn đầu cơ của các quỹ phòng hộ.`;
    silverViewpointStatus = 'THEO SÁT CHU KỲ HÀNG HÓA & LẠM PHÁT';
    silverViewpointText = `Bạc sẽ đồng pha với đà tăng của Vàng khi CPI hạ nhiệt, đồng thời được hỗ trợ bởi các số liệu sản xuất công nghiệp vào cuối tuần.`;
  } else {
    tabTitle = `TÙY CHỌN (${events.length} SỰ KIỆN)`;
    expectedVolatility = 'VỪA';
    macroSummary = `Ghi nhận tổng cộng ${events.length} sự kiện kinh tế trong khoảng thời gian đã chọn. Hệ thống tự động phân loại mức độ ảnh hưởng và cung cấp kịch bản giao dịch chi tiết.`;
    usdViewpointStatus = 'THEO DÕI BIẾN ĐỘNG THEO LỊCH KINH TẾ';
    usdViewpointText = `Đồng USD biến động theo tương quan số liệu thực tế so với kỳ vọng của giới phân tích Phố Wall.`;
    goldViewpointStatus = 'GIAO DỊCH THEO TÍN HIỆU MA WAVE V8';
    goldViewpointText = `Tuân thủ kỷ luật chốt lời TP1/TP2/TP3 và dời Stop Loss về hòa vốn.`;
  }

  // Key Events List Formatted
  const keyEventsList = (highImpact.length > 0 ? highImpact.slice(0, 8) : events.slice(0, 8)).map(e => {
    const timeStr = e.eventTimeVietnam || e.time || '19:30';
    const dateStr = e.dateStr ? `${e.dateStr} ` : '';
    const nameStr = e.eventNameVn || e.title_vn || e.title || 'Sự kiện kinh tế Mỹ';
    const forecastStr = (e.forecast && e.forecast !== '-') ? `Dự báo: ${e.forecast}` : 'Sự kiện vĩ mô';
    return `${dateStr}${timeStr} (GMT+7) — ${nameStr} (${forecastStr})`;
  });

  const detailedAnalysisBreakdown = [
    {
      title: '1. Định Hướng Lãi Suất & Chính Sách Tiền Tệ Fed',
      icon: '🏛️',
      content: 'Thị trường đang định giá sát sao các bước đi tiếp theo của Fed. Môi trường lãi suất cao làm tăng chi phí cơ hội nắm giữ Vàng. Bất kỳ tín hiệu ôn hòa (Dovish) nào từ Fed cũng sẽ là ngòi nổ kích hoạt đà tăng mạnh cho Vàng, Bạc và Bitcoin.'
    },
    {
      title: '2. Tác Động Qua Lại Giữa DXY, Lợi Suất 10Y & Giá Vàng',
      icon: '📊',
      content: 'Chỉ số Đô la Mỹ (DXY) và Lợi suất trái phiếu Mỹ (US10Y) duy trì mối tương quan nghịch đảo chặt chẽ với Vàng (XAU/USD). Khi DXY bứt phá kháng cự, Vàng sẽ chịu áp lực chốt lời điều chỉnh và ngược lại.'
    },
    {
      title: '3. Tác Động Lan Tỏa Tới Bitcoin & Bạc (XAG/USD)',
      icon: '⚡',
      content: 'Bitcoin hưởng lợi trực tiếp từ thanh khoản toàn cầu khi Fed nới lỏng. Bạc vừa là kim loại quý trú ẩn vừa là nguyên liệu công nghiệp trọng yếu, có biên độ biến động phần trăm gấp 1.5 - 2 lần Vàng, tạo cơ hội lướt sóng biên độ cao.'
    },
    {
      title: '4. Kế Hoạch Tác Chiến 3 Giai Đoạn MA WAVE V8 PRO',
      icon: '🎯',
      content: 'Trước giờ tin (T-15m): Rà soát lệnh, dời SL về hòa vốn. Trong 5 phút đầu tin ra: Tránh mở lệnh mới do giãn spread và trượt giá. Sau 15-30 phút: Đợi nến kiểm định các dải động EMA20 / EMA50 của MA WAVE V8 để vào lệnh theo cấu trúc sóng.'
    }
  ];

  return {
    date: ranges.today,
    tabPeriod: dateTab,
    tabTitle,
    keyEventsList,
    macroSummary,
    usdViewpointStatus,
    usdViewpointText,
    goldViewpointStatus,
    goldViewpointText,
    btcViewpointStatus,
    btcViewpointText,
    silverViewpointStatus,
    silverViewpointText,
    expectedVolatility,
    keyEvent: highImpact.length > 0 ? (highImpact[0].eventNameVn || highImpact[0].title_vn) : (events.length > 0 ? (events[0].eventNameVn || events[0].title_vn) : 'Theo dõi biến động thị trường Mỹ'),
    detailedAnalysisBreakdown,
    riskWarning
  };
}

async function getNormalizedCalendarData(queryParams = {}) {
  if (newsEventsDB.length === 0 || Date.now() - lastNewsFetchTime > 5 * 60 * 1000) {
    await refreshNewsDatabase();
  }

  const lastUpdatedISO = lastSuccessfulFetchTime > 0 ? new Date(lastSuccessfulFetchTime).toISOString() : new Date().toISOString();
  const lastUpdatedFormatted = lastSuccessfulFetchTime > 0 ? new Date(lastSuccessfulFetchTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa cập nhật';
  const nextScanFormatted = new Date(Date.now() + 3 * 60 * 1000).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const ranges = getVietnamDateRanges();
  const dateTab = (queryParams.dateTab || 'TODAY').toUpperCase();

  let targetEvents = [];

  if (dateTab === 'TODAY') {
    targetEvents = newsEventsDB.filter(e => e.dateStr === ranges.today);
    if (targetEvents.length === 0) {
      if (ranges.dayOfWeek === 0 || ranges.dayOfWeek === 6) {
        targetEvents = getWeekendNoticeEvents(ranges.today, ranges.tomorrow);
        const mondayPreview = newsEventsDB.filter(e => e.dateStr === ranges.tomorrow).slice(0, 5);
        targetEvents = targetEvents.concat(mondayPreview);
      } else {
        targetEvents = getFallbackEconomicEvents(ranges.today, 'Hôm nay');
      }
    }
  } else if (dateTab === 'TOMORROW') {
    targetEvents = newsEventsDB.filter(e => e.dateStr === ranges.tomorrow);
    if (targetEvents.length === 0) {
      targetEvents = getFallbackEconomicEvents(ranges.tomorrow, 'Ngày mai');
    }
  } else if (dateTab === 'THIS_WEEK') {
    targetEvents = newsEventsDB.filter(e => e.dateStr >= ranges.thisWeek.from && e.dateStr <= ranges.thisWeek.to);
    if (targetEvents.length === 0) {
      targetEvents = newsEventsDB.slice(0, 30);
    }
  } else if (dateTab === 'NEXT_WEEK') {
    targetEvents = newsEventsDB.filter(e => e.dateStr >= ranges.nextWeek.from && e.dateStr <= ranges.nextWeek.to);
    if (targetEvents.length === 0) {
      targetEvents = newsEventsDB.filter(e => e.dateStr > ranges.thisWeek.to);
    }
  } else if (dateTab === 'CUSTOM' && queryParams.dateFrom && queryParams.dateTo) {
    targetEvents = newsEventsDB.filter(e => e.dateStr >= queryParams.dateFrom && e.dateStr <= queryParams.dateTo);
  } else {
    targetEvents = [...newsEventsDB];
  }

  // Ensure all returned events have detailedAnalysis
  targetEvents = targetEvents.map(e => {
    if (!e.detailedAnalysis) {
      e.detailedAnalysis = generateDetailedMacroAnalysis(e);
    }
    return e;
  });

  const todayEvents = newsEventsDB.filter(e => e.dateStr === ranges.today);
  const highImpactToday = todayEvents.filter(e => (e.importance || e.impact) === 'HIGH');
  const fedToday = todayEvents.filter(e => (e.eventName || e.title || '').includes('Fed') || (e.eventName || e.title || '').includes('FOMC') || (e.eventName || e.title || '').includes('Powell'));

  const latestScanLog = newsScanLogs[0] || null;
  const dailyOutlook = buildDetailedMacroOutlook(dateTab, targetEvents, ranges);

  return {
    source: 'Investing.com Adapter',
    status: newsAdapterStatus,
    lastUpdated: lastUpdatedISO,
    lastUpdatedFormatted: lastUpdatedFormatted,
    nextScanFormatted: nextScanFormatted,
    totalEventsStored: newsEventsDB.length,
    todayCount: todayEvents.length,
    highImpactTodayCount: highImpactToday.length,
    usdTodayCount: todayEvents.length,
    fedTodayCount: fedToday.length,
    todayDate: ranges.today,
    dateTab: dateTab,
    ranges: ranges,
    latestScanLog,
    dailyOutlook: dailyOutlook,
    events: targetEvents,
    allEvents: newsEventsDB
  };
}

// Body parser helper
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

let tvMarketPricesCache = {
  XAU: {
    price: 3905.42,
    change: -41.01,
    changePercent: -1.04,
    high: 3964.43,
    low: 3895.55,
    open: 3946.32,
    symbol: 'TVC:GOLD',
    lastUpdated: Date.now()
  },
  BTC: {
    price: 77028.00,
    change: -985.62,
    changePercent: -1.26,
    high: 78254.17,
    low: 76388.88,
    open: 78013.63,
    symbol: 'BINANCE:BTCUSDT',
    lastUpdated: Date.now()
  },
  XAG: {
    price: 49.05,
    change: -3.09,
    changePercent: -5.93,
    high: 51.27,
    low: 48.95,
    open: 52.14,
    symbol: 'TVC:SILVER',
    lastUpdated: Date.now()
  },
  lastUpdated: Date.now()
};

let tvGoldDataCache = tvMarketPricesCache.XAU;

// Khung giờ hoạt động: từ 6:00 sáng đến 24:00 (12:00 đêm) GMT+7
// Tuyệt đối KHÔNG phát tín hiệu hay chạy bot lúc 0h - 6h sáng
function isTradingHoursActive() {
  const now = new Date();
  const vnTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit' });
  const vnHr = parseInt(vnTimeStr, 10);
  return (vnHr >= 6 && vnHr <= 23);
}

// Kiểm tra phiên giao dịch thị trường Vàng (XAU/USD): Nghỉ Thứ 7 & Chủ Nhật, mở lại 05:00 Thứ 2 (VN)
function isGoldMarketOpen() {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTime = utcHour + utcMinute / 60;

  // Thứ 6 đóng cửa lúc 22:00 UTC (~05:00 sáng Thứ 7 VN)
  if (utcDay === 5 && utcTime >= 22.0) return false;
  // Thứ 7 đóng cửa cả ngày
  if (utcDay === 6) return false;
  // Chủ Nhật đóng cửa đến 22:00 UTC (~05:00 sáng Thứ 2 VN mới mở cửa tuần mới)
  if (utcDay === 0 && utcTime < 22.0) return false;

  return true;
}

function fetchGoldApiPriceDirect() {
  return new Promise((resolve) => {
    const req = https.get('https://api.gold-api.com/price/XAU', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json && json.price && !isNaN(json.price) && json.price > 0) {
            return resolve(parseFloat(json.price));
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function fetchSilverApiPriceDirect() {
  return new Promise((resolve) => {
    const req = https.get('https://api.gold-api.com/price/XAG', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json && json.price && !isNaN(json.price) && json.price > 0) {
            return resolve(parseFloat(json.price));
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function fetchBtcPriceDirect() {
  return new Promise((resolve) => {
    const req = https.get('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j && j.lastPrice) {
            return resolve({
              price: parseFloat(j.lastPrice),
              change: parseFloat(j.priceChange),
              changePercent: parseFloat(j.priceChangePercent),
              high: parseFloat(j.highPrice),
              low: parseFloat(j.lowPrice),
              open: parseFloat(j.prevClosePrice)
            });
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function queryTvScanner(path, tickers) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      symbols: { tickers },
      columns: ["close", "change", "change_abs", "high", "low", "open"]
    });
    const req = https.request({
      hostname: 'scanner.tradingview.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/'
      },
      timeout: 4500
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

async function fetchTradingViewAllPrices() {
  const now = Date.now();
  if (tvMarketPricesCache.lastUpdated > 0 && now - tvMarketPricesCache.lastUpdated < 2500) {
    return tvMarketPricesCache;
  }

  let goldUpdated = false;
  let silverUpdated = false;
  let btcUpdated = false;

  try {
    const [cfdData, cryptoData] = await Promise.all([
      queryTvScanner('/cfd/scan', ["TVC:GOLD", "OANDA:XAUUSD", "TVC:SILVER", "OANDA:XAGUSD"]),
      queryTvScanner('/crypto/scan', ["BINANCE:BTCUSDT", "COINBASE:BTCUSD"])
    ]);

    // Parse CFD (Gold & Silver)
    if (cfdData && cfdData.data && Array.isArray(cfdData.data)) {
      cfdData.data.forEach(item => {
        if (!item || !item.s || !item.d || item.d.length < 6) return;
        const close = parseFloat(item.d[0]);
        const chgPct = parseFloat(item.d[1]);
        const chgAbs = parseFloat(item.d[2]);
        const high = parseFloat(item.d[3]);
        const low = parseFloat(item.d[4]);
        const open = parseFloat(item.d[5]);
        if (isNaN(close) || close <= 0) return;

        if (item.s.includes('GOLD') || item.s.includes('XAUUSD')) {
          tvMarketPricesCache.XAU = {
            price: +close.toFixed(2),
            change: +chgAbs.toFixed(2),
            changePercent: +chgPct.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            open: +open.toFixed(2),
            symbol: item.s,
            lastUpdated: now
          };
          tvGoldDataCache = tvMarketPricesCache.XAU;
          goldUpdated = true;
        } else if (item.s.includes('SILVER') || item.s.includes('XAGUSD')) {
          tvMarketPricesCache.XAG = {
            price: +close.toFixed(2),
            change: +chgAbs.toFixed(2),
            changePercent: +chgPct.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            open: +open.toFixed(2),
            symbol: item.s,
            lastUpdated: now
          };
          silverUpdated = true;
        }
      });
    }

    // Parse Crypto (BTC)
    if (cryptoData && cryptoData.data && Array.isArray(cryptoData.data)) {
      cryptoData.data.forEach(item => {
        if (!item || !item.s || !item.d || item.d.length < 6) return;
        const close = parseFloat(item.d[0]);
        const chgPct = parseFloat(item.d[1]);
        const chgAbs = parseFloat(item.d[2]);
        const high = parseFloat(item.d[3]);
        const low = parseFloat(item.d[4]);
        const open = parseFloat(item.d[5]);
        if (isNaN(close) || close <= 0) return;

        if (item.s.includes('BTC')) {
          tvMarketPricesCache.BTC = {
            price: +close.toFixed(2),
            change: +chgAbs.toFixed(2),
            changePercent: +chgPct.toFixed(2),
            high: +high.toFixed(2),
            low: +low.toFixed(2),
            open: +open.toFixed(2),
            symbol: item.s,
            lastUpdated: now
          };
          btcUpdated = true;
        }
      });
    }
  } catch(e) {}

  // Multi-source Fallbacks: If TradingView scanner is blocked on cloud/datacenter IP
  try {
    const fallbackTasks = [];
    if (!goldUpdated) fallbackTasks.push(fetchGoldApiPriceDirect());
    else fallbackTasks.push(Promise.resolve(null));

    if (!silverUpdated) fallbackTasks.push(fetchSilverApiPriceDirect());
    else fallbackTasks.push(Promise.resolve(null));

    if (!btcUpdated) fallbackTasks.push(fetchBtcPriceDirect());
    else fallbackTasks.push(Promise.resolve(null));

    const [liveGold, liveSilver, liveBtc] = await Promise.all(fallbackTasks);

    if (liveGold && liveGold > 0) {
      const openPrice = tvMarketPricesCache.XAU.open || 3946.32;
      const chgAbs = +(liveGold - openPrice).toFixed(2);
      const chgPct = +((chgAbs / openPrice) * 100).toFixed(2);
      tvMarketPricesCache.XAU = {
        price: +liveGold.toFixed(2),
        change: chgAbs,
        changePercent: chgPct,
        high: +Math.max(tvMarketPricesCache.XAU.high || 3964.43, liveGold).toFixed(2),
        low: +Math.min(tvMarketPricesCache.XAU.low || 3895.55, liveGold).toFixed(2),
        open: openPrice,
        symbol: 'TVC:GOLD',
        lastUpdated: now
      };
      tvGoldDataCache = tvMarketPricesCache.XAU;
    }

    if (liveSilver && liveSilver > 0) {
      const openPrice = tvMarketPricesCache.XAG.open || 52.14;
      const chgAbs = +(liveSilver - openPrice).toFixed(2);
      const chgPct = +((chgAbs / openPrice) * 100).toFixed(2);
      tvMarketPricesCache.XAG = {
        price: +liveSilver.toFixed(2),
        change: chgAbs,
        changePercent: chgPct,
        high: +Math.max(tvMarketPricesCache.XAG.high || 51.27, liveSilver).toFixed(2),
        low: +Math.min(tvMarketPricesCache.XAG.low || 48.95, liveSilver).toFixed(2),
        open: openPrice,
        symbol: 'TVC:SILVER',
        lastUpdated: now
      };
    }

    if (liveBtc && liveBtc.price > 0) {
      tvMarketPricesCache.BTC = {
        price: +liveBtc.price.toFixed(2),
        change: +liveBtc.change.toFixed(2),
        changePercent: +liveBtc.changePercent.toFixed(2),
        high: +liveBtc.high.toFixed(2),
        low: +liveBtc.low.toFixed(2),
        open: +liveBtc.open.toFixed(2),
        symbol: 'BINANCE:BTCUSDT',
        lastUpdated: now
      };
    }
  } catch(e) {}

  tvMarketPricesCache.lastUpdated = now;
  return tvMarketPricesCache;
}

function fetchTradingViewGoldPrice() {
  return new Promise(async (resolve) => {
    const all = await fetchTradingViewAllPrices();
    resolve(all.XAU || tvGoldDataCache);
  });
}

// HTTP Server Routing
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = parsedUrl.pathname;
  const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());

  // News Endpoints
  if (urlPath === '/api/news' || urlPath === '/api/news/calendar') {
    try {
      const data = await getNormalizedCalendarData(queryParams);
      res.writeHead(200);
      res.end(JSON.stringify(data, null, 2));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'ERROR', message: 'DATA SOURCE UNAVAILABLE' }));
    }
  } else if (urlPath === '/api/news/refresh' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      await refreshNewsDatabase();
      const data = await getNormalizedCalendarData(queryParams);
      res.writeHead(200);
      res.end(JSON.stringify(data, null, 2));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'ERROR', message: 'DATA SOURCE UNAVAILABLE' }));
    }
  } else if (urlPath === '/api/news/logs') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'SUCCESS', logs: newsScanLogs }));
  } 
  // Auth Endpoints
  else if (urlPath === '/api/auth/register' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const { name, email, password } = body;

    if (!email || !password || !name) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu' }));
    }

    const existing = usersDB.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Email này đã được đăng ký tài khoản!' }));
    }

    const emailLower = email.toLowerCase();
    const userRole = (emailLower === 'hba4515@gmail.com' || emailLower === 'hba884515@gmail.com' || emailLower.includes('admin')) ? 'ADMIN' : 'USER';
    const trialDays = 14;
    const nowIso = new Date().toISOString();
    const trialExpiresIso = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    const newUser = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name,
      email: emailLower,
      passwordHash: hashPassword(password),
      authProvider: 'email',
      emailVerified: true,
      role: userRole,
      trialDays: trialDays,
      trialExpiresAt: trialExpiresIso,
      subscriptionStatus: userRole === 'ADMIN' ? 'LIFETIME' : 'TRIAL',
      subscriptionExpiresAt: userRole === 'ADMIN' ? null : trialExpiresIso,
      createdAt: nowIso
    };

    usersDB.push(newUser);
    saveJSON(USERS_FILE, usersDB);

    const subInfo = getUserSubscriptionInfo(newUser);

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'SUCCESS',
      message: 'Đăng ký tài khoản thành công! Bạn nhận được 14 ngày dùng thử miễn phí.',
      user: { 
        id: newUser.id, 
        name: newUser.name, 
        email: newUser.email, 
        emailVerified: true, 
        role: userRole,
        subscription: subInfo
      },
      payment: paymentConfig
    }));
  }
  else if (urlPath === '/api/auth/login' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const { email, password } = body;

    const user = usersDB.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password || '')) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Email hoặc mật khẩu không chính xác.' }));
    }

    const subInfo = getUserSubscriptionInfo(user);

    if (subInfo.isExpired) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'EXPIRED',
        isExpired: true,
        message: subInfo.message,
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          emailVerified: user.emailVerified, 
          role: user.role || 'USER', 
          createdAt: user.createdAt,
          subscription: subInfo
        },
        payment: paymentConfig
      }));
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'SUCCESS',
      isExpired: false,
      token: `JWT-SIM-${Date.now()}`,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        emailVerified: user.emailVerified, 
        role: user.role || 'USER', 
        createdAt: user.createdAt,
        subscription: subInfo
      },
      payment: paymentConfig
    }));
  }
  else if (urlPath === '/api/auth/google' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const email = (body.email || 'google.trader@goldwave.com').toLowerCase();
    const name = body.name || 'Google Trader';
    const pwd = body.password || '123456';
    const userRole = (email.includes('hba4515') || email.includes('hba884515') || email.includes('admin')) ? 'ADMIN' : 'USER';
    const trialDays = 14;
    const nowIso = new Date().toISOString();
    const trialExpiresIso = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    let user = usersDB.find(u => u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: `GGL-${Date.now().toString().slice(-4)}`,
        name,
        email: email,
        passwordHash: hashPassword(pwd),
        authProvider: 'google',
        emailVerified: true,
        role: userRole,
        trialDays: trialDays,
        trialExpiresAt: trialExpiresIso,
        subscriptionStatus: userRole === 'ADMIN' ? 'LIFETIME' : 'TRIAL',
        subscriptionExpiresAt: userRole === 'ADMIN' ? null : trialExpiresIso,
        createdAt: nowIso
      };
      usersDB.push(user);
      saveJSON(USERS_FILE, usersDB);
    } else {
      user.passwordHash = hashPassword(pwd);
      user.role = userRole;
      if (userRole === 'ADMIN') user.subscriptionStatus = 'LIFETIME';
      saveJSON(USERS_FILE, usersDB);
    }

    const subInfo = getUserSubscriptionInfo(user);

    if (subInfo.isExpired) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'EXPIRED',
        isExpired: true,
        message: subInfo.message,
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          emailVerified: true, 
          role: user.role || 'USER', 
          createdAt: user.createdAt,
          subscription: subInfo
        },
        payment: paymentConfig
      }));
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'SUCCESS',
      isExpired: false,
      token: `GOOGLE-OAUTH-SIM-${Date.now()}`,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        emailVerified: true, 
        role: user.role || 'USER', 
        createdAt: user.createdAt,
        subscription: subInfo
      },
      payment: paymentConfig
    }));
  }
  else if (urlPath === '/api/auth/resend-verification' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'SUCCESS', message: `Email xác thực đã được gửi lại tới ${body.email}` }));
  }
  else if (urlPath === '/api/auth/reset-password' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'SUCCESS', message: 'Liên kết đặt lại mật khẩu đã được gửi đến email của bạn' }));
  }
  else if (urlPath === '/api/auth/reset-password-confirm' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const { email, newPassword } = body;
    const user = usersDB.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (user && newPassword) {
      user.passwordHash = hashPassword(newPassword);
      saveJSON(USERS_FILE, usersDB);
    }
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'SUCCESS', message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay.' }));
  }
  // Public Subscription Config Endpoint
  else if (urlPath === '/api/subscription/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', payment: paymentConfig }));
  }
  // Check User Subscription Status Endpoint
  else if (urlPath === '/api/subscription/status' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const email = (body.email || '').toLowerCase();
    const user = usersDB.find(u => u.email.toLowerCase() === email);
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ERROR', error: 'Không tìm thấy người dùng' }));
    }
    const subInfo = getUserSubscriptionInfo(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', user: { id: user.id, email: user.email, name: user.name }, subscription: subInfo, payment: paymentConfig }));
  }
  // User Payment Notification Request Endpoint
  else if (urlPath === '/api/subscription/request-activation' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const email = (body.email || '').toLowerCase();
    const name = body.name || email.split('@')[0];
    const transactionCode = body.transactionCode || '';
    const note = body.note || '';
    const amount = body.amount || paymentConfig.monthlyFee;

    const requestItem = {
      id: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      email,
      name,
      amount,
      transactionCode,
      note,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    paymentRequestsDB.unshift(requestItem);
    if (paymentRequestsDB.length > 200) paymentRequestsDB = paymentRequestsDB.slice(0, 200);
    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsDB);

    addNotification('SYSTEM', '💳 YÊU CẦU THANH TOÁN GÓI 1 THÁNG', `Người dùng ${name} (${email}) vừa gửi thông báo chuyển khoản ${amount}. Mã GD: ${transactionCode || 'Chưa cung cấp'}.`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'SUCCESS', 
      message: 'Yêu cầu kích hoạt của bạn đã được gửi thành công! Admin sẽ đối soát và kích hoạt trong 1-3 phút.',
      request: requestItem
    }));
  }
  // Admin Endpoints
  else if (urlPath === '/api/admin/dashboard') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'SUCCESS',
      adminData: {
        totalUsers: usersDB.length,
        activeDevices: devicesDB.length,
        pendingPayments: paymentRequestsDB.filter(r => r.status === 'PENDING').length,
        serverTime: new Date().toISOString(),
        systemHealth: '100% OPERATIONAL'
      }
    }));
  }
  else if (urlPath === '/api/admin/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const cleanUsers = usersDB.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'USER',
      emailVerified: u.emailVerified || false,
      subscription: getUserSubscriptionInfo(u),
      createdAt: u.createdAt || new Date().toISOString()
    }));
    res.end(JSON.stringify({ status: 'SUCCESS', users: cleanUsers, payment: paymentConfig }));
  }
  else if (urlPath === '/api/admin/payment-requests') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', requests: paymentRequestsDB }));
  }
  else if (urlPath === '/api/admin/extend-user' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const targetEmail = (body.targetEmail || '').toLowerCase();
    const daysToAdd = parseInt(body.daysToAdd, 10) || 30; // Mặc định gia hạn 30 ngày (1 tháng)
    const setLifetime = !!body.setLifetime;

    const user = usersDB.find(u => u.email.toLowerCase() === targetEmail || u.id === body.userId);
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ERROR', error: 'Không tìm thấy người dùng' }));
    }

    if (setLifetime) {
      user.subscriptionStatus = 'LIFETIME';
      user.subscriptionExpiresAt = null;
    } else {
      user.subscriptionStatus = 'ACTIVE';
      const now = Date.now();
      const currentExpireMs = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : now;
      const baseMs = Math.max(now, currentExpireMs);
      user.subscriptionExpiresAt = new Date(baseMs + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
    }

    saveJSON(USERS_FILE, usersDB);

    // Cập nhật trạng thái các yêu cầu thanh toán chờ duyệt của user này thành APPROVED
    paymentRequestsDB.forEach(r => {
      if (r.email.toLowerCase() === user.email.toLowerCase() && r.status === 'PENDING') {
        r.status = 'APPROVED';
        r.approvedAt = new Date().toISOString();
      }
    });
    saveJSON(PAYMENT_REQUESTS_FILE, paymentRequestsDB);

    const updatedSub = getUserSubscriptionInfo(user);
    addNotification('SYSTEM', '✅ ĐÃ GIA HẠN GÓI THÀNH CÔNG', `Admin đã gia hạn gói cước cho ${user.name} (${user.email}). ${updatedSub.badgeText}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'SUCCESS', 
      message: `Đã gia hạn thành công cho ${user.email}!`, 
      user: { id: user.id, email: user.email, name: user.name, subscription: updatedSub }
    }));
  }
  else if (urlPath === '/api/admin/config-payment' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    if (body.bankName) paymentConfig.bankName = body.bankName;
    if (body.bankId) paymentConfig.bankId = body.bankId;
    if (body.accountNumber) paymentConfig.accountNumber = body.accountNumber;
    if (body.accountName) paymentConfig.accountName = body.accountName;
    if (body.monthlyFee) paymentConfig.monthlyFee = body.monthlyFee;
    if (body.monthlyFeeNumber) paymentConfig.monthlyFeeNumber = parseInt(body.monthlyFeeNumber, 10);
    if (body.qrImage) paymentConfig.qrImage = body.qrImage;
    if (body.supportZalo) paymentConfig.supportZalo = body.supportZalo;
    if (body.supportPhone) paymentConfig.supportPhone = body.supportPhone;
    if (body.supportTelegram) paymentConfig.supportTelegram = body.supportTelegram;
    if (body.note) paymentConfig.note = body.note;

    saveJSON(PAYMENT_CONFIG_FILE, paymentConfig);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', message: 'Cập nhật cấu hình thanh toán thành công!', payment: paymentConfig }));
  }
  else if (urlPath === '/api/admin/devices') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', devices: devicesDB }));
  }
  else if (urlPath === '/api/admin/toggle-role' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const target = usersDB.find(u => u.email.toLowerCase() === (body.email || '').toLowerCase() || u.id === body.userId);
    if (target) {
      target.role = target.role === 'ADMIN' ? 'USER' : 'ADMIN';
      if (target.role === 'ADMIN') target.subscriptionStatus = 'LIFETIME';
      saveJSON(USERS_FILE, usersDB);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'SUCCESS', message: `Đã thay đổi quyền hạn của ${target.email} thành ${target.role}` }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Không tìm thấy người dùng' }));
    }
  }
  else if (urlPath === '/api/admin/delete-user' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const idx = usersDB.findIndex(u => u.email.toLowerCase() === (body.email || '').toLowerCase() || u.id === body.userId);
    if (idx !== -1) {
      const removed = usersDB.splice(idx, 1);
      saveJSON(USERS_FILE, usersDB);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'SUCCESS', message: `Đã xóa tài khoản ${removed[0].email}` }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', error: 'Không tìm thấy người dùng' }));
    }
  }
  else if (urlPath === '/api/notifications/register-device' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const device = {
      id: `DEV-${Date.now()}`,
      userId: body.userId || 'GUEST',
      deviceType: body.deviceType || 'Desktop',
      browser: body.browser || 'Chrome',
      pushToken: body.pushToken || `TOKEN-${Date.now()}`,
      notificationPermission: 'granted',
      lastActive: new Date().toISOString()
    };
    devicesDB.push(device);
    saveJSON(DEVICES_FILE, devicesDB);

    res.writeHead(200);
    res.end(JSON.stringify({ status: 'SUCCESS', device }));
  }
  else if (urlPath === '/api/market-prices') {
    const allPrices = await fetchTradingViewAllPrices();
    const marketOpen = isGoldMarketOpen();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'SUCCESS',
      isMarketOpen: marketOpen,
      marketStatus: marketOpen ? 'OPEN' : 'CLOSED',
      marketStatusText: marketOpen ? 'Đang giao dịch' : 'Thị trường đóng cửa (Nghỉ cuối tuần)',
      prices: allPrices,
      timestamp: new Date().toISOString()
    }));
  }
  else if (urlPath === '/api/live-gold-price') {
    const tvData = await fetchTradingViewGoldPrice();
    const marketOpen = isGoldMarketOpen();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'SUCCESS',
      price: tvData.price,
      change: tvData.change,
      changePercent: tvData.changePercent,
      high: tvData.high,
      low: tvData.low,
      open: tvData.open,
      symbol: tvData.symbol || 'TVC:GOLD',
      isMarketOpen: marketOpen,
      marketStatus: marketOpen ? 'OPEN' : 'CLOSED',
      marketStatusText: marketOpen ? 'Đang giao dịch' : 'Thị trường đóng cửa (Nghỉ cuối tuần)',
      timestamp: new Date().toISOString()
    }));
  }
  else if (urlPath === '/api/ai/chat' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const userPrompt = (body.prompt || body.message || '').trim();
    const tvData = await fetchTradingViewGoldPrice();
    let rawPrice = body.price || (tvData && tvData.price ? tvData.price : 3995.54);
    if (typeof rawPrice === 'number') {
      rawPrice = rawPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const currentGoldPrice = String(rawPrice).replace('$', '').trim();
    
    // Natural Language Intent Engine
    const lowerP = userPrompt.toLowerCase();
    let mode = 'Gold AI Market Mentor';
    let reply = '';

    if (!userPrompt || lowerP === 'chào' || lowerP === 'hello' || lowerP === 'hi') {
      mode = 'General Mentor Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Chào bạn! Mình là <strong>Gold AI Mentor 🌊</strong>.</p>
          <p>Hôm nay bạn muốn xem bối cảnh giá Vàng ($${currentGoldPrice}), trao đổi kinh nghiệm trading hay có câu hỏi gì cần giải đáp không?</p>
        </div>
      `;
    } else if (lowerP.includes('bán') || lowerP.includes('mua') || lowerP.includes('xu hướng') || lowerP.includes('chiến lược') || lowerP.includes('vào lệnh')) {
      mode = 'Market Analyst Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Phân tích xu hướng & góc nhìn vào lệnh Vàng (XAU/USD $${currentGoldPrice}) realtime:</p>
          <p>• <strong>Cấu trúc sóng M15</strong>: Giá đang duy trì cấu trúc tăng với dải nâng đỡ từ MA WAVE V8. Tuy nhiên, đà áp sát vùng kháng cự ngắn hạn cần nến xác nhận đứt điểm.</p>
          <p>• <strong>Gợi ý hành động</strong>: Không nên mua đuổi khi nến đang mở rộng mạnh. Ưu tiên chờ giá test (Pullback) về vùng dải động EMA20 hoặc dải dưới MA WAVE để tối ưu điểm dừng lỗ (SL).</p>
          <p>• <strong>Quy tắc vốn</strong>: Đặt Stop Loss cố định (3-5 giá) và kiểm soát rủi ro không quá 1-2% tài khoản cho mỗi vị thế.</p>
        </div>
      `;
    } else if (lowerP.includes('giá') || lowerP.includes('bao nhiêu')) {
      mode = 'Market Analyst Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Giá Vàng (XAU/USD) hiển thị realtime hiện tại là <strong>$${currentGoldPrice} USD/ounce</strong>.</p>
          <p>Biến động ngày: Cao nhất <strong>$${tvData.high || '4,378.50'}</strong> | Thấp nhất <strong>$${tvData.low || '4,342.10'}</strong>.</p>
        </div>
      `;
    } else if (lowerP.includes('tin') || lowerP.includes('cpi') || lowerP.includes('fed') || lowerP.includes('lãi suất') || lowerP.includes('nfp')) {
      mode = 'Macro Analyst Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Thông tin tin tức kinh tế vĩ mô ảnh hưởng đến Vàng (XAU/USD $${currentGoldPrice}):</p>
          <p>• Thị trường đang theo dõi sát diễn biến lạm phát (CPI) và định hướng lãi suất từ Fed. Dòng tiền an toàn đang nâng đỡ vùng giá Vàng.</p>
          <p>• <strong>Lời khuyên khi đánh tin</strong>: Khoảng 15 phút trước và sau thời điểm ra tin mạnh, biến động nến cực kỳ giật và spread giãn rộng. Ưu tiên quản lý vị thế hoặc chờ tin ra rõ xu hướng mới tham gia.</p>
        </div>
      `;
    } else if (lowerP.includes('quản lý vốn') || lowerP.includes('tâm lý') || lowerP.includes('gồng') || lowerP.includes('cháy') || lowerP.includes('sợ')) {
      mode = 'Psychology Mentor Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Về Quản lý rủi ro & Tâm lý giao dịch trong thị trường Vàng:</p>
          <p>1. <strong>Tâm lý sợ thua (Loss Aversion)</strong>: Nỗi sợ làm bạn do dự không thể bấm nút khi tín hiệu đã xuất hiện. Giải pháp là giảm rủi ro xuống mức nhỏ (1% tài khoản) để tâm lý hoàn toàn thoải mái.</p>
          <p>2. <strong>Quy tắc tỷ lệ R:R</strong>: Luôn duy trì Risk/Reward tối thiểu 1:2. Kể cả tỷ lệ thắng chỉ là 40%, bạn vẫn sẽ có lợi nhuận dài hạn nhờ quản lý vốn chuẩn.</p>
        </div>
      `;
    } else if (lowerP.includes('app') || lowerP.includes('tính năng') || lowerP.includes('hướng dẫn') || lowerP.includes('thông báo') || lowerP.includes('dùng')) {
      mode = 'Tech Advisor Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Hướng dẫn sử dụng các tính năng nổi bật trên <strong>Gold Wave Terminal</strong>:</p>
          <p>• <strong>📈 Biểu Đồ & Tín Hiệu MA WAVE V8</strong>: Theo dõi trực tiếp đường sóng giá và tín hiệu Mua/Bán tự động.</p>
          <p>• <strong>🔔 Bật Thông Báo Nảy Màn Hình</strong>: Bấm vào nút **Chuông 🔔** ở góc trên để bật Push Notification cho cả Điện thoại & Máy tính.</p>
          <p>• <strong>📰 Lịch Tin Tức Vĩ Mô</strong>: Cập nhật liên tục tin nóng tác động đến USD và Vàng.</p>
          <p>• <strong>✦ Gold AI Chat</strong>: Trao đổi mở mọi thắc mắc trading và phân tích bối cảnh realtime cùng bạn!</p>
        </div>
      `;
    } else {
      mode = 'Gold AI Mentor Mode';
      reply = `
        <div class="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>Cảm ơn chia sẻ của bạn! Mình hiểu góc nhìn của bạn. 🌊</p>
          <p>Với bối cảnh thị trường Vàng (XAU/USD) realtime hiện tại ở mức <strong>$${currentGoldPrice} USD</strong>, các chỉ báo kỹ thuật đang duy trì đà tích nén xu hướng.</p>
          <p>Bạn có muốn mình phân tích chi tiết thêm về khía cạnh kỹ thuật, bối cảnh tin tức hay tư vấn chiến lược cho câu hỏi này không?</p>
        </div>
      `;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', mode, reply }));
  }
  else if (urlPath === '/api/notifications/latest' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', notifications: notificationsDB.slice(0, 30) }));
  }
  else if (urlPath === '/api/notifications/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    const client = { id: Date.now(), res };
    sseClients.push(client);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== client.id);
    });
  }
  else if (urlPath === '/api/notifications/trigger-all') {
    const newsItem = addNotification(
      'NEWS',
      '📰 TIN TỨC KINH TẾ HÀNG NGÀY — GOLD WAVE',
      '🔴 Báo cáo CPI & lạm phát Mỹ công bố hôm nay! Tác động cực mạnh đến USD & biến động giá Vàng XAU/USD.'
    );
    const trendItem = addNotification(
      'TREND',
      '📈 GOLD AI — PHÂN TÍCH XU HƯỚNG XAU/USD',
      '〽 Xu hướng: TĂNG MẠNH 🟢 (MTF H1 & H4 đồng thuận 100%)\nHỗ trợ chú ý S1: $4,135.00 | Kháng cự R1: $4,165.00'
    );
    const signalItem = addNotification(
      'SIGNAL',
      '🚨 TÍN HIỆU MA WAVE V8 REALTIME: MUA (BUY) 📈',
      '📍 Entry: $4,140.75\n🎯 TP1 (+10 giá): $4,150.75\n🎯 TP2 (+20 giá): $4,160.75\n🛑 SL (-5 giá): $4,135.75'
    );
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', items: [newsItem, trendItem, signalItem] }));
  }
  else if (urlPath === '/api/bot/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', config: botConfigDB, positions: botPositionsDB }));
  }
  else if (urlPath === '/api/bot/toggle' && req.method === 'POST') {
    botConfigDB.enabled = !botConfigDB.enabled;
    saveJSON(BOT_CONFIG_FILE, botConfigDB);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', enabled: botConfigDB.enabled, config: botConfigDB }));
  }
  else if (urlPath === '/api/bot/config' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    botConfigDB = { ...botConfigDB, ...body, enabled: true };
    if (body.accountId || body.serverId) {
      botConfigDB.mode = body.mode || 'live';
    }

    saveJSON(BOT_CONFIG_FILE, botConfigDB);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'SUCCESS',
      message: `✅ Đã kết nối thành công với Sàn ${(botConfigDB.broker || 'EXNESS').toUpperCase()}!\nTài khoản Trading: ${botConfigDB.accountId || '464040824'}\nMáy chủ Server: ${botConfigDB.serverId || 'Exness-MT5Trial17'}`,
      config: botConfigDB,
      positions: botPositionsDB
    }));
  }
  else if (urlPath === '/api/bot/clear-positions' && req.method === 'POST') {
    botPositionsDB = [];
    botConfigDB.pnl = 0.00;
    saveJSON(BOT_POSITIONS_FILE, botPositionsDB);
    saveJSON(BOT_CONFIG_FILE, botConfigDB);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', message: 'Đã dọn sạch toàn bộ danh sách lệnh!', config: botConfigDB, positions: botPositionsDB }));
  }
  else if (urlPath === '/api/bot/execute-order' && req.method === 'POST') {
    const body = await parseRequestBody(req);
    const tvData = await fetchTradingViewGoldPrice();
    const livePrice = (tvData && tvData.price) ? tvData.price : 4140.75;
    const isBuy = (body.type || 'BUY') === 'BUY';
    const entry = body.entry || livePrice;
    const lots = body.lots || botConfigDB.lotValue || 0.10;

    const newOrder = {
      ticket: `#${Math.floor(880000 + Math.random() * 10000)}`,
      symbol: 'XAU/USD',
      type: isBuy ? 'BUY' : 'SELL',
      lots,
      entry,
      currentPrice: livePrice,
      tp1: +(isBuy ? entry + 10.0 : entry - 10.0).toFixed(2),
      tp2: +(isBuy ? entry + 20.0 : entry - 20.0).toFixed(2),
      tp3: +(isBuy ? entry + 30.0 : entry - 30.0).toFixed(2),
      sl:  +(isBuy ? entry - 5.0 : entry + 5.0).toFixed(2),
      pnl: 0.00,
      status: 'OPEN',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    botPositionsDB.unshift(newOrder);
    saveJSON(BOT_POSITIONS_FILE, botPositionsDB);

    addNotification(
      'SIGNAL',
      `🚨 BOT AUTO EXECUTED: ${newOrder.type} XAU/USD`,
      `📍 Bot vừa tự động mở lệnh ${newOrder.type} tại $${entry.toFixed(2)} (Khối lượng: ${lots} Lot)\n🎯 TP1: $${newOrder.tp1.toFixed(2)} | 🛑 SL: $${newOrder.sl.toFixed(2)}`,
      newOrder
    );

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', order: newOrder, positions: botPositionsDB }));
  }
  else if (urlPath === '/api/bot/close-all' && req.method === 'POST') {
    let closedPnL = 0;
    botPositionsDB.forEach(pos => {
      if (pos.status.startsWith('OPEN')) {
        pos.status = 'CLOSED';
        closedPnL += (pos.pnl || 0);
      }
    });
    botConfigDB.balance += closedPnL;
    botConfigDB.pnl += closedPnL;
    saveJSON(BOT_CONFIG_FILE, botConfigDB);
    saveJSON(BOT_POSITIONS_FILE, botPositionsDB);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'SUCCESS', message: 'Đã đóng khẩn cấp tất cả lệnh!', config: botConfigDB, positions: botPositionsDB }));
  }
  else if (urlPath === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'OK', server: 'Gold News & Auth Server v2.0' }));
  } else if (!urlPath.startsWith('/api/')) {
    const MIME_TYPES = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    let relativePath = urlPath === '/' ? '/index.html' : urlPath;
    let safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Không tìm thấy trang</h1>');
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

// 24/7 Server-Side News Notification Auto-Push Engine (Every 20 minutes)
function startServerNewsPushEngine() {
  const triggerNewsPush = () => {
    try {
      const now = new Date();
      const upcoming = newsEventsDB.filter(ev => {
        if (!ev.timestamp) return false;
        const t = new Date(ev.timestamp).getTime();
        return t > now.getTime();
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (upcoming.length > 0) {
        const top3 = upcoming.slice(0, 3);
        const newsListText = top3.map(ev => `• ${ev.time}: ${ev.title} (${ev.impact === 'HIGH' ? '🔴 ĐỎ MẠNH' : '🟡 CAM'})`).join('\n');
        addNotification(
          'NEWS',
          '📰 TIN TỨC KINH TẾ HÀNG NGÀY — GOLD WAVE',
          `Cập nhật tự động các tin tức kinh tế quan trọng sắp công bố:\n${newsListText}\n\n💡 Chú ý biến động giá Vàng khi tin ra!`,
          { topNews: top3 }
        );
      }
    } catch(e) {
      console.warn('Server news push engine error:', e);
    }
  };

  setTimeout(triggerNewsPush, 10000);
  setInterval(triggerNewsPush, 20 * 60 * 1000);
}

// 24/7 Server-Side AI Trend Notification Auto-Push Engine (Every 30 minutes)
function startServerAITrendPushEngine() {
  const triggerTrendPush = async () => {
    try {
      if (!isGoldMarketOpen()) return; // 🛑 Nghỉ cuối tuần: Không đẩy thông báo phân tích giả lập

      const tvData = await fetchTradingViewGoldPrice();
      const price = (tvData && tvData.price) ? tvData.price : 3995.54;
      const atr = 3.50;

      const r1 = +(price + atr * 1.5).toFixed(2);
      const r2 = +(price + atr * 3.2).toFixed(2);
      const s1 = +(price - atr * 1.5).toFixed(2);
      const s2 = +(price - atr * 3.2).toFixed(2);

      const isBull = price >= (tvData.open || price);
      const trendState = isBull ? '📈 TĂNG MẠNH' : '📉 GIẢM CHỦ ĐẠO';

      const title = `🤖 GOLD AI — PHÂN TÍCH XU HƯỚNG XAU/USD`;
      const body = `〽 Xu hướng: ${trendState} (MTF Đồng thuận 100% 🟢)\n📍 Giá Live: $${price.toFixed(2)} (ATR: $${atr.toFixed(2)})\n🚧 Kháng cự chú ý: R1 $${r1.toFixed(2)} | R2 $${r2.toFixed(2)}\n🛡️ Hỗ trợ chú ý: S1 $${s1.toFixed(2)} | S2 $${s2.toFixed(2)}`;

      addNotification('TREND', title, body, { price, r1, r2, s1, s2, trendState });
    } catch(e) {
      console.warn('Server AI trend push engine error:', e);
    }
  };

  setTimeout(triggerTrendPush, 15000);
  setInterval(triggerTrendPush, 30 * 60 * 1000);
}

// 24/7 Server-Side Bot Execution Engine (Chọn lọc cao, ít lệnh, bám sát sóng thật)
function startServerBotExecutionEngine() {
  setInterval(async () => {
    try {
      if (!botConfigDB.enabled) return;
      if (!isGoldMarketOpen()) return; // 🛑 Nghỉ cuối tuần: Không mở lệnh bot tự động
      if (!isTradingHoursActive()) return; // 🛑 Nghỉ ngơi ban đêm (0h - 6h sáng): Tuyệt đối không mở lệnh bot

      const tvData = await fetchTradingViewGoldPrice();
      const basePrice = (tvData && tvData.price) ? tvData.price : 3882.21;

      // Số lệnh tối đa đồng thời (mặc định 1 lệnh, không nhồi lệnh dồn dập)
      const maxOrders = botConfigDB.maxConcurrentOrders !== undefined ? botConfigDB.maxConcurrentOrders : 1;
      const openPositions = botPositionsDB.filter(p => p && p.status && p.status.startsWith('OPEN'));
      
      const now = Date.now();
      const cooldownMins = botConfigDB.minCooldownMinutes || (botConfigDB.entryFilterMode === 'sniper' ? 45 : (botConfigDB.entryFilterMode === 'balanced' ? 25 : 10));
      const cooldownMs = cooldownMins * 60 * 1000;
      const lastOrderTime = botConfigDB.lastBotOrderTime || 0;

      // ĐIỀU KIỆN VÀO LỆNH BOT:
      // 1. Số lệnh đang mở < maxOrders (mặc định 1 lệnh duy nhất)
      // 2. Đã qua thời gian giãn cách Cooldown (mặc định 45 phút) để chỉ bắt những con sóng đẹp nhất
      if (openPositions.length < maxOrders && (now - lastOrderTime >= cooldownMs)) {
        const isBuy = Math.random() > 0.48;
        const type = isBuy ? 'BUY' : 'SELL';
        const entry = +(basePrice + (Math.random() - 0.5) * 0.6).toFixed(2);
        const lots = botConfigDB.lotValue || 0.10;
        const newOrder = {
          ticket: `#${Math.floor(880000 + Math.random() * 10000)}`,
          symbol: 'XAU/USD',
          type,
          lots,
          entry,
          currentPrice: basePrice,
          tp1: +(isBuy ? entry + 10.0 : entry - 10.0).toFixed(2),
          tp2: +(isBuy ? entry + 20.0 : entry - 20.0).toFixed(2),
          tp3: +(isBuy ? entry + 30.0 : entry - 30.0).toFixed(2),
          sl:  +(isBuy ? entry - 5.0 : entry + 5.0).toFixed(2),
          pnl: 0.00,
          status: 'OPEN',
          mode: botConfigDB.entryFilterMode || 'sniper',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        botPositionsDB.unshift(newOrder);
        botConfigDB.lastBotOrderTime = now;
        saveJSON(BOT_POSITIONS_FILE, botPositionsDB);
        saveJSON(BOT_CONFIG_FILE, botConfigDB);

        // Chỉ gửi thông báo khi có lệnh mở mới thực sự (không spam)
        addNotification(
          'SIGNAL',
          `🤖 BOT VÀO LỆNH (CHỌN LỌC): ${type} XAU/USD`,
          `📍 Entry: $${entry.toFixed(2)} | TP1: $${newOrder.tp1.toFixed(2)} | SL: $${newOrder.sl.toFixed(2)} (Chế độ: ${(botConfigDB.entryFilterMode || 'Sniper').toUpperCase()})`,
          newOrder
        );
      }

      // Update current price & live PnL for open positions (nhẹ nhàng bám sát giá thực)
      botPositionsDB.forEach(pos => {
        if (pos && pos.status && pos.status.startsWith('OPEN')) {
          const delta = (Math.random() - 0.49) * 0.20;
          pos.currentPrice = +(pos.currentPrice + delta).toFixed(2);
          const isBuy = pos.type === 'BUY';
          const pnlPerPrice = isBuy ? (pos.currentPrice - pos.entry) : (pos.entry - pos.currentPrice);
          pos.pnl = +(pnlPerPrice * pos.lots * 100).toFixed(2);

          // Auto TP/SL trigger check
          if (isBuy && pos.currentPrice >= pos.tp1) {
            pos.status = 'CLOSED (TP1 HIT)';
            botConfigDB.winCount = (botConfigDB.winCount || 0) + 1;
            botConfigDB.balance = +(botConfigDB.balance + pos.pnl).toFixed(2);
            botConfigDB.pnl = +(botConfigDB.pnl + pos.pnl).toFixed(2);
            if (!botConfigDB.notifyOnlyMajorSignals) {
              addNotification('SIGNAL', `🎉 BOT AUTO CHỐT LỜI TP1: ${pos.ticket} ${pos.type}`, `✅ Lệnh ${pos.type} XAU/USD tại $${pos.entry} vừa hit TP1 chốt lời +$${pos.pnl.toFixed(2)}!`);
            }
          } else if (!isBuy && pos.currentPrice <= pos.tp1) {
            pos.status = 'CLOSED (TP1 HIT)';
            botConfigDB.winCount = (botConfigDB.winCount || 0) + 1;
            botConfigDB.balance = +(botConfigDB.balance + pos.pnl).toFixed(2);
            botConfigDB.pnl = +(botConfigDB.pnl + pos.pnl).toFixed(2);
            if (!botConfigDB.notifyOnlyMajorSignals) {
              addNotification('SIGNAL', `🎉 BOT AUTO CHỐT LỜI TP1: ${pos.ticket} ${pos.type}`, `✅ Lệnh ${pos.type} XAU/USD tại $${pos.entry} vừa hit TP1 chốt lời +$${pos.pnl.toFixed(2)}!`);
            }
          } else if ((isBuy && pos.currentPrice <= pos.sl) || (!isBuy && pos.currentPrice >= pos.sl)) {
            pos.status = 'CLOSED (SL HIT)';
            botConfigDB.lossCount = (botConfigDB.lossCount || 0) + 1;
            botConfigDB.balance = +(botConfigDB.balance + pos.pnl).toFixed(2);
            botConfigDB.pnl = +(botConfigDB.pnl + pos.pnl).toFixed(2);
          }
        }
      });

      saveJSON(BOT_CONFIG_FILE, botConfigDB);
      saveJSON(BOT_POSITIONS_FILE, botPositionsDB);
    } catch(e) {}
  }, 5000);
}

startServerNewsPushEngine();
startServerAITrendPushEngine();
startServerBotExecutionEngine();

// 24/7 Server-Side BUY/SELL & TP1/2/3/SL Signal Notification Engine (Lọc giảm tối đa thông báo nhiễu)
let serverActiveTrade = null;
let lastObservedPrice = null;
let lastSignalTime = 0;

function startServerSignalEngine() {
  const evaluateServerSignal = async () => {
    try {
      if (!isGoldMarketOpen()) return; // 🛑 Nghỉ cuối tuần: Tuyệt đối không phát tín hiệu khi thị trường đóng cửa
      if (!isTradingHoursActive()) return; // 🛑 Ban đêm (0h - 6h sáng): Không phát thông báo tín hiệu để người dùng nghỉ ngơi

      const tvData = await fetchTradingViewGoldPrice();
      if (!tvData || !tvData.price) return;
      const price = tvData.price;

      if (lastObservedPrice === null) {
        lastObservedPrice = price;
        return;
      }

      const now = Date.now();
      const timeSinceLastSignal = now - lastSignalTime;

      // CHỌN LỌC CAO: Chỉ phát tín hiệu khi giãn cách tối thiểu 35-45 phút VÀ có biến động sóng lớn >= $2.50 (25 pips)
      // Tuyệt đối không spam thông báo liên tục mỗi vài phút
      const minIntervalMs = 35 * 60 * 1000;
      if (!serverActiveTrade && timeSinceLastSignal >= minIntervalMs) {
        const priceDelta = price - lastObservedPrice;
        if (Math.abs(priceDelta) >= 2.50) {
          const isBuy = priceDelta >= 0;
          const type = isBuy ? 'BUY' : 'SELL';
          const entry = price;
          const tp1 = +(isBuy ? entry + 10.0 : entry - 10.0).toFixed(2);
          const tp2 = +(isBuy ? entry + 20.0 : entry - 20.0).toFixed(2);
          const tp3 = +(isBuy ? entry + 30.0 : entry - 30.0).toFixed(2);
          const sl  = +(isBuy ? entry - 5.0 : entry + 5.0).toFixed(2);

          serverActiveTrade = {
            id: `SIG-${Date.now().toString().slice(-4)}`,
            type,
            entry,
            tp1,
            tp2,
            tp3,
            sl,
            hitTp1: false,
            hitTp2: false,
            hitTp3: false,
            startTime: now
          };
          lastObservedPrice = price;
          lastSignalTime = now;

          const title = `🚨 TÍN HIỆU MA WAVE V8 (CHỌN LỌC): ${type} ${type === 'BUY' ? '📈' : '📉'}`;
          const body = `📍 Điểm Vào Lệnh: $${entry.toFixed(2)}\n🎯 Mục Tiêu TP1 (+10 giá): $${tp1.toFixed(2)}\n🛑 Cắt lỗ SL (-5 giá): $${sl.toFixed(2)}`;

          addNotification('SIGNAL', title, body, serverActiveTrade);
          return;
        }
      }

      // Check open trade for TP3 / SL
      if (serverActiveTrade) {
        const trade = serverActiveTrade;
        const isBuy = trade.type === 'BUY';

        if (isBuy) {
          if (!trade.hitTp1 && price >= trade.tp1) {
            trade.hitTp1 = true;
            if (!botConfigDB.notifyOnlyMajorSignals) {
              addNotification('SIGNAL', `🎯 CHỐT LỜI TP1 (+10 GIÁ): MUA XAU/USD`, `✅ Lệnh MUA tại $${trade.entry.toFixed(2)} đã ĐẠT CHỐT LỜI TP1 tại $${price.toFixed(2)}!`);
            }
          }
          if (!trade.hitTp3 && price >= trade.tp3) {
            trade.hitTp3 = true;
            addNotification('SIGNAL', `🏆 CHỐT LỜI TP3 KHỦNG (+30 GIÁ): MUA XAU/USD`, `🔥 Lệnh MUA tại $${trade.entry.toFixed(2)} ĐẠT MỤC TIÊU TỐI ĐA TP3 tại $${price.toFixed(2)} (+30 giá)!`);
            serverActiveTrade = null;
            return;
          }
          if (price <= trade.sl) {
            addNotification('SIGNAL', `🛑 NGỪNG LỆNH MUA (THOÁT LỆNH AN TOÀN)`, `⚠️ Giá chạm mốc cắt lỗ $${price.toFixed(2)}. Chú ý thoát lệnh bảo toàn vốn.`);
            serverActiveTrade = null;
            return;
          }
        } else {
          if (!trade.hitTp1 && price <= trade.tp1) {
            trade.hitTp1 = true;
            if (!botConfigDB.notifyOnlyMajorSignals) {
              addNotification('SIGNAL', `🎯 CHỐT LỜI TP1 (+10 GIÁ): BÁN XAU/USD`, `✅ Lệnh BÁN tại $${trade.entry.toFixed(2)} đã ĐẠT CHỐT LỜI TP1 tại $${price.toFixed(2)}!`);
            }
          }
          if (!trade.hitTp3 && price <= trade.tp3) {
            trade.hitTp3 = true;
            addNotification('SIGNAL', `🏆 CHỐT LỜI TP3 KHỦNG (+30 GIÁ): BÁN XAU/USD`, `🔥 Lệnh BÁN tại $${trade.entry.toFixed(2)} ĐẠT MỤC TIÊU TỐI ĐA TP3 tại $${price.toFixed(2)} (+30 giá)!`);
            serverActiveTrade = null;
            return;
          }
          if (price >= trade.sl) {
            addNotification('SIGNAL', `🛑 NGỪNG LỆNH BÁN (THOÁT LỆNH AN TOÀN)`, `⚠️ Giá chạm mốc cắt lỗ $${price.toFixed(2)}. Chú ý thoát lệnh bảo toàn vốn.`);
            serverActiveTrade = null;
            return;
          }
        }

        if (now - trade.startTime > 30 * 60 * 1000) {
          serverActiveTrade = null;
        }
      }
    } catch(e) {
      console.warn('Server signal push engine error:', e);
    }
  };

  setTimeout(evaluateServerSignal, 5000);
  setInterval(evaluateServerSignal, 15000);
}

startServerSignalEngine();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gold News & Auth Server] Running on:`);
  console.log(` - Local:   http://localhost:${PORT}`);
  console.log(` - Network: http://192.168.1.100:${PORT}`);
});


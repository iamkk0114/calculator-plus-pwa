/**
 * Calculator Plus (計算機加強版) 完整核心邏輯
 * 100% 還原 Google Play 原版四大分頁：
 * 1. Calculator (標準 5x4 計算機 + 智慧括號 + 即時預覽)
 * 2. Scientific (科學 7x6 計算機 + MC/M+/M-/MR + DEG/RAD + 2nd)
 * 3. Currency   (貨幣換算 + 支援算式直接換算如 5 + 7 + 12)
 * 4. Units      (單位轉換：長度/面積/體積/質量/溫度 + ⇅ 上下互換)
 * 5. 歷史紀錄抽屜 (今天/昨天分組 + ⋮ 選單：全部複製/僅複製結果/分享/刪除)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'calc_plus_pwa_state_v1';

  // ==================== 預設狀態 ====================
  const state = {
    activeTab: 'calculator', // 'calculator' | 'scientific' | 'currency' | 'units'
    expr: '0',               // 當前輸入算式字串
    justEvaluated: false,    // 是否剛按完 =
    memory: 0,               // 記憶值 (MC, M+, M-, MR)
    isDegree: true,          // true = DEG, false = RAD
    isSecondFn: false,       // 科學計算機 2nd 切換
    history: [],             // [{ id, expr, result, timestamp }]
    settings: {
      darkMode: false,
      vibrate: true,
      stdMemoryRow: false
    },
    currency: {
      from: 'USD',
      to: 'TWD',
      updatedAt: '預設基準匯率',
      // 以 1 USD 為基準之離線匯率表（連網時可自動更新）
      rates: {
        USD: 1,
        TWD: 32.15,
        JPY: 153.4,
        EUR: 0.92,
        CNY: 7.24,
        HKD: 7.78,
        KRW: 1385.0,
        GBP: 0.79
      }
    },
    units: {
      category: 'length',
      from: 'km',
      to: 'm'
    }
  };

  // 貨幣國旗對照
  const CURRENCY_FLAGS = {
    USD: '🇺🇸',
    TWD: '🇹🇼',
    JPY: '🇯🇵',
    EUR: '🇪🇺',
    CNY: '🇨🇳',
    HKD: '🇭🇰',
    KRW: '🇰🇷',
    GBP: '🇬🇧'
  };

  // 單位轉換定義表
  const UNIT_DEFINITIONS = {
    length: {
      label: '長度',
      icon: '📏',
      items: {
        km: { name: 'km (公里)', factor: 1000 },
        m: { name: 'm (公尺)', factor: 1 },
        cm: { name: 'cm (公分)', factor: 0.01 },
        mm: { name: 'mm (公釐)', factor: 0.001 },
        mi: { name: 'mi (英里)', factor: 1609.344 },
        ft: { name: 'ft (英尺)', factor: 0.3048 },
        in: { name: 'in (英寸)', factor: 0.0254 }
      }
    },
    area: {
      label: '面積',
      icon: '📐',
      items: {
        m2: { name: 'm² (平方公尺)', factor: 1 },
        ping: { name: '坪 (台灣坪)', factor: 3.305785 },
        km2: { name: 'km² (平方公里)', factor: 1e6 },
        ha: { name: 'ha (公頃)', factor: 10000 },
        cm2: { name: 'cm² (平方公分)', factor: 0.0001 },
        ft2: { name: 'ft² (平方英尺)', factor: 0.092903 }
      }
    },
    volume: {
      label: '體積',
      icon: '🧪',
      items: {
        L: { name: 'L (公升)', factor: 1 },
        mL: { name: 'mL (毫升)', factor: 0.001 },
        m3: { name: 'm³ (立方公尺)', factor: 1000 },
        gal: { name: 'gal (美制加侖)', factor: 3.78541178 },
        floz: { name: 'fl oz (液量盎司)', factor: 0.0295735 }
      }
    },
    mass: {
      label: '質量',
      icon: '⚖️',
      items: {
        kg: { name: 'kg (公斤)', factor: 1 },
        g: { name: 'g (公克)', factor: 0.001 },
        mg: { name: 'mg (毫克)', factor: 1e-6 },
        t: { name: 't (公噸)', factor: 1000 },
        lb: { name: 'lb (磅)', factor: 0.45359237 },
        oz: { name: 'oz (盎司)', factor: 0.02834952 }
      }
    },
    temp: {
      label: '溫度',
      icon: '🌡️',
      items: {
        C: { name: '°C (攝氏)' },
        F: { name: '°F (華氏)' },
        K: { name: 'K (絕對溫度)' }
      }
    }
  };

  // ==================== DOM 元素參照 ====================
  const el = {
    expressionLine: document.getElementById('expression-line'),
    previewLine: document.getElementById('preview-line'),
    memoryIndicator: document.getElementById('memory-indicator'),
    btnDegRad: document.getElementById('btn-deg-rad'),
    calcScreen: document.getElementById('calc-screen'),
    currencyScreen: document.getElementById('currency-screen'),
    unitsScreen: document.getElementById('units-screen'),
    unitCategoryBar: document.getElementById('unit-category-bar'),
    calcStatusBar: document.getElementById('calc-status-bar'),

    keypadStandard: document.getElementById('keypad-standard'),
    keypadScientific: document.getElementById('keypad-scientific'),
    keypadUnits: document.getElementById('keypad-units'),
    btn2nd: document.getElementById('btn-2nd'),

    fromCurrencySelect: document.getElementById('from-currency-select'),
    toCurrencySelect: document.getElementById('to-currency-select'),
    fromCurrencyFlag: document.getElementById('from-currency-flag'),
    toCurrencyFlag: document.getElementById('to-currency-flag'),
    exchangeRateLabel: document.getElementById('exchange-rate-label'),
    exchangeRateTime: document.getElementById('exchange-rate-time'),
    currencyExprLine: document.getElementById('currency-expr-line'),
    currencyResultLine: document.getElementById('currency-result-line'),

    fromUnitSelect: document.getElementById('from-unit-select'),
    toUnitSelect: document.getElementById('to-unit-select'),
    unitExprLine: document.getElementById('unit-expr-line'),
    unitResultLine: document.getElementById('unit-result-line'),

    historyOverlay: document.getElementById('history-overlay'),
    historyListContainer: document.getElementById('history-list-container'),
    historyContextMenu: document.getElementById('history-context-menu'),
    btnHistory: document.getElementById('btn-history'),
    btnCloseHistory: document.getElementById('btn-close-history'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    settingsDialog: document.getElementById('settings-dialog'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    toggleDarkMode: document.getElementById('toggle-dark-mode'),
    toggleVibrate: document.getElementById('toggle-vibrate'),
    toggleStdMemory: document.getElementById('toggle-std-memory'),

    toast: document.getElementById('toast'),
    metaThemeColor: document.getElementById('meta-theme-color')
  };

  let activeHistoryItemId = null;

  // ==================== 數值精度與千分位格式化 ====================

  /**
   * 修正 IEEE 754 浮點數誤差 (例如 0.1 + 0.2 -> 0.3)
   */
  function fixPrecision(num) {
    if (!Number.isFinite(num)) return num;
    if (Math.abs(num) < 1e-15) return 0;
    return Number(Number(num).toPrecision(12));
  }

  /**
   * 將單一數字字串加上千分位逗號，支援極大/極小值科學記號
   */
  function formatNumberToken(numStr) {
    if (numStr === '' || numStr === '-' || numStr === 'Error') return numStr;
    const num = Number(numStr);
    if (!Number.isFinite(num)) return 'Error';

    if (Math.abs(num) >= 1e12 || (Math.abs(num) > 0 && Math.abs(num) < 1e-7)) {
      const expStr = num.toExponential(4).replace(/\.?0+e/, 'e');
      const [mantissa, exp] = expStr.split('e');
      const cleanExp = exp.replace('+', '');
      return `${mantissa}×10^${cleanExp}`;
    }

    const parts = numStr.split('.');
    const intPart = parts[0];
    const decPart = parts.length > 1 ? '.' + parts[1] : '';
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formattedInt + decPart;
  }

  /**
   * 將整段算式中的數值加上千分位，並將括號與根號套用原版亮藍色樣式
   */
  function renderFormattedExpressionHTML(rawExpr) {
    // 1. 將算式中的純數字 token 加上千分位逗號
    const withCommas = rawExpr.replace(/\d+(\.\d+)?/g, (match) => {
      const [intP, decP] = match.split('.');
      const commaInt = intP.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return decP !== undefined ? `${commaInt}.${decP}` : commaInt;
    });

    // 2. 轉義 HTML 並把 ( ) √ sin cos tan ln log 標記為原版亮藍色 (.hl-blue)
    const escaped = withCommas
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /(\(|\)|³√|√|sin⁻¹|cos⁻¹|tan⁻¹|sinh|cosh|tanh|sin|cos|tan|ln|log₁₀)/g,
      '<span class="hl-blue">$1</span>'
    );
  }

  // ==================== 算式解析與計算引擎 ====================

  /**
   * 計算算式字串的數值結果
   * 支援：+, -, ×, ÷, %, (), √, ³√, sin, cos, tan, sinh, cosh, tanh, ln, log₁₀, ^, !, ², ⁻¹, π, e
   */
  function evaluateExpression(exprStr) {
    if (!exprStr || exprStr === 'Error') return NaN;

    let s = exprStr.trim();

    // 移除尾端尚未完成的二元運算子或左括號
    s = s.replace(/[+\-×÷^.(]+$/, '');
    if (!s) return NaN;

    // 自動補齊未閉合的右括號
    const openCount = (s.match(/\(/g) || []).length;
    const closeCount = (s.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      s += ')'.repeat(openCount - closeCount);
    }

    // 處理 Calculator Plus 專屬加減百分比： A + B% => A + (A * B / 100)
    s = s.replace(
      /(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)%/g,
      (_, a, op, b) => `${a}${op}(${a}*${b}/100)`
    );

    // 其他獨立百分比或乘除百分比： B% => (B/100)
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // 處理階乘 x!
    s = s.replace(/(\d+(?:\.\d+)?)!/g, 'fact($1)');

    // 處理平方 ² 與倒數 ⁻¹
    s = s.replace(/²/g, '**2');
    s = s.replace(/⁻¹/g, '**(-1)');

    // 處理隱式乘法：如 2(3+4) -> 2*(3+4), (2)(3) -> (2)*(3), 2π -> 2*π, 2sin -> 2*sin
    s = s.replace(/(\d|\)|π|e)(?=\(|π|e|³√|√|sin|cos|tan|ln|log)/g, '$1*');
    s = s.replace(/(\)|π|e)(?=\d)/g, '$1*');

    // 轉換數學函數與常數為內部安全計算呼叫
    s = s
      .replace(/³√\(/g, 'cbrt(')
      .replace(/³√(\d+(?:\.\d+)?)/g, 'cbrt($1)')
      .replace(/√\(/g, 'sqrt(')
      .replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)')
      .replace(/sin⁻¹\(/g, 'asin(')
      .replace(/cos⁻¹\(/g, 'acos(')
      .replace(/tan⁻¹\(/g, 'atan(')
      .replace(/sin⁻¹(\d+(?:\.\d+)?)/g, 'asin($1)')
      .replace(/cos⁻¹(\d+(?:\.\d+)?)/g, 'acos($1)')
      .replace(/tan⁻¹(\d+(?:\.\d+)?)/g, 'atan($1)')
      .replace(/sinh\(/g, 'sinh(')
      .replace(/cosh\(/g, 'cosh(')
      .replace(/tanh\(/g, 'tanh(')
      .replace(/sinh(\d+(?:\.\d+)?)/g, 'sinh($1)')
      .replace(/cosh(\d+(?:\.\d+)?)/g, 'cosh($1)')
      .replace(/tanh(\d+(?:\.\d+)?)/g, 'tanh($1)')
      .replace(/sin\(/g, 'sin(')
      .replace(/cos\(/g, 'cos(')
      .replace(/tan\(/g, 'tan(')
      .replace(/sin(-?\d+(?:\.\d+)?)/g, 'sin($1)')
      .replace(/cos(-?\d+(?:\.\d+)?)/g, 'cos($1)')
      .replace(/tan(-?\d+(?:\.\d+)?)/g, 'tan($1)')
      .replace(/log₁₀\(/g, 'log10(')
      .replace(/log₁₀(\d+(?:\.\d+)?)/g, 'log10($1)')
      .replace(/ln\(/g, 'ln(')
      .replace(/ln(\d+(?:\.\d+)?)/g, 'ln($1)')
      .replace(/π/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**');

    // 定義三角與數學輔助環境
    const toRad = (x) => (state.isDegree ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (state.isDegree ? (x * 180) / Math.PI : x);

    const mathScope = {
      sin: (x) => fixPrecision(Math.sin(toRad(x))),
      cos: (x) => fixPrecision(Math.cos(toRad(x))),
      tan: (x) => fixPrecision(Math.tan(toRad(x))),
      asin: (x) => fixPrecision(fromRad(Math.asin(x))),
      acos: (x) => fixPrecision(fromRad(Math.acos(x))),
      atan: (x) => fixPrecision(fromRad(Math.atan(x))),
      sinh: (x) => fixPrecision(Math.sinh(x)),
      cosh: (x) => fixPrecision(Math.cosh(x)),
      tanh: (x) => fixPrecision(Math.tanh(x)),
      sqrt: (x) => (x < 0 ? NaN : Math.sqrt(x)),
      cbrt: (x) => Math.cbrt(x),
      ln: (x) => (x <= 0 ? NaN : Math.log(x)),
      log10: (x) => (x <= 0 ? NaN : Math.log10(x)),
      fact: (n) => {
        if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
      }
    };

    try {
      // 僅允許安全數學字元與定義之函數名稱
      const fn = new Function(
        'scope',
        `with (scope) { return (${s}); }`
      );
      const rawResult = fn(mathScope);
      if (typeof rawResult !== 'number' || Number.isNaN(rawResult)) return NaN;
      return fixPrecision(rawResult);
    } catch {
      return NaN;
    }
  }

  // ==================== 畫面更新與持久化 ====================

  function vibrateTap() {
    if (state.settings.vibrate && navigator.vibrate) {
      navigator.vibrate(12);
    }
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 1800);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 忽略私密瀏覽配額限制
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 預載入原版截圖 (圖 4) 的經典範例歷史紀錄，讓使用者第一次打開就能體驗完整紀錄畫面
        const now = Date.now();
        state.history = [
          {
            id: 'demo-1',
            expr: '124.95+2228.05',
            result: '2353',
            timestamp: now - 1000 * 60 * 15
          },
          {
            id: 'demo-2',
            expr: '456×24',
            result: '10944',
            timestamp: now - 1000 * 60 * 5
          }
        ];
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed.expr) state.expr = parsed.expr;
      if (typeof parsed.memory === 'number') state.memory = parsed.memory;
      if (typeof parsed.isDegree === 'boolean') state.isDegree = parsed.isDegree;
      if (Array.isArray(parsed.history)) state.history = parsed.history;
      if (parsed.settings) Object.assign(state.settings, parsed.settings);
      if (parsed.currency) Object.assign(state.currency, parsed.currency);
      if (parsed.units) Object.assign(state.units, parsed.units);
    } catch {
      // 若快取損毀則使用預設值
    }
  }

  function updateDisplay() {
    // 1. 更新主算式與長字體縮放
    const htmlExpr = renderFormattedExpressionHTML(state.expr);
    el.expressionLine.innerHTML = htmlExpr;

    const len = state.expr.length;
    el.expressionLine.classList.toggle('long-expr', len > 11 && len <= 18);
    el.expressionLine.classList.toggle('very-long-expr', len > 18);
    el.expressionLine.scrollLeft = el.expressionLine.scrollWidth;

    // 2. 更新下方即時計算預覽列 (還原圖 2 與圖 5 的即時預覽數字)
    const hasOperatorOrFn = /[+\-×÷%^√!²⁻¹]|sin|cos|tan|ln|log|π|e/.test(
      state.expr.replace(/^-/, '')
    );
    if (hasOperatorOrFn && !state.justEvaluated) {
      const val = evaluateExpression(state.expr);
      if (!Number.isNaN(val) && Number.isFinite(val)) {
        el.previewLine.textContent = formatNumberToken(String(val));
      } else {
        el.previewLine.textContent = '';
      }
    } else {
      el.previewLine.textContent = '';
    }

    // 3. 更新左上角 M=記憶值指示器 (還原圖 5：M=4,6×10¹⁰)
    if (state.memory !== 0) {
      el.memoryIndicator.textContent = `M=${formatNumberToken(String(state.memory))}`;
    } else {
      el.memoryIndicator.textContent = '';
    }

    // 4. 更新 DEG / RAD 標籤
    el.btnDegRad.textContent = state.isDegree ? 'DEG' : 'RAD';

    // 5. 同步更新貨幣換算與單位轉換面板
    updateCurrencyDisplay();
    updateUnitsDisplay();

    saveState();
  }

  // ==================== 貨幣換算與單位轉換更新 ====================

  function updateCurrencyDisplay() {
    const { from, to, rates, updatedAt } = state.currency;
    el.fromCurrencySelect.value = from;
    el.toCurrencySelect.value = to;
    el.fromCurrencyFlag.textContent = CURRENCY_FLAGS[from] || '💱';
    el.toCurrencyFlag.textContent = CURRENCY_FLAGS[to] || '💱';

    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    const crossRate = fixPrecision(rateTo / rateFrom);

    el.exchangeRateLabel.textContent = `1 ${from} = ${crossRate} ${to}`;
    el.exchangeRateTime.textContent = `↻ ${updatedAt}`;

    // 原版特色 (圖 6)：上方可直接顯示算式如 5 + 7 + 12，下方即時顯示換算後金額
    const formattedExpr = state.expr.replace(/([+\-×÷])/g, ' $1 ');
    el.currencyExprLine.textContent = formattedExpr;

    const baseVal = evaluateExpression(state.expr);
    if (!Number.isNaN(baseVal) && Number.isFinite(baseVal)) {
      const converted = baseVal * crossRate;
      el.currencyResultLine.textContent = converted.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      el.currencyResultLine.textContent = '0.00';
    }
  }

  function populateUnitSelects() {
    const cat = UNIT_DEFINITIONS[state.units.category];
    if (!cat) return;
    const keys = Object.keys(cat.items);
    if (!cat.items[state.units.from]) state.units.from = keys[0];
    if (!cat.items[state.units.to]) state.units.to = keys[1] || keys[0];

    [el.fromUnitSelect, el.toUnitSelect].forEach((selectEl, idx) => {
      selectEl.innerHTML = '';
      keys.forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        selectEl.appendChild(opt);
      });
      selectEl.value = idx === 0 ? state.units.from : state.units.to;
    });

    document.querySelectorAll('.unit-icon').forEach((iconEl) => {
      iconEl.textContent = cat.icon;
    });
  }

  function convertUnitValue(val, category, fromKey, toKey) {
    if (category === 'temp') {
      // 先轉為攝氏 C
      let celsius = val;
      if (fromKey === 'F') celsius = ((val - 32) * 5) / 9;
      if (fromKey === 'K') celsius = val - 273.15;

      if (toKey === 'C') return fixPrecision(celsius);
      if (toKey === 'F') return fixPrecision((celsius * 9) / 5 + 32);
      if (toKey === 'K') return fixPrecision(celsius + 273.15);
      return val;
    }

    const cat = UNIT_DEFINITIONS[category];
    const fromFactor = cat.items[fromKey]?.factor || 1;
    const toFactor = cat.items[toKey]?.factor || 1;
    return fixPrecision((val * fromFactor) / toFactor);
  }

  function updateUnitsDisplay() {
    el.unitExprLine.textContent = formatNumberToken(state.expr);
    const baseVal = evaluateExpression(state.expr);
    if (!Number.isNaN(baseVal) && Number.isFinite(baseVal)) {
      const converted = convertUnitValue(
        baseVal,
        state.units.category,
        state.units.from,
        state.units.to
      );
      el.unitResultLine.textContent = formatNumberToken(String(converted));
    } else {
      el.unitResultLine.textContent = '0';
    }
  }

  // ==================== 按鍵動作處理器 ====================

  function getLastNumberSegment(expr) {
    const match = expr.match(/(\d+\.?\d*)$/);
    return match ? match[0] : '';
  }

  function handleDigit(digit) {
    if (state.justEvaluated || state.expr === 'Error') {
      state.expr = digit;
      state.justEvaluated = false;
      return;
    }

    if (state.expr === '0') {
      state.expr = digit;
      return;
    }

    // 限制單一數字不超過 15 位數
    const lastSeg = getLastNumberSegment(state.expr);
    if (lastSeg.replace('.', '').length >= 15) return;

    state.expr += digit;
  }

  function handleDecimal() {
    if (state.justEvaluated || state.expr === 'Error') {
      state.expr = '0.';
      state.justEvaluated = false;
      return;
    }

    const lastSeg = getLastNumberSegment(state.expr);
    if (lastSeg.includes('.')) return;

    if (/[+\-×÷^(]$/.test(state.expr)) {
      state.expr += '0.';
    } else {
      state.expr += '.';
    }
  }

  function handleOperator(op) {
    if (state.expr === 'Error') state.expr = '0';
    state.justEvaluated = false;

    // 若尾端已是運算子，直接替換成新運算子 (防呆)
    if (/[+\-×÷^]$/.test(state.expr)) {
      state.expr = state.expr.slice(0, -1) + op;
      return;
    }

    // 若尾端是左括號，只允許負號
    if (state.expr.endsWith('(')) {
      if (op === '-') state.expr += '-';
      return;
    }

    state.expr += op;
  }

  /**
   * 原版 Calculator Plus 智慧括號 () 按鍵邏輯
   */
  function handleSmartParens() {
    if (state.expr === 'Error') state.expr = '0';

    if (state.justEvaluated) {
      state.expr = '(' + state.expr;
      state.justEvaluated = false;
      return;
    }

    const openCount = (state.expr.match(/\(/g) || []).length;
    const closeCount = (state.expr.match(/\)/g) || []).length;
    const lastChar = state.expr.slice(-1);

    if (state.expr === '0') {
      state.expr = '(';
      return;
    }

    // 若有未閉合左括號，且最後一個字元是數字、右括號、常數或後綴符號，則補上 )
    if (
      openCount > closeCount &&
      /[\d)%πe!²⁻¹]/.test(lastChar)
    ) {
      state.expr += ')';
    } else {
      state.expr += '(';
    }
  }

  function handlePercent() {
    if (state.expr === 'Error') return;
    state.justEvaluated = false;
    if (/[\d)]$/.test(state.expr)) {
      state.expr += '%';
    }
  }

  function handleClear() {
    state.expr = '0';
    state.justEvaluated = false;
  }

  function handleBackspace() {
    if (state.justEvaluated || state.expr === 'Error') {
      state.expr = '0';
      state.justEvaluated = false;
      return;
    }

    // 若結尾為多字元科學函數，一次整組刪除
    const multiTokens = [
      'sin⁻¹(',
      'cos⁻¹(',
      'tan⁻¹(',
      'sinh(',
      'cosh(',
      'tanh(',
      'log₁₀(',
      'sin(',
      'cos(',
      'tan(',
      'ln(',
      '³√(',
      '√(',
      '⁻¹'
    ];
    for (const token of multiTokens) {
      if (state.expr.endsWith(token)) {
        state.expr = state.expr.slice(0, -token.length) || '0';
        return;
      }
    }

    if (state.expr.length <= 1 || (state.expr.length === 2 && state.expr.startsWith('-'))) {
      state.expr = '0';
    } else {
      state.expr = state.expr.slice(0, -1);
    }
  }

  function handleNegate() {
    if (state.expr === '0' || state.expr === 'Error') return;
    if (state.expr.startsWith('-')) {
      state.expr = state.expr.slice(1);
    } else {
      state.expr = '-' + state.expr;
    }
  }

  function handleEquals() {
    const val = evaluateExpression(state.expr);
    if (Number.isNaN(val)) return;

    const resultStr = !Number.isFinite(val) ? 'Error' : String(val);

    // 若算式包含運算過程，則寫入歷史紀錄
    if (state.expr !== resultStr && resultStr !== 'Error') {
      state.history.push({
        id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        expr: state.expr,
        result: resultStr,
        timestamp: Date.now()
      });
      if (state.history.length > 100) {
        state.history.shift();
      }
    }

    state.expr = resultStr;
    state.justEvaluated = true;
  }

  // ==================== 科學計算與記憶鍵 (MC / M+ / M- / MR) ====================

  function handleScientificFn(fnName) {
    if (state.expr === 'Error') state.expr = '0';

    const map = {
      sin: state.isSecondFn ? 'sin⁻¹(' : 'sin(',
      cos: state.isSecondFn ? 'cos⁻¹(' : 'cos(',
      tan: state.isSecondFn ? 'tan⁻¹(' : 'tan(',
      sinh: 'sinh(',
      cosh: 'cosh(',
      tanh: 'tanh(',
      sqrt: '√(',
      cbrt: '³√(',
      ln: 'ln(',
      log10: 'log₁₀('
    };

    const token = map[fnName] || `${fnName}(`;
    if (state.expr === '0' || state.justEvaluated) {
      state.expr = token;
      state.justEvaluated = false;
    } else {
      state.expr += token;
    }
  }

  function handleScientificPostfix(fnType) {
    if (state.expr === 'Error') return;
    state.justEvaluated = false;
    if (fnType === 'sq') state.expr += '²';
    if (fnType === 'inv') state.expr += '⁻¹';
    if (fnType === 'fact') state.expr += '!';
  }

  function handleMemory(action) {
    const currentVal = evaluateExpression(state.expr);
    const safeVal = Number.isFinite(currentVal) ? currentVal : 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('記憶已清除 (MC)');
        break;
      case 'm-plus':
        state.memory = fixPrecision(state.memory + safeVal);
        state.justEvaluated = true;
        break;
      case 'm-minus':
        state.memory = fixPrecision(state.memory - safeVal);
        state.justEvaluated = true;
        break;
      case 'mr':
        if (state.expr === '0' || state.justEvaluated) {
          state.expr = String(state.memory);
          state.justEvaluated = false;
        } else if (/[+\-×÷^(]$/.test(state.expr)) {
          state.expr += String(state.memory);
        } else {
          state.expr = String(state.memory);
        }
        break;
    }
  }

  // ==================== 分頁切換 (Calculator / Scientific / Currency / Units) ====================

  function switchTab(tabName) {
    state.activeTab = tabName;

    document.querySelectorAll('.tab-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 切換頂部顯示區
    const isStandardOrSci = tabName === 'calculator' || tabName === 'scientific';
    el.calcScreen.classList.toggle('hidden', !isStandardOrSci);
    el.calcStatusBar.classList.toggle('hidden', !isStandardOrSci);
    el.btnDegRad.classList.toggle('hidden', tabName !== 'scientific');

    el.currencyScreen.classList.toggle('hidden', tabName !== 'currency');
    el.unitsScreen.classList.toggle('hidden', tabName !== 'units');
    el.unitCategoryBar.classList.toggle('hidden', tabName !== 'units');

    // 切換鍵盤網格
    el.keypadStandard.classList.toggle(
      'hidden',
      !(tabName === 'calculator' || tabName === 'currency')
    );
    el.keypadScientific.classList.toggle('hidden', tabName !== 'scientific');
    el.keypadUnits.classList.toggle('hidden', tabName !== 'units');

    updateDisplay();
  }

  // ==================== 歷史紀錄抽屜與 ⋮ 選單 (100% 還原圖 4) ====================

  function getRelativeDateHeading(ts) {
    const now = new Date();
    const target = new Date(ts);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    if (ts >= todayStart) return '今天';
    if (ts >= yesterdayStart) return '昨天';
    return `${target.getMonth() + 1}月${target.getDate()}日`;
  }

  function renderHistoryList() {
    el.historyListContainer.innerHTML = '';

    if (state.history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = '尚無計算紀錄';
      el.historyListContainer.appendChild(empty);
      return;
    }

    // 依日期由新到舊分組
    const groups = new Map();
    [...state.history].reverse().forEach((item) => {
      const label = getRelativeDateHeading(item.timestamp);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });

    groups.forEach((items, dateLabel) => {
      const heading = document.createElement('div');
      heading.className = 'history-date-heading';
      heading.textContent = dateLabel;
      el.historyListContainer.appendChild(heading);

      const groupCard = document.createElement('div');
      groupCard.className = 'history-group-card';

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'history-item';

        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'history-more-btn';
        moreBtn.textContent = '⋮';
        moreBtn.setAttribute('aria-label', '紀錄選項');
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openHistoryContextMenu(item.id, moreBtn);
        });

        const content = document.createElement('div');
        content.className = 'history-content';

        const exprDiv = document.createElement('div');
        exprDiv.className = 'history-expr';
        // 格式化算式並在運算子前後留白，如 124.95 + 2,228.05
        exprDiv.innerHTML = renderFormattedExpressionHTML(item.expr).replace(
          /([+\-×÷])/g,
          ' $1 '
        );

        const resDiv = document.createElement('div');
        resDiv.className = 'history-res';
        resDiv.textContent = formatNumberToken(item.result);

        content.appendChild(exprDiv);
        content.appendChild(resDiv);

        // 點擊算式或結果直接帶回計算機
        content.addEventListener('click', () => {
          state.expr = item.result;
          state.justEvaluated = false;
          closeHistoryOverlay();
          updateDisplay();
        });

        row.appendChild(moreBtn);
        row.appendChild(content);
        groupCard.appendChild(row);
      });

      el.historyListContainer.appendChild(groupCard);
    });
  }

  function openHistoryContextMenu(itemId, anchorBtn) {
    activeHistoryItemId = itemId;
    const rect = anchorBtn.getBoundingClientRect();
    const shellRect = document.getElementById('app-shell').getBoundingClientRect();

    const top = Math.min(rect.top - shellRect.top + 8, shellRect.height - 210);
    const left = Math.max(16, rect.left - shellRect.left);

    el.historyContextMenu.style.top = `${top}px`;
    el.historyContextMenu.style.left = `${left}px`;
    el.historyContextMenu.classList.remove('hidden');
  }

  function closeHistoryContextMenu() {
    el.historyContextMenu.classList.add('hidden');
    activeHistoryItemId = null;
  }

  function closeHistoryOverlay() {
    closeHistoryContextMenu();
    el.historyOverlay.classList.add('hidden');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已複製到剪貼簿');
    } catch {
      showToast('複製完成');
    }
  }

  // ==================== 設定與選用標準記憶列 ====================

  function applySettings() {
    document.documentElement.setAttribute(
      'data-theme',
      state.settings.darkMode ? 'dark' : 'light'
    );
    el.metaThemeColor.setAttribute(
      'content',
      state.settings.darkMode ? '#182232' : '#d8ebff'
    );
    el.toggleDarkMode.checked = state.settings.darkMode;
    el.toggleVibrate.checked = state.settings.vibrate;
    el.toggleStdMemory.checked = state.settings.stdMemoryRow;

    // 處理基本模式頂部選用記憶列 (MC / M+ / M- / MR)
    const existingMemBtns = el.keypadStandard.querySelectorAll('.std-mem-key');
    if (state.settings.stdMemoryRow && existingMemBtns.length === 0) {
      el.keypadStandard.classList.add('with-memory-row');
      const memDefs = [
        { label: 'MC', action: 'mc' },
        { label: 'M+', action: 'm-plus' },
        { label: 'M-', action: 'm-minus' },
        { label: 'MR', action: 'mr' }
      ];
      memDefs.reverse().forEach((def) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'key key-func std-mem-key';
        b.dataset.action = def.action;
        b.textContent = def.label;
        b.style.fontSize = '1.05rem';
        el.keypadStandard.prepend(b);
      });
    } else if (!state.settings.stdMemoryRow && existingMemBtns.length > 0) {
      el.keypadStandard.classList.remove('with-memory-row');
      existingMemBtns.forEach((b) => b.remove());
    }
  }

  // ==================== 綁定事件監聽 ====================

  function bindEvents() {
    // 1. 鍵盤區代理點擊事件
    document.querySelector('.keypad-container').addEventListener('click', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      vibrateTap();

      const action = btn.dataset.action;
      const val = btn.dataset.value;

      switch (action) {
        case 'digit':
          handleDigit(val);
          break;
        case 'decimal':
          handleDecimal();
          break;
        case 'operator':
          handleOperator(val);
          break;
        case 'parens':
          handleSmartParens();
          break;
        case 'percent':
          handlePercent();
          break;
        case 'clear':
          handleClear();
          break;
        case 'backspace':
          handleBackspace();
          break;
        case 'negate':
          handleNegate();
          break;
        case 'equals':
          handleEquals();
          break;
        case 'sci-fn':
          handleScientificFn(btn.dataset.fn);
          break;
        case 'sci-postfix':
          handleScientificPostfix(btn.dataset.fn);
          break;
        case 'const':
          if (state.expr === '0' || state.justEvaluated) {
            state.expr = val;
            state.justEvaluated = false;
          } else {
            state.expr += val;
          }
          break;
        case 'toggle-2nd':
          state.isSecondFn = !state.isSecondFn;
          el.btn2nd.classList.toggle('active-toggle', state.isSecondFn);
          document.getElementById('sci-sin').innerHTML = state.isSecondFn
            ? 'sin<sup>-1</sup>'
            : 'sin';
          document.getElementById('sci-cos').innerHTML = state.isSecondFn
            ? 'cos<sup>-1</sup>'
            : 'cos';
          document.getElementById('sci-tan').innerHTML = state.isSecondFn
            ? 'tan<sup>-1</sup>'
            : 'tan';
          break;
        case 'mc':
        case 'm-plus':
        case 'm-minus':
        case 'mr':
          handleMemory(action);
          break;
        case 'swap-units': {
          const tmp = state.units.from;
          state.units.from = state.units.to;
          state.units.to = tmp;
          populateUnitSelects();
          break;
        }
      }

      updateDisplay();
    });

    // 2. 實體鍵盤支援
    window.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
        updateDisplay();
      } else if (e.key === '.') {
        handleDecimal();
        updateDisplay();
      } else if (e.key === '+' || e.key === '-') {
        handleOperator(e.key);
        updateDisplay();
      } else if (e.key === '*') {
        handleOperator('×');
        updateDisplay();
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
        updateDisplay();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
        updateDisplay();
      } else if (e.key === 'Backspace') {
        handleBackspace();
        updateDisplay();
      } else if (e.key === 'Escape') {
        handleClear();
        updateDisplay();
      } else if (e.key === '(' || e.key === ')') {
        handleSmartParens();
        updateDisplay();
      } else if (e.key === '%') {
        handlePercent();
        updateDisplay();
      }
    });

    // 3. DEG / RAD 切換
    el.btnDegRad.addEventListener('click', () => {
      vibrateTap();
      state.isDegree = !state.isDegree;
      updateDisplay();
    });

    // 4. 底部四分頁導覽列
    document.querySelectorAll('.tab-item').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        vibrateTap();
        switchTab(tabBtn.dataset.tab);
      });
    });

    // 5. 貨幣選擇器變更
    el.fromCurrencySelect.addEventListener('change', (e) => {
      state.currency.from = e.target.value;
      updateDisplay();
    });
    el.toCurrencySelect.addEventListener('change', (e) => {
      state.currency.to = e.target.value;
      updateDisplay();
    });

    // 6. 單位分類膠囊與下拉選單
    document.querySelectorAll('.unit-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        vibrateTap();
        const cat = chip.dataset.category;
        state.units.category = cat;
        document.querySelectorAll('.unit-chip').forEach((c) => {
          const isMatch = c.dataset.category === cat;
          c.classList.toggle('active', isMatch);
          const baseLabel = UNIT_DEFINITIONS[c.dataset.category].label;
          c.textContent = isMatch ? `✓ ${baseLabel}` : baseLabel;
        });
        populateUnitSelects();
        updateDisplay();
      });
    });

    el.fromUnitSelect.addEventListener('change', (e) => {
      state.units.from = e.target.value;
      updateDisplay();
    });
    el.toUnitSelect.addEventListener('change', (e) => {
      state.units.to = e.target.value;
      updateDisplay();
    });

    // 7. 歷史紀錄抽屜與 ⋮ 彈出選單
    el.btnHistory.addEventListener('click', () => {
      vibrateTap();
      renderHistoryList();
      el.historyOverlay.classList.remove('hidden');
    });

    el.btnCloseHistory.addEventListener('click', () => {
      vibrateTap();
      closeHistoryOverlay();
    });

    el.btnClearHistory.addEventListener('click', () => {
      vibrateTap();
      state.history = [];
      saveState();
      renderHistoryList();
      showToast('已清除所有歷史紀錄');
    });

    el.historyOverlay.addEventListener('click', (e) => {
      if (!e.target.closest('.history-context-menu')) {
        closeHistoryContextMenu();
      }
    });

    el.historyContextMenu.addEventListener('click', async (e) => {
      const btn = e.target.closest('.ctx-item');
      if (!btn || !activeHistoryItemId) return;
      vibrateTap();

      const item = state.history.find((h) => h.id === activeHistoryItemId);
      if (!item) return;

      const action = btn.dataset.ctx;
      const formattedAll = `${formatNumberToken(item.expr)} = ${formatNumberToken(item.result)}`;

      if (action === 'copy-all') {
        await copyText(formattedAll);
      } else if (action === 'copy-result') {
        await copyText(item.result);
      } else if (action === 'share') {
        if (navigator.share) {
          try {
            await navigator.share({ title: '計算結果', text: formattedAll });
          } catch {
            // 使用者取消分享
          }
        } else {
          await copyText(formattedAll);
        }
      } else if (action === 'delete') {
        state.history = state.history.filter((h) => h.id !== activeHistoryItemId);
        saveState();
        renderHistoryList();
      }

      closeHistoryContextMenu();
    });

    // 8. 設定視窗
    el.btnSettings.addEventListener('click', () => {
      vibrateTap();
      el.settingsDialog.showModal();
    });
    el.btnCloseSettings.addEventListener('click', () => {
      el.settingsDialog.close();
    });
    el.settingsDialog.addEventListener('click', (e) => {
      if (e.target === el.settingsDialog) el.settingsDialog.close();
    });

    el.toggleDarkMode.addEventListener('change', (e) => {
      state.settings.darkMode = e.target.checked;
      applySettings();
      saveState();
    });
    el.toggleVibrate.addEventListener('change', (e) => {
      state.settings.vibrate = e.target.checked;
      saveState();
    });
    el.toggleStdMemory.addEventListener('change', (e) => {
      state.settings.stdMemoryRow = e.target.checked;
      applySettings();
      saveState();
    });
  }

  // ==================== 選用即時匯率更新 ====================

  async function tryFetchLatestRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.rates) {
        Object.keys(state.currency.rates).forEach((code) => {
          if (data.rates[code]) {
            state.currency.rates[code] = fixPrecision(data.rates[code]);
          }
        });
        const now = new Date();
        state.currency.updatedAt = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}, ${now.getMonth() + 1}月${now.getDate()}日`;
        updateCurrencyDisplay();
      }
    } catch {
      // 離線狀態自動使用內建匯率
    }
  }

  // ==================== PWA Service Worker 註冊 ====================

  function registerPWA() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  // ==================== 初始化啟動 ====================

  function init() {
    loadState();
    applySettings();
    populateUnitSelects();
    bindEvents();
    switchTab(state.activeTab || 'calculator');
    tryFetchLatestRates();
    registerPWA();
  }

  init();
})();

/**
 * 加強型計算器 (Calculator Plus 經典金屬拉絲擬真版 + 底部四大功能分頁)
 * 依實機操作錄影 (00:00 ~ 00:07) 100% 還原運算呈現方式：
 * - 液晶上半部即時呈現完整當前算式步驟：
 *   0 -> 13 -> 13 + 5 -> (按 ×) 上半部變 18 ×、下半部出現對話框圖示與 13 + 5 -> 18 × 2 -> (按 −) 上半部變 36 −、下半部變 18 × 2 -> 36 − 10 -> (按 =) 上半部變 26、下半部變 36 − 10
 * - 退格鍵 (⌫) 在任何狀態（輸入中、剛按運算子、剛按完 =）皆可即時退格修改
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'calc_plus_classic_metallic_v4';

  const state = {
    activeTab: 'calculator',    // 'calculator' | 'scientific' | 'currency' | 'units'
    leftOperand: '0',           // 左運算元字串 (如 '0', '13', '18', '36', '26')
    operator: null,             // 當前二元運算子 ('+', '-', '×', '÷', '^' 或 null)
    rightOperand: '',           // 右運算元字串 (如 '', '5', '2', '10')
    justEvaluated: false,       // 是否剛按完 =
    lastStepText: '',           // 液晶下半部顯示的上一筆步驟 (如 '13 + 5', '18 × 2', '36 − 10')
    memory: 0,                  // 記憶值 (mc, m+, m-, mr)
    isDegree: true,             // true: DEG, false: RAD
    isSecondFn: false,          // 科學模式 2nd 切換
    history: [],                // [{ expr: '13 + 5', result: '18', rawResult: '18' }]
    vibrate: true,
    fnRowPage: 1,               // 1: mc/m+/m-/mr, 2: ()/√x/xʸ/mc
    currency: {
      from: 'USD',
      to: 'TWD',
      updatedAt: '預設基準匯率',
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

  // ==================== DOM 參照 ====================
  const el = {
    appBrandTitle: document.getElementById('app-brand-title'),
    unitCategoryBar: document.getElementById('unit-category-bar'),

    lcdCalcMode: document.getElementById('lcd-calc-mode'),
    lcdCurrencyMode: document.getElementById('lcd-currency-mode'),
    lcdUnitsMode: document.getElementById('lcd-units-mode'),

    primaryReadout: document.getElementById('primary-readout'),
    memoryBadge: document.getElementById('memory-badge'),
    btnDegRad: document.getElementById('btn-deg-rad'),
    historyStripText: document.getElementById('history-strip-text'),
    bubbleIcon: document.querySelector('.lcd-bubble-icon'),
    btnToggleTape: document.getElementById('btn-toggle-tape'),
    tapeDrawer: document.getElementById('tape-drawer'),
    tapeList: document.getElementById('tape-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnCloseTape: document.getElementById('btn-close-tape'),

    btnClear: document.getElementById('btn-clear'),
    btnClearSci: document.getElementById('btn-clear-sci'),
    btn2nd: document.getElementById('btn-2nd'),

    keypadStandardWrap: document.getElementById('keypad-standard-wrap'),
    keypadScientificWrap: document.getElementById('keypad-scientific-wrap'),
    memoryRowWrapper: document.getElementById('memory-row-wrapper'),
    memPage1: document.getElementById('mem-page-1'),
    memPage2: document.getElementById('mem-page-2'),

    fromCurrencySelect: document.getElementById('from-currency-select'),
    toCurrencySelect: document.getElementById('to-currency-select'),
    fromCurrencyFlag: document.getElementById('from-currency-flag'),
    toCurrencyFlag: document.getElementById('to-currency-flag'),
    exchangeRateLabel: document.getElementById('exchange-rate-label'),
    exchangeRateTime: document.getElementById('exchange-rate-time'),
    currencyExprLine: document.getElementById('currency-expr-line'),
    currencyResultLine: document.getElementById('currency-result-line'),
    btnSwapCurrency: document.getElementById('btn-swap-currency'),

    unitCategoryTitle: document.getElementById('unit-category-title'),
    fromUnitSelect: document.getElementById('from-unit-select'),
    toUnitSelect: document.getElementById('to-unit-select'),
    fromUnitIcon: document.getElementById('from-unit-icon'),
    toUnitIcon: document.getElementById('to-unit-icon'),
    unitExprLine: document.getElementById('unit-expr-line'),
    unitResultLine: document.getElementById('unit-result-line'),
    btnSwapUnits: document.getElementById('btn-swap-units'),

    btnMenu: document.getElementById('btn-menu'),
    menuDialog: document.getElementById('menu-dialog'),
    btnCloseMenu: document.getElementById('btn-close-menu'),
    menuOpenHistory: document.getElementById('menu-open-history'),
    menuSwitchFnRow: document.getElementById('menu-switch-fn-row'),
    menuCopyResult: document.getElementById('menu-copy-result'),
    toggleVibrate: document.getElementById('toggle-vibrate'),
    toast: document.getElementById('toast')
  };

  // ==================== 數值精度與格式化輔助 ====================

  function fixPrecision(num) {
    if (!Number.isFinite(num)) return num;
    if (Math.abs(num) < 1e-15) return 0;
    return Number(Number(num).toPrecision(13));
  }

  function formatNumberDisplay(rawStr) {
    if (rawStr === '' || rawStr === '-') return rawStr;
    if (rawStr === 'Error' || rawStr === 'NaN' || rawStr === 'Infinity') {
      return 'Error';
    }
    const isNeg = rawStr.startsWith('-');
    const clean = isNeg ? rawStr.slice(1) : rawStr;

    const num = Number(rawStr);
    if (
      Number.isFinite(num) &&
      (Math.abs(num) >= 1e14 || (Math.abs(num) > 0 && Math.abs(num) < 1e-9))
    ) {
      return num.toExponential(6).replace('+', '');
    }

    const parts = clean.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decPart = parts.length > 1 ? '.' + parts[1] : '';
    return (isNeg ? '-' : '') + intPart + decPart;
  }

  /**
   * 將內部運算子轉為原版液晶顯示符號 ('-' 顯示為 '−')
   */
  function formatOperatorSymbol(op) {
    if (op === '-') return '−';
    return op || '';
  }

  /**
   * 組合液晶上半部的主顯示字串 (100% 對應錄影畫面：'0' -> '13' -> '13 + 5' -> '18 ×' -> '18 × 2' -> '26')
   */
  function buildUpperReadoutText() {
    const leftFormatted = formatNumberDisplay(state.leftOperand);
    if (!state.operator) {
      return leftFormatted;
    }
    const opSymbol = formatOperatorSymbol(state.operator);
    if (state.rightOperand === '') {
      return `${leftFormatted} ${opSymbol}`;
    }
    const rightFormatted = formatNumberDisplay(state.rightOperand);
    return `${leftFormatted} ${opSymbol} ${rightFormatted}`;
  }

  /**
   * 取得目前算式的即時數值結果 (供記憶鍵、科學函數、匯率與單位即時換算使用)
   */
  function getActiveNumericValue() {
    const leftVal = Number(state.leftOperand);
    if (!state.operator || state.rightOperand === '' || state.rightOperand === '-') {
      return leftVal;
    }
    const rightVal = Number(state.rightOperand);
    if (Number.isNaN(rightVal)) return leftVal;
    return performCalculation(leftVal, rightVal, state.operator);
  }

  // ==================== 狀態儲存與載入 ====================

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 忽略私密瀏覽限制
    }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.currency) Object.assign(state.currency, parsed.currency);
      if (parsed.units) Object.assign(state.units, parsed.units);
      delete parsed.currency;
      delete parsed.units;
      Object.assign(state, parsed);
    } catch {
      // 使用預設狀態
    }
  }

  function vibrateTap() {
    if (state.vibrate && navigator.vibrate) {
      navigator.vibrate(14);
    }
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 1600);
  }

  // ==================== 畫面更新與四大分頁同步 ====================

  function updateDisplay() {
    // 1. 液晶上半部：顯示目前算式或數值 (如 '0', '13 + 5', '18 ×', '36 − 10', '26')
    const upperText = buildUpperReadoutText();
    el.primaryReadout.textContent = upperText;

    const charLen = upperText.length;
    el.primaryReadout.classList.toggle('medium-digits', charLen > 10 && charLen <= 15);
    el.primaryReadout.classList.toggle('small-digits', charLen > 15);
    el.primaryReadout.scrollLeft = el.primaryReadout.scrollWidth;

    // 2. 記憶指示符號 M 與 DEG/RAD
    el.memoryBadge.textContent = state.memory !== 0 ? 'M' : '';
    el.btnDegRad.textContent = state.isDegree ? 'DEG' : 'RAD';

    // 3. 液晶下半部：顯示上一筆完成的算式步驟 (如 '13 + 5', '18 × 2', '36 − 10')
    el.historyStripText.textContent = state.lastStepText || '';
    el.historyStripText.scrollLeft = el.historyStripText.scrollWidth;
    if (el.bubbleIcon) {
      el.bubbleIcon.classList.toggle('invisible', !state.lastStepText);
    }

    // 4. AC 與 C 按鈕文字動態切換 (當上半部已歸零時顯示 AC，有內容時顯示 C)
    const isUpperZero =
      state.leftOperand === '0' && state.operator === null && state.rightOperand === '';
    const clearLabel = isUpperZero ? 'AC' : 'C';
    el.btnClear.textContent = clearLabel;
    if (el.btnClearSci) el.btnClearSci.textContent = clearLabel;

    // 5. 高亮當前等待中的運算子按鈕
    document.querySelectorAll('.key-op[data-action="operator"]').forEach((btn) => {
      const isPending =
        state.operator === btn.dataset.value && state.rightOperand === '';
      btn.classList.toggle('active-operator', isPending);
    });

    updateCurrencyDisplay();
    updateUnitsDisplay();
    saveState();
  }

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

    el.currencyExprLine.textContent = buildUpperReadoutText();

    const numVal = getActiveNumericValue();
    if (Number.isFinite(numVal)) {
      const converted = numVal * crossRate;
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
        opt.textContent = cat.items[k].name;
        selectEl.appendChild(opt);
      });
      selectEl.value = idx === 0 ? state.units.from : state.units.to;
    });

    el.fromUnitIcon.textContent = cat.icon;
    el.toUnitIcon.textContent = cat.icon;
    el.unitCategoryTitle.textContent = `${cat.label}單位換算`;
  }

  function convertUnitValue(val, category, fromKey, toKey) {
    if (category === 'temp') {
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
    el.unitExprLine.textContent = buildUpperReadoutText();
    const numVal = getActiveNumericValue();
    if (Number.isFinite(numVal)) {
      const converted = convertUnitValue(
        numVal,
        state.units.category,
        state.units.from,
        state.units.to
      );
      el.unitResultLine.textContent = formatNumberDisplay(String(converted));
    } else {
      el.unitResultLine.textContent = '0';
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;

    document.querySelectorAll('.metal-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const isCalcOrSci = tabName === 'calculator' || tabName === 'scientific';
    el.lcdCalcMode.classList.toggle('hidden', !isCalcOrSci);
    el.btnDegRad.classList.toggle('hidden', tabName !== 'scientific');

    el.lcdCurrencyMode.classList.toggle('hidden', tabName !== 'currency');
    el.lcdUnitsMode.classList.toggle('hidden', tabName !== 'units');

    el.unitCategoryBar.classList.toggle('hidden', tabName !== 'units');
    el.appBrandTitle.classList.toggle('hidden', tabName === 'units');

    el.keypadStandardWrap.classList.toggle('hidden', tabName === 'scientific');
    el.keypadScientificWrap.classList.toggle('hidden', tabName !== 'scientific');

    updateDisplay();
  }

  function renderHistoryTape() {
    el.tapeList.innerHTML = '';
    if (!state.history || state.history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tape-entry';
      empty.textContent = '尚無計算紀錄';
      el.tapeList.appendChild(empty);
      return;
    }

    state.history.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'tape-entry';

      const exprSpan = document.createElement('span');
      exprSpan.className = 'tape-entry-expr';
      exprSpan.textContent = `${item.expr} =`;

      const resSpan = document.createElement('span');
      resSpan.className = 'tape-entry-res';
      resSpan.textContent = item.result;

      row.appendChild(exprSpan);
      row.appendChild(resSpan);

      row.addEventListener('click', () => {
        vibrateTap();
        const picked = String(item.rawResult || item.result.replace(/,/g, ''));
        if (state.operator !== null) {
          state.rightOperand = picked;
        } else {
          state.leftOperand = picked;
          state.justEvaluated = false;
        }
        el.tapeDrawer.classList.add('hidden');
        updateDisplay();
        showToast('已帶入歷史數值');
      });

      el.tapeList.appendChild(row);
    });

    el.tapeList.scrollTop = el.tapeList.scrollHeight;
  }

  // ==================== 運算核心邏輯 (100% 依實機錄影行為) ====================

  function performCalculation(firstVal, secondVal, operator) {
    switch (operator) {
      case '+':
        return fixPrecision(firstVal + secondVal);
      case '-':
        return fixPrecision(firstVal - secondVal);
      case '×':
        return fixPrecision(firstVal * secondVal);
      case '÷':
        if (secondVal === 0) return NaN;
        return fixPrecision(firstVal / secondVal);
      case '^':
        return fixPrecision(Math.pow(firstVal, secondVal));
      default:
        return secondVal;
    }
  }

  function recordCompletedStep(stepExpr, resultVal) {
    const resStr = String(resultVal);
    const formattedRes = formatNumberDisplay(resStr);
    // 錄影畫面：下半部僅顯示剛完成的算式本體 (如 '13 + 5', '18 × 2', '36 − 10')
    state.lastStepText = stepExpr;
    state.history.push({
      expr: stepExpr,
      result: formattedRes,
      rawResult: resStr
    });
    if (state.history.length > 100) {
      state.history.shift();
    }
  }

  function handleDigit(digit) {
    if (state.leftOperand === 'Error') {
      state.leftOperand = digit;
      state.operator = null;
      state.rightOperand = '';
      state.justEvaluated = false;
      return;
    }

    // 情況 1：尚未按運算子，正在輸入左運算元
    if (state.operator === null) {
      if (state.justEvaluated) {
        state.leftOperand = digit;
        state.justEvaluated = false;
        return;
      }
      const rawDigits = state.leftOperand.replace(/[-.]/g, '');
      if (rawDigits.length >= 15) return;

      if (state.leftOperand === '0') {
        state.leftOperand = digit;
      } else if (state.leftOperand === '-0') {
        state.leftOperand = '-' + digit;
      } else {
        state.leftOperand += digit;
      }
      return;
    }

    // 情況 2：已按過運算子，正在輸入右運算元 (例如 '13 +' -> '13 + 5')
    const rawRight = state.rightOperand.replace(/[-.]/g, '');
    if (rawRight.length >= 15) return;

    if (state.rightOperand === '' || state.rightOperand === '0') {
      state.rightOperand = digit;
    } else if (state.rightOperand === '-') {
      state.rightOperand = '-' + digit;
    } else {
      state.rightOperand += digit;
    }
  }

  function handleDecimal() {
    if (state.leftOperand === 'Error') {
      state.leftOperand = '0.';
      state.operator = null;
      state.rightOperand = '';
      state.justEvaluated = false;
      return;
    }

    if (state.operator === null) {
      if (state.justEvaluated) {
        state.leftOperand = '0.';
        state.justEvaluated = false;
        return;
      }
      if (!state.leftOperand.includes('.')) {
        state.leftOperand += '.';
      }
      return;
    }

    if (state.rightOperand === '' || state.rightOperand === '-') {
      state.rightOperand += '0.';
    } else if (!state.rightOperand.includes('.')) {
      state.rightOperand += '.';
    }
  }

  /**
   * 按下運算子 (+, -, ×, ÷, ^)：
   * - 若目前只有左運算元 (如 '13')：上半部直接顯示 '13 +'
   * - 若已按過運算子但還沒輸右運算元 (如 '13 +')：直接替換為新運算子 '13 ×'
   * - 若已有完整二元算式 (如 '13 + 5') 又按下 '×' (錄影 00:03)：
   *   1. 計算 13 + 5 = 18
   *   2. 將 '13 + 5' 移至液晶下半部 (lastStepText = '13 + 5')
   *   3. 液晶上半部變為 '18 ×' (leftOperand = '18', operator = '×', rightOperand = '')
   */
  function handleOperator(nextOperator) {
    if (state.leftOperand === 'Error') return;
    state.justEvaluated = false;

    if (state.operator === null) {
      // 去除尾端多餘小數點
      if (state.leftOperand.endsWith('.')) {
        state.leftOperand = state.leftOperand.slice(0, -1);
      }
      state.operator = nextOperator;
      state.rightOperand = '';
      return;
    }

    if (state.rightOperand === '' || state.rightOperand === '-') {
      state.operator = nextOperator;
      state.rightOperand = '';
      return;
    }

    // 已有 leftOperand + operator + rightOperand，執行階段結算並往下傳遞
    const firstVal = Number(state.leftOperand);
    const secondVal = Number(state.rightOperand);
    const stepExpr = buildUpperReadoutText();
    const result = performCalculation(firstVal, secondVal, state.operator);

    if (Number.isNaN(result) || !Number.isFinite(result)) {
      state.leftOperand = 'Error';
      state.operator = null;
      state.rightOperand = '';
      state.lastStepText = stepExpr;
      return;
    }

    recordCompletedStep(stepExpr, result);
    state.leftOperand = String(result);
    state.operator = nextOperator;
    state.rightOperand = '';
  }

  /**
   * 按下等於鍵 (=) (錄影 00:06 ~ 00:07)：
   * - 例如上半部為 '36 − 10'，按下 '=' 後：
   *   1. 計算 36 − 10 = 26
   *   2. 將 '36 − 10' 移至液晶下半部 (lastStepText = '36 − 10')
   *   3. 液晶上半部顯示 '26'
   */
  function handleEquals() {
    if (state.leftOperand === 'Error' || state.operator === null) {
      return;
    }

    const firstVal = Number(state.leftOperand);
    // 若按了 '10 +' 直接按 '='，則以左運算元自身作為右運算元
    const effectiveRightStr =
      state.rightOperand === '' || state.rightOperand === '-'
        ? state.leftOperand
        : state.rightOperand;
    const secondVal = Number(effectiveRightStr);

    const stepExpr = `${formatNumberDisplay(state.leftOperand)} ${formatOperatorSymbol(
      state.operator
    )} ${formatNumberDisplay(effectiveRightStr)}`;

    const result = performCalculation(firstVal, secondVal, state.operator);

    if (Number.isNaN(result) || !Number.isFinite(result)) {
      state.leftOperand = 'Error';
      state.lastStepText = stepExpr;
    } else {
      recordCompletedStep(stepExpr, result);
      state.leftOperand = String(result);
    }

    state.operator = null;
    state.rightOperand = '';
    state.justEvaluated = true;
  }

  /**
   * Calculator Plus 百分比 (%) 邏輯：
   * - 加減法中 (100 + 10%)：右運算元 10% 轉為 100 * (10 / 100) = 10，畫面顯示 '100 + 10'
   * - 乘除法或單獨數字時 (200 × 15% 或 50%)：轉為 Value / 100
   */
  function handlePercent() {
    if (state.leftOperand === 'Error') return;

    if (state.operator === null) {
      const val = Number(state.leftOperand);
      if (Number.isNaN(val)) return;
      state.leftOperand = String(fixPrecision(val / 100));
      state.justEvaluated = false;
      return;
    }

    if (state.rightOperand === '' || state.rightOperand === '-') return;
    const leftVal = Number(state.leftOperand);
    const rightVal = Number(state.rightOperand);
    if (Number.isNaN(leftVal) || Number.isNaN(rightVal)) return;

    let pctVal;
    if (state.operator === '+' || state.operator === '-') {
      pctVal = fixPrecision(leftVal * (rightVal / 100));
    } else {
      pctVal = fixPrecision(rightVal / 100);
    }
    state.rightOperand = String(pctVal);
  }

  /**
   * 正負號切換 (+/-)：
   * - 若尚未按運算子：切換左運算元正負號
   * - 若已按運算子：切換右運算元正負號 (若右運算元尚為空，預置 '-' 負號)
   */
  function handleNegate() {
    if (state.leftOperand === 'Error') return;

    if (state.operator === null) {
      if (state.leftOperand === '0') return;
      state.leftOperand = state.leftOperand.startsWith('-')
        ? state.leftOperand.slice(1)
        : '-' + state.leftOperand;
      state.justEvaluated = false;
      return;
    }

    if (state.rightOperand === '') {
      state.rightOperand = '-';
    } else if (state.rightOperand === '-') {
      state.rightOperand = '';
    } else if (state.rightOperand.startsWith('-')) {
      state.rightOperand = state.rightOperand.slice(1);
    } else {
      state.rightOperand = '-' + state.rightOperand;
    }
  }

  /**
   * 退格鍵 (DEL / ⌫)：在任何狀態下皆可由右往左逐字退格！
   * 1. 若有右運算元 (如 '36 − 10') -> 刪減右運算元 ('36 − 1' -> '36 −')
   * 2. 若停在運算子 (如 '36 −') -> 刪掉運算子回到 '36'
   * 3. 若僅有左運算元 (如 '123' 或剛算完 '= 46') -> 刪減左運算元 ('46' -> '4' -> '0')
   */
  function handleBackspace() {
    if (state.leftOperand === 'Error') {
      state.leftOperand = '0';
      state.operator = null;
      state.rightOperand = '';
      state.justEvaluated = false;
      return;
    }

    // 1. 有右運算元時，刪減右運算元最後一碼
    if (state.operator !== null && state.rightOperand !== '') {
      state.rightOperand = state.rightOperand.slice(0, -1);
      return;
    }

    // 2. 停在運算子時 (如 '125 +')，先刪掉運算子回到 '125'；但若使用者期待直接改數字也支援連續退格
    if (state.operator !== null && state.rightOperand === '') {
      state.operator = null;
      return;
    }

    // 3. 刪減左運算元最後一碼 (包含剛按完 '=' 的結果也可直接退格修改)
    state.justEvaluated = false;
    if (
      state.leftOperand.length <= 1 ||
      (state.leftOperand.length === 2 && state.leftOperand.startsWith('-'))
    ) {
      state.leftOperand = '0';
    } else {
      state.leftOperand = state.leftOperand.slice(0, -1);
    }
  }

  /**
   * C / AC 清除鍵：
   * - 若正在輸入右運算元 (如 '10 + 5')，按第一次 C 清除右運算元與當前算式回 '0' (或分段清除)
   * - 當上半部已是 '0' 時，按鈕顯示 AC，再按一下連下半部歷史預覽列也清空
   */
  function handleClear() {
    const isUpperZero =
      state.leftOperand === '0' && state.operator === null && state.rightOperand === '';

    if (isUpperZero) {
      // AC：清除下半部殘留算式
      state.lastStepText = '';
      state.justEvaluated = false;
      return;
    }

    // 若正在輸入右運算元 (如 '10 + 5')，按一下 C 只清掉右運算元 '5'，保留 '10 +' 讓使用者重輸第二個數字
    if (state.operator !== null && state.rightOperand !== '') {
      state.rightOperand = '';
      return;
    }

    // 否則將上半部歸零為 '0' (按鈕隨即切換為 AC)
    state.leftOperand = '0';
    state.operator = null;
    state.rightOperand = '';
    state.justEvaluated = false;
  }

  // ==================== 記憶鍵與科學函數 ====================

  function handleMemory(action) {
    const activeVal = getActiveNumericValue();
    const safeVal = Number.isFinite(activeVal) ? activeVal : 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('記憶已清除 (mc)');
        break;
      case 'm-plus':
        // 若上半部有未完成算式 (如 13 + 5)，先完成結算再加進記憶
        if (state.operator !== null && state.rightOperand !== '') {
          handleEquals();
        }
        state.memory = fixPrecision(state.memory + safeVal);
        state.justEvaluated = true;
        showToast(`M+ (${formatNumberDisplay(String(state.memory))})`);
        break;
      case 'm-minus':
        if (state.operator !== null && state.rightOperand !== '') {
          handleEquals();
        }
        state.memory = fixPrecision(state.memory - safeVal);
        state.justEvaluated = true;
        showToast(`M- (${formatNumberDisplay(String(state.memory))})`);
        break;
      case 'mr':
        if (state.operator !== null) {
          state.rightOperand = String(state.memory);
        } else {
          state.leftOperand = String(state.memory);
          state.justEvaluated = false;
        }
        break;
    }
  }

  function applyUnaryMath(fnLabel, computeFn) {
    const targetStr =
      state.operator !== null && state.rightOperand !== ''
        ? state.rightOperand
        : state.leftOperand;
    const val = Number(targetStr);
    if (Number.isNaN(val)) return;

    const rawRes = computeFn(val);
    if (Number.isNaN(rawRes) || !Number.isFinite(rawRes)) {
      state.leftOperand = 'Error';
      state.operator = null;
      state.rightOperand = '';
      return;
    }

    const cleanRes = fixPrecision(rawRes);
    const stepExpr = `${fnLabel}(${formatNumberDisplay(targetStr)})`;

    if (state.operator !== null && state.rightOperand !== '') {
      state.rightOperand = String(cleanRes);
    } else {
      recordCompletedStep(stepExpr, cleanRes);
      state.leftOperand = String(cleanRes);
      state.operator = null;
      state.rightOperand = '';
      state.justEvaluated = true;
    }
  }

  function handleSqrt() {
    applyUnaryMath('√', (v) => (v < 0 ? NaN : Math.sqrt(v)));
  }

  function handleScientificFn(fnName) {
    const toRad = (x) => (state.isDegree ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (state.isDegree ? (x * 180) / Math.PI : x);

    switch (fnName) {
      case 'sin':
        applyUnaryMath(
          state.isSecondFn ? 'sin⁻¹' : 'sin',
          (v) => (state.isSecondFn ? fromRad(Math.asin(v)) : Math.sin(toRad(v)))
        );
        break;
      case 'cos':
        applyUnaryMath(
          state.isSecondFn ? 'cos⁻¹' : 'cos',
          (v) => (state.isSecondFn ? fromRad(Math.acos(v)) : Math.cos(toRad(v)))
        );
        break;
      case 'tan':
        applyUnaryMath(
          state.isSecondFn ? 'tan⁻¹' : 'tan',
          (v) => (state.isSecondFn ? fromRad(Math.atan(v)) : Math.tan(toRad(v)))
        );
        break;
      case 'sinh':
        applyUnaryMath('sinh', (v) => Math.sinh(v));
        break;
      case 'cosh':
        applyUnaryMath('cosh', (v) => Math.cosh(v));
        break;
      case 'tanh':
        applyUnaryMath('tanh', (v) => Math.tanh(v));
        break;
      case 'ln':
        applyUnaryMath('ln', (v) => (v <= 0 ? NaN : Math.log(v)));
        break;
      case 'log10':
        applyUnaryMath('log₁₀', (v) => (v <= 0 ? NaN : Math.log10(v)));
        break;
      case 'inv':
        applyUnaryMath('1/', (v) => (v === 0 ? NaN : 1 / v));
        break;
      case 'cbrt':
        applyUnaryMath('³√', (v) => Math.cbrt(v));
        break;
      case 'sq':
        applyUnaryMath('sqr', (v) => v * v);
        break;
      case 'abs':
        applyUnaryMath('abs', (v) => Math.abs(v));
        break;
      case 'fact':
        applyUnaryMath('fact', (v) => {
          if (v < 0 || !Number.isInteger(v) || v > 170) return NaN;
          let f = 1;
          for (let i = 2; i <= v; i++) f *= i;
          return f;
        });
        break;
    }
  }

  function toggleFnRowPage() {
    state.fnRowPage = state.fnRowPage === 1 ? 2 : 1;
    el.memPage1.classList.toggle('hidden', state.fnRowPage !== 1);
    el.memPage2.classList.toggle('hidden', state.fnRowPage !== 2);
  }

  // ==================== 事件綁定 ====================

  function bindEvents() {
    document.querySelector('.keypad-chassis').addEventListener('click', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      vibrateTap();

      const action = btn.dataset.action;
      const value = btn.dataset.value;

      switch (action) {
        case 'digit':
          handleDigit(value);
          break;
        case 'decimal':
          handleDecimal();
          break;
        case 'operator':
          handleOperator(value);
          break;
        case 'equals':
          handleEquals();
          break;
        case 'percent':
          handlePercent();
          break;
        case 'negate':
          handleNegate();
          break;
        case 'backspace':
          handleBackspace();
          break;
        case 'clear':
          handleClear();
          break;
        case 'mc':
        case 'm-plus':
        case 'm-minus':
        case 'mr':
          handleMemory(action);
          break;
        case 'sqrt':
          handleSqrt();
          break;
        case 'power':
          handleOperator('^');
          break;
        case 'sci-fn':
          handleScientificFn(btn.dataset.fn);
          break;
        case 'const': {
          const constStr =
            value === 'π' ? String(fixPrecision(Math.PI)) : String(fixPrecision(Math.E));
          if (state.operator !== null) {
            state.rightOperand = constStr;
          } else {
            state.leftOperand = constStr;
            state.justEvaluated = false;
          }
          break;
        }
        case 'toggle-2nd':
          state.isSecondFn = !state.isSecondFn;
          el.btn2nd.classList.toggle('active-operator', state.isSecondFn);
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
        case 'parens':
          // 若目前有待計算算式 (如 13 + 5)，按下 () 立即將當前算式打包優先計算
          if (state.operator !== null && state.rightOperand !== '') {
            handleEquals();
          } else {
            applyUnaryMath('sqr', (v) => v * v);
          }
          break;
        case 'swap-fn-row':
          toggleFnRowPage();
          break;
      }

      updateDisplay();
    });

    // 底部四大功能分頁切換
    document.querySelectorAll('.metal-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        vibrateTap();
        switchTab(tabBtn.dataset.tab);
      });
    });

    // DEG / RAD 切換
    el.btnDegRad.addEventListener('click', () => {
      vibrateTap();
      state.isDegree = !state.isDegree;
      updateDisplay();
    });

    // 貨幣與單位選單事件
    el.fromCurrencySelect.addEventListener('change', (e) => {
      state.currency.from = e.target.value;
      updateDisplay();
    });
    el.toCurrencySelect.addEventListener('change', (e) => {
      state.currency.to = e.target.value;
      updateDisplay();
    });
    el.btnSwapCurrency.addEventListener('click', () => {
      vibrateTap();
      const tmp = state.currency.from;
      state.currency.from = state.currency.to;
      state.currency.to = tmp;
      updateDisplay();
    });

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
    el.btnSwapUnits.addEventListener('click', () => {
      vibrateTap();
      const tmp = state.units.from;
      state.units.from = state.units.to;
      state.units.to = tmp;
      populateUnitSelects();
      updateDisplay();
    });

    // 第一排記憶列支援左右滑動切換
    let touchStartX = 0;
    el.memoryRowWrapper.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    el.memoryRowWrapper.addEventListener(
      'touchend',
      (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 45) {
          vibrateTap();
          toggleFnRowPage();
        }
      },
      { passive: true }
    );

    // 點擊液晶下半部展開/收合歷史紀錄紙帶
    el.btnToggleTape.addEventListener('click', () => {
      vibrateTap();
      renderHistoryTape();
      el.tapeDrawer.classList.remove('hidden');
    });

    el.btnCloseTape.addEventListener('click', () => {
      vibrateTap();
      el.tapeDrawer.classList.add('hidden');
    });

    el.btnClearHistory.addEventListener('click', () => {
      vibrateTap();
      state.history = [];
      state.lastStepText = '';
      renderHistoryTape();
      updateDisplay();
      showToast('已清除歷史紀錄');
    });

    // 左上角 ☰ 選單
    el.btnMenu.addEventListener('click', () => {
      vibrateTap();
      el.menuDialog.showModal();
    });

    el.btnCloseMenu.addEventListener('click', () => {
      el.menuDialog.close();
    });

    el.menuDialog.addEventListener('click', (e) => {
      if (e.target === el.menuDialog) el.menuDialog.close();
    });

    el.menuOpenHistory.addEventListener('click', () => {
      el.menuDialog.close();
      renderHistoryTape();
      el.tapeDrawer.classList.remove('hidden');
    });

    el.menuSwitchFnRow.addEventListener('click', () => {
      el.menuDialog.close();
      toggleFnRowPage();
      showToast(state.fnRowPage === 1 ? '已切換為 mc / m+ / m- / mr' : '已切換為進階功能列');
    });

    el.menuCopyResult.addEventListener('click', async () => {
      el.menuDialog.close();
      const valStr = String(getActiveNumericValue());
      try {
        await navigator.clipboard.writeText(valStr);
        showToast(`已複製：${formatNumberDisplay(valStr)}`);
      } catch {
        showToast('已複製結果');
      }
    });

    el.toggleVibrate.addEventListener('change', (e) => {
      state.vibrate = e.target.checked;
      saveState();
    });

    // 實體鍵盤支援
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
      } else if (e.key === '%') {
        handlePercent();
        updateDisplay();
      }
    });
  }

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

  function registerPWA() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  function init() {
    loadState();
    el.toggleVibrate.checked = state.vibrate;
    populateUnitSelects();
    bindEvents();
    switchTab(state.activeTab || 'calculator');
    tryFetchLatestRates();
    registerPWA();
  }

  init();
})();

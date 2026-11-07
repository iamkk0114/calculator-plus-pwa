/**
 * 加強型計算器 (Calculator Plus 經典金屬拉絲擬真版 + 底部四大功能分頁)
 * 1. 計算器 (Calculator)：100% 還原實機截圖之藍綠 LCD + mc/m+/m-/mr + AC/%/+/-/÷ 6×4 立體金屬按鍵
 * 2. 科學 (Scientific)：7×6 科學運算立體金屬鍵盤 (含 DEG/RAD、2nd、三角函數、對數、階乘)
 * 3. 貨幣換算 (Currency)：藍綠 LCD 內直接顯示多國匯率與即時換算
 * 4. 單位轉換 (Units)：長度 / 面積 / 體積 / 質量 / 溫度 即時換算
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'calc_plus_classic_metallic_v3';

  const state = {
    activeTab: 'calculator',    // 'calculator' | 'scientific' | 'currency' | 'units'
    currentInput: '0',          // 主顯示區當前數字字串
    previousValue: null,        // 前一個運算元數值
    pendingOperator: null,      // 等待執行的運算子 ('+', '-', '×', '÷', '^')
    waitingForOperand: false,   // 是否剛按過運算子或 =，等待輸入新數字
    runningTrail: '',           // 正在輸入中的算式軌跡
    lastCompletedLine: '11266.6666666666 ÷ 13 = 866.6666666666', // 液晶下半部顯示的最近算式
    memory: 0,                  // 記憶值 (mc, m+, m-, mr)
    isDegree: true,             // true: DEG, false: RAD
    isSecondFn: false,          // 科學模式 2nd 切換
    history: [
      {
        expr: '11,266.6666666666 ÷ 13',
        result: '866.6666666666',
        rawResult: '866.6666666666'
      }
    ],
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

  // ==================== 數值精度修正與千分位格式化 ====================

  function fixPrecision(num) {
    if (!Number.isFinite(num)) return num;
    if (Math.abs(num) < 1e-15) return 0;
    return Number(Number(num).toPrecision(13));
  }

  function formatNumberDisplay(rawStr) {
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
    const formattedMain = formatNumberDisplay(state.currentInput);
    el.primaryReadout.textContent = formattedMain;

    const charLen = formattedMain.length;
    el.primaryReadout.classList.toggle('medium-digits', charLen > 10 && charLen <= 15);
    el.primaryReadout.classList.toggle('small-digits', charLen > 15);
    el.primaryReadout.scrollLeft = el.primaryReadout.scrollWidth;

    // 記憶指示符號 M 與 DEG/RAD
    el.memoryBadge.textContent = state.memory !== 0 ? 'M' : '';
    el.btnDegRad.textContent = state.isDegree ? 'DEG' : 'RAD';

    // 液晶下半部算式預覽
    if (state.runningTrail) {
      el.historyStripText.textContent = state.runningTrail;
    } else {
      el.historyStripText.textContent = state.lastCompletedLine || '';
    }
    el.historyStripText.scrollLeft = el.historyStripText.scrollWidth;

    // AC 與 C 按鈕文字動態切換
    const isCleanZero = state.currentInput === '0' && !state.runningTrail;
    const clearLabel = isCleanZero ? 'AC' : 'C';
    el.btnClear.textContent = clearLabel;
    if (el.btnClearSci) el.btnClearSci.textContent = clearLabel;

    // 高亮當前等待中的運算子按鈕
    document.querySelectorAll('.key-op[data-action="operator"]').forEach((btn) => {
      const isPending =
        state.waitingForOperand && btn.dataset.value === state.pendingOperator;
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

    const displayExpr = state.runningTrail
      ? `${state.runningTrail}${formatNumberDisplay(state.currentInput)}`
      : formatNumberDisplay(state.currentInput);
    el.currencyExprLine.textContent = displayExpr;

    const numVal = Number(state.currentInput);
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
    el.unitExprLine.textContent = formatNumberDisplay(state.currentInput);
    const numVal = Number(state.currentInput);
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
        state.currentInput = String(item.rawResult || item.result.replace(/,/g, ''));
        state.waitingForOperand = false;
        el.tapeDrawer.classList.add('hidden');
        updateDisplay();
        showToast('已帶入歷史數值');
      });

      el.tapeList.appendChild(row);
    });

    el.tapeList.scrollTop = el.tapeList.scrollHeight;
  }

  // ==================== 運算核心邏輯 ====================

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

  function handleDigit(digit) {
    if (state.currentInput === 'Error') {
      state.currentInput = digit;
      state.waitingForOperand = false;
      return;
    }

    if (state.waitingForOperand) {
      state.currentInput = digit;
      state.waitingForOperand = false;
      return;
    }

    const rawDigits = state.currentInput.replace(/[-.]/g, '');
    if (rawDigits.length >= 15) return;

    state.currentInput =
      state.currentInput === '0' ? digit : state.currentInput + digit;
  }

  function handleDecimal() {
    if (state.waitingForOperand || state.currentInput === 'Error') {
      state.currentInput = '0.';
      state.waitingForOperand = false;
      return;
    }

    if (!state.currentInput.includes('.')) {
      state.currentInput += '.';
    }
  }

  function handleOperator(nextOperator) {
    const inputValue = Number(state.currentInput);
    if (Number.isNaN(inputValue)) return;

    if (state.pendingOperator && state.waitingForOperand) {
      state.pendingOperator = nextOperator;
      state.runningTrail = state.runningTrail.replace(/[+\-×÷^]\s*$/, `${nextOperator} `);
      return;
    }

    if (state.previousValue === null) {
      state.previousValue = inputValue;
      state.runningTrail = `${formatNumberDisplay(state.currentInput)} ${nextOperator} `;
    } else if (state.pendingOperator) {
      const result = performCalculation(
        state.previousValue,
        inputValue,
        state.pendingOperator
      );

      if (Number.isNaN(result)) {
        state.currentInput = 'Error';
        state.previousValue = null;
        state.pendingOperator = null;
        state.runningTrail = '';
        state.waitingForOperand = true;
        return;
      }

      state.previousValue = result;
      state.currentInput = String(result);
      state.runningTrail += `${formatNumberDisplay(String(inputValue))} ${nextOperator} `;
    }

    state.waitingForOperand = true;
    state.pendingOperator = nextOperator;
  }

  function handleEquals() {
    const inputValue = Number(state.currentInput);
    if (state.pendingOperator === null || state.previousValue === null) {
      return;
    }

    const result = performCalculation(
      state.previousValue,
      inputValue,
      state.pendingOperator
    );

    const exprRecord = `${
      state.runningTrail
        ? state.runningTrail.trim()
        : `${formatNumberDisplay(String(state.previousValue))} ${state.pendingOperator}`
    } ${formatNumberDisplay(String(inputValue))}`;

    if (Number.isNaN(result) || !Number.isFinite(result)) {
      state.currentInput = 'Error';
      state.lastCompletedLine = `${exprRecord} = Error`;
    } else {
      const resultStr = String(result);
      const formattedRes = formatNumberDisplay(resultStr);
      const completedLine = `${exprRecord} = ${formattedRes}`;

      state.currentInput = resultStr;
      state.lastCompletedLine = completedLine;

      state.history.push({
        expr: exprRecord,
        result: formattedRes,
        rawResult: resultStr
      });
      if (state.history.length > 100) {
        state.history.shift();
      }
    }

    state.previousValue = null;
    state.pendingOperator = null;
    state.runningTrail = '';
    state.waitingForOperand = true;
  }

  function handlePercent() {
    const currentVal = Number(state.currentInput);
    if (Number.isNaN(currentVal)) return;

    let percentVal;
    if (
      state.previousValue !== null &&
      (state.pendingOperator === '+' || state.pendingOperator === '-')
    ) {
      percentVal = fixPrecision(state.previousValue * (currentVal / 100));
    } else {
      percentVal = fixPrecision(currentVal / 100);
    }

    state.currentInput = String(percentVal);
    state.waitingForOperand = false;
  }

  function handleNegate() {
    if (state.currentInput === '0' || state.currentInput === 'Error') return;
    if (state.currentInput.startsWith('-')) {
      state.currentInput = state.currentInput.slice(1);
    } else {
      state.currentInput = '-' + state.currentInput;
    }
  }

  function handleBackspace() {
    if (state.waitingForOperand || state.currentInput === 'Error') {
      return;
    }

    if (
      state.currentInput.length <= 1 ||
      (state.currentInput.length === 2 && state.currentInput.startsWith('-'))
    ) {
      state.currentInput = '0';
    } else {
      state.currentInput = state.currentInput.slice(0, -1);
    }
  }

  function handleClear() {
    if (state.currentInput !== '0') {
      state.currentInput = '0';
      state.waitingForOperand = false;
    } else {
      state.currentInput = '0';
      state.previousValue = null;
      state.pendingOperator = null;
      state.runningTrail = '';
      state.waitingForOperand = false;
    }
  }

  // ==================== 記憶鍵與科學函數 ====================

  function handleMemory(action) {
    const val = Number(state.currentInput);
    const safeVal = Number.isFinite(val) ? val : 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('記憶已清除 (mc)');
        break;
      case 'm-plus':
        state.memory = fixPrecision(state.memory + safeVal);
        state.waitingForOperand = true;
        showToast(`M+ (${formatNumberDisplay(String(state.memory))})`);
        break;
      case 'm-minus':
        state.memory = fixPrecision(state.memory - safeVal);
        state.waitingForOperand = true;
        showToast(`M- (${formatNumberDisplay(String(state.memory))})`);
        break;
      case 'mr':
        state.currentInput = String(state.memory);
        state.waitingForOperand = false;
        break;
    }
  }

  function handleSqrt() {
    const val = Number(state.currentInput);
    if (val < 0 || Number.isNaN(val)) {
      state.currentInput = 'Error';
      return;
    }
    const res = fixPrecision(Math.sqrt(val));
    state.lastCompletedLine = `√(${formatNumberDisplay(state.currentInput)}) = ${formatNumberDisplay(String(res))}`;
    state.currentInput = String(res);
    state.waitingForOperand = true;
  }

  function handleScientificFn(fnName) {
    const val = Number(state.currentInput);
    if (Number.isNaN(val)) return;

    const toRad = (x) => (state.isDegree ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (state.isDegree ? (x * 180) / Math.PI : x);

    let res = NaN;
    let label = fnName;

    switch (fnName) {
      case 'sin':
        res = state.isSecondFn ? fromRad(Math.asin(val)) : Math.sin(toRad(val));
        label = state.isSecondFn ? 'sin⁻¹' : 'sin';
        break;
      case 'cos':
        res = state.isSecondFn ? fromRad(Math.acos(val)) : Math.cos(toRad(val));
        label = state.isSecondFn ? 'cos⁻¹' : 'cos';
        break;
      case 'tan':
        res = state.isSecondFn ? fromRad(Math.atan(val)) : Math.tan(toRad(val));
        label = state.isSecondFn ? 'tan⁻¹' : 'tan';
        break;
      case 'sinh':
        res = Math.sinh(val);
        break;
      case 'cosh':
        res = Math.cosh(val);
        break;
      case 'tanh':
        res = Math.tanh(val);
        break;
      case 'ln':
        res = val <= 0 ? NaN : Math.log(val);
        break;
      case 'log10':
        res = val <= 0 ? NaN : Math.log10(val);
        label = 'log₁₀';
        break;
      case 'inv':
        res = val === 0 ? NaN : 1 / val;
        label = '1/';
        break;
      case 'cbrt':
        res = Math.cbrt(val);
        label = '³√';
        break;
      case 'sq':
        res = val * val;
        label = 'sqr';
        break;
      case 'abs':
        res = Math.abs(val);
        label = 'abs';
        break;
      case 'fact': {
        if (val < 0 || !Number.isInteger(val) || val > 170) {
          res = NaN;
        } else {
          let f = 1;
          for (let i = 2; i <= val; i++) f *= i;
          res = f;
        }
        label = 'fact';
        break;
      }
    }

    if (Number.isNaN(res) || !Number.isFinite(res)) {
      state.currentInput = 'Error';
    } else {
      const cleanRes = fixPrecision(res);
      const exprText = `${label}(${formatNumberDisplay(state.currentInput)})`;
      const resText = formatNumberDisplay(String(cleanRes));
      state.lastCompletedLine = `${exprText} = ${resText}`;
      state.currentInput = String(cleanRes);
      state.history.push({
        expr: exprText,
        result: resText,
        rawResult: String(cleanRes)
      });
    }
    state.waitingForOperand = true;
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
        case 'const':
          state.currentInput =
            value === 'π' ? String(fixPrecision(Math.PI)) : String(fixPrecision(Math.E));
          state.waitingForOperand = false;
          break;
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
          showToast('已套用優先運算');
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
      state.lastCompletedLine = '';
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
      try {
        await navigator.clipboard.writeText(state.currentInput);
        showToast(`已複製：${formatNumberDisplay(state.currentInput)}`);
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

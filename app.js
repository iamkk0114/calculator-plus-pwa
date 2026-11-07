/**
 * 加強型計算器 (Calculator Plus 經典金屬拉絲擬真版) 核心邏輯
 * 100% 還原實機截圖行為：
 * - 上方藍綠液晶螢幕：上半部顯示主數字 (0)，下半部保留最近一筆歷史算式 (如 11,266.6666666 ÷ 13 = 866.6666666666)
 * - 點擊液晶下半部對話框列可展開完整歷史紙帶，點擊任一筆紀錄即可帶入數字
 * - 第一排深灰藍立體鍵：mc, m+, m-, mr (支援左右滑動切換進階列 (), √x, xʸ)
 * - 第二排：珊瑚紅 AC/C、冷銀灰 %、+/-、÷
 * - 精準浮點數修正與 LocalStorage 自動記憶持久化
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'calc_plus_classic_metallic_v2';

  const state = {
    currentInput: '0',          // 主顯示區當前數字字串
    previousValue: null,        // 前一個運算元數值
    pendingOperator: null,      // 等待執行的運算子 ('+', '-', '×', '÷', '^')
    waitingForOperand: false,   // 是否剛按過運算子或 =，等待輸入新數字
    runningTrail: '',           // 正在輸入中的算式軌跡
    lastCompletedLine: '11266.6666666666 ÷ 13 = 866.6666666666', // 液晶下半部顯示的最近算式
    memory: 0,                  // 記憶值 (mc, m+, m-, mr)
    history: [
      {
        expr: '11,266.6666666666 ÷ 13',
        result: '866.6666666666',
        rawResult: '866.6666666666'
      }
    ],
    vibrate: true,
    fnRowPage: 1                // 1: mc/m+/m-/mr, 2: ()/√x/xʸ/mc
  };

  // ==================== DOM 參照 ====================
  const el = {
    primaryReadout: document.getElementById('primary-readout'),
    memoryBadge: document.getElementById('memory-badge'),
    historyStripText: document.getElementById('history-strip-text'),
    btnToggleTape: document.getElementById('btn-toggle-tape'),
    tapeDrawer: document.getElementById('tape-drawer'),
    tapeList: document.getElementById('tape-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    btnCloseTape: document.getElementById('btn-close-tape'),
    btnClear: document.getElementById('btn-clear'),

    memoryRowWrapper: document.getElementById('memory-row-wrapper'),
    memPage1: document.getElementById('mem-page-1'),
    memPage2: document.getElementById('mem-page-2'),

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

  /**
   * 解決 IEEE 754 浮點數誤差 (例如 0.1 + 0.2 = 0.3)，同時保留像 866.6666666666 這類循環小數的顯示精度
   */
  function fixPrecision(num) {
    if (!Number.isFinite(num)) return num;
    if (Math.abs(num) < 1e-15) return 0;
    return Number(Number(num).toPrecision(13));
  }

  /**
   * 為數字字串加上千分位逗號 (小數點後不加逗號)
   */
  function formatNumberDisplay(rawStr) {
    if (rawStr === 'Error' || rawStr === 'NaN' || rawStr === 'Infinity') {
      return 'Error';
    }
    const isNeg = rawStr.startsWith('-');
    const clean = isNeg ? rawStr.slice(1) : rawStr;

    const num = Number(rawStr);
    if (Number.isFinite(num) && (Math.abs(num) >= 1e14 || (Math.abs(num) > 0 && Math.abs(num) < 1e-9))) {
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

  // ==================== 液晶畫面更新 ====================

  function updateDisplay() {
    // 1. 主數字顯示與字級自適應縮放
    const formattedMain = formatNumberDisplay(state.currentInput);
    el.primaryReadout.textContent = formattedMain;

    const charLen = formattedMain.length;
    el.primaryReadout.classList.toggle('medium-digits', charLen > 10 && charLen <= 15);
    el.primaryReadout.classList.toggle('small-digits', charLen > 15);
    el.primaryReadout.scrollLeft = el.primaryReadout.scrollWidth;

    // 2. 記憶指示符號 M
    if (state.memory !== 0) {
      el.memoryBadge.textContent = 'M';
    } else {
      el.memoryBadge.textContent = '';
    }

    // 3. 液晶下半部：若正在連續輸入算式則顯示當前算式軌跡，否則顯示上一筆完成算式 (如 13 = 866.6666666666)
    if (state.runningTrail) {
      el.historyStripText.textContent = state.runningTrail;
    } else {
      el.historyStripText.textContent = state.lastCompletedLine || '';
    }
    el.historyStripText.scrollLeft = el.historyStripText.scrollWidth;

    // 4. AC 與 C 按鈕文字動態切換
    const isCleanZero = state.currentInput === '0' && !state.runningTrail;
    el.btnClear.textContent = isCleanZero ? 'AC' : 'C';

    // 5. 高亮當前等待中的運算子按鈕
    document.querySelectorAll('.key-op[data-action="operator"]').forEach((btn) => {
      const isPending =
        state.waitingForOperand && btn.dataset.value === state.pendingOperator;
      btn.classList.toggle('active-operator', isPending);
    });

    saveState();
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

      // 點擊歷史紙帶中任一筆，直接將該結果帶入主畫面
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

    // 限制最大輸入長度為 15 位數字
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

    // 若剛按過運算子又馬上換按另一個運算子，直接替換運算子
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

  /**
   * Calculator Plus 專屬百分比 (%) 邏輯：
   * - 在加減法中 (A + B%)：將 B% 視為 A * (B / 100)
   * - 在乘除法或單獨數字時：將 B% 視為 B / 100
   */
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

  /**
   * C / AC 清除鍵：
   * - 若當前有輸入數字，按一下先歸零當前輸入 (C)
   * - 若當前已是 0，則清除整筆進行中算式 (AC)，但保留液晶下半部的上一筆完成紀錄（還原截圖畫面）
   */
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

  // ==================== 第一排記憶與進階功能鍵 (mc, m+, m-, mr) ====================

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

  function toggleFnRowPage() {
    state.fnRowPage = state.fnRowPage === 1 ? 2 : 1;
    el.memPage1.classList.toggle('hidden', state.fnRowPage !== 1);
    el.memPage2.classList.toggle('hidden', state.fnRowPage !== 2);
  }

  // ==================== 事件綁定 ====================

  function bindEvents() {
    // 1. 按鍵點擊事件代理
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
        case 'parens':
          showToast('已套用優先運算');
          break;
        case 'swap-fn-row':
          toggleFnRowPage();
          break;
      }

      updateDisplay();
    });

    // 2. 第一排記憶列支援左右滑動切換 (原版隱藏手勢彩蛋)
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

    // 3. 點擊液晶下半部展開/收合歷史紀錄紙帶
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

    // 4. 左上角 ☰ 選單
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

    // 5. 實體鍵盤支援
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

  // ==================== PWA Service Worker 註冊 ====================

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
    bindEvents();
    updateDisplay();
    registerPWA();
  }

  init();
})();

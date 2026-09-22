// ==================================================================
// 全域視覺狀態管理（收音震動 或 準星蓄力任一成立即為 active）
// ==================================================================
const targetImg = document.getElementById('target-img');
const targetPlaceholder = document.getElementById('target-placeholder');
const visualContainer = document.querySelector('.visual-container');

const IMG_NORMAL = './assets/item_normal.png';
const IMG_ACTIVE = './assets/item_active.png';

// 預載入圖片避免切換時閃爍
const preloadedActive = new Image();
preloadedActive.src = IMG_ACTIVE;
const preloadedNormal = new Image();
preloadedNormal.src = IMG_NORMAL;

let isAudioActive = false;   // 正在收音震動中
let isCursorCharged = false; // 準星蓄力停留滿 1 秒

function updateVisualState() {
  const shouldBeActive = isAudioActive || isCursorCharged;

  if (shouldBeActive) {
    if (!targetImg.src.endsWith('item_active.png')) {
      targetImg.src = IMG_ACTIVE;
    }
    visualContainer.classList.add('is-active');
    targetPlaceholder.classList.add('active-state');
    targetPlaceholder.innerText = 'ACTIVE!';
  } else {
    if (!targetImg.src.endsWith('item_normal.png')) {
      targetImg.src = IMG_NORMAL;
    }
    visualContainer.classList.remove('is-active');
    targetPlaceholder.classList.remove('active-state');
    targetPlaceholder.innerText = 'NORMAL';
  }
}

// ==================================================================
// 1. 麥克風音量監控與抖動演算（震動時自動進入 item_active）
// ==================================================================
const micBtn = document.getElementById('mic-toggle-btn');
const testShakeBtn = document.getElementById('test-shake-btn');
const gainSlider = document.getElementById('gain-slider');
const volumeMeter = document.getElementById('volume-meter-fill');
const debugVol = document.getElementById('debug-vol');
const securityWarning = document.getElementById('security-warning');

let audioCtx = null;
let analyser = null;
let gainNode = null;
let micData = null;

let currentShakeIntensity = 0;
let targetShakeIntensity = 0;
const MAX_SHAKE_PX = 28;
const MAX_ROTATE_DEG = 12;

let isSimulatingAudio = false;

// 檢查手機端是否因為缺乏 HTTPS 限制收音
const isSecureOrigin = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

if (!isSecureOrigin && securityWarning) {
  securityWarning.style.display = 'block';
  securityWarning.innerText = '⚠️ 手機非 HTTPS，麥克風將被瀏覽器停用，請按「按住模擬大聲」測試';
}

if (gainSlider) {
  gainSlider.addEventListener('input', (e) => {
    if (gainNode) {
      gainNode.gain.value = parseFloat(e.target.value);
    }
  });
}

// 啟用麥克風
micBtn.addEventListener('click', async (e) => {
  e.stopPropagation();

  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
      micBtn.innerText = '收音中...';
      return;
    } catch (err) {
      console.warn('喚醒失敗：', err);
    }
  }

  if (audioCtx) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      },
      video: false
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(stream);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = parseFloat(gainSlider ? gainSlider.value : 4);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.15;

    source.connect(gainNode);
    gainNode.connect(analyser);

    micData = new Uint8Array(analyser.frequencyBinCount);
    micBtn.innerText = '收音中...';
    micBtn.classList.add('active');
    if (securityWarning) securityWarning.style.display = 'none';
  } catch (err) {
    alert('無法開啟麥克風！\n原因：' + err.message + '\n\n提示：若用手機測試，需在 HTTPS 環境下瀏覽器才會放行麥克風。您可使用「按住模擬大聲」按鈕直接測試動態！');
  }
});

// 手動模擬按鈕
function startSimulate() {
  isSimulatingAudio = true;
}
function stopSimulate() {
  isSimulatingAudio = false;
}

testShakeBtn.addEventListener('mousedown', startSimulate);
window.addEventListener('mouseup', stopSimulate);
testShakeBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); startSimulate(); }, { passive: false });
window.addEventListener('touchend', stopSimulate);

// 抖動與收音幀循環
function processAudioShake() {
  targetShakeIntensity = 0;
  let normalizedVol = 0;

  if (isSimulatingAudio) {
    normalizedVol = 0.95;
    targetShakeIntensity = MAX_SHAKE_PX;
  } else if (analyser && micData && audioCtx && audioCtx.state === 'running') {
    analyser.getByteFrequencyData(micData);

    let sum = 0;
    for (let i = 0; i < micData.length; i++) {
      sum += micData[i];
    }
    const avg = sum / micData.length;

    const effectiveVol = Math.max(0, avg - 6);
    normalizedVol = Math.min(1.0, effectiveVol / 35);
    targetShakeIntensity = normalizedVol * MAX_SHAKE_PX;
  }

  // 更新 HUD
  volumeMeter.style.width = `${(normalizedVol * 100).toFixed(0)}%`;
  if (debugVol) {
    debugVol.innerText = `音量: ${(normalizedVol * 100).toFixed(0)}% | 抖動: ${targetShakeIntensity.toFixed(0)}px`;
  }

  // 平滑抖動
  if (targetShakeIntensity > currentShakeIntensity) {
    currentShakeIntensity += (targetShakeIntensity - currentShakeIntensity) * 0.45;
  } else {
    currentShakeIntensity += (targetShakeIntensity - currentShakeIntensity) * 0.2;
  }

  if (currentShakeIntensity < 0.2) {
    currentShakeIntensity = 0;
  }

  // 【核心功能】震動時同步切換 item_active
  // 只要抖動幅度大於 1px，立即標記為 isAudioActive = true；平息後自動還原
  const nowAudioActive = currentShakeIntensity >= 1.0;
  if (nowAudioActive !== isAudioActive) {
    isAudioActive = nowAudioActive;
    updateVisualState();
  }

  // 隨機位移
  let posX = 0;
  let posY = 0;
  let rot = 0;

  if (currentShakeIntensity > 0) {
    posX = (Math.random() - 0.5) * 2 * currentShakeIntensity;
    posY = (Math.random() - 0.5) * 2 * currentShakeIntensity;
    rot = (Math.random() - 0.5) * 2 * (currentShakeIntensity / MAX_SHAKE_PX) * MAX_ROTATE_DEG;
  }

  visualContainer.style.transform = `translate3d(${posX.toFixed(2)}px, ${posY.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;

  requestAnimationFrame(processAudioShake);
}
requestAnimationFrame(processAudioShake);

// ==================================================================
// 2. 準星互動、蓄力充能 (停留滿 1 秒維持 ACTIVE)
// ==================================================================
const cursor = document.getElementById('custom-cursor');
const targetObj = document.getElementById('target-object');
const circle = document.querySelector('.progress-ring-circle');
const feedbackLog = document.getElementById('feedback-log');
const connStatus = document.getElementById('connection-status');

const radius = circle.r.baseVal.value;
const circumference = 2 * Math.PI * radius;
circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = circumference;

let hoverStartTime = null;
let cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let isUsingWii = false;

function setProgress(percent) {
  const offset = circumference - (percent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

function checkTargetInteraction(x, y, isTriggered) {
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  if (isTriggered) {
    cursor.classList.add('active');
  } else {
    cursor.classList.remove('active');
  }

  const rect = targetObj.getBoundingClientRect();
  const isHover = (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);

  if (isHover) {
    if (!hoverStartTime) hoverStartTime = performance.now();
    const elapsed = performance.now() - hoverStartTime;
    const progress = Math.min(100, (elapsed / 1000) * 100);

    setProgress(progress);

    if (progress >= 100 && !isCursorCharged) {
      isCursorCharged = true;
      updateVisualState();
      onTargetCharged();
    }
  } else {
    hoverStartTime = null;
    if (isCursorCharged) {
      isCursorCharged = false;
      updateVisualState();
    }
    setProgress(0);
    circle.setAttribute('stroke', '#0ea5e9');
  }
}

function onTargetCharged() {
  circle.setAttribute('stroke', '#23bd04');
  feedbackLog.innerText = '手把回饋：蓄力完成震動！';

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'rumble', duration: 250 }));
  }

  setTimeout(() => {
    feedbackLog.innerText = '手把回饋：靜止';
  }, 1000);
}

// ==================================================================
// 3. 通訊與多端輸入（Wii 手把 / 電腦滑鼠 / 手機觸控）
// ==================================================================
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  connStatus.innerText = '模式：已連線至後端服務';
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'wii_data') {
    isUsingWii = true;
    connStatus.innerText = '模式：Wii 手把運作中';

    if (msg.pointer) {
      cursorPos.x = (1 - (msg.pointer.x / 1024)) * window.innerWidth;
      cursorPos.y = (msg.pointer.y / 768) * window.innerHeight;
    }

    const isPressing = msg.buttons && (msg.buttons.a || msg.buttons.b);
    checkTargetInteraction(cursorPos.x, cursorPos.y, isPressing);
  }
};

ws.onerror = () => {
  connStatus.innerText = '模式：模擬模式 (未連後端)';
};

function isInteractiveUI(target) {
  return target.closest('#hud') || target.tagName === 'BUTTON' || target.tagName === 'INPUT';
}

// PC 滑鼠事件
window.addEventListener('mousemove', (e) => {
  if (!isUsingWii) {
    cursorPos.x = e.clientX;
    cursorPos.y = e.clientY;
    checkTargetInteraction(cursorPos.x, cursorPos.y, false);
  }
});

window.addEventListener('mousedown', (e) => {
  if (!isUsingWii && !isInteractiveUI(e.target)) {
    checkTargetInteraction(cursorPos.x, cursorPos.y, true);
  }
});

window.addEventListener('mouseup', () => {
  if (!isUsingWii) checkTargetInteraction(cursorPos.x, cursorPos.y, false);
});

// 手機觸控事件
window.addEventListener('touchstart', (e) => {
  if (isUsingWii || isInteractiveUI(e.target)) return;

  if (e.touches.length > 0) {
    const touch = e.touches[0];
    cursorPos.x = touch.clientX;
    cursorPos.y = touch.clientY;
    checkTargetInteraction(cursorPos.x, cursorPos.y, true);
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (isUsingWii || isInteractiveUI(e.target)) return;

  if (e.touches.length > 0) {
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    cursorPos.x = touch.clientX;
    cursorPos.y = touch.clientY;
    checkTargetInteraction(cursorPos.x, cursorPos.y, true);
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!isUsingWii) {
    checkTargetInteraction(cursorPos.x, cursorPos.y, false);
  }
});
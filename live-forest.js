// Shared geometry helpers for the forest interaction.
window.forestPoint = function (p, vw, vh, w, h) {
  const s = Math.max(w / vw, h / vh);
  return {
    x: w - (p.x * vw * s - (vw * s - w) / 2),
    y: p.y * vh * s - (vh * s - h) / 2
  };
};

window.forestCrosses = function (a, b, r) {
  let lo = 0, hi = 1;
  for (const [v, d, min, max] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
    if (Math.abs(d) < 1e-8) {
      if (v < min || v > max) return false;
    } else {
      let x = (min - v) / d;
      let y = (max - v) / d;
      if (x > y) [x, y] = [y, x];
      lo = Math.max(lo, x);
      hi = Math.min(hi, y);
      if (lo > hi) return false;
    }
  }
  return true;
};

window.forestSlash = function (points, zone, height) {
  if (points.length < 2) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const dt = (b.t - a.t) / 1000;
  const dy = b.y - a.y;
  if (dt <= 0 || dy < height * .045 || dy / dt < height * .7 || dy < Math.abs(b.x - a.x) * .6) return false;
  return points.slice(1).some((p, i) => forestCrosses(points[i], p, zone));
};

window.forestPlayer = { ready: false, busy: false };

(async () => {
  const host = document.getElementById('stage');
  const notice = document.getElementById('model-loading');
  const P = window.forestPlayer;

  try {
    if (!window.PIXI?.live2d || !window.Live2DCubismCore) {
      throw Error('模型播放器或 CubismCore 未正確載入');
    }

    const app = new PIXI.Application({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true
    });

    app.view.id = 'live-forest';
    host.insertBefore(app.view, document.getElementById('overlay'));

    // 自動依據當前網址解析正確的模型路徑
    const basePath = new URL('models/forest/', window.location.href).href;
    const modelPath = basePath + 'forest.model3.json';

    console.log('[Live2D] 正在載入模型：', modelPath);
    const model = await PIXI.live2d.Live2DModel.from(modelPath, {
      autoInteract: false,
      autoFocus: false,
      motionPreload: 'ALL'
    });

    const internal = model.internalModel;
    const core = internal.coreModel;

    // Cubism 5.3 Core 相容性修補 (renderOrders moved from drawables to model)
    const raw = core.getModel();
    if (!raw.drawables.renderOrders) {
      if (raw.offscreens?.count || !raw.renderOrders || raw.renderOrders.length !== raw.drawables.count) {
        throw Error('模型需要新版繪圖功能');
      }
      Object.defineProperty(raw.drawables, 'renderOrders', { get: () => raw.renderOrders });
    }

    app.stage.addChild(model);

    const values = { Param: 0, Param2: 0, Param5: 0, Param6: 0 };
    let transition = null;
    let revision = 0;

    // 載入 4 個動作表情檔
    const expressions = {};
    await Promise.all(['cut_top', 'cut_left', 'forestmove1', 'forestmove2'].map(async name => {
      const expUrl = basePath + name + '.exp3.json';
      const r = await fetch(expUrl);
      if (!r.ok) throw Error('缺少動作檔: ' + name);
      expressions[name] = await r.json();
    }));

    internal.on('beforeModelUpdate', () => {
      if (transition) {
        const t = Math.min(1, (performance.now() - transition.start) / transition.ms);
        const e = t * t * (3 - 2 * t);
        for (const id of Object.keys(transition.to)) {
          values[id] = transition.from[id] + (transition.to[id] - transition.from[id]) * e;
        }
        if (t === 1) {
          const end = transition.resolve;
          transition = null;
          end();
        }
      }
      for (const [id, value] of Object.entries(values)) {
        core.setParameterValueById(id, value);
      }
    });

    const expression = name => new Promise(resolve => {
      const e = expressions[name];
      const to = {};
      const from = {};
      for (const p of e.Parameters) {
        from[p.Id] = values[p.Id] ?? 0;
        to[p.Id] = p.Value;
      }
      transition = {
        from,
        to,
        resolve,
        start: performance.now(),
        ms: (e.FadeInTime ?? 1) * 1000
      };
    });

    const parts = [];
    for (let i = 0; i < core.getDrawableCount(); i++) {
      const b = internal.getDrawableBounds(i);
      parts.push({ i, cx: b.x + b.width / 2, cy: b.y + b.height / 2, area: b.width * b.height });
    }

    const trees = parts.slice().sort((a, b) => b.area - a.area).slice(0, 3);
    const top = trees.reduce((a, b) => a.cy < b.cy ? a : b);
    const lower = trees.filter(p => p !== top);
    const left = lower.reduce((a, b) => a.cx < b.cx ? a : b, lower[0] || top);

    function layout() {
      const size = Math.min(host.clientWidth * 0.72, host.clientHeight * 0.72, 470);
      model.scale.set(size / Math.max(internal.width, internal.height));
      model.position.set((host.clientWidth - model.width) / 2, host.clientHeight * 0.43 - model.height / 2);
    }

    new ResizeObserver(layout).observe(host);
    layout();

    P.bounds = step => {
      const b = internal.getDrawableBounds((step === 0 ? top : left).i);
      const a = model.toGlobal(new PIXI.Point(b.x, b.y));
      const z = model.toGlobal(new PIXI.Point(b.x + b.width, b.y + b.height));
      return {
        left: Math.min(a.x, z.x) - 12,
        right: Math.max(a.x, z.x) + 12,
        top: Math.min(a.y, z.y) - 12,
        bottom: Math.max(a.y, z.y) + 12
      };
    };

    P.cut = async step => {
      if (P.busy || !P.ready) return false;
      P.busy = true;
      const rev = revision;
      await expression(step === 0 ? 'cut_top' : 'cut_left');
      if (rev !== revision) return false;
      await expression(step === 0 ? 'forestmove1' : 'forestmove2');
      if (rev !== revision) return false;
      P.busy = false;
      return true;
    };

    P.reset = () => {
      revision++;
      if (transition) {
        const end = transition.resolve;
        transition = null;
        end();
      }
      for (const id of Object.keys(values)) values[id] = 0;
      P.busy = false;
    };

    P.debug = () => ({
      parts,
      values: { ...values },
      bounds: [P.bounds(0), P.bounds(1)],
      parameters: core._model.parameters.ids,
      canvas: [internal.width, internal.height]
    });

    P.ready = true;
    if (notice) notice.hidden = true;
    const wordElem = document.querySelector('.word');
    if (wordElem) wordElem.hidden = true;
    document.getElementById('demo').disabled = false;
    console.log('[Live2D] 森林模型載入成功！');

  } catch (e) {
    console.error('[Live2D 錯誤]', e);
    if (notice) notice.textContent = '模型載入中斷：' + e.message;
  }
})();
/* ============================================================
   mikuumi · 数字空间 — 页面脚本
   模块:星空背景 / 滚动显现 / 导航状态 / 光标光晕
   约定:全部包在 IIFE 内,不引入全局变量;每个模块独立容错。
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 星空背景 ---------- */
  function initStars() {
    const canvas = document.getElementById("stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let vw = 0, vh = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    function applySize() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
      canvas.style.width = vw + "px";
      canvas.style.height = vh + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    applySize();

    // 窄屏减量,兼顾移动端性能
    const COUNT = vw < 768 ? 90 : 180;
    // 大部分星点为青色,少量紫色,呼应品牌双色
    const stars = Array.from({ length: COUNT }, () => ({
      x: rand(0, vw),
      y: rand(0, vh),
      r: rand(0.5, 2.4),
      v: rand(0.05, 0.3),
      o: rand(0.25, 0.95),
      rgb: Math.random() < 0.82 ? "110,231,255" : "192,132,252",
      phase: rand(0, Math.PI * 2),
      twinkle: rand(0.4, 1.2)
    }));

    function draw(t) {
      ctx.clearRect(0, 0, vw, vh);
      const sec = t / 1000;
      for (const s of stars) {
        s.y -= s.v;
        if (s.y < -2) { s.y = vh + 2; s.x = rand(0, vw); }
        const a = reduceMotion ? s.o : s.o * (0.78 + 0.22 * Math.sin(sec * s.twinkle + s.phase));
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + s.rgb + "," + a.toFixed(3) + ")";
        ctx.arc(s.x, s.y, s.r, 0, 6.2832);
        ctx.fill();
      }
      if (!reduceMotion) requestAnimationFrame(draw);
    }

    let lastW = vw, lastH = vh;
    window.addEventListener("resize", () => {
      // 手机地址栏收展会触发 resize,尺寸没变就不重置画布
      if (window.innerWidth === lastW && window.innerHeight === lastH) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      applySize();
      if (reduceMotion) draw(performance.now()); // 静态模式重绘一帧
    }, { passive: true });

    if (reduceMotion) draw(performance.now());
    else requestAnimationFrame(draw);
  }

  /* ---------- 滚动显现 + 技能条填充 ---------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("visible"));
      return;
    }
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add("visible");
        en.target.querySelectorAll(".progress").forEach(bar => {
          bar.style.width = bar.dataset.width + "%";
        });
        io.unobserve(en.target); // 显现一次即可,停止观察
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 }); // 进入视口下沿前 10% 即触发,滚动节奏更连贯
    els.forEach(el => io.observe(el));
  }

  /* ---------- 导航状态:滚动加深 + 当前分区高亮 ---------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    if (!nav || !("IntersectionObserver" in window)) return;

    // 滚离页面顶部后加深导航底色(1px 哨兵元素,避免 0 高度元素的 IO 边界歧义)
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;";
    document.body.prepend(sentinel);
    new IntersectionObserver(([en]) => {
      nav.classList.toggle("scrolled", !en.isIntersecting);
    }).observe(sentinel);

    // 视口中线穿过哪个分区就高亮哪个链接
    const links = Array.from(document.querySelectorAll(".nav-links a"));
    const byId = {};
    links.forEach(a => {
      const id = (a.hash || "").slice(1);
      if (id && document.getElementById(id)) byId[id] = a;
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const link = byId[en.target.id];
        if (!link) return;
        links.forEach(l => l.classList.remove("active"));
        link.classList.add("active");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    Object.keys(byId).forEach(id => io.observe(document.getElementById(id)));
  }

  /* ---------- 光标光晕(仅精确指针设备) ---------- */
  function initGlow() {
    if (reduceMotion) return;
    const glow = document.querySelector(".cursor-glow");
    if (!glow) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let tx = -500, ty = -500, x = tx, y = ty, raf = 0;
    const step = () => {
      raf = 0;
      x += (tx - x) * 0.18; // 轻微插值,让光晕有拖尾质感
      y += (ty - y) * 0.18;
      glow.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      if (Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) raf = requestAnimationFrame(step);
    };
    window.addEventListener("mousemove", e => {
      tx = e.clientX - 175;
      ty = e.clientY - 175;
      if (!raf) raf = requestAnimationFrame(step); // 合帧,避免高频布局写入
    }, { passive: true });
  }

  /* ---------- 启动:模块间互相独立,单个失败不影响其余 ---------- */
  const modules = [initStars, initReveal, initNav, initGlow];
  function boot() { modules.forEach(fn => { try { fn(); } catch (err) { /* 单模块降级 */ } }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

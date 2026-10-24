(function () {
  "use strict";
  const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, "0");
  const KEY = "prompt2patch-dashboard-v3";
  const MODES = [["fit", "Fit"], ["r45", "4:5"], ["stretch", "Stretch"], ["crop", "Crop"]];
  const MOODS = [["focus", "Focus"], ["groove", "Groove"], ["hype", "Hype"]];
  /* ---- Edit these freely ---- */
  const TIPS = ["Read the error message twice before you touch the code.", "Prompt smart, patch faster.", "Reproduce the bug first, then fix it.", "Small change, run the tests, repeat.", "Explain the bug to your AI like a teammate.", "Check the logs before you blame the code.", "Every 404 has a story, find it.", "Find it. Fix it. Repeat."];
  const MILESTONES = [[1800, "30 minutes left, start wrapping up your fixes!"], [900, "15 minutes left, final push!"], [600, "10 minutes to go, make sure your patch is submitted!"], [300, "5 minutes left, last checks!"], [60, "1 minute! Wrap it up!"]];

  let cfg = { total: 135 * 60, vol: 50, focus: 30, mode: "fit", mood: "groove" };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")) } catch (e) { }
  if (!MODES.some(m => m[0] === cfg.mode)) cfg.mode = "fit";
  if (!MOODS.some(m => m[0] === cfg.mood)) cfg.mood = "groove";
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch (e) { } };

  /* ---------- Ticker (rotating tips + milestone messages) ---------- */
  let holdUntil = 0, tipI = 0;
  function say(msg, hot) {
    const t = $("ticker"); t.style.opacity = 0;
    setTimeout(() => { t.textContent = msg; t.classList.toggle("hot", !!hot); t.style.opacity = 1 }, 350);
    if (hot) holdUntil = Date.now() + 12000;
  }
  function nextTip() { if (Date.now() < holdUntil) return; say(TIPS[tipI++ % TIPS.length], false) }
  $("ticker").textContent = TIPS[0]; setInterval(nextTip, 9000);

  /* ---------- Timer ---------- */
  let total = cfg.total, left = total, running = false, endAt = 0, tick = null, lock = null, fired = new Set(), lastTick = -1;
  const clockTime = ms => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  function render() {
    $("clock").textContent = pad(Math.floor(left / 3600)) + ":" + pad(Math.floor(left % 3600 / 60)) + ":" + pad(left % 60);
    $("fill").style.width = (total ? left / total * 100 : 0) + "%";
    const r = left / total, t = $("timer");
    t.classList.toggle("warn", left > 0 && r <= .25 && r > .1);
    t.classList.toggle("crit", left > 0 && r <= .1);
    t.classList.toggle("last10", running && left > 0 && left <= 10);
    t.classList.toggle("done", left === 0);
    $("label").textContent = left === 0 ? "Time's Up!" : running ? "Time Remaining · Ends " + clockTime(endAt) : left === total ? "Ready" : "Paused";
  }
  function milestones() {
    if (total >= 900 && !fired.has("half") && left <= total / 2) { fired.add("half"); say("Halfway there, keep patching! 🔧", true) }
    MILESTONES.forEach(([s, m]) => { if (total > s && left <= s && !fired.has(s)) { fired.add(s); say(m, true) } });
    if (left > 0 && left <= 10 && lastTick !== left) { lastTick = left; Music.tick(left) }
  }
  function loop() {
    left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)); render(); milestones();
    if (!left) { stop(); Music.chime(); say("🎉 Time's up! Pens down!", true); party() }
  }
  async function wake() { try { if (navigator.wakeLock && !document.hidden) lock = await navigator.wakeLock.request("screen") } catch (e) { } }
  function resetFlags() { fired.clear(); lastTick = -1 }
  function begin() {
    if (left <= 0) return; Music.prime();
    fired.clear(); MILESTONES.forEach(([s]) => { if (left <= s) fired.add(s) }); if (left <= total / 2) fired.add("half"); lastTick = -1;
    endAt = Date.now() + left * 1000; running = true; tick = setInterval(loop, 250); $("start").textContent = "⏸ Pause"; render(); wake();
    if (left === total) say("Let's go! Find it. Fix it. Ship it. 🚀", true);
  }
  function stop() { running = false; clearInterval(tick); $("start").textContent = "▶ Start"; render() }
  function fillInputs() { $("h").value = Math.floor(total / 3600); $("m").value = Math.floor(total % 3600 / 60); $("s").value = total % 60 }
  function setTotal(sec) { stop(); resetFlags(); total = left = Math.max(1, Math.min(86399, Math.floor(sec))); cfg.total = total; save(); fillInputs(); render() }
  function adj(min) { left = Math.max(0, left + min * 60); total = Math.max(total, left); if (running) endAt = Date.now() + left * 1000; render() }
  $("start").onclick = () => running ? stop() : begin();
  $("reset").onclick = () => { stop(); resetFlags(); left = total; render() };
  $("set").onclick = () => setTotal((+$("h").value || 0) * 3600 + (+$("m").value || 0) * 60 + (+$("s").value || 0));
  $("m1").onclick = () => adj(-1); $("p1").onclick = () => adj(1);
  document.querySelectorAll("[data-m]").forEach(b => b.onclick = () => setTotal(+b.dataset.m * 60));
  fillInputs(); render();
  document.addEventListener("visibilitychange", () => { if (running) wake() });

  /* ---------- Control panel: manual hide / show ---------- */
  function panel(open) { $("ctrl").classList.toggle("hidden", !open); $("gear").classList.toggle("hidden", open); if (open) awake() }
  document.addEventListener("contextmenu", e => { e.preventDefault(); panel($("ctrl").classList.contains("hidden")) });
  $("hide").onclick = () => panel(false); $("gear").onclick = () => panel(true);
  let idleT; function awake() { document.body.classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add("idle"), 4000) }
  ["mousemove", "mousedown", "touchstart"].forEach(ev => document.addEventListener(ev, awake));

  /* ---------- Fullscreen & image mode ---------- */
  const fs = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  $("fs").onclick = fs;
  document.addEventListener("dblclick", e => { if (!e.target.closest("#ctrl")) fs() });
  document.addEventListener("fullscreenchange", () => $("fs").textContent = document.fullscreenElement ? "⛶ Exit fullscreen" : "⛶ Fullscreen");
  function applyMode() {
    MODES.forEach(m => document.body.classList.remove(m[0])); document.body.classList.add(cfg.mode);
    $("mode").textContent = "Image: " + MODES.find(m => m[0] === cfg.mode)[1];
  }
  $("mode").onclick = () => { cfg.mode = MODES[(MODES.findIndex(m => m[0] === cfg.mode) + 1) % MODES.length][0]; save(); applyMode() };
  $("focus").value = cfg.focus; document.documentElement.style.setProperty("--focus", cfg.focus + "%");
  $("focus").oninput = e => { cfg.focus = +e.target.value; document.documentElement.style.setProperty("--focus", cfg.focus + "%"); save() };
  applyMode();

  /* ---------- Music ---------- */
  const icon = () => $("mute").textContent = Music.isMuted() || cfg.vol === 0 ? "🔇" : "🔊";
  const moodLabel = () => { $("moodBtn").textContent = "Mood: " + MOODS.find(m => m[0] === cfg.mood)[1] };
  Music.onInfo(txt => $("now").textContent = txt);
  Music.setVolume(cfg.vol / 100); $("vol").value = cfg.vol; icon();
  Music.setMood(cfg.mood); moodLabel();
  $("music").onclick = () => { $("music").textContent = "♪ Music: " + (Music.toggle() ? "On" : "Off") };
  $("moodBtn").onclick = () => { cfg.mood = MOODS[(MOODS.findIndex(m => m[0] === cfg.mood) + 1) % MOODS.length][0]; save(); Music.setMood(cfg.mood); moodLabel() };
  $("mute").onclick = () => { Music.setMuted(!Music.isMuted()); icon() };
  $("vol").oninput = e => { cfg.vol = +e.target.value; save(); Music.setVolume(cfg.vol / 100); icon() };
  $("test").onclick = () => Music.chime();
  $("party").onclick = () => party();

  /* ---------- Floating code bits behind the timer ---------- */
  (function () {
    const cv = $("bits"), c = cv.getContext && cv.getContext("2d"); if (!c) return;
    const G = ["{ }", "</>", "404", "fix()", "=>", "git", "0x1F", "#", "bug", "patch", "✓", "&&", "find()", "repeat()"];
    let W = 1, H = 1, last = 0;
    const mk = init => ({ x: Math.random(), y: init ? Math.random() : 1.1, s: .5 + Math.random() * .8, v: .02 + Math.random() * .035, t: G[Math.floor(Math.random() * G.length)], a: .07 + Math.random() * .12 });
    const P = Array.from({ length: 18 }, () => mk(true));
    function size() { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; W = cv.width = Math.max(1, Math.round(r.width * d)); H = cv.height = Math.max(1, Math.round(r.height * d)) }
    if (window.ResizeObserver) new ResizeObserver(size).observe(cv); size();
    function draw(now) {
      requestAnimationFrame(draw); if (now - last < 33) return; const dt = Math.min(.1, (now - last) / 1000); last = now;
      c.clearRect(0, 0, W, H); c.textAlign = "center";
      P.forEach((p, i) => {
        p.y -= p.v * dt; if (p.y < -.1) P[i] = mk(false);
        c.font = "700 " + Math.round(H * .13 * p.s) + "px Consolas,monospace";
        c.fillStyle = "rgba(255,150,50," + (p.a * Math.min(1, Math.max(0, p.y * 3))).toFixed(3) + ")";
        c.fillText(p.t, p.x * W, p.y * H);
      });
    }
    requestAnimationFrame(draw);
  })();

  /* ---------- Confetti (time's up / test) ---------- */
  function party() {
    const cv = $("confetti"), c = cv.getContext && cv.getContext("2d"); if (!c) return;
    cv.width = innerWidth; cv.height = innerHeight;
    const col = ["#ff8a1f", "#ffb347", "#ffffff", "#4fc3ff", "#ff5fa2", "#ffd54a"];
    const P = Array.from({ length: 190 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height * .6, vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: col[Math.floor(Math.random() * col.length)] }));
    const t0 = performance.now();
    (function f(now) {
      const e = now - t0; c.clearRect(0, 0, cv.width, cv.height);
      P.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .04; p.r += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.max(0, Math.min(1, (7000 - e) / 1500)); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore() });
      if (e < 7000) requestAnimationFrame(f); else c.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  /* ---------- Shortcuts ---------- */
  document.addEventListener("keydown", e => {
    awake(); if (e.target.type === "number") return;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); $("start").click() }
    else if (k === "r") $("reset").click(); else if (k === "p") $("music").click(); else if (k === "n") $("moodBtn").click();
    else if (k === "m") $("mute").click(); else if (k === "f") fs(); else if (k === "i") $("mode").click();
    else if (k === "h") panel($("ctrl").classList.contains("hidden"));
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const v = Math.max(0, Math.min(100, cfg.vol + (e.key === "ArrowUp" ? 5 : -5))); $("vol").value = v; $("vol").dispatchEvent(new Event("input")) }
  });
  awake();
})();
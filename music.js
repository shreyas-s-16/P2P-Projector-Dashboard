/* Generative instrumental that never repeats. Moods: Focus (calm), Groove (default, gently upbeat), Hype (livelier).
   Everything is soft sine/pluck sounds, low-passed, so it keeps energy up without being harsh. */
(function (g) {
  "use strict";
  const KEYS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const MAJ = [0, 2, 4, 5, 7, 9, 11], PENT = [0, 2, 4, 7, 9];
  const NEXT = { 0: [3, 3, 5, 5, 1, 4, 2], 5: [3, 3, 1, 4, 0], 3: [0, 0, 4, 5, 1], 1: [4, 4, 3, 0], 4: [0, 0, 5, 3], 2: [5, 3] };
  const MOODS = {
    focus: { name: "Focus", bpm: [62, 74], en: [.2, .5], drums: 0, arp: 0, mel: [.08, .10], len: [2.2, 3.6], gap: .3 },
    groove: { name: "Groove", bpm: [92, 104], en: [.5, .8], drums: 1, arp: .5, mel: [.12, .14], len: [1.2, 2.4], gap: .12 },
    hype: { name: "Hype", bpm: [108, 120], en: [.65, .95], drums: 2, arp: .7, mel: [.16, .14], len: [.9, 1.8], gap: .1 }
  };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12), clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let ctx, master, verb, delay, dry, noiseBuf, seq = null, dog = null, onInfo = () => { };
  let on = false, muted = false, vol = .5, timers = [], mood = "groove", M = MOODS.groove;
  let root = 50, energy = .6, bpm = 98, nextT = 0, step = 0, mel = 2, ap = 0, dir = 1, pendRoot = null, evoN = 0, cdeg = 0;
  const nt = (d, o) => root + MAJ[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + o);
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function setup() {
    if (ctx) return;
    ctx = new (g.AudioContext || g.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 6;     // keeps peaks from getting loud
    verb = ctx.createConvolver();
    const n = Math.floor(ctx.sampleRate * 3.5), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++)d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) }
    verb.buffer = buf;
    const vg = ctx.createGain(); vg.gain.value = .5;
    delay = ctx.createDelay(2); delay.delayTime.value = .375;
    const fb = ctx.createGain(); fb.gain.value = .3;
    const dg = ctx.createGain(); dg.gain.value = .35;
    delay.connect(fb); fb.connect(delay); delay.connect(dg); dg.connect(verb);
    const vlp = ctx.createBiquadFilter(); vlp.type = "lowpass"; vlp.frequency.value = 2000; verb.connect(vlp); vlp.connect(vg); vg.connect(master);
    dry = ctx.createGain(); dry.gain.value = .75; dry.connect(master);
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3000; tone.Q.value = .5; master.connect(tone); tone.connect(comp); comp.connect(ctx.destination);
    const nb = Math.floor(ctx.sampleRate), b2 = ctx.createBuffer(1, nb, ctx.sampleRate), d2 = b2.getChannelData(0);
    for (let i = 0; i < nb; i++)d2[i] = Math.random() * 2 - 1;
    noiseBuf = b2;
  }
  function voice(type, f, t, a, peak, hold, rel, send, dest) {
    const o = ctx.createOscillator(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; o.detune.value = rnd(-6, 6);
    lp.type = "lowpass"; lp.frequency.value = type === "sine" ? 3000 : 1500;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + a);
    gn.gain.setValueAtTime(peak, t + a + hold); gn.gain.linearRampToValueAtTime(0, t + a + hold + rel);
    o.connect(lp); lp.connect(gn); gn.connect(dest || dry);
    if (!dest) { gn.connect(verb); if (send) gn.connect(delay) }
    o.start(t); o.stop(t + a + hold + rel + .1);
  }
  function noise(t, dur, type, freq, peak, dest, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    gn.gain.setValueAtTime(peak, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(gn); gn.connect(dest); s.start(t); s.stop(t + dur + .05);
  }
  function kick(t, peak, dest) {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(45, t + .18);
    gn.gain.setValueAtTime(peak, t); gn.gain.exponentialRampToValueAtTime(.0001, t + .35);
    o.connect(gn); gn.connect(dest || dry); o.start(t); o.stop(t + .4);
  }
  function soft(m, t, peak, len, send) { // soft felt-piano / pluck style note
    const f = hz(m), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = "sine"; o2.type = "sine"; o1.frequency.value = f; o2.frequency.value = f * 2; o1.detune.value = rnd(-4, 4); g2.gain.value = .16;
    lp.type = "lowpass"; lp.frequency.value = 1600;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + .012); gn.gain.exponentialRampToValueAtTime(.0001, t + len);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(gn); gn.connect(dry); gn.connect(verb); if (send) gn.connect(delay);
    o1.start(t); o2.start(t); o1.stop(t + len + .1); o2.stop(t + len + .1);
  }
  function info() { onInfo(M.name + " · " + KEYS[root % 12] + " major · " + Math.round(bpm) + " BPM") }
  function newChord(t) {
    if (pendRoot !== null) { root = pendRoot; pendRoot = null; info() }
    cdeg = pick(NEXT[cdeg] || [0]);
    const dur = 16 * 30 / bpm;
    [0, 2, 4, 6].forEach(s => voice("sine", hz(nt(cdeg + s, 0)), t, rnd(1.5, 2.5), .03, dur * .5, rnd(2, 3), false));            // warm pad
    if (!M.drums) soft(nt(cdeg, -1), t, .11, 4, false);                                                              // soft bass (Focus)
    [0, 2, 4, 6, 7].forEach((s, i) => { if (i < 2 || Math.random() < .8) soft(nt(cdeg + s, 0), t + i * M.gap, rnd(.06, .09), 3, true) }); // rolled chord
  }
  function sequencer() {
    if (!on) return;
    while (nextT < ctx.currentTime + .4) {
      const i = step++, t = nextT, e = energy, bar = i % 8; nextT += 30 / bpm;           // one step = an eighth note
      if (i % 16 === 0) newChord(t);
      if (M.drums) {
        if (bar === 0 || (M.drums > 1 && bar === 4) || (bar === 6 && Math.random() < .25)) kick(t, .11 + e * .04);               // soft kick
        if (bar === 4) noise(t, .09, "bandpass", 1500, .03 + e * .02, dry, .8);                                       // soft snap
        if (i % 2 === 1 && (M.drums > 1 || Math.random() < .6)) noise(t, .04, "bandpass", 3200, .01 + e * .008, dry, 1);        // muted tick
        if (bar === 0 || (bar === 6 && Math.random() < .4)) soft(nt(cdeg, -1), t, .1, 1.1, false);                       // bass pluck
      }
      if (M.arp && Math.random() < M.arp) { // up-and-down chord arpeggio with the odd jump
        if (Math.random() < .15) ap = Math.floor(rnd(0, 4)); else { ap += dir; if (ap > 3 || ap < 0) { dir = -dir; ap = clamp(ap, 0, 3) } }
        soft(nt(cdeg + [0, 2, 4, 7][ap], 0), t, (i % 4 === 0 ? .05 : .03) + e * .015, .9, true);
      }
      if (Math.random() < M.mel[0] + e * M.mel[1]) { // sparse pentatonic melody
        mel = clamp(mel + pick([-2, -1, -1, 1, 1, 2]), -2, 5);
        soft(root + 12 + PENT[((mel % 5) + 5) % 5] + 12 * Math.floor(mel / 5), t, .06 + e * .025, rnd(M.len[0], M.len[1]), true);
      }
    }
  }
  function evolve() { // every 20-40 s: energy and tempo drift inside the mood's range; key moves by a fifth now and then
    if (!on) return;
    energy = clamp(energy + rnd(-.2, .2), M.en[0], M.en[1]); bpm = clamp(bpm + rnd(-3, 3), M.bpm[0], M.bpm[1]);
    if (++evoN % 5 === 0) { let r = root + pick([5, 7, -5, -7]); while (r < 46) r += 12; while (r > 59) r -= 12; pendRoot = r }
    info(); later(evolve, rnd(20000, 40000));
  }
  function setMood(name) {
    mood = MOODS[name] ? name : "groove"; M = MOODS[mood];
    energy = rnd(M.en[0], M.en[1]); bpm = Math.round(rnd(M.bpm[0], M.bpm[1]));
    if (on) info();
  }
  function applyVol() { if (master) master.gain.setTargetAtTime(muted || !on ? 0 : vol * 1.5, ctx.currentTime, .4) }
  function start() {
    setup(); ctx.resume(); setMood(mood);
    root = pick([48, 50, 53, 55, 57]); cdeg = 0; mel = 2; ap = 0; dir = 1; step = 0; pendRoot = null; evoN = 0;
    nextT = ctx.currentTime + .2; on = true; applyVol(); info(); later(evolve, rnd(20000, 30000));
    seq = setInterval(sequencer, 100);
    dog = setInterval(() => { if (on && ctx.state === "suspended") ctx.resume() }, 3000);
  }
  function stop() { on = false; timers.forEach(clearTimeout); timers = []; clearInterval(seq); clearInterval(dog); applyVol(); onInfo("") }

  /* Game-show style "time's up" fanfare: snare roll -> brass stabs -> big final chord + crash + bell sparkle */
  function brass(midis, t, dur, peak, dest) {
    midis.forEach(m => [-7, 7].forEach(dt => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = dt; f.type = "lowpass";
      f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + .07); f.frequency.linearRampToValueAtTime(1400, t + dur);
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(peak, t + .03); gn.gain.setValueAtTime(peak, t + dur * .8); gn.gain.linearRampToValueAtTime(0, t + dur + .25);
      o.connect(f); f.connect(gn); gn.connect(dest); o.start(t); o.stop(t + dur + .3);
    }));
  }
  function bell(m, t, peak, dest) {
    [1, 2.76, 5.4].forEach((k, i) => {
      const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(m) * k;
      gn.gain.setValueAtTime(peak / (i + 1), t); gn.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
      o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + 1.5);
    });
  }
  function chime() {
    setup(); ctx.resume();
    const t0 = ctx.currentTime + .05, fx = ctx.createGain(); fx.gain.value = .9; fx.connect(ctx.destination);
    if (on) { master.gain.setTargetAtTime(vol * .2, ctx.currentTime, .1); setTimeout(applyVol, 7000) }
    for (let i = 0, t = 0; t < 1.2; i++) { noise(t0 + t, .09, "bandpass", 2200, .1 + t * .25, fx, .7); t += Math.max(.04, .16 - i * .012) }
    const T = t0 + 1.25;
    [0, .24, .48].forEach(d => brass([41, 53, 57, 60, 65], T + d, .16, .1, fx));          // da-da-da (F major)
    brass([36, 48, 55, 60, 64, 67, 72], T + .8, 1.7, .12, fx);                           // DAAA (C major)
    noise(T + .8, 2.6, "highpass", 4000, .28, fx); kick(T + .8, .6, fx); kick(T + .8, .4, fx);
    [84, 88, 91, 96, 100, 103, 108].forEach((m, i) => bell(m, T + .9 + i * .09, .12, fx));
  }
  function tick(n) { // soft blip for the last 10 seconds, pitch rises as time runs out
    if (muted || vol === 0) return;
    setup(); ctx.resume();
    const t = ctx.currentTime + .01, o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = "sine"; o.frequency.value = hz(72 + (10 - n));
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.2 * Math.max(vol, .4), t + .01); gn.gain.exponentialRampToValueAtTime(.0001, t + .25);
    o.connect(gn); gn.connect(ctx.destination); o.start(t); o.stop(t + .3);
  }
  g.Music = {
    prime: () => { setup(); ctx.resume() }, start, stop, chime, tick, setMood,
    getMood: () => mood, moodName: () => M.name,
    toggle: () => { on ? stop() : start(); return on },
    isOn: () => on, isMuted: () => muted,
    setVolume: v => { vol = clamp(v, 0, 1); if (vol > 0) muted = false; applyVol() },
    setMuted: b => { muted = b; applyVol() },
    onInfo: fn => { onInfo = fn }
  };
})(window);
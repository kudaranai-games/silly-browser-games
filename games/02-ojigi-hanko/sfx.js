// 効果音を Web Audio で合成する。音声ファイルは使わない。
// ブラウザの制限で、最初の音はユーザー操作（押す）の中で鳴らす必要がある。

export function createSfx() {
  let ac = null;
  let muted = false;

  function ctx() {
    if (muted) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  function tone(type, freqFrom, freqTo, start, duration, gain) {
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime + start;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise(start, duration, gain, cutoff) {
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime + start;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(a.destination);
    src.start(t0);
  }

  return {
    // 自分のハンコ: ポンッ
    pon() {
      tone("sine", 420, 160, 0, 0.09, 0.35);
    },
    // 着地の衝撃。strength は 0〜1。
    thud(strength = 1) {
      tone("sine", 140, 38, 0, 0.35 + 0.25 * strength, 0.9 * strength);
      noise(0, 0.12 + 0.12 * strength, 0.6 * strength, 900);
    },
    // 承認のファンファーレ（チープさが大事）
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.1 + i * 0.11, i === 3 ? 0.6 : 0.14, 0.25));
    },
    // 差し戻しのブザー
    buzzer() {
      tone("square", 110, 105, 0.08, 0.22, 0.18);
      tone("square", 110, 98, 0.36, 0.45, 0.18);
    },
    setMuted(value) {
      muted = value;
    },
  };
}

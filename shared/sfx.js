// 効果音を Web Audio で合成するための部品。音声ファイルは使わない。
// ブラウザの制限で、最初の音はユーザー操作（タップなど）の中で鳴らす必要がある。

export function createSynth() {
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

  // start 秒後から duration 秒、周波数を freqFrom → freqTo へ動かしながら鳴らす
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

  // ローパスをかけたノイズ（衝撃音・息の音など）
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
    tone,
    noise,
    setMuted(value) {
      muted = value;
    },
  };
}

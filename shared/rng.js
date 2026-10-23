// 乱数のヘルパー。rng は [0, 1) を返す関数（Math.random か mulberry32 で作ったもの）。

// 32bit シードから [0, 1) の乱数列を返す関数を作る（mulberry32）。テストで結果を再現したいときに使う。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [min, max] の範囲の実数
export function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

// [min, max] の範囲の整数（両端を含む）
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

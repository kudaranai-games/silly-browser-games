// 車両とホームと乗客の物理世界。DOM に依存しないので、テストから本物の Matter.js で動かせる。
// 座標はキャンバスの論理座標（400×640、y は下向き）。

// 車両の断面。左の壁の下側が開いていてドアになる。
export const CAR = {
  left: 150, // 車内の左端（左の壁の内側）
  right: 382, // 車内の右端
  top: 120, // 天井の内側
  floor: 470, // 床の高さ（ホームと同じ）
  wall: 10, // 左の壁の厚さ。左の壁は CAR.left - wall 〜 CAR.left
  doorTop: 250, // ドアの開口部の上端
};
// ホーム（画面左端から車両の左の壁まで）
export const PLATFORM = { left: 0, right: CAR.left - CAR.wall, floor: CAR.floor };

const STEP_MS = 1000 / 60;
// 1ステップ（1/60秒）を細かく分けて進める。ドアの上の壁（厚さ10）をすり抜けないよう、
// 1回の更新で動く距離（MAX_SPEED / SUBSTEPS）を壁の厚さより十分小さくする。
const SUBSTEPS = 3;
// 投げたときの速さの上限（1/60秒あたりの px）
const MAX_SPEED = 22;
// ホームで乗客が現れる位置（x）と、次の乗客が現れるまでの間隔
const SPAWN_SLOTS = [34, 100];
const SPAWN_GAP_MS = 300;
// 回転のしにくさの倍率
const UPRIGHT = 4;

// data: game.json。rng: [0, 1) を返す関数（乗客の種類を決める）
export function createWorld(Matter, data, rng) {
  const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const passengers = [];
  let held = null; // ドラッグ中の { body, constraint }
  let spawnWait = 0;
  let frozen = false;

  Composite.add(engine.world, walls(Bodies));

  function spawn(type = pickWeighted(rng, data.passengers), x = SPAWN_SLOTS[0], y = CAR.floor - type.h / 2 - 30) {
    const body = Bodies.rectangle(x, y, type.w, type.h, {
      chamfer: { radius: Math.min(type.w, type.h) * 0.3 },
      density: type.density,
      friction: type.friction,
      frictionAir: 0.01,
      restitution: 0.05,
      label: type.id,
    });
    // 人は倒れにくくする（満員電車らしく立ったまま詰まる）。おじさんは回すので、そのまま。
    if (!type.spin) Body.setInertia(body, body.inertia * UPRIGHT);
    const p = { id: passengers.length, type, body };
    passengers.push(p);
    Composite.add(engine.world, body);
    return p;
  }

  // 空いている出現位置に、次の乗客を出す（上から降ってきてホームに立つ）
  function refill(ms) {
    spawnWait -= ms;
    if (spawnWait > 0 || passengers.length >= data.maxPassengers) return;
    const bodies = passengers.map((p) => p.body);
    const x = SPAWN_SLOTS.find((sx) => Query.region(bodies, { min: { x: sx - 28, y: CAR.floor - 150 }, max: { x: sx + 28, y: CAR.floor } }).length === 0);
    if (x === undefined) return;
    const type = pickWeighted(rng, data.passengers);
    spawn(type, x);
    spawnWait = SPAWN_GAP_MS;
  }

  function step(ms = STEP_MS) {
    if (frozen) return;
    for (let i = 0; i < SUBSTEPS; i++) {
      // 速さは Matter の基準（1/60秒あたり）で読み書きする
      for (const { body, type } of passengers) {
        // おじさんはなぜか回転する（つかまれている間も）
        if (type.spin && Math.abs(Body.getAngularVelocity(body)) < type.spin) Body.setAngularVelocity(body, type.spin);
        const v = Body.getVelocity(body);
        const speed = Math.hypot(v.x, v.y);
        if (speed > MAX_SPEED) Body.setVelocity(body, { x: (v.x / speed) * MAX_SPEED, y: (v.y / speed) * MAX_SPEED });
      }
      Engine.update(engine, STEP_MS / SUBSTEPS);
    }
    refill(ms);
  }

  // (x, y) にいる乗客をつかむ。つかめたら true
  function grab(x, y) {
    if (frozen) return false;
    release();
    const hit = Query.point(passengers.map((p) => p.body), { x, y })[0];
    if (!hit) return false;
    // 重心を引っぱる。つかんだ点を引っぱると体がねじれて、投げた人が寝転がってしまう。
    const constraint = Constraint.create({ pointA: { x, y }, bodyB: hit, stiffness: 0.2, damping: 0.05, length: 0 });
    Composite.add(engine.world, constraint);
    held = { body: hit, constraint };
    return true;
  }

  function drag(x, y) {
    if (!held) return;
    held.constraint.pointA = { x, y };
  }

  // 離すと、そのときの勢いのまま飛んでいく
  function release() {
    if (!held) return;
    Composite.remove(engine.world, held.constraint);
    held = null;
  }

  // ドアが閉まりきった瞬間の判定。ドアと重なっている乗客は挟まれている。
  function closeDoor() {
    release();
    frozen = true;
    const door = Bodies.rectangle(CAR.left - CAR.wall / 2, (CAR.doorTop + CAR.floor) / 2, CAR.wall, CAR.floor - CAR.doorTop, { isStatic: true });
    const pinchedBodies = new Set(Query.collides(door, passengers.map((p) => p.body)).map((c) => (c.bodyA === door ? c.bodyB : c.bodyA)));
    const pinched = passengers.filter((p) => pinchedBodies.has(p.body));
    const inside = passengers.filter((p) => !pinchedBodies.has(p.body) && isInside(p.body.position));
    return { inside: inside.length, pinched: pinched.length, pinchedIds: pinched.map((p) => p.id) };
  }

  return {
    engine,
    passengers,
    step,
    grab,
    drag,
    release,
    closeDoor,
    isHolding: () => held !== null,
    // 今、車内にいる人数（遊んでいる途中の表示用）
    insideCount: () => passengers.filter((p) => isInside(p.body.position)).length,
    // テスト用: 指定の種類の乗客を指定の位置に置く
    place(typeId, x, y) {
      return spawn(data.passengers.find((t) => t.id === typeId), x, y);
    },
  };
}

// 車内にいるか（重心が車内の四角に入っているか）
export function isInside({ x, y }) {
  return x > CAR.left && x < CAR.right && y > CAR.top && y < CAR.floor;
}

function walls(Bodies) {
  const s = { isStatic: true, friction: 0.6, label: "wall" };
  // すり抜け防止のため、どの壁も外側へ厚くとる
  return [
    Bodies.rectangle(200, CAR.floor + 50, 600, 100, s), // 床とホーム
    Bodies.rectangle(CAR.right + 50, 300, 100, 800, s), // 車両の右の壁（画面の右端まで）
    Bodies.rectangle((CAR.left - CAR.wall + CAR.right) / 2, CAR.top - 30, CAR.right - CAR.left + CAR.wall, 60, s), // 天井
    Bodies.rectangle(CAR.left - CAR.wall / 2, (CAR.top - 60 + CAR.doorTop) / 2, CAR.wall, CAR.doorTop - CAR.top + 60, s), // ドアの上の壁
    Bodies.rectangle(-50, 300, 100, 800, s), // 画面の左端
    Bodies.rectangle(200, -60, 600, 100, s), // 画面の上端
  ];
}

export function pickWeighted(rng, list) {
  const total = list.reduce((sum, t) => sum + t.weight, 0);
  let r = rng() * total;
  for (const t of list) {
    r -= t.weight;
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

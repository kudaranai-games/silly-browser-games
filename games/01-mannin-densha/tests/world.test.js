// 物理世界のテスト。公開用と同じ Matter.js を node で動かす。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorld, isInside, CAR, PLATFORM } from "../logic/world.js";
import { mulberry32 } from "../../../shared/rng.js";
import { loadMatter } from "./load-matter.js";

const data = JSON.parse(readFileSync(new URL("../data/game.json", import.meta.url), "utf8"));
const Matter = loadMatter();
// 乗客が勝手に出てこない世界（置いた乗客だけで試す）
const noSpawn = { ...data, maxPassengers: 0 };

function run(world, steps) {
  for (let i = 0; i < steps; i++) world.step();
}

test("車内に置いた乗客は床に立ち、車内に数えられる", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const p = w.place("salaryman", 300, 300);
  run(w, 120);
  assert.ok(isInside(p.body.position));
  assert.ok(Math.abs(p.body.position.y - (CAR.floor - p.type.h / 2)) < 3, `y=${p.body.position.y}`);
  assert.deepEqual(w.closeDoor(), { inside: 1, pinched: 0, pinchedIds: [], specials: 0, bonus: 0 });
});

test("ホームにいる乗客は車内に数えない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  w.place("student", 60, 400);
  run(w, 60);
  assert.deepEqual(w.closeDoor(), { inside: 0, pinched: 0, pinchedIds: [], specials: 0, bonus: 0 });
});

test("ドアの位置にいる乗客は挟まれ、車内にも数えない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const inDoor = w.place("salaryman", CAR.left - CAR.wall / 2, CAR.floor - 36);
  const inCar = w.place("salaryman", 300, CAR.floor - 36);
  const result = w.closeDoor();
  assert.deepEqual(result, { inside: 1, pinched: 1, pinchedIds: [inDoor.id], specials: 0, bonus: 0 });
  assert.notEqual(inCar.id, inDoor.id);
});

test("体の大部分が車内でも、ドアにかかっていれば挟まれていて、車内に数えない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  // 重心は車内（x > CAR.left）だが、左端がドアの位置にはみ出している
  const p = w.place("salaryman", CAR.left + 10, CAR.floor - 36);
  assert.ok(isInside(p.body.position));
  assert.deepEqual(w.closeDoor(), { inside: 0, pinched: 1, pinchedIds: [p.id], specials: 0, bonus: 0 });
});

test("ドアの上の壁に引っかかっている乗客は挟まれていない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  // 開口部より上（壁の高さ）にいる。重力で落ちる前に判定する
  w.place("student", CAR.left - CAR.wall / 2, CAR.doorTop - 40);
  assert.equal(w.closeDoor().pinched, 0);
});

test("ホームの乗客をつかんで車内へ引っぱって離すと、車内に入る", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const p = w.place("salaryman", 60, CAR.floor - 36);
  run(w, 30);
  const { x, y } = p.body.position;
  assert.equal(w.grab(x, y), true);
  assert.equal(w.isHolding(), true);
  for (let i = 1; i <= 30; i++) {
    w.drag(x + i * 8, y - 40);
    w.step();
  }
  w.release();
  assert.equal(w.isHolding(), false);
  run(w, 120);
  assert.ok(isInside(p.body.position), JSON.stringify(p.body.position));
  // 離したら宙に止まらず、床まで落ちる
  assert.ok(p.body.position.y > CAR.floor - p.type.h, `y=${p.body.position.y}`);
});

test("何もないところはつかめない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  w.place("salaryman", 60, CAR.floor - 36);
  assert.equal(w.grab(300, 200), false);
  assert.equal(w.isHolding(), false);
});

test("ドアが閉まったあとは、物理が止まり、つかめない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const p = w.place("salaryman", 300, 200);
  w.closeDoor();
  const before = { ...p.body.position };
  run(w, 30);
  assert.deepEqual(p.body.position, before);
  assert.equal(w.grab(before.x, before.y), false);
});

test("ホームには乗客が補充され、上限を超えない", () => {
  const w = createWorld(Matter, { ...data, maxPassengers: 6 }, mulberry32(3));
  run(w, 60);
  const waiting = w.passengers.filter((p) => p.body.position.x < PLATFORM.right);
  assert.equal(waiting.length, 2, "ホームの2か所に1人ずつ");
  // ホームの乗客を車内へ移すと、また補充される。何度やっても上限で止まる
  for (let round = 0; round < 6; round++) {
    for (const p of w.passengers.filter((q) => q.body.position.x < PLATFORM.right)) {
      Matter.Body.setPosition(p.body, { x: 200 + 30 * (p.id % 6), y: 160 });
      Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
    }
    run(w, 60);
  }
  assert.equal(w.passengers.length, 6);
});

test("おじさんは回転し続ける", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const p = w.place("ojisan", 300, 300);
  run(w, 60);
  const spin = (b) => Math.abs(Matter.Body.getAngularVelocity(b));
  assert.ok(spin(p.body) > 0.05, `${spin(p.body)}`);
  const s = w.place("salaryman", 200, 300);
  run(w, 60);
  assert.ok(spin(s.body) < 0.05, `${spin(s.body)}`);
});

test("ドアの上の薄い壁に向かって思い切り投げても、すり抜けて車内に入らない", () => {
  const stuck = [];
  for (const speed of [40, 60, 90, 140]) {
    const w = createWorld(Matter, noSpawn, mulberry32(1));
    const p = w.place("student", 100, (CAR.top + CAR.doorTop) / 2);
    Matter.Body.setVelocity(p.body, { x: speed, y: 0 });
    run(w, 3);
    if (p.body.position.x > CAR.left) stuck.push({ speed, x: p.body.position.x });
  }
  assert.deepEqual(stuck, []);
});

test("思い切り投げても、壁をすり抜けて画面の外へ出ない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(5));
  const rng = mulberry32(7);
  for (let i = 0; i < 25; i++) {
    const p = w.place(data.passengers[i % data.passengers.length].id, 60 + rng() * 40, 380);
    Matter.Body.setVelocity(p.body, { x: 60 * (rng() - 0.3), y: -60 * rng() });
  }
  run(w, 300);
  const outside = w.passengers
    .map((p) => p.body.position)
    .filter(({ x, y }) => !(x > 0 && x < 400 && y > -20 && y < CAR.floor) || !Number.isFinite(x));
  assert.deepEqual(outside, []);
});

test("車内の特別な乗客だけがボーナスになり、挟まった特別な乗客はならない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  w.place("climber", 300, CAR.floor - 42);
  w.place("salaryman", 200, CAR.floor - 36);
  const pinchedGuitar = w.place("guitar", CAR.left - CAR.wall / 2, CAR.floor - 50);
  const outsidePlush = w.place("plush", 50, CAR.floor - 34);
  const r = w.closeDoor();
  assert.deepEqual(r, { inside: 2, pinched: 1, pinchedIds: [pinchedGuitar.id], specials: 1, bonus: 30 });
  assert.ok(outsidePlush);
});

test("駆け込み乗車の人は、空いている車内へ自分で飛び込む", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  // ホームで待っている人の頭の上を越えていく（ぶつからないので、待っている人は動かない）
  const waiting = [w.place("guitar", 34, CAR.floor - 50), w.place("climber", 100, CAR.floor - 42)];
  run(w, 30);
  const before = waiting.map((p) => p.body.position.x);
  const r = w.launchRunner();
  assert.ok(r);
  run(w, 120);
  assert.ok(isInside(r.body.position), JSON.stringify(r.body.position));
  assert.equal(r.dashing, false);
  const moved = waiting.filter((p, i) => Math.abs(p.body.position.x - before[i]) > 3).map((p) => p.type.id);
  assert.deepEqual(moved, []);
});

test("駆け込み乗車の人は、ドアの近くに乗客がいても、ドアで止まらずに奥へ進む", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  w.place("salaryman", CAR.left + 20, CAR.floor - 36);
  w.place("salaryman", CAR.left + 54, CAR.floor - 36);
  run(w, 30);
  const r = w.launchRunner();
  run(w, 120);
  assert.ok(isInside(r.body.position) && r.body.position.x > CAR.left + 30, `runner x=${r.body.position.x}`);
  assert.equal(w.closeDoor().pinched, 0);
});

test("駆け込み乗車の人は1回だけ。ドアが閉まったあとは来ない", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  assert.ok(w.launchRunner());
  assert.equal(w.launchRunner(), null);
  const w2 = createWorld(Matter, noSpawn, mulberry32(1));
  w2.closeDoor();
  assert.equal(w2.launchRunner(), null);
  assert.equal(w2.passengers.length, 0);
});

test("駆け込み乗車の人は、つかまれたら走るのをやめる", () => {
  const w = createWorld(Matter, noSpawn, mulberry32(1));
  const r = w.launchRunner();
  run(w, 3);
  assert.equal(r.dashing, true);
  assert.equal(w.grab(r.body.position.x, r.body.position.y), true);
  // ホームの方へ引き戻す
  for (let i = 0; i < 40; i++) {
    w.drag(40, CAR.floor - 40);
    w.step();
  }
  assert.equal(r.dashing, false);
  assert.ok(r.body.position.x < PLATFORM.right, `x=${r.body.position.x}`);
});

test("駆け込み乗車の人は、混んだ車内でも前へ押し進み、たいていは中まで入る", () => {
  // 混み具合と乱数を変えた8通り。押し進む力がないと、ドアで挟まったりホームへ跳ね返されたりする
  const results = [];
  for (const n of [10, 14]) {
    for (const seed of [1, 2, 3, 4]) {
      const rng = mulberry32(seed);
      const w = createWorld(Matter, noSpawn, rng);
      for (let i = 0; i < n; i++) {
        w.place(data.passengers[Math.floor(rng() * 5)].id, 170 + rng() * 200, 200);
        run(w, 20);
      }
      run(w, 120);
      const r = w.launchRunner();
      run(w, 120);
      const c = w.closeDoor();
      results.push(isInside(r.body.position) && !c.pinchedIds.includes(r.id));
    }
  }
  assert.ok(results.filter(Boolean).length >= 7, JSON.stringify(results));
});

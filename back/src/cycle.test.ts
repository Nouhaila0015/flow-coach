import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeCycle, cycleLengths, phaseRanges } from './cycle.js';

const STARTS = ['2026-06-29', '2026-07-27', '2026-08-22', '2026-09-25'];

test('longueurs des cycles entre débuts consécutifs', () => {
  assert.deepEqual(cycleLengths(STARTS), [28, 26, 34]);
});

test('exemple des maquettes : J18 en phase lutéale', () => {
  const c = computeCycle(STARTS, 5, '2026-10-12')!;
  assert.equal(c.averageLength, 29); // (28 + 26 + 34) / 3 = 29,3
  assert.equal(c.day, 18);
  assert.equal(c.ovulationDay, 15);
  assert.equal(c.phase, 'luteale');
  assert.equal(c.shortest, 26);
  assert.equal(c.longest, 34);
});

test('bornes des phases pour un cycle de 29 jours et 5 jours de règles', () => {
  assert.deepEqual(phaseRanges(29, 5), [
    { phase: 'menstruelle', from: 1, to: 5 },
    { phase: 'folliculaire', from: 6, to: 13 },
    { phase: 'ovulatoire', from: 14, to: 16 },
    { phase: 'luteale', from: 17, to: null },
  ]);
  const at = (date: string) => computeCycle(STARTS, 5, date)!.phase;
  assert.equal(at('2026-09-25'), 'menstruelle'); // J1
  assert.equal(at('2026-09-29'), 'menstruelle'); // J5
  assert.equal(at('2026-09-30'), 'folliculaire'); // J6
  assert.equal(at('2026-10-07'), 'folliculaire'); // J13
  assert.equal(at('2026-10-08'), 'ovulatoire'); // J14
  assert.equal(at('2026-10-10'), 'ovulatoire'); // J16
  assert.equal(at('2026-10-11'), 'luteale'); // J17
});

test('règles en retard : on reste en lutéale, sans prédiction', () => {
  const c = computeCycle(STARTS, 5, '2026-11-20')!; // J57
  assert.equal(c.day, 57);
  assert.equal(c.phase, 'luteale');
});

test('cycles courts : la phase menstruelle est prioritaire', () => {
  // cycle moyen de 20 jours → ovulation J6, règles de 7 jours
  const ranges = phaseRanges(20, 7);
  assert.deepEqual(ranges[0], { phase: 'menstruelle', from: 1, to: 7 });
  assert.ok(!ranges.some((r) => r.phase === 'folliculaire'));
  assert.equal(ranges.find((r) => r.phase === 'luteale')!.from, 8);
  const c = computeCycle(['2026-01-01', '2026-01-21', '2026-02-10'], 7, '2026-02-15')!; // J6
  assert.equal(c.phase, 'menstruelle');
});

test('moyenne limitée aux 6 derniers cycles', () => {
  const starts = ['2025-01-01', '2025-03-02']; // premier cycle de 60 jours, exclu ensuite
  let d = new Date(2025, 2, 2, 12);
  for (let i = 0; i < 6; i++) {
    d = new Date(d.getTime() + 28 * 86_400_000);
    starts.push(d.toISOString().slice(0, 10));
  }
  const c = computeCycle(starts, 5, starts[starts.length - 1])!;
  assert.equal(c.averageLength, 28);
  assert.equal(c.longest, 60);
});

test('données insuffisantes ou dates futures ignorées', () => {
  assert.equal(computeCycle(['2026-09-25'], 5, '2026-10-12'), null);
  assert.equal(computeCycle(['2026-09-25', '2026-10-20'], 5, '2026-10-12'), null);
});

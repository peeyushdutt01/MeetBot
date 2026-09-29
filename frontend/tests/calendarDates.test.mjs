import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, defaultSlot, isInMonth } from '../src/utils/calendarDates.mjs';

test('month grid starts on Monday and covers a leap day', () => {
  const days = calendarDays(new Date(2024, 1, 1));
  assert.equal(days.length, 35);
  assert.equal(days[0].getDay(), 1);
  assert.equal(days[0].getMonth(), 0);
  assert.equal(days.at(-1).getMonth(), 2);
  assert.ok(days.some(day => day.getMonth() === 1 && day.getDate() === 29));
});

test('month grid expands to six rows when needed', () => {
  const month = new Date(2026, 7, 1);
  const days = calendarDays(month);
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(days.filter(day => isInMonth(day, month)).length, 31);
});

test('new meeting slot uses the selected day for one hour', () => {
  const day = new Date(2026, 9, 14);
  const { start, end } = defaultSlot(day, new Date(2026, 8, 30));
  assert.equal(start.getHours(), 9);
  assert.equal(end - start, 60 * 60 * 1000);
});

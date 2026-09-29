export const sameDay = (a, b) => a.toDateString() === b.toDateString();

export const isInMonth = (date, month) =>
  date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();

export const calendarDays = (month) => {
  const leadingDays = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1));
};

export const defaultSlot = (day, now = new Date()) => {
  const start = new Date(day);
  if (sameDay(start, now)) {
    start.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
};

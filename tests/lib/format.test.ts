import { compactNumber, dateTime, money, shortDate } from '../../lib/format';

describe('lib/format', () => {
  it('formats peso values consistently', () => {
    expect(money(1234.5)).toBe('₱1,234.50');
    expect(money('99.9')).toBe('₱99.90');
    expect(money('bad-input')).toBe('₱0.00');
  });

  it('formats dates for the PH locale', () => {
    const value = '2026-04-06T08:15:00.000Z';

    expect(shortDate(value)).toMatch(/abr|apr/i);
    expect(dateTime(value)).toMatch(/abr|apr/i);
  });

  it('formats compact numbers without crashing', () => {
    expect(compactNumber(1200)).toMatch(/1(\.|,)2\s?k/i);
  });
});

import { describe } from 'node:test';
import { format } from 'util';

function describeEach(rows) {
  return (
    /** @type {string} */
    message,
    fn
  ) => {
    for (const row of rows) {
      const countFormatting = message.replaceAll('%%', '').split('%').length - 1;

      describe(format(message, ...row.slice(0, countFormatting)), () => fn(...row));
    }
  };
}

exports = { describeEach };

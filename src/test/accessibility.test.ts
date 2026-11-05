import { expect, test } from 'vitest';
import { expectAccessible } from './accessibility';

test('rejects an unnamed button with a rule-specific diagnostic', async () => {
  const container = document.createElement('main');
  container.append(document.createElement('button'));
  document.body.append(container);

  try {
    await expect(expectAccessible(container)).rejects.toThrow('button-name');
  } finally {
    container.remove();
  }
});

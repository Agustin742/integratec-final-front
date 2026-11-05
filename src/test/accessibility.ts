import axe from 'axe-core';

export async function expectAccessible(container: HTMLElement): Promise<void> {
  const { violations } = await axe.run(container, {
    // jsdom has no layout/canvas support; check contrast in a real browser.
    rules: { 'color-contrast': { enabled: false } },
  });

  if (violations.length > 0) {
    throw new Error(
      violations
        .map(
          ({ id, help, nodes }) =>
            `${id}: ${help}\n${nodes.map(({ html }) => html).join('\n')}`,
        )
        .join('\n\n'),
    );
  }
}

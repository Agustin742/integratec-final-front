import axe from 'axe-core';

export interface ExpectAccessibleOptions {
  /** Axe rule ids to skip, each justified at the call site. */
  readonly disabledRules?: readonly string[];
}

export async function expectAccessible(
  container: HTMLElement,
  { disabledRules = [] }: ExpectAccessibleOptions = {},
): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: {
      // jsdom has no layout/canvas support; check contrast in a real browser.
      'color-contrast': { enabled: false },
      ...Object.fromEntries(
        disabledRules.map((rule) => [rule, { enabled: false }]),
      ),
    },
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

import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint();

describe('ESLint security rules (FD1 mitigation)', () => {
  test('rejects dangerouslySetInnerHTML in React components', async () => {
    const [result] = await eslint.lintText(
      `export function UnsafeHtml({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
`,
      { filePath: 'src/app/UnsafeHtml.tsx' },
    );

    expect(result).toBeDefined();
    expect(result?.errorCount).toBeGreaterThan(0);
    expect(
      result?.messages.some(
        (message) =>
          message.ruleId === 'no-restricted-syntax' &&
          message.message.includes('dangerouslySetInnerHTML'),
      ),
    ).toBe(true);
  });

  test('allows standard safe JSX text rendering', async () => {
    const [result] = await eslint.lintText(
      `export function SafeText({ content }: { content: string }) {
  return <div>{content}</div>;
}
`,
      { filePath: 'src/app/SafeText.tsx' },
    );

    expect(result).toBeDefined();
    expect(result?.errorCount).toBe(0);
  });
});

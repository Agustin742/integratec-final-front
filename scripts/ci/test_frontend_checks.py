"""Execute the frontend CI shell boundary with isolated package fixtures."""
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASH = shutil.which('bash') or 'bash'
RUNNER = ROOT / 'scripts/ci/run_frontend_check.sh'
SCRIPTS = ('lint', 'format:check', 'typecheck', 'test', 'build')


class FrontendChecks(unittest.TestCase):
    def test_workflow_wiring(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertLess(workflow.index('corepack enable'), workflow.index('uses: actions/setup-node'))
        self.assertIn('node-version: 22', workflow)
        self.assertIn('cache: pnpm', workflow)
        self.assertIn('cache-dependency-path: pnpm-lock.yaml', workflow)
        for script in SCRIPTS:
            self.assertIn(f'bash scripts/ci/run_frontend_check.sh {script}', workflow)
        self.assertIn('name: Summarize frontend checks\n        if: always()', workflow)

    def test_script_results(self):
        for script in SCRIPTS:
            for present, status in ((False, 0), (True, 0), (True, 7)):
                with self.subTest(script=script, present=present, status=status), tempfile.TemporaryDirectory(
                        prefix='.fixtures-', dir=RUNNER.parent) as scratch:
                    folder = Path(scratch)
                    package = json.dumps({'scripts': {script: 'fixture'} if present else {}})
                    (folder / 'package.json').write_text(package)
                    (folder / 'output').write_text('')
                    (folder / 'summary').write_text('')
                    assignments = (
                        f'cd {shlex.quote(folder.relative_to(ROOT).as_posix())}\n'
                        'export GITHUB_OUTPUT=output GITHUB_STEP_SUMMARY=summary\n'
                        f'pnpm() {{ echo "pnpm $*"; return {status}; }}\n'
                        'export -f pnpm\n'
                    )
                    # Fixtures are direct children of scripts/ci.
                    runner = '../run_frontend_check.sh'
                    result = subprocess.run([BASH, '-e'], cwd=ROOT,
                        input=(assignments + f'bash {runner} {shlex.quote(script)}\n').encode(),
                        capture_output=True)
                    expected_stdout = f'pnpm {script}\n' if present else (
                        '::notice title=Tests not configured::No test script is configured; no tests were run.\n'
                        if script == 'test' else
                        f'::notice title=Frontend check not configured::No {script} script is configured; check skipped.\n')
                    self.assertEqual((result.returncode, result.stdout.decode(), result.stderr.decode()),
                                     (status if present else 0, expected_stdout, ''))
                    outcome = ('Passed' if status == 0 else 'Failed') if present else 'Skipped (script absent)'
                    self.assertEqual((folder / 'output').read_text(), f'result={outcome}\n')
                    self.assertEqual((folder / 'package.json').read_text(), package)
                    self.assertEqual((folder / 'summary').read_text(),
                        '## Tests not configured\nNo `test` script is configured in `package.json`; no tests were run.\n'
                        if not present and script == 'test' else '')

    def test_summary_fallbacks(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        section = workflow.split('      - name: Summarize frontend checks\n', 1)[1]
        script = section.split('        run: |\n', 1)[1]
        with tempfile.TemporaryDirectory(prefix='.fixtures-', dir=RUNNER.parent) as scratch:
            summary = Path(scratch) / 'summary'
            env = {**os.environ, 'GITHUB_STEP_SUMMARY': summary.as_posix(),
                   'LINT': 'Passed', 'FORMAT': 'Failed', 'TYPECHECK': 'Skipped (script absent)',
                   'TEST': 'Skipped (setup failed or no package)', 'BUILD': 'Passed'}
            result = subprocess.run([BASH, '-e'], input=script.encode(), capture_output=True, env=env)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, b'', b''))
            self.assertEqual(summary.read_text(),
                '## Frontend checks\n| Check | Result |\n| --- | --- |\n'
                '| lint | Passed |\n| format:check | Failed |\n| typecheck | Skipped (script absent) |\n'
                '| test | Skipped (setup failed or no package) |\n| build | Passed |\n')


if __name__ == '__main__':
    unittest.main()

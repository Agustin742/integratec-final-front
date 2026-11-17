# PR #77 authentication review follow-ups

All ten review comments are addressed and passed independent authentication verification. The corrections are committed locally; publication and current-head Linux CI remain pending. No merge or issue closure is claimed.

## Review disposition

| Comment                                  | Resolution                                                                                                      | Evidence                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1. Honest logout cleanup warning         | Cleanup failure takes precedence over server confirmation; the warning does not claim credentials were removed. | Shell tests cover both server outcomes.                    |
| 2. Authenticated password-reset access   | Reset is reachable signed in or out; successful confirmation clears local credentials and private caches.       | Reset component tests and desktop/mobile E2E.              |
| 3. Default `/` return notice             | The default target no longer shows the notice; safe links and hostile-target fallback remain intact.            | Login component tests.                                     |
| 4. Credentials after failed verification | Failed login/profile renewal clears its credentials without clearing a newer session.                           | Controller tests and four independent late-renewal probes. |
| 5. Failed-login state                    | Failed login becomes unauthenticated; unavailable storage retains an honest uncertainty state.                  | Controller tests.                                          |
| 6. Reset cancellation                    | Expected aborts are silent; unmounts and stale responses cannot clear replacement credentials or caches.        | Reset suites and two independent unmount probes.           |
| 7. Safe API error detail                 | Non-401 login retains safe field errors and correlation IDs; generic 401, refresh and logout remain sanitized.  | Transport and login tests.                                 |
| 8. Shared validators                     | Email normalization and UTF-8 password checks share one implementation; compatibility exports remain available. | Schema tests and actual historical-source differential.    |
| 9. Shell refs                            | Synchronous duplicate-click protection remains to prevent duplicate toasts; the mounted ref was removed.        | Rapid-click test asserts one request and one toast.        |
| 10. Unused descriptions                  | Removed unused login/reset descriptions; page titles remain.                                                    | Static reference search.                                   |

Production return targets currently allow only exact `/`; no additional production destination was invented for testing.

## Observed verification

- Parent, Node 22.23.4: lint, typecheck, 474/474 tests across 41 files, production build and security check passed. Build chunk-size and JSXEmptyExpression lint advisories remain.
- Playwright: 46/46 desktop/mobile cases passed, including authenticated reset and URL/history secret handling.
- Independent isolated authentication verification: 180/180 tests across 12 files passed, including six additional race/unmount probes; no actionable candidate regression found.
- Actual base/current schema differential: 390 outcomes and seven constants matched, including data, DTOs and complete validation errors. Independent verification corroborated the candidate module hashes.
- Configured formatting passed after pure CRLF-to-LF normalization of 134 Git-clean files. Preservation checks confirmed unchanged logical tracked/staged diffs and the four pre-existing untracked files.
- Parent documentation validation passed for 63 files; whitespace checks passed before final evidence reconciliation.

## Open proof and delivery limits

- The initial application-check attempt used Node 24 and was rejected by engine-strict before tests. Subsequent explicit Node 22 checks passed; the earlier rejection is retained as setup evidence.
- Python CI failed on CRLF shell bytes. The authorized environment continuation exhausted its one correction: the isolated unchanged suite still passed only 7/8 tests, with 15 failing Node/WSL subcases. This is not a live-suite pass.
- The continuation's documentation check failed before validation because WSL Git rejected Windows worktree metadata. It does not replace or erase the earlier parent documentation result.
- The first independent typecheck exited 2 because its scratch copy omitted the API-sync module, causing one missing-module and three dependent implicit-any diagnostics. A separately human-authorized bounded continuation copied the original module and its adjacent declaration into fresh scratch; independent typecheck then passed with empty stdout/stderr. Preservation checks confirmed all original inputs and the earlier snapshot unchanged; the earlier failure remains recorded.
- Independent source-integrity proof found zero unexpected mutations. Optional handoff-file generation failed before writes; the verifier returned its report directly.
- Native assessment classified each source work unit as high risk. Candidate-specific native review was declined for all three units; no lineage was created or native approval claimed. Independent security verification remains the observed outside proof.
- No live-backend integration or deployment is verified (FD9). Publication, current-head Linux CI and teammate approval remain separate prerequisites.

See the [quality rules](../rules/quality-and-testing.md), [authentication rules](../rules/authentication-and-session.md) and [routing guide](./routing.md). The acting contributor's [tracker](../changelogs/tracker-alejo.md) records the current handoff.

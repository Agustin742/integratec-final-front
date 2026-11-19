import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomSubmissionsStore,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
  type SubmissionStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { profile } from '@/session/test-fixtures';
import type { SessionService } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import type { StudentActivityResponseDto } from '../activity-schema';
import { activityMessages } from '../messages';
import { formatActivityDeadline } from '../format-activity-deadline';
import { SubmissionPanel } from './submission-panel';
import { submissionMessages } from './submission-messages';
import {
  MAX_SUBMISSION_FILES,
  MAX_SUBMISSION_FILE_BYTES,
} from './submission-service';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
});

afterAll(() => {
  mswServer.close();
});

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000201';
const ACTIVITY_ID = '00000000-0000-4000-8000-0000000005a1';
const UNKNOWN_ACTIVITY_ID = '00000000-0000-4000-8000-000000000942';
const COPY = submissionMessages.panel;

const PDF_BYTES = new TextEncoder().encode(
  '%PDF-1.4\n% synthetic submission\n',
);

function makePdfFile(name = 'tp1.pdf'): File {
  return new File([PDF_BYTES], name, { type: 'application/pdf' });
}

function makeActivityDto(
  overrides: Partial<StudentActivityResponseDto> = {},
): StudentActivityResponseDto {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Ecuaciones',
    description: 'Resolver los ejercicios 1 a 5.',
    opensAt: null,
    // Far in the future of any plausible test clock: the window is open.
    dueAt: '2999-12-31T23:59:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    questions: [],
    ...overrides,
  };
}

function makeStoreActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Ecuaciones',
    description: 'Resolver los ejercicios 1 a 5.',
    opensAt: null,
    dueAt: '2999-12-31T23:59:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeStoredSubmission(
  overrides: Partial<SubmissionStoreItem> = {},
): SubmissionStoreItem {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    activityId: ACTIVITY_ID,
    submittedAt: '2026-11-18T12:00:00.000Z',
    isLate: false,
    status: 'submitted',
    files: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        originalName: 'tp1.pdf',
        contentType: 'application/pdf',
        sizeBytes: PDF_BYTES.byteLength,
        position: 0,
      },
    ],
    idempotencyKey: '11111111-2222-4333-8444-555555555555',
    ...overrides,
  };
}

function makeStore(
  overrides: Partial<
    Parameters<typeof createClassroomSubmissionsStore>[0]
  > = {},
) {
  return createClassroomSubmissionsStore({
    baseUrl: TEST_API_BASE_URL,
    role: 'STUDENT',
    activity: makeStoreActivity(),
    ...overrides,
  });
}

/**
 * Session service whose controller also satisfies the XHR session port
 * (`getAccessToken`/`refreshAccessToken`), exactly like the service tests'
 * synthetic port. The typed client points at MSW.
 */
function makePanelSession() {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const { service } = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  return {
    service: {
      ...service,
      controller: {
        ...service.controller,
        getAccessToken: () => 'synthetic-access',
        refreshAccessToken: vi.fn(async () => 'synthetic-refreshed'),
      },
    } as unknown as SessionService,
    client,
  };
}

function renderPanel(activity: StudentActivityResponseDto) {
  const { service } = makePanelSession();
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const view = render(
    <SessionProvider service={service}>
      <SubmissionPanel activity={activity} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...view, queryClient };
}

function selectFiles(files: readonly File[]): HTMLInputElement {
  const input = screen.getByLabelText(
    COPY.form.fileInputLabel,
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [...files] } });
  return input;
}

/** Counts create requests and their idempotency keys via MSW events. */
function trackCreateRequests() {
  const requests: { readonly url: string; readonly idempotencyKey: string }[] =
    [];
  const listener = ({ request }: { request: Request }) => {
    if (request.method === 'POST' && request.url.endsWith('/submissions')) {
      requests.push({
        url: request.url,
        idempotencyKey: request.headers.get('Idempotency-Key') ?? '',
      });
    }
  };
  mswServer.events.on('request:start', listener);
  return {
    requests,
    stop: () => mswServer.events.removeListener('request:start', listener),
  };
}

/**
 * Store-independent gated POST handler: the upload stays pending until the
 * test releases it, so pending-state behaviors are deterministic. Later MSW
 * handlers win, so registering this after the store's handlers takes over
 * only the POST; the store still answers preflight and read-own.
 */
function gatedCreateHandler(activityId: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = http.post(
    `${TEST_API_BASE_URL}/activities/${activityId}/submissions`,
    async () => {
      await gate;
      return new HttpResponse(
        JSON.stringify({
          id: '77777777-7777-4777-8777-777777777777',
          activityId,
          submittedAt: '2026-11-18T12:00:00.000Z',
          isLate: false,
          status: 'submitted',
          files: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              originalName: 'tp1.pdf',
              contentType: 'application/pdf',
              sizeBytes: PDF_BYTES.byteLength,
              position: 0,
            },
          ],
        }),
        {
          status: 201,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
          },
        },
      );
    },
  );
  return { handler, release };
}

describe('SubmissionPanel (#42 T3)', () => {
  test('a successful submit shows the server-confirmed Submitted state with files and signed links from the refreshed read-own', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    const { container } = renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile('tp1.pdf')]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    // The server-confirmed outcome: never a local "probably sent" state.
    expect(await screen.findByText(COPY.statusLabels.submitted)).toBeVisible();
    expect(screen.getByText('tp1.pdf')).toBeVisible();
    expect(screen.queryByText(COPY.lateBadge)).not.toBeInTheDocument();
    // The own-submission query refreshes from server data, bringing the
    // signed short-lived URL, which opens in a new tab and is never persisted.
    const download = await screen.findByRole('link', {
      name: COPY.downloadLabel,
    });
    expect(download).toHaveAttribute('target', '_blank');
    expect(download).toHaveAttribute('rel', 'noopener noreferrer');
    expect(download.getAttribute('href')).toContain(
      'https://storage.example.invalid/signed/',
    );
    expect(store.getItems()).toHaveLength(1);
    await expectAccessible(container);
  });

  test('duplicate clicks during a pending upload are guarded: one request only', async () => {
    const store = makeStore();
    const { handler, release } = gatedCreateHandler(ACTIVITY_ID);
    mswServer.use(...store.handlers, handler);
    const tracker = trackCreateRequests();
    renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile()]);
    const submit = screen.getByRole('button', {
      name: COPY.form.submitLabel,
    });
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeVisible();

    // The pending request reached MSW exactly once before the second click.
    await waitFor(() => expect(tracker.requests).toHaveLength(1));
    fireEvent.click(submit);
    expect(tracker.requests).toHaveLength(1);

    release();
    await screen.findByText(COPY.statusLabels.submitted);
    expect(tracker.requests).toHaveLength(1);
    tracker.stop();
  });

  test('a late-flagged own submission displays the late badge and school-zone date', async () => {
    const store = makeStore({
      initialItems: [makeStoredSubmission({ isLate: true })],
    });
    mswServer.use(...store.handlers);
    const { container } = renderPanel(makeActivityDto());

    expect(await screen.findByText(COPY.statusLabels.submitted)).toBeVisible();
    expect(screen.getByText(COPY.lateBadge)).toBeVisible();
    // The submitted instant renders in the activity's school time zone.
    expect(
      screen.getByText(
        formatActivityDeadline(
          '2026-11-18T12:00:00.000Z',
          'America/Argentina/Buenos_Aires',
        ),
      ),
    ).toBeVisible();
    expect(screen.getByText('tp1.pdf')).toBeVisible();
    // Signed download URL from read-own opens in a new tab, never persisted.
    const download = screen.getByRole('link', { name: COPY.downloadLabel });
    expect(download).toHaveAttribute('target', '_blank');
    expect(download).toHaveAttribute('rel', 'noopener noreferrer');
    expect(download.getAttribute('href')).toContain(
      'https://storage.example.invalid/signed/',
    );
    await expectAccessible(container);
  });

  test('forbidden (403) read-own shows the error state with retry', async () => {
    const store = makeStore({
      role: 'TEACHER',
      initialItems: [makeStoredSubmission()],
    });
    mswServer.use(...store.handlers);
    renderPanel(makeActivityDto());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(COPY.errorTitle);
    expect(
      screen.queryByLabelText(COPY.form.fileInputLabel),
    ).not.toBeInTheDocument();
  });

  test('an unknown activity answers 404 everywhere: no form data is trusted and nothing is stored', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeActivityDto({ id: UNKNOWN_ACTIVITY_ID }));

    // read-own 404 renders the upload form (the student has no submission yet).
    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();

    selectFiles([makePdfFile()]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    // The definite 404 rejection explains itself and preserves the selection.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No encontramos el recurso solicitado.');
    expect(screen.getByText('tp1.pdf')).toBeVisible();
    expect(store.getItems()).toHaveLength(0);
  });

  test('an uncertain dropped response reconciles through read-own and shows the stored submission as confirmed', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    store.failNext('create', 'drop-response');
    renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile()]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    // The server stored it; reconciliation confirms it instead of resubmitting.
    expect(
      await screen.findByText(COPY.uncertainReconciledNotice),
    ).toBeVisible();
    expect(screen.getByText(COPY.statusLabels.submitted)).toBeVisible();
    expect(screen.getByText('tp1.pdf')).toBeVisible();
    expect(store.getItems()).toHaveLength(1);
  });

  test('an uncertain failure with nothing stored offers retry, and the retry reuses the same idempotency key', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    store.failNext('create', 'network');
    const tracker = trackCreateRequests();
    renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile()]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    expect(await screen.findByText(COPY.uncertainTitle)).toBeVisible();
    expect(screen.getByText(COPY.uncertainNothingStored)).toBeVisible();
    expect(tracker.requests).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: COPY.retryAction }));
    expect(await screen.findByText(COPY.statusLabels.submitted)).toBeVisible();

    expect(tracker.requests).toHaveLength(2);
    expect(tracker.requests[1]?.idempotencyKey).toBe(
      tracker.requests[0]?.idempotencyKey,
    );
    expect(store.getLastCreateRequest()?.idempotencyKey).toBe(
      tracker.requests[0]?.idempotencyKey,
    );
    expect(store.getItems()).toHaveLength(1);
    tracker.stop();
  });

  test('a closed window disables submit with the closed reason', async () => {
    const store = makeStore({
      activity: makeStoreActivity({
        dueAt: '2000-01-01T00:00:00.000Z',
        allowLate: false,
      }),
      now: '2000-01-02T00:00:00.000Z',
    });
    mswServer.use(...store.handlers);
    renderPanel(
      makeActivityDto({ dueAt: '2000-01-01T00:00:00.000Z', allowLate: false }),
    );

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    const submit = screen.getByRole('button', {
      name: COPY.form.submitLabel,
    });
    expect(submit).toBeDisabled();
    expect(screen.getByText(COPY.window.closedReason)).toBeVisible();

    selectFiles([makePdfFile()]);
    fireEvent.click(submit);
    await waitFor(() => {
      expect(store.getItems()).toHaveLength(0);
    });
  });

  test('a not-yet-open window disables submit with the not-open reason', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeActivityDto({ opensAt: '2999-06-01T00:00:00.000Z' }));

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile()]);
    const submit = screen.getByRole('button', {
      name: COPY.form.submitLabel,
    });
    expect(submit).toBeDisabled();
    expect(screen.getByText(COPY.window.notOpenReason)).toBeVisible();
  });

  test('pre-check rejections show inline errors and keep the selection', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();

    // Disallowed extension.
    const disguised = new File([PDF_BYTES], 'script.exe', {
      type: 'application/pdf',
    });
    selectFiles([disguised]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(
      await screen.findByText(submissionMessages.validation.type),
    ).toBeVisible();
    expect(screen.getByText('script.exe')).toBeVisible();

    // Oversize file.
    const oversize = new File(
      [new Uint8Array(MAX_SUBMISSION_FILE_BYTES + 1)],
      'enorme.pdf',
      { type: 'application/pdf' },
    );
    selectFiles([oversize]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(
      await screen.findByText(submissionMessages.validation.size),
    ).toBeVisible();
    expect(screen.getByText('enorme.pdf')).toBeVisible();

    // Too many files.
    selectFiles(
      Array.from({ length: MAX_SUBMISSION_FILES + 1 }, (_, index) =>
        makePdfFile(`tp${index}.pdf`),
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(
      await screen.findByText(submissionMessages.validation.count),
    ).toBeVisible();

    // No pre-check failure ever reached the server.
    expect(store.getItems()).toHaveLength(0);
    expect(store.getLastCreateRequest()).toBeNull();
  });

  test('cancel aborts the pending upload as an expected cancellation, not an error', async () => {
    const store = makeStore();
    const { handler, release } = gatedCreateHandler(ACTIVITY_ID);
    mswServer.use(...store.handlers, handler);
    renderPanel(makeActivityDto());

    expect(
      await screen.findByLabelText(COPY.form.fileInputLabel),
    ).toBeVisible();
    selectFiles([makePdfFile()]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(screen.getByRole('progressbar')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: COPY.cancelAction }));

    expect(await screen.findByText(COPY.cancelNotice)).toBeVisible();
    // The form returns with the selection preserved and no failure alert.
    expect(screen.getByText('tp1.pdf')).toBeVisible();
    expect(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    ).toBeEnabled();
    expect(store.getItems()).toHaveLength(0);
    release();
  });

  test('a MULTIPLE_CHOICE activity shows the pending-copy note instead of the file form', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    const { container } = renderPanel(
      makeActivityDto({ format: 'MULTIPLE_CHOICE' }),
    );

    expect(
      await screen.findByText(activityMessages.detail.pendingTabTitle),
    ).toBeVisible();
    expect(
      screen.getByText(activityMessages.detail.submissionPendingDescription),
    ).toBeVisible();
    expect(
      screen.queryByLabelText(COPY.form.fileInputLabel),
    ).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  test('rotates Idempotency-Key when changing file selection and supports removeFile', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    store.failNext('create', {
      status: 409,
      body: {
        code: 'CONFLICT',
        message: 'Submission window closed.',
        details: [{ field: 'dueAt', messages: ['Submission window closed.'] }],
        correlationId: 'req-window-closed',
      },
    });
    const tracker = trackCreateRequests();
    renderPanel(makeActivityDto());

    const input = await screen.findByLabelText(COPY.form.fileInputLabel);
    selectFiles([makePdfFile('uno.pdf'), makePdfFile('dos.pdf')]);
    expect(screen.getByText('uno.pdf')).toBeVisible();
    expect(screen.getByText('dos.pdf')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', {
        name: COPY.form.removeFileLabel('dos.pdf'),
      }),
    );
    expect(screen.queryByText('dos.pdf')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(
      await screen.findByText(submissionMessages.serverErrors.windowClosed),
    ).toBeVisible();

    // Change selection -> must rotate Idempotency-Key and clear form error.
    selectFiles([makePdfFile('nuevo.pdf')]);
    expect(
      screen.queryByText(submissionMessages.serverErrors.windowClosed),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );
    expect(await screen.findByText(COPY.statusLabels.submitted)).toBeVisible();
    expect(tracker.requests).toHaveLength(2);
    expect(tracker.requests[1]?.idempotencyKey).not.toBe(
      tracker.requests[0]?.idempotencyKey,
    );
    expect(store.getItems()).toHaveLength(1);
    expect(input).not.toBeInTheDocument();
  });

  test('unverifiable reconciliation blocks file changes until Volver a verificar succeeds', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    store.failNext('create', 'network');
    renderPanel(makeActivityDto());

    const input = await screen.findByLabelText(COPY.form.fileInputLabel);
    selectFiles([makePdfFile()]);
    store.failNext('readOwn', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Down',
        correlationId: 'req-read-503',
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    expect(await screen.findByText(COPY.uncertainUnverified)).toBeVisible();
    expect(input).toBeDisabled();
    expect(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: COPY.verifyAgainAction }),
    );
    expect(await screen.findByText(COPY.uncertainNothingStored)).toBeVisible();
    expect(screen.getByLabelText(COPY.form.fileInputLabel)).toBeEnabled();
  });

  test('marks the file input aria-invalid when a pre-check validation fails', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeActivityDto());

    const input = await screen.findByLabelText(COPY.form.fileInputLabel);
    selectFiles([new File([], 'vacio.pdf', { type: 'application/pdf' })]);
    fireEvent.click(
      screen.getByRole('button', { name: COPY.form.submitLabel }),
    );

    expect(
      await screen.findByText(submissionMessages.validation.empty),
    ).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(' ');
  });
});

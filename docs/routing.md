# Routing

React Router (FD4) runs in data mode: `createBrowserRouter` with `RouterProvider` in `src/main.tsx`, and `createMemoryRouter` in tests. The route table is one function, `createAppRoutes()` in `src/app/router/routes.tsx`, shared by both.

## Route table

| Path                  | Guard                   | Module                                 |
| --------------------- | ----------------------- | -------------------------------------- |
| `/login`              | `PublicOnly`            | `src/app/pages/login-page`             |
| `/register`           | `PublicOnly`            | `src/app/pages/register-page`          |
| `/password-reset`     | `PublicOnly`            | `src/app/pages/password-reset-page`    |
| `/invitations/accept` | none (signed in or out) | `src/app/pages/invitation-accept-page` |
| `/`                   | `RequireAuth`           | `src/app/pages/home-page`              |
| `/dev/ui`             | none, dev/showcase only | `src/app/ui-foundations`               |
| `*`                   | none                    | `NotFoundPage` (static import)         |

Every page is a lazy route module (`lazy: { Component }`), so its chunk loads when it is first matched. The `/dev/ui` route exists only when `__UI_SHOWCASE__` is true (dev server and the `showcase` build used by the browser suite); a production build drops it and its chunk.

All routes live under one layout route, `AppShell`: `BaseLayout` (skip link, banner with the only `h1`, `main`), `<Outlet />` and the single toast host. Pages use `h2` for their title.

The table leaves room for the parent area (extended scope): it mounts as its own branch next to the protected one, with its own guard. It is not implemented.

## Guards

Guards are components that read `useSessionSnapshot()`; auth is not decided in loaders, because the session is asynchronous and owned by the session controller (see [session lifecycle](./session-lifecycle.md)).

- `RequireAuth` wraps the protected branch. `initializing` shows loading, `unauthenticated` redirects to `/login?next=<path>`, `unable-to-verify` shows a retry state, and only `authenticated` renders the nested routes. Protected content is never rendered before the session resolves.
- `PublicOnly` wraps login, register and password reset. A signed-in user is sent to the return target.
- The return target goes through `safeSessionRedirect` both when written and when read, so a hostile `?next=` degrades to `/`. Repeated `next` parameters count as absent.

A 403 or 404 from a resource never reaches the guards, so it cannot cause a login redirect loop.

## Errors, not found and forbidden

- `RootErrorBoundary` sits above the shell. It is plain markup on purpose (no shared component) so it still renders if a shared primitive is what broke. It has no skip link because it has no shell.
- `RouteErrorBoundary` sits inside the shell, so a page error replaces only the page area and the banner, navigation and toasts stay.
- `classifyRouteError` maps what was thrown to one of: not found (404), forbidden (403), stale chunk (a failed lazy import, offers a full reload) or unexpected (generic error with "Reintentar"). A 401 is never handled here; the session layer owns it.
- Throw `notFound()` or `forbidden()` (from `route-errors.ts`) in a page, hook or loader to show those views. Error text, stack and server data are never rendered.

## Capability gate

Role-aware routes use `useClassroomCapabilities(classroomId)` (`GET /classrooms/{id}`, nothing persisted, keyed by user and classroom) through `RequireCapability`:

```tsx
{
  path: 'classrooms/:classroomId/moderation',
  element: <RequireCapability capability="moderate_chat" />,
  children: [{ index: true, lazy: { Component: ... } }],
}
```

It shows loading while pending, forbidden when the server did not grant the capability (or on 403), not found on 404 (a foreign classroom looks like a missing one), and the generic error for anything else. A missing or empty classroom id is not found. An explicit `classroomId` prop overrides the `:classroomId` param. It never redirects.

## Accessibility

- The skip link from `BaseLayout` targets `main` (`id="main-content"`, `tabIndex={-1}`) on every route inside the shell.
- After a client-side navigation that changes the pathname, focus moves to the new page's heading, or to `main` when it has none (`useFocusOnNavigation` in `app-shell.tsx`). It does not run on the first render or on the redirect that resolves a first load, and search or hash changes keep focus. Moving focus to the heading is what makes screen readers announce the new page.
- `document.title` is `<page> · IntegrarTec`, written only by `useDocumentTitle` (`document-title.ts`). Pages get it through `PlaceholderPage`; the error views call it directly. Because each view titles itself, a forbidden or error view never inherits the title of the route that failed.

## Add a protected route

1. Add the route to the `protected` branch in `createAppRoutes` (or use `protectedRoutes` in tests) as a lazy module, and render a heading with `PlaceholderPage` or call `useDocumentTitle` yourself.
2. If it needs a capability, nest it under `RequireCapability`.
3. To let login return the user to it, add its exact path to `APPROVED_DESTINATIONS` in `src/session/redirect.ts`. Today only `/` is approved and matching is exact, so any other path falls back to `/`. A dynamic path such as `/classrooms/:id` needs pattern matching in `safeSessionRedirect`, which the first classroom route story must add. `safeSessionRedirect` takes an optional allowlist only so tests can prove forwarding; application code never passes it.
4. Add tests with `createMemoryRouter(createAppRoutes({ protectedRoutes }))`.

## Hosting requirement for deep links

The app is served at the domain root (no `basename`) and uses browser history, so opening `/login` or `/dev/ui` directly requests that path from the host. The host must rewrite paths without a file extension to `/index.html` with status 200. On AWS Amplify Hosting this is the rewrite rule:

- Source: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|wasm)$)([^.]+$)/>`
- Target: `/index.html`
- Type: `200 (Rewrite)`

The rule is not in `customHttp.yml` (that file only holds response headers); it is configured on the hosting side and is owned by issue #22. Until it is in place, a hard load of any route other than `/` returns the host's 404.

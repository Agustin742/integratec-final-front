/** Full page reload. Isolated so tests can observe it without touching `window.location`. */
export const reloadPage = (): void => {
  window.location.reload();
};

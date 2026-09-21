/** Full-page navigation to another site (e.g. GitLab's OAuth screen). A module of its own so tests can mock it. */
export function goTo(url: string): void {
  window.location.assign(url);
}

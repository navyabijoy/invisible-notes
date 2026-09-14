// Single source of truth for domain / repo / links.
// Swap DOMAIN when moving to a new domain — nothing else in the site
// hardcodes a domain string.
window.GHOST_NOTES_CONFIG = {
  DOMAIN: "ghostnotes.navyabijoy.tech",
  REPO: "navyabijoy/invisible-notes",
  get REPO_URL() {
    return `https://github.com/${this.REPO}`;
  },
  get RELEASES_URL() {
    return `https://github.com/${this.REPO}/releases/latest`;
  },
  get ISSUES_URL() {
    return `https://github.com/${this.REPO}/issues`;
  },
  TWITTER_URL: "https://twitter.com/navyabijoy",
};

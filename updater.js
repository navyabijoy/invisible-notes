// Check and fetch latest release information from GitHub Releases.
const https = require("https");
const platform = require("./platform");

const GITHUB_REPO = "navyabijoy/invisible-notes";
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

function parseSemver(v) {
  const clean = String(v || "")
    .replace(/^[vV]/, "")
    .trim();
  const [core, prerelease] = clean.split("-");
  const parts = (core || "").split(".").map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return { parts, prerelease: prerelease || "" };
}

function isNewerVersion(remote, local) {
  const a = parseSemver(remote);
  const b = parseSemver(local);
  for (let i = 0; i < 3; i++) {
    if (a.parts[i] > b.parts[i]) return true;
    if (a.parts[i] < b.parts[i]) return false;
  }
  if (!a.prerelease && b.prerelease) return true;
  return false;
}

function pickPlatformAsset(assets) {
  if (!Array.isArray(assets)) return null;
  const filtered = assets.filter(
    (a) =>
      a &&
      typeof a.name === "string" &&
      !a.name.endsWith(".blockmap") &&
      !a.name.endsWith(".yml"),
  );
  if (platform.isMac) {
    return (
      filtered.find((a) => a.name.endsWith(".dmg")) ||
      filtered.find((a) => a.name.endsWith(".zip")) ||
      null
    );
  }
  if (platform.isWindows) {
    return filtered.find((a) => a.name.endsWith(".exe")) || null;
  }
  if (platform.isLinux) {
    return (
      filtered.find((a) => a.name.endsWith(".AppImage")) ||
      filtered.find((a) => a.name.endsWith(".tar.gz")) ||
      null
    );
  }
  return null;
}

function fetchLatestRelease(options = {}) {
  const url = options.url || RELEASES_API_URL;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Ghost-Notes-App",
          Accept: "application/vnd.github.v3+json",
        },
        timeout: 10000,
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchLatestRelease({ ...options, url: res.headers.location })
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (_) {
            reject(new Error("Failed to parse release data from GitHub"));
          }
        });
      },
    );
    req.on("error", (err) => {
      reject(new Error(err.message || "Network request failed"));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out while checking for updates"));
    });
  });
}

async function checkForUpdates(currentVersion, options = {}) {
  try {
    const release = await (options.fetcher || fetchLatestRelease)();
    const latestTag = release.tag_name || "";
    const cleanTag = latestTag.replace(/^[vV]/, "");
    const hasUpdate = isNewerVersion(cleanTag, currentVersion);
    const asset = pickPlatformAsset(release.assets);

    return {
      success: true,
      currentVersion,
      latestVersion: cleanTag || currentVersion,
      hasUpdate,
      releaseName: release.name || latestTag,
      releaseUrl:
        release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      publishedAt: release.published_at || null,
      releaseNotes: release.body || "",
      downloadUrl: asset
        ? asset.browser_download_url
        : release.html_url || null,
      assetName: asset ? asset.name : null,
      checkedAt: Date.now(),
    };
  } catch (err) {
    return {
      success: false,
      currentVersion,
      hasUpdate: false,
      error: err.message || "Failed to fetch from GitHub releases",
      checkedAt: Date.now(),
    };
  }
}

module.exports = {
  GITHUB_REPO,
  parseSemver,
  isNewerVersion,
  pickPlatformAsset,
  fetchLatestRelease,
  checkForUpdates,
};

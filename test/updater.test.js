const test = require("node:test");
const assert = require("node:assert/strict");

const updater = require("../updater");
const platform = require("../platform");

test("parseSemver handles version strings with or without v", () => {
  assert.deepEqual(updater.parseSemver("1.2.3"), {
    parts: [1, 2, 3],
    prerelease: "",
  });
  assert.deepEqual(updater.parseSemver("v1.2.3"), {
    parts: [1, 2, 3],
    prerelease: "",
  });
  assert.deepEqual(updater.parseSemver("v2.0"), {
    parts: [2, 0, 0],
    prerelease: "",
  });
  assert.deepEqual(updater.parseSemver("1.3.0-beta.1"), {
    parts: [1, 3, 0],
    prerelease: "beta.1",
  });
});

test("isNewerVersion compares semver versions correctly", () => {
  assert.equal(updater.isNewerVersion("1.2.3", "1.2.2"), true);
  assert.equal(updater.isNewerVersion("2.0.0", "1.9.9"), true);
  assert.equal(updater.isNewerVersion("1.3.0", "1.2.9"), true);
  assert.equal(updater.isNewerVersion("1.2.2", "1.2.2"), false);
  assert.equal(updater.isNewerVersion("1.2.1", "1.2.2"), false);
  assert.equal(updater.isNewerVersion("1.0.0", "2.0.0"), false);
  assert.equal(updater.isNewerVersion("1.2.3", "1.2.3-beta"), true);
});

test("pickPlatformAsset returns expected installer asset for platform", () => {
  const assets = [
    {
      name: "Ghost-Notes-1.3.0-universal.dmg",
      browser_download_url: "https://example.com/mac.dmg",
    },
    {
      name: "Ghost-Notes-Setup-1.3.0.exe",
      browser_download_url: "https://example.com/win.exe",
    },
    {
      name: "Ghost Notes-1.3.0.AppImage",
      browser_download_url: "https://example.com/linux.AppImage",
    },
    {
      name: "latest.yml",
      browser_download_url: "https://example.com/latest.yml",
    },
  ];

  const picked = updater.pickPlatformAsset(assets);
  assert.ok(picked, "must pick a valid asset");
  if (platform.isMac) {
    assert.equal(picked.name, "Ghost-Notes-1.3.0-universal.dmg");
  } else if (platform.isWindows) {
    assert.equal(picked.name, "Ghost-Notes-Setup-1.3.0.exe");
  } else if (platform.isLinux) {
    assert.equal(picked.name, "Ghost Notes-1.3.0.AppImage");
  }
});

test("checkForUpdates detects available update when remote is newer", async () => {
  const mockRelease = {
    tag_name: "v2.0.0",
    name: "Ghost Notes 2.0.0",
    html_url:
      "https://github.com/navyabijoy/invisible-notes/releases/tag/v2.0.0",
    published_at: "2026-10-01T00:00:00Z",
    body: "Major update with exciting features!",
    assets: [
      {
        name: "Ghost Notes-2.0.0.AppImage",
        browser_download_url: "https://example.com/linux.AppImage",
      },
    ],
  };

  const result = await updater.checkForUpdates("1.2.2", {
    fetcher: async () => mockRelease,
  });

  assert.equal(result.success, true);
  assert.equal(result.hasUpdate, true);
  assert.equal(result.latestVersion, "2.0.0");
  assert.equal(result.releaseName, "Ghost Notes 2.0.0");
  assert.equal(result.releaseNotes, "Major update with exciting features!");
});

test("checkForUpdates reports no update when versions match", async () => {
  const mockRelease = {
    tag_name: "v1.2.2",
    name: "Ghost Notes 1.2.2",
    html_url:
      "https://github.com/navyabijoy/invisible-notes/releases/tag/v1.2.2",
    published_at: "2026-09-01T00:00:00Z",
    body: "Current release.",
    assets: [],
  };

  const result = await updater.checkForUpdates("1.2.2", {
    fetcher: async () => mockRelease,
  });

  assert.equal(result.success, true);
  assert.equal(result.hasUpdate, false);
  assert.equal(result.latestVersion, "1.2.2");
});

test("checkForUpdates handles fetch failure gracefully", async () => {
  const result = await updater.checkForUpdates("1.2.2", {
    fetcher: async () => {
      throw new Error("Network unreachable");
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.hasUpdate, false);
  assert.equal(result.error, "Network unreachable");
});

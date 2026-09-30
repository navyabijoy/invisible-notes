const test = require("node:test");
const assert = require("node:assert/strict");

const platform = require("../platform");

test("adds the Hyprland capture-exclusion rule on launch", (t, done) => {
  const calls = [];
  platform.applyLinuxCaptureExclusion({
    env: { HYPRLAND_INSTANCE_SIGNATURE: "sig" },
    exec: (command, args, options, callback) => {
      calls.push({ command, args });
      callback(null, "");
    },
    callback: (error, applied) => {
      assert.equal(error, null);
      assert.equal(applied, platform.isLinux);
      if (platform.isLinux) {
        assert.equal(calls.length, 1);
        assert.equal(calls[0].command, "hyprctl");
        assert.deepEqual(calls[0].args, [
          "keyword",
          "windowrule",
          "no_screen_share on, match:class ^(invisible-notes)$",
        ]);
      } else {
        assert.equal(calls.length, 0);
      }
      done();
    },
  });
});

test("reports a failed rule application instead of throwing", (t, done) => {
  platform.applyLinuxCaptureExclusion({
    env: { HYPRLAND_INSTANCE_SIGNATURE: "sig" },
    exec: (command, args, options, callback) =>
      callback(new Error("no hyprctl")),
    callback: (error, applied) => {
      assert.equal(applied, false);
      if (platform.isLinux) assert.match(String(error), /no hyprctl/);
      done();
    },
  });
});

test("leaves the compositor alone outside a Hyprland session", (t, done) => {
  const calls = [];
  platform.applyLinuxCaptureExclusion({
    env: {},
    exec: (...args) => calls.push(args),
    callback: (error, applied) => {
      assert.equal(error, null);
      assert.equal(applied, false);
      assert.equal(calls.length, 0);
      done();
    },
  });
});

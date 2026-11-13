// Synthetic, offline URL/header checks; no private credentials or network use.
import assert from "node:assert/strict";
import { buildTizenPlaybackProxyUrl } from "../js/platform/tizen/tizenPlaybackProxy.js";

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
}
function options(url) {
  const parsed = new URL(url);
  return new URLSearchParams(parsed.pathname.slice("/proxy/".length).split("/")[0]);
}
const base = "http://127.0.0.1:2710";
for (const [userinfo, decoded] of [
  ["fixture:secret", "fixture:secret"],
  ["fixture%40name:pass%3Aword", "fixture@name:pass:word"],
  ["caf%C3%A9:%F0%9F%94%91", "café:🔑"],
  ["fixture%2525:pass%252Fword", "fixture%25:pass%2Fword"],
  ["fixture%ZZ:pass", "fixture%ZZ:pass"],
  ["fixture", "fixture:"],
  [":secret", ":secret"]
]) {
  const url = buildTizenPlaybackProxyUrl(base, `https://${userinfo}@cdn.example/movie.mkv?x=1`, {
    Referer: "https://app.example/"
  });
  const parsed = options(url);
  check(parsed.get("d"), "https://cdn.example", "Origin contains no userinfo");
  check(
    parsed
      .getAll("h")
      .includes(
        `Authorization:${encodeURIComponent(`Basic ${Buffer.from(decoded).toString("base64")}`)}`
      ),
    true,
    "URL userinfo converted to UTF-8 Basic Authorization"
  );
  check(
    parsed.getAll("h").includes("Referer:https%3A%2F%2Fapp.example%2F"),
    true,
    "Declared headers retained"
  );
  check(url.endsWith("/movie.mkv?x=1"), true, "Source path and query retained");
}
for (const key of ["Authorization", "authorization", " AUTHORIZATION "]) {
  const url = buildTizenPlaybackProxyUrl(base, "https://fixture:secret@cdn.example/movie.mkv", {
    [key]: "Bearer explicit-fixture"
  });
  const headers = options(url).getAll("h");
  check(headers.length, 1, "Explicit authorization wins without duplicate header");
  check(
    headers[0].endsWith(":Bearer%20explicit-fixture"),
    true,
    "Explicit authorization value retained"
  );
  check(
    options(url).get("d"),
    "https://cdn.example",
    "Explicit authorization still removes userinfo"
  );
}
check(
  options(buildTizenPlaybackProxyUrl(base, "https://cdn.example/movie.mkv")).getAll("h"),
  [],
  "No credentials means no implicit auth header"
);
check(buildTizenPlaybackProxyUrl(base, "not a URL"), "", "Invalid URL remains rejected");
check(buildTizenPlaybackProxyUrl(base, "file:///movie.mkv"), "", "Non-HTTP URL remains rejected");
console.log(
  JSON.stringify({
    suite: "tizen-proxy-url-auth",
    passed,
    networkRequestsMade: false,
    tvContacted: false
  })
);

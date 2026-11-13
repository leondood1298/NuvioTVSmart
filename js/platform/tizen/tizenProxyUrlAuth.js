export function createProxyUrlBuilder(originalBuilder) {
  function decodeUserInfo(value) {
    try {
      return decodeURIComponent(value);
    } catch (_) {
      // Malformed escapes are literal credentials, rather than a reason to throw
      // while selecting a stream. Valid escapes are decoded exactly once.
      return value;
    }
  }

  function utf8Base64(value) {
    const escaped = encodeURIComponent(value);
    const bytes = [];
    for (let index = 0; index < escaped.length; index += 1) {
      if (escaped[index] === "%") {
        bytes.push(parseInt(escaped.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(escaped.charCodeAt(index));
      }
    }
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index];
      const hasSecond = index + 1 < bytes.length;
      const hasThird = index + 2 < bytes.length;
      const second = hasSecond ? bytes[index + 1] : 0;
      const third = hasThird ? bytes[index + 2] : 0;
      output += alphabet[first >> 2];
      output += alphabet[((first & 3) << 4) | (second >> 4)];
      output += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)] : "=";
      output += hasThird ? alphabet[third & 63] : "=";
    }
    return output;
  }

  return function buildProxyUrl(baseUrl, sourceUrl, headers = {}, traceId = null) {
    let source;
    try {
      source = new URL(String(sourceUrl || "").trim());
    } catch (_) {
      return originalBuilder.call(this, baseUrl, sourceUrl, headers, traceId);
    }
    if (
      (source.protocol !== "http:" && source.protocol !== "https:") ||
      (!source.username && !source.password)
    ) {
      return originalBuilder.call(this, baseUrl, sourceUrl, headers, traceId);
    }
    const hasExplicitAuthorization =
      headers &&
      typeof headers === "object" &&
      Object.keys(headers).some((key) => key.trim().toLowerCase() === "authorization");
    let effectiveHeaders = headers;
    if (!hasExplicitAuthorization) {
      const credentials = decodeUserInfo(source.username) + ":" + decodeUserInfo(source.password);
      effectiveHeaders = {
        ...(headers && typeof headers === "object" ? headers : {}),
        Authorization: "Basic " + utf8Base64(credentials)
      };
    }
    source.username = "";
    source.password = "";
    return originalBuilder.call(this, baseUrl, source.href, effectiveHeaders, traceId);
  };
}

const ZEPHYR_STATIONS_URL = "https://api.zephyrapp.nz/stations";

export async function onRequestGet() {
  return proxyZephyr(ZEPHYR_STATIONS_URL, 30);
}

async function proxyZephyr(url, browserTtlSeconds) {
  const upstream = await fetch(url, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: browserTtlSeconds, cacheEverything: true },
  });

  return jsonResponse(upstream, browserTtlSeconds);
}

async function jsonResponse(upstream, browserTtlSeconds) {
  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    "cache-control": `public, max-age=${browserTtlSeconds}, stale-while-revalidate=120`,
    "x-content-type-options": "nosniff",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

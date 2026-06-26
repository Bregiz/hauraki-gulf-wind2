const ALLOWED_STATION_IDS = new Set([
  "6631d5ddcf26372d5b80413b",
  "68f65b7ce3323e552ce3b2a5",
  "69f7dd013fd033f10b5f8696",
  "6631d5ddcf26372d5b8040a2",
  "6631d5ddcf26372d5b80414c",
  "6631d5ddcf26372d5b804176",
  "68f65ba0e3323e552ce3b2dc",
  "6631d5ddcf26372d5b8040c0",
]);

export async function onRequestGet({ params }) {
  const id = String(params.id || "");
  if (!ALLOWED_STATION_IDS.has(id)) {
    return new Response("Unknown station", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }

  const url = `https://api.zephyrapp.nz/stations/${id}/data`;
  const upstream = await fetch(url, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 120, cacheEverything: true },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "public, max-age=120, stale-while-revalidate=300",
      "x-content-type-options": "nosniff",
    },
  });
}

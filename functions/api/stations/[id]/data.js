const STATION_ID_RE = /^[a-f0-9]{24}$/i;

export async function onRequestGet({ params }) {
  const id = String(params.id || "");
  if (!STATION_ID_RE.test(id)) {
    return new Response("Invalid station id", {
      status: 400,
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

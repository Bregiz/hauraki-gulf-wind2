const ZEPHYR_STATIONS_URL = "https://api.zephyrapp.nz/stations";

export async function handler() {
  try {
    const upstream = await fetch(ZEPHYR_STATIONS_URL, {
      headers: { accept: "application/json" },
    });

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "public, max-age=30, stale-while-revalidate=120",
        "x-content-type-options": "nosniff",
      },
      body: await upstream.text(),
    };
  } catch {
    return {
      statusCode: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
      body: JSON.stringify({ error: "Unable to fetch wind stations" }),
    };
  }
}

const STATION_ID_RE = /^[a-f0-9]{24}$/i;

export async function handler(event) {
  const id = String(event.queryStringParameters?.id || "");
  if (!STATION_ID_RE.test(id)) {
    return {
      statusCode: 400,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
      body: "Invalid station id",
    };
  }

  try {
    const upstream = await fetch(`https://api.zephyrapp.nz/stations/${id}/data`, {
      headers: { accept: "application/json" },
    });

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "public, max-age=120, stale-while-revalidate=300",
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
      body: JSON.stringify({ error: "Unable to fetch wind history" }),
    };
  }
}

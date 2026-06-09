const ALLOWED_HOSTNAME = /^scontent[^.]*\.cdninstagram\.com$/;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }

  if (!ALLOWED_HOSTNAME.test(parsed.hostname)) {
    return new Response("URL not allowed", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
  } catch (err) {
    return new Response(`Failed to fetch image: ${String(err)}`, { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

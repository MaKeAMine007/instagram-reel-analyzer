const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ApifyDatasetResponse {
  items: InstagramPost[];
}

interface InstagramPost {
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  caption?: string;
  ownerUsername?: string;
  timestamp?: string;
  displayUrl?: string;
  [key: string]: unknown;
}

function isValidReelUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "www.instagram.com" ||
        parsed.hostname === "instagram.com") &&
      parsed.pathname.includes("/reel/")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json(
      { error: "APIFY_TOKEN environment variable is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const url =
    body !== null &&
    typeof body === "object" &&
    "url" in body &&
    typeof (body as Record<string, unknown>).url === "string"
      ? ((body as Record<string, string>).url as string).trim()
      : null;

  if (!url) {
    return Response.json({ error: "Missing required field: url" }, { status: 400 });
  }

  if (!isValidReelUrl(url)) {
    return Response.json(
      { error: "Invalid URL. Must be a valid Instagram Reel URL (e.g. https://www.instagram.com/reel/...)" },
      { status: 400 }
    );
  }

  // Run actor synchronously — blocks until finished (up to 300s)
  let runRes: Response;
  try {
    runRes = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${token}&waitForFinish=300`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: "posts",
          resultsLimit: 1,
        }),
      }
    );
  } catch (err) {
    return Response.json(
      { error: "Failed to reach Apify API", detail: String(err) },
      { status: 502 }
    );
  }

  if (!runRes.ok) {
    const text = await runRes.text().catch(() => "");
    return Response.json(
      { error: `Apify API error: ${runRes.status} ${runRes.statusText}`, detail: text },
      { status: 502 }
    );
  }

  const runData = (await runRes.json()) as ApifyRunResponse;
  const run = runData.data;

  if (run.status !== "SUCCEEDED") {
    return Response.json(
      { error: `Actor run did not succeed. Status: ${run.status}` },
      { status: 502 }
    );
  }

  // Fetch dataset results
  let dataRes: Response;
  try {
    dataRes = await fetch(
      `${APIFY_BASE}/datasets/${run.defaultDatasetId}/items?token=${token}`,
      { method: "GET" }
    );
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch dataset from Apify", detail: String(err) },
      { status: 502 }
    );
  }

  if (!dataRes.ok) {
    return Response.json(
      { error: `Failed to retrieve dataset: ${dataRes.status} ${dataRes.statusText}` },
      { status: 502 }
    );
  }

  const dataset = (await dataRes.json()) as ApifyDatasetResponse;
  const items = Array.isArray(dataset) ? dataset : dataset.items ?? dataset;
  const post = Array.isArray(items) ? (items as InstagramPost[])[0] : null;

  if (!post) {
    return Response.json(
      { error: "No data returned for this Reel. It may be private or the URL may be incorrect." },
      { status: 404 }
    );
  }

  return Response.json({
    views: post.videoPlayCount ?? null,
    likes: post.likesCount ?? null,
    comments: post.commentsCount ?? null,
    caption: post.caption ?? null,
    username: post.ownerUsername ?? null,
    timestamp: post.timestamp ?? null,
    thumbnail: post.displayUrl
      ? `/api/thumbnail?url=${encodeURIComponent(post.displayUrl)}`
      : null,
  });
}

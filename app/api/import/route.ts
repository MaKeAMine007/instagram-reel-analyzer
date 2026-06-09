import sql from "@/app/lib/db";
import { randomUUID } from "crypto";
import type { NeonQueryPromise } from "@neondatabase/serverless";

export interface ParsedRow {
  name: string;
  phone: string;
  dob: string | null;
  gender: string;
  city: string;
  jain: boolean | null;
  jito: boolean | null;
  week: number;
  username: string | null;
  reelUrl: string | null;
  status: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  marks: number;
  remark: string;
}

interface ImportBody {
  preview: boolean;
  mode: "merge" | "create-only";
  rows: ParsedRow[];
}

export async function POST(request: Request) {
  const body = await request.json() as ImportBody;
  const { preview, mode, rows } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No valid rows provided" }, { status: 400 });
  }

  // ── Fetch existing DB state ────────────────────────────────────────────────

  const existingCreators = await sql`
    SELECT DISTINCT ON (phone) id, phone
    FROM submissions
    ORDER BY phone, submitted_at ASC
  `;
  const phoneToSubId = new Map<string, string>();
  for (const c of existingCreators) phoneToSubId.set(String(c.phone), String(c.id));

  const existingReelRows = await sql`
    SELECT r.id, s.phone, r.url, r.week::int AS week
    FROM reels r
    JOIN submissions s ON r.submission_id = s.id
  `;
  const reelFp = new Map<string, string>(); // "phone|week|url" → reel id
  for (const r of existingReelRows) {
    reelFp.set(`${r.phone}|${r.week}|${r.url}`, String(r.id));
  }

  const maxIdxRows = await sql`
    SELECT submission_id::text, MAX(reel_index) AS max_idx
    FROM reels GROUP BY submission_id
  `;
  const maxIdx = new Map<string, number>();
  for (const r of maxIdxRows) maxIdx.set(String(r.submission_id), Number(r.max_idx) + 1);

  // ── Categorize ─────────────────────────────────────────────────────────────

  // Last row per phone wins for creator fields
  const latestCreatorRow = new Map<string, ParsedRow>();
  for (const row of rows) latestCreatorRow.set(row.phone, row);

  let creatorsToCreate = 0;
  let creatorsToUpdate = 0;
  let reelsToCreate    = 0;
  let reelsToUpdate    = 0;
  let fallbackDobCount = 0;

  for (const row of rows) {
    if (!row.dob) fallbackDobCount++;
  }

  for (const [phone] of latestCreatorRow) {
    if (phoneToSubId.has(phone)) creatorsToUpdate++;
    else creatorsToCreate++;
  }

  for (const row of rows) {
    if (!row.reelUrl) continue;
    const fp = `${row.phone}|${row.week}|${row.reelUrl}`;
    if (reelFp.has(fp)) reelsToUpdate++;
    else reelsToCreate++;
  }

  const weeksDetected = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);

  if (preview) {
    return Response.json({
      creatorsToCreate,
      creatorsToUpdate,
      reelsToCreate,
      reelsToUpdate,
      weeksDetected,
      fallbackDobCount,
      skipped: 0,
      errors: [],
    });
  }

  // ── Build transaction queries ──────────────────────────────────────────────

  const newSubIds = new Map<string, string>(); // phone → new UUID
  for (const [phone] of latestCreatorRow) {
    if (!phoneToSubId.has(phone)) newSubIds.set(phone, randomUUID());
  }

  const queries: NeonQueryPromise<false, false>[] = [];
  const reelsToScrape: { id: string; url: string; submissionId: string }[] = [];

  // Creator INSERTs
  for (const [phone, row] of latestCreatorRow) {
    if (phoneToSubId.has(phone)) continue;
    const id  = newSubIds.get(phone)!;
    const dob = row.dob ?? "2000-01-01";
    const isJito = row.jain === true ? row.jito : null;
    queries.push(sql`
      INSERT INTO submissions (id, phone, name, dob, gender, city, is_jain, is_jito_member, remarks, source, in_latest_csv)
      VALUES (${id}, ${phone}, ${row.name}, ${dob}::date, ${row.gender}, ${row.city},
              ${row.jain}, ${isJito}, ${row.remark}, 'csv', true)
    `);
  }

  // Creator UPDATEs (merge mode only)
  if (mode === "merge") {
    for (const [phone, row] of latestCreatorRow) {
      if (!phoneToSubId.has(phone)) continue;
      const subId  = phoneToSubId.get(phone)!;
      const isJito = row.jain === true ? row.jito : null;
      if (row.dob) {
        queries.push(sql`
          UPDATE submissions
          SET name = ${row.name}, dob = ${row.dob}::date, gender = ${row.gender},
              city = ${row.city}, is_jain = ${row.jain}, is_jito_member = ${isJito},
              remarks = ${row.remark}
          WHERE id = ${subId}
        `);
      } else {
        queries.push(sql`
          UPDATE submissions
          SET name = ${row.name}, gender = ${row.gender},
              city = ${row.city}, is_jain = ${row.jain}, is_jito_member = ${isJito},
              remarks = ${row.remark}
          WHERE id = ${subId}
        `);
      }
    }
  }

  // Reel index counters (per submission)
  const idxCounter = new Map<string, number>();
  for (const [phone, subId] of phoneToSubId) {
    idxCounter.set(subId, maxIdx.get(subId) ?? 0);
  }
  for (const [phone, id] of newSubIds) {
    idxCounter.set(id, 0);
  }

  // Reel INSERTs (new reels for all creators)
  for (const row of rows) {
    if (!row.reelUrl) continue;
    const fp = `${row.phone}|${row.week}|${row.reelUrl}`;
    if (reelFp.has(fp)) continue; // will be updated below

    const subId  = newSubIds.get(row.phone) ?? phoneToSubId.get(row.phone)!;
    const idx    = idxCounter.get(subId) ?? 0;
    idxCounter.set(subId, idx + 1);

    const reelId     = randomUUID();
    const needsScrape =
      row.status !== "done" ||
      row.username == null ||
      row.views    == null ||
      row.likes    == null ||
      row.comments == null;
    const status = needsScrape ? "pending" : "done";

    queries.push(sql`
      INSERT INTO reels (id, submission_id, url, status, username,
                         views, likes, comments, marks, reel_index, week)
      VALUES (${reelId}, ${subId}, ${row.reelUrl}, ${status}, ${row.username ?? null},
              ${row.views ?? null}, ${row.likes ?? null}, ${row.comments ?? null},
              ${row.marks}, ${idx}, ${row.week})
    `);

    if (needsScrape) {
      reelsToScrape.push({ id: reelId, url: row.reelUrl, submissionId: subId });
    }
  }

  // Reel UPDATEs (merge mode only)
  if (mode === "merge") {
    for (const row of rows) {
      if (!row.reelUrl) continue;
      const fp = `${row.phone}|${row.week}|${row.reelUrl}`;
      if (!reelFp.has(fp)) continue;

      const reelId = reelFp.get(fp)!;
      queries.push(sql`
        UPDATE reels
        SET username = ${row.username ?? null},
            status   = ${row.status   ?? "done"},
            views    = ${row.views    ?? null},
            likes    = ${row.likes    ?? null},
            comments = ${row.comments ?? null},
            marks    = ${row.marks}
        WHERE id = ${reelId}
      `);
    }
  }

  // Count data queries before injecting color-state queries
  const dataQueryCount = queries.length;

  // ── Color state (always inside transaction, atomic rollback on failure) ──────
  // Reset ALL creators to not-in-latest-csv first, then mark phones in this CSV
  queries.unshift(sql`UPDATE submissions SET in_latest_csv = false`);
  for (const [phone] of latestCreatorRow) {
    if (!phoneToSubId.has(phone)) continue; // new creators already inserted with in_latest_csv=true
    const subId = phoneToSubId.get(phone)!;
    queries.push(sql`UPDATE submissions SET in_latest_csv = true WHERE id = ${subId}`);
  }

  try {
    await sql.transaction(queries);
  } catch (e) {
    return Response.json({ error: "Transaction failed", detail: String(e) }, { status: 500 });
  }

  const warnings: string[] = [];
  if (fallbackDobCount > 0) {
    warnings.push(`${fallbackDobCount} row${fallbackDobCount !== 1 ? "s" : ""} used fallback DOB 2000-01-01`);
  }

  return Response.json({
    imported: dataQueryCount,
    skipped: 0,
    warnings,
    errors: [],
    reelsToScrape,
  });
}

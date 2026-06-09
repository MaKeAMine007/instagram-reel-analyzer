import sql from "@/app/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  const { id, reelId } = await params;
  const body = await request.json() as Record<string, unknown>;

  if ("marks" in body || "remarks" in body) {
    // Dashboard: update marks + remarks
    await sql`
      UPDATE reels
      SET marks   = ${(body.marks as number) ?? 0},
          remarks = ${(body.remarks as string) ?? ""}
      WHERE id = ${reelId} AND submission_id = ${id}
    `;
  } else {
    // Scrape result from form page
    await sql`
      UPDATE reels
      SET
        status         = ${body.status         as string},
        username       = ${(body.username       as string  | null) ?? null},
        views          = ${(body.views          as number  | null) ?? null},
        likes          = ${(body.likes          as number  | null) ?? null},
        comments       = ${(body.comments       as number  | null) ?? null},
        thumbnail      = ${(body.thumbnail      as string  | null) ?? null},
        reel_timestamp = ${(body.timestamp      as string  | null) ?? null}
      WHERE id = ${reelId} AND submission_id = ${id}
    `;
  }

  return Response.json({ ok: true });
}

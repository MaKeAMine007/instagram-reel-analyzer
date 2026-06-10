import sql from "@/app/lib/db";

async function bootstrap() {
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_settings (
      id           INT PRIMARY KEY,
      status       TEXT NOT NULL DEFAULT 'active',
      active_week  INT  NOT NULL DEFAULT 1
    )
  `;
  await sql`
    INSERT INTO campaign_settings (id, status, active_week)
    VALUES (1, 'active', 1)
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function GET() {
  try {
    await bootstrap();
    const [row] = await sql`SELECT status, active_week FROM campaign_settings WHERE id = 1`;
    return Response.json({ status: row.status, activeWeek: Number(row.active_week) });
  } catch {
    return Response.json({ status: "active", activeWeek: 1 });
  }
}

export async function PATCH(request: Request) {
  try {
    await bootstrap();
    const body = await request.json() as { status?: string; activeWeek?: number };

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return Response.json({ error: "status must be 'active' or 'inactive'" }, { status: 400 });
      }
      await sql`UPDATE campaign_settings SET status = ${body.status} WHERE id = 1`;
    }

    if (body.activeWeek !== undefined) {
      const w = Number(body.activeWeek);
      if (!Number.isInteger(w) || w < 1 || w > 5) {
        return Response.json({ error: "activeWeek must be 1–5" }, { status: 400 });
      }
      await sql`UPDATE campaign_settings SET active_week = ${w} WHERE id = 1`;
    }

    const [row] = await sql`SELECT status, active_week FROM campaign_settings WHERE id = 1`;
    return Response.json({ status: row.status, activeWeek: Number(row.active_week) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

import sql from "@/app/lib/db";

async function bootstrap() {
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_settings (
      id         INT  PRIMARY KEY,
      status     TEXT NOT NULL DEFAULT 'active',
      open_weeks TEXT NOT NULL DEFAULT '[1]'
    )
  `;
  // Migrate existing tables that have active_week but not open_weeks
  await sql`ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS open_weeks TEXT NOT NULL DEFAULT '[1]'`;
  await sql`
    INSERT INTO campaign_settings (id, status, open_weeks)
    VALUES (1, 'active', '[1]')
    ON CONFLICT (id) DO NOTHING
  `;
}

function parseOpenWeeks(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw || "[1]");
    if (Array.isArray(parsed)) return parsed as number[];
  } catch {
    // ignore
  }
  return [1];
}

export async function GET() {
  try {
    await bootstrap();
    const [row] = await sql`SELECT status, open_weeks FROM campaign_settings WHERE id = 1`;
    return Response.json({ status: row.status, openWeeks: parseOpenWeeks(row.open_weeks) });
  } catch {
    return Response.json({ status: "active", openWeeks: [1] });
  }
}

export async function PATCH(request: Request) {
  try {
    await bootstrap();
    const body = await request.json() as { status?: string; openWeeks?: number[] };

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return Response.json({ error: "status must be 'active' or 'inactive'" }, { status: 400 });
      }
      await sql`UPDATE campaign_settings SET status = ${body.status} WHERE id = 1`;
    }

    if (body.openWeeks !== undefined) {
      const weeks = body.openWeeks;
      if (!Array.isArray(weeks) || weeks.some((w) => !Number.isInteger(w) || w < 1 || w > 5)) {
        return Response.json({ error: "openWeeks must be an array of integers 1–5" }, { status: 400 });
      }
      const json = JSON.stringify(weeks.slice().sort((a, b) => a - b));
      await sql`UPDATE campaign_settings SET open_weeks = ${json} WHERE id = 1`;
    }

    const [row] = await sql`SELECT status, open_weeks FROM campaign_settings WHERE id = 1`;
    return Response.json({ status: row.status, openWeeks: parseOpenWeeks(row.open_weeks) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

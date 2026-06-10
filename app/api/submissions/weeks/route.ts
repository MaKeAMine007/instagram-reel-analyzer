import sql from "@/app/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone")?.trim() ?? "";

  if (!phone) {
    return Response.json({ exists: false, occupiedWeeks: [] });
  }

  const [creatorRows, reelRows] = await Promise.all([
    sql`
      SELECT DISTINCT ON (phone)
        name, gender, dob::text AS dob, city, is_jain, is_jito_member
      FROM submissions
      WHERE phone = ${phone}
      ORDER BY phone, submitted_at ASC
    `,
    sql`
      SELECT DISTINCT r.week::int AS week
      FROM reels r
      JOIN submissions s ON r.submission_id = s.id
      WHERE s.phone = ${phone}
      ORDER BY r.week
    `,
  ]);

  if (creatorRows.length === 0) {
    return Response.json({ exists: false, occupiedWeeks: [] });
  }

  const c = creatorRows[0];
  return Response.json({
    exists: true,
    occupiedWeeks: reelRows.map((r) => Number(r.week)),
    name: c.name,
    gender: c.gender,
    dob: c.dob,
    city: c.city,
    isJain: c.is_jain,
    isJitoMember: c.is_jito_member,
  });
}

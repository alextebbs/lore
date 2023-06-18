import { NextResponse } from "next/server";
import { type Character } from "~/utils/types";

import { db } from "~/utils/db";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const res = (await request.json()) as Character;

  // console.log("SAVING", res);

  const update = await db.character
    .update({
      where: {
        id: res.id,
      },
      data: {
        [params.field]: res[params.field],
      },
      include: {
        friends: true,
        enemies: true,
        goals: true,
      },
    })
    .catch((err) => {
      console.error(err);
    });

  return NextResponse.json({ update });
}

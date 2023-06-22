import { NextResponse } from "next/server";
import { type Character } from "~/utils/types";

import { db } from "~/utils/db";
import { getAuthSession } from "~/utils/auth";

export async function POST(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const req = (await request.json()) as Character;

  // console.log("SAVING", res);

  const session = await getAuthSession();

  if (!session?.user.id) return;

  const update = await db.character
    .update({
      where: {
        id: req.id,
      },
      data: {
        [params.field]: req[params.field],
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

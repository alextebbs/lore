import { NextResponse } from "next/server";
import { type Character } from "~/utils/types";
import { db } from "~/utils/db";
import { verifyHasAccess } from "~/utils/verify";

export async function POST(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  try {
    const res = (await request.json()) as Character;

    const id = res.id;

    if (!id) return new Response(null, { status: 400 }); // Bad Request

    if (!(await verifyHasAccess(id))) {
      return new Response(null, { status: 403 }); // Forbidden
    }

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
  } catch (err) {
    return new Response(null, { status: 500 }); // Internal Server Error
  }
}

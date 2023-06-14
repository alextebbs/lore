import { PrismaClient } from "@prisma/client/edge";
import { NextResponse } from "next/server";
import { type Character } from "~/utils/types";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: { field: keyof Character } }
) {
  const res = (await request.json()) as Character;

  console.log(res);

  const prisma = new PrismaClient();

  const update = await prisma.character
    .update({
      where: {
        id: res.id,
      },
      data: {
        [params.field]: res[params.field],
      },
    })
    .catch((err) => {
      console.error(err);
    });

  return NextResponse.json({ update });
}

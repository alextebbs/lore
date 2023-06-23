import { db } from "~/utils/db";
import { verifyHasAccess } from "~/utils/verify";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return new Response(null, { status: 400 }); // Bad Request

    if (!(await verifyHasAccess(id))) {
      return new Response(null, { status: 403 }); // Forbidden
    }

    console.time("reroll");

    const character = await db.character.update({
      where: {
        id: searchParams.get("id") as string,
        // userId: session?.user.id,
      },
      data: {
        name: null,
        age: null,
        species: null,
        height: null,
        weight: null,
        eyeColor: null,
        hairColor: null,
        backstory: null,
        physicalDescription: null,
        demeanor: null,
        secret: null,
        roleplayTips: null,
        imageURL: null,
        goals: {
          updateMany: {
            where: {
              description: { not: null },
            },
            data: {
              description: null,
            },
          },
        },
      },
      include: {
        friends: true,
        enemies: true,
        goals: true,
      },
    });

    console.timeEnd("reroll");

    return new Response(JSON.stringify(character));
  } catch (err) {
    return new Response(null, { status: 500 }); // Internal Server Error
  }
}

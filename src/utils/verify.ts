import { cookies } from "next/headers";
import { getAuthSession } from "./auth";
import { db } from "./db";

export const verifyHasAccess = async (id: string) => {
  const session = await getAuthSession();

  const userId = session?.user.id;
  const cookieId = cookies().get("lore.cookie")?.value;

  if (userId) {
    const count = await db.character.count({
      where: {
        id,
        userId,
      },
    });

    return count > 0;
  }

  if (cookieId) {
    const count = await db.character.count({
      where: {
        id,
        userId,
      },
    });

    console.log(
      "Allowed to save because your cookie matches this character cookie"
    );

    return count > 0;
  }

  return false;
};

import { Prisma } from "@prisma/client";

const characterType = Prisma.validator<Prisma.CharacterArgs>()({
  include: { friends: true, enemies: true, goals: true },
});

export type Character = Prisma.CharacterGetPayload<typeof characterType>;

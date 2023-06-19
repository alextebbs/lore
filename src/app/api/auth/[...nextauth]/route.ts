import { authOptions } from "~/utils/auth";
import NextAuth from "next-auth";

// QUESTION: NextAuth() returns "any". My eslint settings don't like that. I
// don't own the NextAuth package. Is it better for me to fumble around and
// try to write my own type for what it should be - in this case:
// (???) => Promise<Response>) or should I just disable the eslint
// check and move on with my life? I don't even know if that type is right,
// but NextJS expects GET and POST to be a certain way when it reads this
// file via whatever NextJS magic it's doing.

// A:
// const handler = NextAuth(authOptions) as () => Promise<Response>;

// Or B:
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

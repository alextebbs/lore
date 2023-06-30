# Mythweaver

(Live demo)[https://lore-orpin.vercel.app/]

Mythweaver is an NPC generator using OpenAI to create fictional characters for
use in tabletop roleplaying games.

I built this as a way to teach myself Next.JS and how to architect a more
fully-featured "app" or "product" on the web.

Some neat features:

- You can log in to save characters, your characters are stored in a DB.
- Characters can be edited, deleted, rerolled, or shared via their permalink.
- You can create a character without logging in, and then log in to edit that
  character.

The Stack

- [Next.JS 13 App Router](https://nextjs.org/docs/app)
- [NextAuth](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/docs)
- [Planetscale](https://planetscale.com/)
- [OpenAI Completions](https://platform.openai.com/docs/api-reference/completions)
- [DALL-E](https://platform.openai.com/docs/api-reference/images)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Tailwind](https://tailwindcss.com/docs/installation)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)

## TODO

### High

- [] It's slow :(

  - [] I need to better understand how caching and cache invalidation works.

- [x] ~~Make Auth actually protect characters that aren't yours~~

  - [x] ~~You shouldn't be able to edit a character that isn't yours~~

- [x] ~~You should be able to create a character without a login, and then associate
      that character with your login (no idea how to do this) edit: its done~~

### Mid

- [] Sort out prompts, add examples, tune them

  - Sometimes it gets jacked and starts generating the whole character when
    I just ask for the name (rarely).
  - Sometimes it adds punctuation where I don't want it to.
  - Consider adding "Occupation" to the character
  - Consider adding a very short summary to the character?
  - It's default generations kind of suck sometimes. It gives the same names
    over and over again. Don't know how I would influence or fix this.

- [] Images need to actually get stored somewhere, unfortunately
- [] Character name should fill in in the sidebar when character is being generated

- [] Relational stuff is still messed up
  - [] Friends/Enemies is giving 6 of each. The database relation isn't set right
  - [] Relational items are still a bit wacky in prompt generator

### Low

- [] You should be able to fork a character to make it become yours
- [] I'm using a mix of query parameters and POST body data to move data around from
  the frontend to the API. Should I care? Does it matter?

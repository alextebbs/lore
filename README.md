# Mythweaver

(Check it out)[https://lore-orpin.vercel.app/]

This is an NPC Generator using OpenAI to create fictional characters for use in
tabletop roleplaying games. I built this as a way to teach myself Next.js and
architecting a more fully-featured "app" or "product" on the web.

Some features:

- You can log in to save characters, your characters are stored in a DB.
- Characters can be edited, deleted, or shared via their permalink.
- Fields on the character sheet can be regenerated.

## TODO

### High

- Mobile UI (sidebar needs to toggle)

- [x] Make Auth actually protect characters that aren't yours

  - [x] You shouldn't be able to edit a character that isn't yours

- [x] You should be able to create a character without a login, and then associate
      that character with your login (no idea how to do this) edit: its done

### Mid

- [] Sort out prompts, add examples, tune them

  - Sometimes it gets jacked and starts generating the whole character when
    I just ask for the name (rarely).
  - Sometimes it adds punctuation where I don't want it to.
  - Consider adding "Occupation" to the character
  - Consider adding a very short summary to the character?
  - It's default generations kind of suck. It gives the same names over and
    over again. Don't know how I would influence or fix this.

- [] Character name should fill in in the sidebar when character is being generated

- [] Relational stuff is still messed up
  - [] Friends/Enemies is giving 6 of each. The database relation isn't set right
  - [] Relational items are still a bit wacky in prompt generator

### Low

- [] You should be able to fork a character to make it become yours
- [] Its slow (its less slow now)
- [] Images need to actually get stored somewhere, unfortunately
- [] I'm using a mix of query parameters and POST body to move data around from
  the frontend to the API. Should I care? Does it matter?

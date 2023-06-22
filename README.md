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

- Character generation needs to be different

  - Should be handled by CharacterSheet, not CharacterSheetItem.
  - Rerolling shouldn't be an API route, it should just happen client-side
  - Save buttons should not be visible until generation is fully complete and
    your user is associated with the character.
  - "Saving" the character should only happen once, at the end of character
    generation.

- Make Auth actually protect characters that aren't yours

  - You shouldn't be able to edit a character that isn't yours

- You should be able to create a character without a login, and then associate
  that character with your login (no idea how to do this)

  - Maybe any character you've created could be "claimed"?

### Mid

- Sort out prompts, add examples, tune them
- Reroll doesn't do anything
- Character name should fill in in the sidebar when character is being generated
- Relational stuff is still messed up
  - Friends/Enemies is giving 6 of each. The database relation isn't set right
  - Relational items are still a bit wacky in prompt generator
  - Relational items can be edited before they are generated

### Low

- You should be able to fork a character to make it become yours
- Use this? https://vercel.com/blog/introducing-the-vercel-ai-sdk
- Its slow (its less slow now)
- Images need to actually get stored somewhere, unfortunately
- Add the ability to edit originalPrompt

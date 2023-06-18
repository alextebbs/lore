# Mythweaver

Uses GPT to generate lore for use in tabletop roleplaying games. Currently generates NPCs.

Check it out: https://lore-orpin.vercel.app/

### TODO

### High

- Make Auth actually protect characters that aren't yours

  - You shouldn't be able to edit a character that isn't yours

- Mobile UI (sidebar needs to toggle)

- Its slow :(

- You should be able to create a character without a login, and then associate
  that character with your login (no idea how to do this)

- Relational stuff is still messed up
  - Friends/Enemies is giving 6 of each

### Mid

- Images need to actually get stored somewhere, unfortunately
- Character name should fill in in the sidebar when character is being generated
- Sort out prompts, add examples, tune them
  - Relational items are still a bit wacky in prompt generator
- Reroll doesn't do anything
- Use this? https://vercel.com/blog/introducing-the-vercel-ai-sdk

### Low

- Consider a more robust dithering effect on photo?
- Look into next/font
- You should be able to fork a character to make it become yours
- Add the ability to edit originalPrompt

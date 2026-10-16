CATCH THE SNOWFLAKES: OUR LITTLE UNIVERSE
A birthday game for Sakshi ("Snowflake"). Plain HTML, CSS and JavaScript.
No frameworks, no build step, no external services.

FILES
  index.html   the page and all screens (start, pause, game over, win, memory page, map)
  style.css    all styling
  script.js    the game. Personal text and settings are at the very top.
  photos/      OPTIONAL. Your own photographs for the memory pages (see below).
               This folder is not included; create it next to index.html.

RUNNING IT
  Open index.html in a browser, or upload the whole folder to any static host
  (Netlify Drop, GitHub Pages, Vercel, etc.) and share the link.
  Saved progress is stored per browser and per address, so the same link must
  be used each time. Opening the file directly and opening the hosted copy
  keep separate progress.

CONTROLS
  Move the basket: Left/Right arrows, A / D, mouse, or drag a finger.
  Pause / resume: P or Esc, or the pause button.
  Restart: the restart button. Sound: the speaker button.
  Finale: tap, click or press Space/Enter to skip to the letter.

GAME RULES (all editable at the top of script.js)
  Standard: 90 seconds to reach 500 points. Relaxed: no timer, same target.
  Snowflake 10, golden 50, heart +20, memory snowflake +20.
  Slow-mo (5 s) and double points (6 s) power-ups.
  Combo: every 5th catch pays a bonus (max +20); 3 misses in a row end it.
  Memory snowflakes appear rarely (up to 3 per Standard run, up to 5 in Relaxed).

HOW MEMORIES WORK
  Catching a rose-gold Memory Snowflake freezes the game (score, timer, combo
  and power-ups all stay exactly as they were) and opens that memory's page.
  A memory is saved as "discovered" at the moment its page opens, so it can
  never be marked found without being shown. If the Memory Snowflake is the
  catch that reaches 500 points, its page is shown first and the birthday
  finale follows when she presses Continue.
  Discovered memories are listed on the Memory map ("Our Little Universe"),
  which can be reached from the start, pause, game-over and win screens and
  reopened at any time. Undiscovered places show only "Undiscovered".

EDITING MEMORIES (MEMORIES list in script.js)
  Edit only the text fields: mapName, place, date, title, story.
  Do NOT change the id values (beginning, first-text, rainy-day, three-words,
  lodhi-garden). They are what her saved progress is stored under.
  Keep the order; memories unlock in that order and the map positions follow it.
  "scene" chooses the animated picture shown when there is no photo.
  Only write things that really happened.

PHOTOS (optional)
  Create a folder named photos next to index.html and use EXACTLY these names:
    photos/01-the-beginning.jpg
    photos/02-first-conversation.jpg
    photos/03-rainy-crossing.jpg
    photos/04-three-little-words.jpg
    photos/05-lodhi-garden.jpg
  Any photo that is missing or fails to load simply falls back to the animated
  illustration; the game never breaks. Use landscape or square photos about
  1200 px wide and under 400 KB; faces near the middle (top and bottom are cropped).
  For PNG/WebP keep the name and change the "photo:" line for that memory.
  Privacy note: this is a static site, so the story text and photo file names
  are inside the files that get uploaded. Locked memories are hidden in the
  game, but anyone who opens the page source could read them. Share the link
  only with her.

TESTING
  Quick memory test: add ?memtest to the address (index.html?memtest). Memory
  snowflakes then appear every few seconds. Her real progress is still
  saved, so clear it afterwards (below) before the real gift.
  Reset saved progress: browser dev tools > Application > Local Storage, delete
  catchSnowflakesMemories (memories) and catchSnowflakesBest (best score).

  Automated checks run on this version (headless Chromium via Playwright, not
  real phones): no duplicate or missing element IDs; Standard starts at 90 s
  and times out to game over; Relaxed has no countdown; a memory caught on the
  winning catch opens its page and then the finale; found memories survive
  reload and restart; score, timer, combo and power-ups stay frozen during a
  memory page; pause > map > memory > resume; restart during a memory; locked
  memories reveal nothing; a single animation loop after repeated restarts;
  reduced-motion; no page errors; layouts at 320x568, 360x640, 390x844,
  640x360 and 844x390 with and without a photo.

  STILL WORTH DOING BY HAND before gifting (on her kind of phone):
   1. Play one Standard and one Relaxed round to the end on a real phone.
   2. Add your real photos and open each memory from the map.
   3. Check sound on iPhone (audio only starts after the first tap; the mute
      button works) and with the phone's silent switch.
   4. Turn on "Reduce motion" in the phone settings and check the finale.
   5. Rotate the phone during a memory page and during the map.
   6. Clear the test progress (see above) so she starts fresh.

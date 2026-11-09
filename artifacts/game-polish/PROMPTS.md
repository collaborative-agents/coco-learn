# Prompt regression results

Each case starts from a fresh game with real default permissions. All 20 published a Chromium-validated version and passed the recorded structural assertions. Screenshots and actual changed fields are retained below. This measures publishing and requested data changes; it is not a complete subjective art-quality rubric.

| Prompt | Result | Seconds | Changed fields | Screenshot |
|---|---|---:|---|---|
| change the background to daylight | Pass | 18.19 | title, timeOfDay, background, textColor, decorations, ground, scene | [Game](benchmark/01-daylight.png) · [Chat](benchmark/01-daylight-chat.png) |
| I want to make coco run in a daylight theme, but not a moon light | Pass | 10.65 | title, timeOfDay, background, textColor, decorations, ground, scene | [Game](benchmark/02-nov7-theme.png) · [Chat](benchmark/02-nov7-theme-chat.png) |
| hmmm maybe change only the background to daylight ! | Pass | 10 | background, scene | [Game](benchmark/03-nov7-background.png) · [Chat](benchmark/03-nov7-background-chat.png) |
| make it cuter | Pass | 11.3 | title, timeOfDay, background, textColor, decorations, ground, spritePalette, player, obstacles, weather, sounds, scene | [Game](benchmark/04-cuter.png) · [Chat](benchmark/04-cuter-chat.png) |
| make the runner my dog and the obstacles bones | Pass | 8.27 | spritePalette, player, obstacles, scene | [Game](benchmark/05-dog-bones.png) · [Chat](benchmark/05-dog-bones-chat.png) |
| make it night with stars and snow | Pass | 10.65 | weather, scene | [Game](benchmark/06-snow-stars.png) · [Chat](benchmark/06-snow-stars-chat.png) |
| make it way harder | Pass | 8.54 | physics, scene | [Game](benchmark/07-harder.png) · [Chat](benchmark/07-harder-chat.png) |
| make it look like Mario, but make your own original character and scenery | Pass | 43.77 | title, timeOfDay, background, textColor, decorations, ground, spritePalette, player, obstacles, scene | [Game](benchmark/08-platform-style.png) · [Chat](benchmark/08-platform-style-chat.png) |
| Make it a detailed daylight world with a cat | Pass | 11.79 | title, timeOfDay, background, textColor, decorations, ground, player, scene | [Game](benchmark/09-ambitious-cat.png) · [Chat](benchmark/09-ambitious-cat-chat.png) |
| a cozy morning with pastel colors and lots of clouds please | Pass | 15.94 | title, timeOfDay, background, textColor, decorations, ground, scene | [Game](benchmark/10-pastel-morning.png) · [Chat](benchmark/10-pastel-morning-chat.png) |
| make the world rainy and neon blue and pink like a cyberpunk city | Pass | 20.58 | title, background, textColor, spritePalette, weather, scene | [Game](benchmark/11-neon-rain.png) · [Chat](benchmark/11-neon-rain-chat.png) |
| make it sunset with orange skies and mountains | Pass | 10.27 | title, timeOfDay, background, textColor, decorations, ground, scene | [Game](benchmark/12-sunset.png) · [Chat](benchmark/12-sunset-chat.png) |
| a dark purple space world with lots of stars | Pass | 14.98 | title, background, decorations, weather, scene | [Game](benchmark/13-space.png) · [Chat](benchmark/13-space-chat.png) |
| make my runner a pink rabbit | Pass | 16.87 | spritePalette, player, scene | [Game](benchmark/14-rabbit.png) · [Chat](benchmark/14-rabbit-chat.png) |
| make it a sandy desert and change the obstacles to cactuses | Pass | 13.3 | title, timeOfDay, background, textColor, decorations, ground, obstacles, scene | [Game](benchmark/15-desert.png) · [Chat](benchmark/15-desert-chat.png) |
| make only the runner blue, keep everything else the same | Pass | 14.09 | spritePalette, scene | [Game](benchmark/16-blue-only.png) · [Chat](benchmark/16-blue-only-chat.png) |
| chnge the bakgrond to daylite plz | Pass | 12.33 | title, timeOfDay, background, textColor, decorations, ground, scene | [Game](benchmark/17-misspelled-day.png) · [Chat](benchmark/17-misspelled-day-chat.png) |
| can u make a lil cat runing in sno at nite | Pass | 9.6 | title, player, weather, scene | [Game](benchmark/18-misspelled-cat-snow.png) · [Chat](benchmark/18-misspelled-cat-snow-chat.png) |
| turn sounds off and change the score label to DISTANCE | Pass | 7.91 | scoreLabel, scene | [Game](benchmark/19-score-sounds.png) · [Chat](benchmark/19-score-sounds-chat.png) |
| make it easier to jump over things, with lower gravity and higher jumps | Pass | 8.86 | physics, scene | [Game](benchmark/20-higher-jump.png) · [Chat](benchmark/20-higher-jump-chat.png) |

Timing: median 11.545 seconds; 19/20 under 30 seconds. The platform-inspired request took 43.77 seconds.

Human review caveats: the platform-inspired version chose the title “Goomba Hop,” which does not meet the request for an entirely original name. A background-only daylight request preserved the original time-of-day metadata/title, as well as the requested unchanged foreground; its old summary incorrectly called the sky “night.” The summary wording has since been corrected and covered by a regression test.

This run preceded the service-watchdog correction and final input/start-card refinements. Some late captures truthfully show a transient sensing-service warning. The final 3-prompt full-session and explicit service crash/recovery test were run after the watchdog fix. Raw measurements: [results.json](benchmark/results.json).

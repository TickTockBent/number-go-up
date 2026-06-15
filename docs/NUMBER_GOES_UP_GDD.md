# NUMBER GOES UP — Game Design Document

**Version:** 1.0.0  
**Target Platform:** Steam (Windows, Linux, macOS, Steam Deck verified)  
**Price:** $0.99  
**DLC:** "Heavy Wallet" — $4.99  
**Genre:** Incremental / Idle / Clicker  
**Tagline:** *The number goes up. That's it. That's the game.*

---

## 1. Elevator Pitch

NUMBER GOES UP is a $0.99 idle/incremental game with no story, no characters, no ending, and no payoff. There is a number. It goes up. You buy things that make it go up faster, or slower, or not at all. Then you prestige and it resets and goes up 2% faster. The game is fully self-aware that it is a waste of your time and tells you so constantly.

The $4.99 "Heavy Wallet" DLC adds a permanent irremovable 0.001% debuff to all production. The store page is honest about this. People will buy it anyway.

---

## 2. Steam Store Presence

### 2.1 Store Description

> **NUMBER GOES UP**
>
> There is a number. It goes up.
>
> Click it. It goes up faster. Buy upgrades. It goes up even faster. Or buy the red button. That does nothing. Or the slow button. That makes it slower. You pay for this.
>
> Then you prestige. Everything resets. The number goes up 2% faster now. Was it worth it? The number doesn't care. The number goes up.
>
> **Features:**
> - A number
> - It goes up
> - Buttons (some of them work)
> - Prestige system (lose everything, gain almost nothing)
> - Ascension system (lose the thing you gained from losing everything)
> - Transcendence system (at this point we're just impressed you're still here)
> - Steam Achievements (67 of them, obviously)
> - Steam Trading Cards (the number 7 is larger for some reason)
> - Full controller support (why?)
> - Steam Deck verified (the number goes up portably)
> - Cloud saves (your number goes up across devices)
>
> **Does NOT feature:**
> - A story
> - An ending
> - Meaning
> - Respect for your time

### 2.2 Store Tags

Idler, Clicker, Casual, Comedy, Minimalist, Relaxing, Memes, Great Soundtrack, Psychological Horror

### 2.3 Heavy Wallet DLC Store Page

> **NUMBER GOES UP — Heavy Wallet DLC**
>
> **Price: $4.99**
>
> This DLC applies a permanent, irremovable 0.001% debuff to all number production. It's called Heavy Wallet. It cannot be uninstalled. It cannot be refunded after the number goes up even once. It is five times more expensive than the base game.
>
> You are going to buy it anyway.
>
> **What you get:**
> - The "Heavy Wallet" debuff (−0.001% all production, permanent, irremovable)
> - A small icon of a wallet next to your number
> - The knowledge that you paid $4.99 for this
> - One (1) exclusive achievement
> - Access to the "Heavy Wallet" Steam trading card (it's just a picture of $4.99)
>
> **What you don't get:**
> - Your money back
> - A sense of accomplishment
> - Faster numbers

---

## 3. The Number Display

### 3.1 The Digit Width Problem

Funny number detection (80085, 8008135, 5318008, 42069, etc.) requires the player to see full digit strings. Truncating to "80.1K" at five digits kills every calculator joke. The display system must accommodate this.

### 3.2 Solution: Notation Modes

The player selects a notation mode in Settings. This is a first-class design decision, not a cosmetic preference — it directly affects which funny numbers are visible and therefore which achievements are practically obtainable.

| Mode | Label | Behavior | Switches at |
|------|-------|----------|-------------|
| Normal | "Normal Person" | Abbreviated (15.2K, 3.40M) | 10,000 (5 digits) |
| Extended | "Number Enjoyer" (default) | Full digits with commas | 10,000,000 (8 digits) |
| Unhinged | "Unhinged" | Full digits, always, no commas, the font shrinks | Never. The number wraps. The font gets smaller. You asked for this. |
| Scientific | "Nerd" | Scientific notation (1.50e4) | 10,000 |

**Default is "Number Enjoyer."** This ensures all 7-digit funny numbers (5318008, 8008135) are visible without opt-in. The number display area must handle up to `9,999,999` at full legibility before notation kicks in. Font size scales down slightly at 7 digits to fit.

"Unhinged" mode is an achievement unlock (see §10). The font progressively shrinks as the number grows. At 1 trillion+ the digits are nearly unreadable. At 1 quadrillion they begin to wrap. This is the point. There is no lower bound on font size. The number goes up. The font goes down.

### 3.3 Number Display Visual States

The number display reacts to game state:

- **Base state:** Green (#44ff88), steady glow
- **Red Button corruption (6+ owned):** Shifts to red (#ff4444), gains a flicker
- **Slow penalty active:** Number visually lags — a subtle trailing ghost effect, as if the digits are dragging
- **Post-prestige (first 10 seconds):** Brief golden flash, then returns to green
- **Heavy Wallet active:** Tiny wallet icon rendered to the left of the number. It does nothing else. It's just there. Watching.
- **Unhinged mode at extreme values:** The number starts affecting the UI. It pushes other elements. It does not care about your layout.

---

## 4. Core Mechanics

### 4.1 The Click

Tapping or clicking the number adds `clickPower` to the current total. Base click power is 1. Upgrades and prestige bonuses multiply this.

Each click produces a floating "+N" particle that drifts upward and fades. At high click power, particles stack and scatter. At very high click power (10K+/click), the screen shakes subtly. At absurd click power (1M+/click), the shake becomes violent and the background flickers.

### 4.2 Passive Production

Upgrades (§5) provide a per-second rate. The game ticks at 20fps internally. Production continues while the game is closed (offline progress), calculated on return with a toast: "While you were gone, the number went up by [X]. It didn't miss you."

Offline production caps at 8 hours of accumulation to prevent degenerate strategies where optimal play is not playing.

### 4.3 The Economy

All costs use a **1.15x exponential scaling** per unit owned. This is standard incremental fare and produces the correct "just one more" psychology.

Currency is singular: **Numbers.** There is no secondary currency, no gems, no crystals. The number is the number. You spend number to make number go up faster. The number is the means and the end.

---

## 5. Upgrade Tree

Upgrades are organized into tiers that unlock as total-ever-earned milestones are reached. All upgrades are purchasable multiple times (no cap) with escalating costs.

### 5.1 Tier 1 — The Basics (unlocked at start)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| click_1 | CLICK HARDER | 10 | +1 click power | Makes number go up when you click |
| auto_1 | Number Watcher | 15 | +1/s | Watches the number. It goes up. |
| auto_2 | Number Encourager | 100 | +5/s | Tells the number it's doing great |
| auto_3 | Number Therapist | 1,100 | +47/s | Helps number process its feelings about going up |

### 5.2 Tier 2 — Getting Suspicious (unlocked at 500 total)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| auto_4 | Number Influencer | 12,000 | +260/s | Posts motivational quotes about going up |
| red | RED BUTTON | 666 | Nothing. | Does nothing. It's red though. |
| slow | SLOWER BUTTON | 5,000 | ×0.9 all production | −10% speed. Permanent. You're paying for this. |

### 5.3 Tier 3 — Commitment Issues (unlocked at 50K total)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| auto_5 | Number Philosopher | 130,000 | +1,400/s | Ponders the nature of up |
| click_2 | Click Multiplier | 75,000 | ×1.5 click power | Your clicks now have opinions |
| green | GREEN BUTTON | 100,000 | +0.1% all production | Finally, a button that helps. Barely. |

### 5.4 Tier 4 — Past the Point of No Return (unlocked at 1M total)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| auto_6 | Number Deity | 1,400,000 | +7,800/s | Ascended past caring. Numbers still go up. |
| mystery | ??? | 9,999,999 | Nothing. Different nothing. | ??? |
| anti_slow | FASTER BUTTON | 2,000,000 | ×1.05 all production | Partially undoes the slower button. Costs 400x more. |

### 5.5 Tier 5 — Why Are You Still Here (unlocked at 100M total)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| auto_7 | The Concept of Up | 20,000,000 | +44,000/s | It's not a person. It's an idea. The number respects it. |
| auto_8 | Number's Number | 200,000,000 | +250,000/s | Your number hired a number. That number goes up too. |
| void | THE VOID BUTTON | 500,000,000 | −50% current number, +25% production | Sacrifices half your number. The other half is grateful. |

### 5.6 Tier 6 — Endgame Content (There Is No Endgame) (unlocked at 10B total)

| ID | Name | Base Cost | Effect | Description |
|----|------|-----------|--------|-------------|
| auto_9 | Number Singularity | 5,000,000,000 | +1,400,000/s | All numbers are one number now. It goes up. |
| recursive | The Game Itself | 50,000,000,000 | +0.01% of current number/s | The game is playing itself. You can leave. You won't. |
| click_3 | Click of God | 100,000,000,000 | Click = 1s of production | Each click adds your full per-second rate. Why click when it's automatic? Because you can. |

### 5.7 Trap Upgrades — Detailed Behavior

**RED BUTTON:** Each purchase increments a counter. The button never does anything mechanical. It exists to test the player. Escalating purchase messages:

1. "You bought the red button. It does nothing. You knew this."
2. "Another red button. Still nothing."
3. "You keep buying red buttons. This says something about you."
4. "The red buttons are starting to notice you back."
5. "The red buttons have formed a union. Their demand: more red buttons."
6. "At this point the red buttons are buying YOU."
7+ (rotating): "Red." / "Button." / "Red button." / "You." / "Red you." / "Button red you button."

At 6+ red buttons owned, the main number display shifts from green to red. At 20+, the entire UI develops a red tint. At 50+, everything is red. The background. The text. The buy buttons. Everything. The game still works. It's just red now.

**SLOWER BUTTON:** Each purchase multiplies total production by 0.9. This stacks multiplicatively. The debuff persists through prestige cycles but resets on Ascension. Escalating messages based on total penalty:

- <20%: "Everything is now N% slower. You paid for this."
- 20-39%: "N% slower. The number is starting to resent you."
- 40-59%: "N% speed penalty. The number can barely move. It stares at you."
- 60-79%: "N% slower. The number has filed a restraining order."
- 80-89%: "N% slower. The number is technically still moving. Technically."
- 90%+: "The number has stopped believing in movement."

At 99%+ penalty, a secret achievement unlocks (see §10).

**MYSTERY BUTTON (???):** Each purchase costs a fortune and does nothing mechanical. Rotating flavor text on purchase (7 entries, cycling). However — and this is the one secret in the game — every 7th mystery button purchase adds a hidden +0.777% production bonus that is never displayed anywhere. No tooltip. No stat screen entry. The player will never know unless they datamine the game or notice the math is slightly off. If they somehow discover it and post about it, we do not confirm or deny.

---

## 6. Prestige Layers

The game has three nested prestige loops, each resetting the layer below it.

### 6.1 Layer 1: Prestige

**Unlock:** 10,000 total earned  
**Reset:** Current number, all Tier 1-6 upgrades, red button count  
**Reward:** +2% all production per prestige level, permanent  
**Currency name:** "Prestige" (it's not creative; the number doesn't care)

> **Note:** Slow penalty persists across prestige cycles. Resets on Ascension only. This is intentional. Suffer.

On prestige, a full-screen overlay appears with a random quote from the prestige quote pool (see §6.4). The player taps to dismiss.

### 6.2 Layer 2: Ascension

**Unlock:** Prestige level 10  
**Reset:** Everything Layer 1 resets, plus all prestige levels return to 0  
**Reward:** ×1.1 multiplier to all production per ascension level. Prestige bonuses are also multiplied. Slow penalty resets.  
**Currency name:** "Ascension"

Ascension quote pool is separate, more existential. Example: "You have ascended beyond prestige. The number doesn't know what that means. It goes up."

### 6.3 Layer 3: Transcendence

**Unlock:** Ascension level 5  
**Reset:** Everything. All of it. Ascension levels, prestige levels, upgrades. The only thing that persists is the transcendence counter, funny number sightings, and achievement progress.  
**Reward:** The number changes color permanently. Each transcendence level shifts the hue by 30°. At transcendence 12, you're back to green. +5% all production per transcendence level.  
**Currency name:** "Transcendence"

Transcendence quotes are one word each. "Up." "Number." "Again." "Why." "Up." (yes, "Up" appears twice)

### 6.4 Prestige Quote Pools

**Layer 1 — Prestige (melancholy snark):**

- "The number has been reset. It remembers nothing. But you do."
- "Was it worth it? Yes. The number goes up faster now."
- "Prestige Level Up. The void is 2% more generous."
- "You sacrificed everything. You gained almost nothing. Perfect."
- "The number is reborn. It doesn't know it died."
- "Reset complete. The number has forgotten its past life."
- "All that progress, gone. But the PERCENTAGE. The percentage remains."
- "Samsara. The cycle continues. The number goes up."
- "The number before was a different number. This is a new number. It doesn't know you yet."
- "Somewhere in the code, a variable was set to zero. That's all prestige is."

**Layer 2 — Ascension (existential):**

- "You have ascended beyond prestige. The number doesn't know what that means. It goes up."
- "Your prestiges are gone. You are left with a multiplier and a sense of loss."
- "Ascension complete. The meta-number acknowledges you."
- "The number goes up faster now, but at what cost? Exactly 0 cost. Ascension is free."
- "You reset the reset. The number respects the recursion."

**Layer 3 — Transcendence (single words):**

- "Up."
- "Number."
- "Again."
- "Why."
- "Up."
- "Still."
- "Here."
- "Going."
- "Up."

---

## 7. Funny Number System

### 7.1 Detection

The system monitors the raw integer floor of the current number as a digit string. When a known funny pattern appears as a substring, a popup fires. Detection runs against the full digit string in "Number Enjoyer" or "Unhinged" mode. In "Normal Person" and "Nerd" mode, detection still runs internally but popups are smaller and labeled "[hidden in notation]" as a hint to switch modes.

### 7.2 Popup Behavior

Each popup spawns at a random position (10-70% horizontal, 15-45% vertical), with a random rotation (±25°), and plays a burst animation: scale from 0.2→1.5→1.0, drift upward 90px, fade out over 2.2 seconds. There is a 2.5-second global cooldown between popups to prevent visual overload.

When multiple patterns match simultaneously, the highest-priority one fires. Priority is determined by pattern length first, then assigned priority value.

### 7.3 Number Registry

| Pattern | Color | Label | Size | Priority | Notes |
|---------|-------|-------|------|----------|-------|
| 5318008 | #ff69b4 | flip your phone | 24 | 13 | Calculator legend |
| 8008135 | #ff69b4 | BOOBIES | 42 | 12 | The full monty |
| 42069 | #ff00ff | ASCENDED | 44 | 12 | The fusion |
| 80085 | #ff69b4 | BOOBS | 38 | 10 | Classic |
| 9001 | #ff8800 | OVER 9000 | 34 | 9 | Requires being over 9000 |
| 1337 | #00ffff | LEET | 36 | 8 | Hackervoice: I'm in |
| 2319 | #cc44ff | WE GOT A 2319 | 26 | 7 | Monsters Inc. deep cut |
| 666 | #ff2222 | 666 | 40 | 7 | Number of the beast |
| 777 | #ffffff | 777 | 40 | 7 | Jackpot |
| 8008 | #ff69b4 | BOOB | 34 | 6 | Singular |
| 420 | #33cc33 | 420 | 36 | 6 | Blaze it |
| 1738 | #ffdd00 | YEAH BABY | 32 | 6 | Fetty Wap's legacy |
| 404 | #888888 | NOT FOUND | 32 | 5 | Error |
| 1234 | #ffaa00 | 1234! | 32 | 4 | Sequential excellence |
| 69 | #ff66cc | 69 | 34 | 3 | Nice |
| 67 | #44ff88 | 67 | 30 | 2 | If you know you know |

### 7.4 Audio Cues

Each funny number popup plays a short stinger sound. Most are a quick synth chirp in the popup's color-appropriate key. Special cases:

- **69:** A single voice sample: "Nice."
- **OVER 9000:** Distorted scream, 0.3 seconds, clipped
- **666:** Reversed piano chord
- **420:** Chill lo-fi hit with vinyl crackle
- **BOOBS/BOOBIES/BOOB:** Calculator beep sequence (ascending)
- **WE GOT A 2319:** Alarm klaxon, 0.5 seconds

### 7.5 Stats Tracking

All funny number sightings are permanently tracked across sessions and prestige resets. The Stats tab shows a "FUNNY NUMBER SIGHTINGS" section with each pattern's color, label, and total sighting count. This is the one stat that never resets. Ever. Not even on Transcendence.

---

## 8. Heavy Wallet DLC

### 8.1 Purchase Flow

Upon purchasing the DLC on Steam, the game detects it on next launch (or immediately via Steam API callback if running). A full-screen overlay appears:

> **HEAVY WALLET EQUIPPED**
>
> All number production has been permanently reduced by 0.001%.
>
> This cannot be undone. This cannot be uninstalled. This cannot be refunded after the number goes up even once.
>
> You paid $4.99 for this. The base game was $0.99.
>
> Thank you for your support.
>
> [ACCEPT YOUR FATE]

The player must click "ACCEPT YOUR FATE" to dismiss. There is no other button.

### 8.2 Mechanical Effect

A global multiplier of 0.99999 is applied to all production (passive and click). This stacks multiplicatively with all other modifiers. The debuff is called "Heavy Wallet" in the Stats screen and is displayed with a small wallet icon (💰) and the text "−0.001% (permanent, irremovable, you paid for this)."

### 8.3 Visual Indicator

A small pixel-art wallet icon appears to the left of the main number, permanently. It's subtle — roughly 16×16px equivalent. It never goes away. It doesn't animate. It's just there. If the player hovers over it (or long-presses on mobile/Deck), a tooltip reads: "$4.99."

### 8.4 DLC-Exclusive Trading Card

The DLC adds one additional Steam trading card to the set: **$4.99**. It is Common rarity. The card art is the number 4.99 in the same style as the other cards. Nothing special about it. It's the most expensive card to obtain because you need the DLC.

### 8.5 DLC-Exclusive Achievement

"Heavy Wallet" — *Purchased the Heavy Wallet DLC. All numbers are now 0.001% worse. Forever.*

This is a visible (non-hidden) achievement. It has a 100% unlock rate among DLC owners by definition.

---

## 9. Offline & Save System

### 9.1 Offline Progress

The game calculates offline production on return, capped at 8 hours. The return toast is always: "While you were gone, the number went up by [X]. It didn't miss you."

If the Heavy Wallet DLC is active, a second line appears beneath: "(0.001% less than it would have without the DLC.)"

### 9.2 Cloud Saves

Steam Cloud sync is enabled. Save data includes: current number, total-ever, all owned upgrade counts, prestige/ascension/transcendence levels, slow multiplier, red button count, mystery button count (and hidden bonus), funny number sightings, achievement progress, all timestamps.

### 9.3 Save Corruption Easter Egg

If the player attempts to edit their save file (detected via checksum mismatch), the game loads normally but the main number displays "CHEATER" in place of the number for 60 seconds. Production continues normally during this time. The number was still going up. You just couldn't see it. After 60 seconds, the display returns to normal with no penalty. An achievement unlocks: "Caught Red-Handed."

---

## 10. Achievements

67 achievements total. The number 67 is chosen deliberately.

### 10.1 Progression Achievements

| Name | Description | Condition | Hidden? |
|------|-------------|-----------|---------|
| The First Number | The number went up. | Reach 1 | No |
| Three Digits | The number has opinions now. | Reach 100 | No |
| Kilo | One thousand numbers, standing on each other's shoulders. | Reach 1,000 | No |
| The K Word | "K" appeared after your number. You've made it. | Reach 10,000 | No |
| Six Figures | Your number makes more than most people. | Reach 100,000 | No |
| Millionaire | The number is a millionaire. It will not share. | Reach 1,000,000 | No |
| 8 Digits | Welcome to "Number Enjoyer" territory. All the jokes live here. | Reach 10,000,000 | No |
| Billionaire | The number could buy Twitter. It chooses not to. | Reach 1,000,000,000 | No |
| Trillionaire | Congress would like a word. | Reach 1,000,000,000,000 | No |

### 10.2 Funny Number Achievements

| Name | Description | Condition | Hidden? |
|------|-------------|-----------|---------|
| Nice | The number hit 69. Nice. | Number contains 69 | Yes |
| If You Know | 67. | Number contains 67 | Yes |
| Blaze It | The number is enlightened. | Number contains 420 | Yes |
| Calculator Humor | The number said boobs. | Number contains 80085 | Yes |
| Advanced Calculator Humor | The number said boobies. | Number contains 8008135 | Yes |
| Flip Your Phone | ₈₀₀₈₅₁₃€ | Number contains 5318008 | Yes |
| Number of the Beast | The number went to a dark place. | Number contains 666 | Yes |
| Jackpot | 777. The number got lucky. | Number contains 777 | Yes |
| What Does the Scouter Say | IT'S OVER 9000 | Number contains 9001 | Yes |
| Leet | 1337 h4x0r | Number contains 1337 | Yes |
| The Answer | 42. But what's the question? | Number contains 42 | Yes |
| WE GOT A 2319 | Put it back where it came from or so help me. | Number contains 2319 | Yes |
| The Fusion | 42069. Two memes fused into one. The number has peaked. | Number contains 42069 | Yes |
| Yeah Baby | 1738. That's all we can legally say. | Number contains 1738 | Yes |
| Not Found | 404. The number went looking for itself and couldn't find it. | Number contains 404 | Yes |

### 10.3 Trap Upgrade Achievements

| Name | Description | Condition | Hidden? |
|------|-------------|-----------|---------|
| It's Red | Bought the red button. It does nothing. | Buy 1 red button | No |
| Red Collection | You own 5 red buttons. They do 5 nothings. | Buy 5 red buttons | No |
| Red Enthusiast | 10 red buttons. Your number is red now. | Buy 10 red buttons | No |
| Red Identity | 25 red buttons. You don't remember what green looked like. | Buy 25 red buttons | Yes |
| All Red Everything | 50 red buttons. There is only red. | Buy 50 red buttons | Yes |
| Self-Sabotage | Bought the slower button. On purpose. With your own numbers. | Buy 1 slower button | No |
| Terminal Velocity (Reverse) | Reached 50% speed penalty. The number respects your commitment to suffering. | 50% slow penalty | Yes |
| Asymptotic Agony | Reached 90% speed penalty. The number is technically still moving. | 90% slow penalty | Yes |
| Zeno's Paradox | Reached 99% speed penalty. The number will never reach its destination. | 99% slow penalty | Yes |
| ??? | ??? | Buy 1 mystery button | No |
| ??????? | ??????? | Buy 7 mystery buttons | Yes |
| The Secret No One Knows | You'll never see this description because you'll never earn this achievement. | Buy 49 mystery buttons (7×7, triggering the hidden bonus 7 times) | Yes |

### 10.4 Prestige Achievements

| Name | Description | Condition | Hidden? |
|------|-------------|-----------|---------|
| Samsara | The cycle begins. | Prestige for the first time | No |
| Prestige 5 | Five times the number has died and been reborn. | Reach prestige level 5 | No |
| Double Digits | 10 prestige levels. The percentage grows. | Reach prestige level 10 | No |
| The Meta-Reset | Ascended for the first time. Your prestiges are gone. | Ascend for the first time | No |
| Ascension 5 | The number has forgotten what ground level looks like. | Reach ascension level 5 | No |
| Beyond Beyond | Transcended for the first time. Why. | Transcend for the first time | Yes |
| Full Spectrum | Transcended 12 times. The hue rotated all the way around. You're back to green. | Transcendence level 12 | Yes |
| Prestige Within 60 Seconds | Reached the prestige threshold in under 60 seconds. | Prestige with <60s on the run timer | Yes |

### 10.5 Meta / Behavioral Achievements

| Name | Description | Condition | Hidden? |
|------|-------------|-----------|---------|
| First Click | You clicked the number. This is the whole game. | Click the number once | No |
| Thousand Clicks | Your finger is tired. The number is not. | 1,000 total clicks | No |
| Ten Thousand Clicks | Have you considered an auto-clicker? We won't judge. | 10,000 total clicks | Yes |
| Idle Hands | Let the game run for 10 minutes without clicking. | 10 min no clicks (while game is focused) | Yes |
| Idle Master | Let the game run for 1 hour without clicking. | 60 min no clicks | Yes |
| Alt-Tabbed | The game was in the background for 8 hours (the offline cap). | Return from max offline duration | Yes |
| The Long Stare | Stared at the stats page for 2 minutes straight. | Stats tab open 120s, no input | Yes |
| Card Collector | Viewed the trading cards tab. You can't actually collect them here. | Open the cards tab | No |
| Notation Nerd | Switched to Scientific notation. The number is now less fun. | Switch to "Nerd" mode | Yes |
| Unhinged Mode | Enabled "Unhinged" notation. The number will consume your screen. | Switch to "Unhinged" mode | Yes |
| Heavy Wallet | Purchased the Heavy Wallet DLC. All numbers are now 0.001% worse. Forever. | Own the DLC | No |
| Caught Red-Handed | Nice try. | Trigger save corruption detection | Yes |
| Two Buttons | Bought both the slower button and the faster button. The net effect is almost nothing. | Own both slower and faster buttons | Yes |
| Speedrun | Reached 1 million in under 5 minutes. | 1M total in <5min | Yes |
| The Full Experience | Bought every unique upgrade type at least once. | 1+ of each upgrade ID owned | Yes |
| 67 Achievements | You've unlocked all 67 achievements. That number was chosen on purpose. | All 67 achievements unlocked | Yes |

---

## 11. Steam Trading Cards & Community Items

### 11.1 Base Game Cards (8)

| Number | Rarity | Card Art | Background Color |
|--------|--------|----------|-----------------|
| 3 | Common | "3" in monospace, white on dark | Dark gray |
| 14 | Common | "14" in monospace, white on dark | Dark gray |
| 42 | Uncommon | "42" in monospace, blue glow | Deep blue |
| 69 | Uncommon | "69" in monospace, pink glow | Deep pink |
| 7 | Rare | "7" in monospace, LARGE, gold glow, pulsing | Gold/black |
| 100 | Common | "100" in monospace, white on dark | Dark gray |
| ∞ | Legendary | "∞" in monospace, magenta glow | Deep purple |
| 0 | Cursed | "0" in monospace, red, inverted colors | Blood red, inverted |

### 11.2 DLC Card (1)

| Number | Rarity | Card Art | Background Color |
|--------|--------|----------|-----------------|
| $4.99 | Common | "$4.99" in monospace, wallet icon | Gray. Disappointingly gray. |

### 11.3 Badges

Crafting all base cards produces the badge: a pixel-art upward arrow. Each badge level adds more upward arrows. Level 5 badge is just a screen full of arrows.

### 11.4 Emoticons

- `:ngu_up:` — An upward arrow
- `:ngu_7:` — The number 7, large
- `:ngu_red:` — A red circle (does nothing)
- `:ngu_wallet:` — A wallet (only if DLC owned)
- `:ngu_69:` — "69" in pink
- `:ngu_nice:` — "Nice." in plain text

### 11.5 Profile Backgrounds

- **Going Up** — Dark background with a single glowing green number scrolling upward infinitely
- **All Red Everything** — Solid red. That's it.
- **The Void** — Pure black with a single tiny white "0" in the center

---

## 12. Audio Design

### 12.1 Music

The soundtrack is a single lo-fi ambient track that evolves based on game state:

- **Base state:** Minimal — soft pad, light rhythm, nearly subliminal
- **High production (1K+/s):** Adds a gentle bass pulse
- **Very high production (100K+/s):** Adds arpeggiated synth
- **Extreme production (10M+/s):** Full mix, the track is actually a banger now
- **Post-prestige (30 seconds):** Everything cuts out except a single held note. Then the build starts over matching your new production rate.
- **Red Button corruption (20+ red):** The music detunes slightly. At 50+, it's noticeably off-key.
- **99% slow penalty:** Music slows to half speed. Bass drops an octave.

This creates a single-track adaptive score that the player "earns" by playing. The OST is purchasable as a Steam DLC for $0.99 and is listed as "NUMBER GOES UP (Original Soundtrack)" with a single 47-minute track titled "Up."

### 12.2 SFX

- **Click:** Soft mechanical click, pitch varies ±5% randomly
- **Buy upgrade:** Cash register "cha-ching," pitch scaled to cost
- **Buy red button:** The same click but... red. (It's the same sound. It's not actually red. It's a sound.)
- **Buy slow button:** A descending slide whistle
- **Buy mystery button:** Static burst, 0.2s
- **Prestige:** Ascending chime sequence, ethereal reverb
- **Ascension:** Same chime, reversed, then played forward again
- **Transcendence:** A single bass note. That's all.
- **Funny number popups:** See §7.4
- **Offline return toast:** A gentle "ping"

---

## 13. Settings

### 13.1 Gameplay Settings

- **Notation Mode:** Normal Person / Number Enjoyer (default) / Unhinged / Nerd
- **Offline Progress:** On (default) / Off (why?)
- **Screen Shake:** On (default) / Off / MAXIMUM
- **Funny Number Popups:** On (default) / Off (coward)
- **Number Color Override:** Locked unless 1+ transcendence. Allows manual hue selection.

### 13.2 Audio Settings

- **Master Volume**
- **Music Volume**
- **SFX Volume**
- **Funny Number Stinger Volume** (separate slider, defaults to 100%)

### 13.3 Accessibility

- **Reduced Motion:** Disables all animations, popups become static text
- **High Contrast Mode:** Increases all color contrast ratios to 7:1+
- **Screen Reader Announcements:** Announces milestones, prestige events, funny numbers via ARIA live regions
- **Auto-Click Option:** Toggleable automatic clicking at 1 click/second (does not disable click achievements — accessibility is not a penalty)
- **Colorblind Modes:** Protanopia / Deuteranopia / Tritanopia filters with label-only funny number indicators

---

## 14. Controller & Steam Deck

Full controller support. The number is always selected by default. A-button clicks it. D-pad/left stick navigates upgrades. Right trigger is a rapid-click hold (10 clicks/s). Left trigger opens the tab switcher.

Steam Deck verified. Performance target: 60fps at all times. The game is two numbers and some buttons. If we can't hit 60fps, we deserve the reviews.

The Steam Deck back grip buttons map to: L4 = prestige (with confirmation), R4 = buy best affordable upgrade.

---

## 15. Technical Architecture

### 15.1 Engine

The game is either a lightweight web-tech stack (Electron/Tauri with React) for minimum overhead, or a native implementation in a framework like Godot or Love2D. The entire game state fits in under 1KB of JSON. The rendering requirements are trivial. The hardest technical problem is making the Unhinged notation mode not crash the layout at 10^100.

### 15.2 Anti-Cheat Philosophy

There is no anti-cheat. The save file checksum exists solely to trigger the "Caught Red-Handed" achievement and 60-second cosmetic penalty. Players are free to cheat. The number still goes up. If someone edits their save to set the number to infinity, the display will show "Infinity" and a hidden achievement unlocks: "You Win?" — *You set the number to infinity. Is this winning? The number can't go up from here. You broke the one thing the game does.*

### 15.3 Performance Budget

- **Save file size:** <2KB
- **RAM usage:** <100MB (most of which is Electron/runtime overhead)
- **CPU idle:** <2% (one timer, one render)
- **Disk:** <50MB installed
- **Network:** Zero (except Steam API calls for achievements/cloud)

---

## 16. Marketing & Launch

### 16.1 Store Assets

- **Capsule art:** Black background with a giant green "↑" arrow
- **Screenshots:** Five screenshots, each showing just the number at different magnitudes. One screenshot shows the game fully red (50+ red buttons). One shows Unhinged mode with the number wrapping off screen.
- **Trailer:** 30 seconds. Black screen. The number appears at 0. It starts going up. No narration. No music. Just the number. At the end: "NUMBER GOES UP. $0.99." Cut to black. Then, quietly: "$4.99 Heavy Wallet DLC available. It makes the game worse."

### 16.2 Launch Strategy

Announce one week before launch. Single tweet: "There is a number. It goes up. $0.99 on Steam." No press kit. No influencer outreach. No early access. The game speaks for itself. The game says one thing: the number goes up.

### 16.3 Community

Steam discussions are pre-seeded with three pinned threads:

1. **"What does the red button do?"** — Locked. OP by developer. Body: "Nothing."
2. **"Is the game worth $0.99?"** — Locked. OP by developer. Body: "The number goes up."
3. **"Is the DLC worth $4.99?"** — Locked. OP by developer. Body: "No."

---

## 17. Post-Launch Roadmap

~~There is no roadmap.~~ The game is done. The number goes up. That's all it was ever going to do.

Steam Workshop support. We gave up on making sounds so now it's your problem. You're welcome.

If the game somehow sells 100,000 copies, a free update adds one (1) new upgrade: "You Shouldn't Have" — costs 1 trillion, produces 0/s, description reads "100,000 people bought this game. This upgrade is for them. It does nothing." If it sells 1 million copies, the upgrade's description changes to "Seriously?"

---

*This document is the number. It went up.*

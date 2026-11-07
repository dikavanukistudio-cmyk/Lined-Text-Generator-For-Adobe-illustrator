# Lined Text Generator

Transform standard text and vector artwork into iconic retro scanline typography in seconds.

Creating striped, ribbed typography—reminiscent of the legendary IBM logo and 80s synthwave aesthetics—usually requires tedious manual steps: drawing parallel lines, cutting them with Pathfinder, repairing broken open paths, and manually rounding terminal points.

**Lined Text Generator** completely automates this workflow into a single, seamless, non-destructive step directly inside Adobe Illustrator.

---

## Key Features

- **Real-Time Live Preview**
  - Adjust line frequency and stroke thickness on the fly. Watch your artwork update instantly on the artboard with zero lag.
- **True Vector Strokes (Not a Clipping Mask)**
  - The script generates genuine, independent open stroke paths. You maintain complete freedom to alter stroke weights, line colors, dash patterns, or gradients anytime after applying.
- **Smooth Round Cap Terminals**
  - Stroke segments automatically follow letter contours with clean, rounded pill-like ends for a refined, modern aesthetic.
- **Intelligent Counter and Hole Handling**
  - Powered by pure Cubic Bezier geometric intersection math. Letters with enclosed inner spaces (such as A, B, D, O, P, and R) are cropped accurately without visual distortion.
- **Non-Destructive Workflow**
  - Your original live text remains intact and safely hidden, allowing you to revise your typography or change words whenever needed.
- **Complete Parameter Control**
  - **Line Count:** Fine-tune line density from bold, sparse bars to dense scanlines.
  - **Stroke Weight:** Scale stroke thickness to match any font weight or artboard size.
  - **Cap Options:** Choose between Round Cap, Butt Cap (Flat), or Projecting Cap (Square).
  - **Color Modes:** Pick vibrant preset colors, match the original text fill, or use solid black.

---

## Ideal Applications

- **Logo & Brand Identity:** High-impact branding for technology, audio, gaming, sports, and futuristic themes.
- **Apparel & Screen Printing:** Generates clean, gap-separated vector paths ideal for screen printing, heat press, and vinyl cutting.
- **Posters & Album Art:** Bold, attention-grabbing display typography for headlines and album covers.
- **Type Designers & Foundries:** An effective utility to generate decorative display variants and promotional specimen artwork for Typepot.com catalogs.

---

## Technical Specifications

- **Product Type:** Adobe Illustrator ExtendScript (`.jsx`)
- **Compatibility:** Adobe Illustrator (Windows & macOS)
- **Execution:** Direct execution via `File > Scripts > Other Script...` (`Ctrl+F12` on Windows / `Cmd+F12` on Mac)
- **Dependencies:** None. Operates entirely using native Illustrator scripting architecture.

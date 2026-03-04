# fretful

A guitar learning app for practicing notes, chords, and triads on the fretboard — driven by a built-in metronome.

Built with React, TypeScript, Vite, Tailwind CSS, Tone.js, and the [tonal](https://github.com/tonaljs/tonal) music theory library.

---

## Features

### Metronome

A precise metronome powered by Tone.js Web Audio scheduling.

- **BPM control** — drag the arc dial or type a value (20–300 BPM)
- **Tap tempo** — tap a button to set BPM from your playing
- **Time signatures** — 2/4, 3/4, 4/4, 5/4, 6/8, 7/8
- **Accent mode** — toggleable downbeat accent (distinct click on beat 1)
- **Beat indicator** — animated dots show the current beat in real time

---

### Learn Notes

Ear-training drill for memorising every note on every string.

- One note name is shown per measure — find it on the fretboard before beat 1
- On beat 1, the answer dot appears on the fretboard and the note plays
- Cycles through all 12 chromatic pitches on the active string in random order, then moves to the next string
- String selector lets you jump to any string at any time
- Progress counter shows how many notes have been covered on the current string

---

### Learn Chords

Reference and drill tool for CAGED system chord voicings.

#### Reference mode

- Choose any root (all 12 chromatic roots) and quality (Major, Minor, Dom 7, Maj 7, Min 7, Dim, Aug, Sus2, Sus4, m7♭5)
- **Full Neck view** — shows all chord tones across the entire fretboard (frets 0–12) with interval or note-name labels
- **Voicings view** — shows individual closed CAGED voicings (E, A, G, C, D shapes) one at a time; navigate with ← → arrows; fretboard fixed at frets 0–12

#### Drill mode

- Select a root note and which chord qualities to include
- The metronome reveals one chord per measure: the chord name and CAGED shape are shown on beat 1, the previous chord's voicing dots appear simultaneously
- Cycles through all shapes for every selected quality
- Default: Major only; any combination of Major / Minor / Dom 7 / Maj 7 / Min 7
- **Settings button** — returns to drill configuration mid-drill without losing settings

---

### Learn Triads

Reference and drill tool for closed three-note triad voicings across all four string sets.

Voicings are computed algorithmically: for each string set and inversion, the algorithm finds the lowest physically playable closed position (fret span ≤ 4), covering all 12 roots and four qualities.

#### Reference mode

- Choose root, quality (Major, Minor, Dim, Aug), string set, and inversion
- String sets: **E A D**, **A D G**, **D G B**, **G B e**
- Inversions: **Root Position**, **1st Inversion**, **2nd Inversion**
- Label toggle: interval labels (R, 3, 5, ♭3, etc.) or note names
- Fretboard always shows frets 0–12

#### Drill mode

Configure and run a beat-synced triad drill:

- **Root** and **Quality** selectors
- **Horizontal mode** — stays on one string set at a time, sweeps from high fret to low fret, then moves to the next string set
- **Vertical mode** — groups voicings by neck position and jumps across string sets at each position, moving down the neck
- **Snake** — reverses direction on alternating passes (boustrophedon), creating a zigzag rather than a one-way sweep
- **Reverse** — flips the entire sequence end-to-end
- All four combinations (horizontal/vertical × snake/reverse) work independently
- **Settings button** — returns to drill configuration mid-drill without losing settings
- Fretboard fixed at frets 0–12 throughout; previous voicing's dots remain visible while the next challenge is shown

---

### Learn Scales

*Coming soon* — choose a root and mode to see the scale across the fretboard.

---

## Tech notes

- Hash-based routing (`/#/learn-notes`, `/#/learn-chords`, etc.) — works on static hosts including GitHub Pages
- Single metronome engine via React context; feature views subscribe via a beat callback ref
- Triad voicing algorithm tries two starting octaves per string to find all inversions; rejects spans > 4 frets; deduplicates to one voicing per (string set, inversion) pair
- FRETBOARD_NOTES covers frets 0–15 so high-position voicings (fret 12+) render correctly

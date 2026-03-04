import { Scale } from 'tonal'

export const GUITAR_STRINGS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']

export const FRETBOARD_NOTES: string[][] = GUITAR_STRINGS.map(
  note => Scale.get(`${note} chromatic`).notes
)

export function getFretForNote(stringIdx: number, note: string): number {
  const notes = FRETBOARD_NOTES[stringIdx]
  // Strip octave from note for comparison
  const noteName = note.replace(/\d/g, '')
  return notes.findIndex(n => n.replace(/\d/g, '') === noteName)
}

export function getChromatic(stringIdx: number): string[] {
  return shuffle(FRETBOARD_NOTES[stringIdx].map(n => n.replace(/\d/g, '')))
}

export function stripOctave(note: string): string {
  return note.replace(/\d/g, '')
}

export function shuffle<T>(arr: T[]): T[] {
  const clone = arr.slice()
  let currentIndex = clone.length
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[clone[currentIndex], clone[randomIndex]] = [clone[randomIndex], clone[currentIndex]]
  }
  return clone
}

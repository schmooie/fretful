import './App.css'
import { useState, useEffect } from 'react'
import Guitar, { getRenderFingerSpn } from 'react-guitar'
import { standard } from 'react-guitar-tunings'
import { Chord, Scale } from 'tonal'
import dark from 'react-guitar-theme-dark'
import Metronome from './components/Metronome'
import * as Tone from 'tone';

const triad = Chord.degrees("Cm");
[1, 2, 3].map(triad); // => ["C", "Eb", "G"];
[2, 3, 1].map(triad); // => ["Eb", "G", "C"];
[3, 1, 2].map(triad); // => ["G", "C", "Eb"];


const GUITAR_STRINGS = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
const FRETBOARD_NOTES: string[][] = GUITAR_STRINGS
  .map(note => Scale.get(`${note} chromatic`).notes);
const DEFAULT_BPM = 120;
const BEATS_PER_NOTE = 4;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [strings, setStrings] = useState(getEmptyStrings());
  const [activeStringIdx, setActiveStringIdx] = useState(5);
  const [notes, setNotes] = useState(getNotesForActiveString());
  const currentNote: string = notes[0];

  useEffect(() => {
    const beepEveryMs = SECONDS_IN_MINUTE / bpm * MS_IN_SECOND;
    const synth = new Tone.Synth().toDestination();
    let skipClick = false;

    const intervalId = setInterval(() => {
      if (!isPlaying) {
        return;
      }

      const beat = currentBeat + 1;
      const shouldMoveToNextNote = beat !== 0 && beat % BEATS_PER_NOTE === 0 ;

      if (shouldMoveToNextNote) {
        let newNotes = notes.slice();
        newNotes.shift();

        if (newNotes.length === 0) {
          newNotes = shuffle(shuffle(FRETBOARD_NOTES[activeStringIdx]));
        }
        setStrings(() => getStrings(activeStringIdx, notes[0]));
        setNotes(() => newNotes);
        skipClick = true;
      }

      setCurrentBeat((prevBeat) => prevBeat + 1);

      if (!skipClick) {
        synth.triggerAttackRelease('1', "16n", Tone.now());
      } else {
        synth.triggerAttackRelease(currentNote, "16n", Tone.now());
      }
    }, beepEveryMs);

    return () => clearInterval(intervalId);
  }, [bpm, currentBeat, notes, isPlaying, activeStringIdx, currentNote]);

  function getNotesForActiveString(index = activeStringIdx) {
    return shuffle(FRETBOARD_NOTES[index]);
  }

  function onFretClick(strings: number[]) {
    for (let i = 0; i < strings.length; i++) {
      if (strings[i] !== -1 && i !== activeStringIdx) {
        setNotes(getNotesForActiveString(i));
        return setActiveStringIdx(i);
      }
    }
  }

  return (
    <>
      <h1 className="flex items-baseline justify-center">
        <span className='text-sky-400 text-8xl'>{stripOctaveFromNote(currentNote)}</span>
      </h1>
      <div className="flex justify-end">
        <Metronome bpm={bpm} setBpm={setBpm} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />
      </div>
      <div style={{ fontSize: 8 }}>
        <Guitar
          theme={dark}
          strings={strings}
          frets={{from: 0, amount: 12}}
          onChange={onFretClick}
          renderFinger={getRenderFingerSpn(standard)}
          />
      </div>
    </>
  )
}

export default App

function getEmptyStrings() {
  return new Array(GUITAR_STRINGS.length).fill(-1);
}

function getStrings(stringIdx: number, note: string) {
  const strings:number[] = getEmptyStrings();

  strings[stringIdx] = FRETBOARD_NOTES[stringIdx].indexOf(note);

  return strings;
}

function shuffle(arr: string[]) {
  const clone = arr.slice();
  let currentIndex = arr.length;

  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [clone[currentIndex], clone[randomIndex]] = [clone[randomIndex], clone[currentIndex]];
  }

  return clone;
}

function stripOctaveFromNote(note: string) {
  return note.substr(0, note.length - 1)
}

// Runs the move finder off the page's main thread, so the screen never
// freezes while a computer player (or a hint) is thinking.
//
// Messages in:  { id, kind: 'env', env }         the game's env (sent once per game)
//               { id, kind: 'turn' | 'hint', state }
// Messages out: { id, ok: true, result } or { id, ok: false, error }

import { computerTurn, timeLimit } from './computer.js';
import { findHint } from './hint.js';

let env = null;
const now = () => performance.now();

self.onmessage = (e) => {
  const { id, kind } = e.data;
  try {
    if (kind === 'env') {
      env = e.data.env;
      self.postMessage({ id, ok: true, result: null });
      return;
    }
    if (!env) throw new Error('No game loaded');
    const state = e.data.state;
    const opts = { now, timeLimit: timeLimit(state.board) };
    const result = kind === 'turn' ? computerTurn(state, env, opts) : { move: findHint(state, env, opts) };
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};

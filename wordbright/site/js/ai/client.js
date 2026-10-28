// The page's side of the move finder: sends work to the worker (worker.js)
// and gives back a promise. If a worker cannot start, the same code runs on
// the page instead (it is quick, but the screen may pause for a moment).

import { computerTurn, timeLimit } from './computer.js';
import { findHint } from './hint.js';

let worker = null;
let broken = false;
let sentEnv = null;
let seq = 0;
const waiting = new Map();

function start() {
  if (worker || broken) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (e) {
    broken = true;
    return null;
  }
  worker.onmessage = (e) => {
    const job = waiting.get(e.data.id);
    if (!job) return;
    waiting.delete(e.data.id);
    if (e.data.ok) job.resolve(e.data.result); else job.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    e.preventDefault();
    broken = true;
    worker.terminate();
    worker = null;
    sentEnv = null;
    for (const job of waiting.values()) job.fallback();
    waiting.clear();
  };
  return worker;
}

function local(kind, state, env) {
  const opts = { now: () => performance.now(), timeLimit: timeLimit(state.board) };
  return kind === 'turn' ? computerTurn(state, env, opts) : { move: findHint(state, env, opts) };
}

function run(kind, state, env) {
  const w = start();
  if (!w) return new Promise((resolve) => setTimeout(resolve, 0)).then(() => local(kind, state, env));
  if (sentEnv !== env) {
    sentEnv = env;
    w.postMessage({ id: ++seq, kind: 'env', env });
  }
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const fallback = () => {
      try { resolve(local(kind, state, env)); } catch (err) { reject(err); }
    };
    waiting.set(id, { resolve, reject, fallback });
    w.postMessage({ id, kind, state });
  });
}

// { action, move, capped, found } for the computer whose turn it is.
export const askComputer = (state, env) => run('turn', state, env);

// { move } (null if no move was found) for the child whose turn it is.
export const askHint = (state, env) => run('hint', state, env);

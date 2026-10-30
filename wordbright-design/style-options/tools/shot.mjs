// Usage: node shot.mjs <url> <out.png> <width> [--dark] [--light] [--js "code;code"] [--wait ms] [--height h] [--full]
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const [url, out, width] = args;
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const has = (k) => args.includes(k);
const port = 9300 + Math.floor(Math.random() * 500);
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TMPDIR || '/tmp/'}wb-shot-${port}`, '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); target = (await r.json()).find((t) => t.type === 'page'); if (target) break; } catch {} await sleep(100); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const w = Number(width); const h = Number(opt('--height', w < 600 ? 844 : 900));
await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 600 ? 2 : 1, mobile: w < 600 });
const scheme = has('--dark') ? 'dark' : 'light';
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, ...(has('--reduce') ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])] });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(Number(opt('--wait', 1500)));
const js = opt('--js', '');
for (const step of js.split('|||').filter(Boolean)) {
  const r = await send('Runtime.evaluate', { expression: step, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.error('JS error', JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  else if (r.result?.result?.value !== undefined) console.log('=>', JSON.stringify(r.result.result.value).slice(0, 500));
  await sleep(Number(opt('--step', 1200)));
}
const shotParams = { format: 'png' };
if (has('--full')) {
  const m = await send('Page.getLayoutMetrics');
  const cs = m.result.cssContentSize || m.result.contentSize;
  shotParams.clip = { x: 0, y: 0, width: w, height: Math.ceil(cs.height), scale: 1 };
  shotParams.captureBeyondViewport = true;
}
const s = await send('Page.captureScreenshot', shotParams);
const fs = await import('node:fs');
fs.writeFileSync(out, Buffer.from(s.result.data, 'base64'));
ws.close(); proc.kill();
console.log('saved', out);

'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from './providers';

const rooms = ['The Locked Gateway', 'Identity Vault', 'Broken Archive', 'Power Grid', 'Control Room'];
const initialInput = '{\n  "accessCode": "0000"\n}';
type Result = { outcome: string; message: string; data?: { artifact: string } };

function TerminalIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 6 6-6 6M13 18h7" /></svg>;
}

export function Workspace() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const progress = useQuery(trpc.game.progress.queryOptions());
  const [input, setInput] = useState(initialInput);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'response' | 'history'>('response');
  const [starting, setStarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [clock, setClock] = useState<number | null>(null);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const retry = useRef<{ runId: string; requestId: string; input: { accessCode: string } } | null>(null);
  const unlock = useMutation(trpc.gateway.unlock.mutationOptions());
  const hint = useMutation(trpc.game.hint.mutationOptions());
  const restart = useMutation(trpc.game.restart.mutationOptions());
  const history = useQuery(trpc.game.history.queryOptions({
    runId: progress.data?.id ?? '00000000-0000-4000-8000-000000000000', cursor,
  }, { enabled: !!progress.data }));
  const solved = !!progress.data?.rooms.find(room => room.roomId === 'gateway')?.solvedAt;
  const hints = progress.data?.hints ?? [];
  const busy = unlock.isPending || hint.isPending || restart.isPending || starting;
  const progressUnavailable = progress.error && !['UNAUTHORIZED', 'NOT_FOUND'].includes(progress.error.data?.code ?? '');

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (confirmRestart) restartDialog.current?.showModal();
    else restartDialog.current?.close();
  }, [confirmRestart]);

  const elapsedSeconds = progress.data && clock
    ? Math.max(0, Math.floor((clock - Date.parse(progress.data.startedAt)) / 1000)) : 0;
  const elapsed = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: trpc.game.progress.queryKey() });
    await queryClient.invalidateQueries({ queryKey: trpc.game.history.queryKey() });
  }

  async function startGame() {
    setStarting(true);
    setError('');
    try {
      const response = await fetch('/api/session', { method: 'POST' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not start the game. Try again.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the game. Try again.'); }
    finally { setStarting(false); }
  }

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!progress.data || busy) return;
    setError('');
    setView('response');
    let data: unknown;
    try {
      if (new TextEncoder().encode(input).byteLength > 8192) throw new Error('JSON input must be 8 KB or smaller.');
      data = JSON.parse(input);
    } catch (cause) {
      setError(cause instanceof SyntaxError ? 'This is not valid JSON. Check the quotes, commas, and braces, then try again.' : (cause as Error).message);
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !('accessCode' in data) || typeof data.accessCode !== 'string' || Object.keys(data).length !== 1) {
      setError('Provide one field named accessCode with a string value. Example shape: { "accessCode": "0000" }.');
      return;
    }
    const puzzleInput = { accessCode: data.accessCode };
    const previous = retry.current;
    const payload = previous?.runId === progress.data.id && previous.input.accessCode === puzzleInput.accessCode
      ? previous : { runId: progress.data.id, requestId: crypto.randomUUID(), input: puzzleInput };
    retry.current = payload;
    try {
      const response = await unlock.mutateAsync(payload);
      setResult(response);
      retry.current = null;
      setCursor(undefined);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request failed. Retry to send the same request safely.'); }
  }

  async function revealHint() {
    if (!progress.data) return;
    setError('');
    try { await hint.mutateAsync({ runId: progress.data.id }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reveal a hint. Try again.'); }
  }

  async function restartGame() {
    if (!progress.data) return;
    setError('');
    try {
      await restart.mutateAsync({ runId: progress.data.id });
      retry.current = null;
      setResult(null);
      setInput(initialInput);
      setCursor(undefined);
      setView('response');
      setConfirmRestart(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restart. Try again.'); setConfirmRestart(false); }
  }

  return <main>
    <header className="topbar">
      <a href="/" className="brand" aria-label="API Contract Escape Room home"><span className="brand-icon"><TerminalIcon /></span><span>API Contract<span className="brand-subtitle">Escape Room</span></span></a>
      <div className="campaign-progress"><span>{solved ? '1' : '0'} of 5 rooms solved</span><div className="progress-track" aria-hidden="true"><span style={{ width: solved ? '20%' : '0%' }} /></div></div>
      <div className="header-actions"><span className="timer" aria-label={`Elapsed time ${elapsed}`}>{elapsed}</span><button className="quiet" disabled={!progress.data || busy} onClick={() => setConfirmRestart(true)}>Restart game</button></div>
    </header>

    <div className="workspace">
      <aside className="brief-pane" aria-label="Rooms and clues">
        <nav aria-label="Campaign rooms"><h2 className="section-title">Your route out</h2><ol className="room-list">
          {rooms.map((name, index) => <li key={name}><button className={`room-item ${index === 0 ? 'active' : ''}`} disabled={index > 0} aria-label={`${name}: ${index === 0 ? (solved ? 'Solved' : 'Current room') : 'Planned'}`} aria-current={index === 0 ? 'step' : undefined}>
            <span className="room-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{name}</strong><small>{index === 0 ? (solved ? 'Solved' : 'Current room') : 'Planned'}</small></span>
          </button></li>)}
        </ol></nav>
        <section className="mission"><h2>Restore the gateway.</h2><p>You are inside a server that has stopped responding. The outer gateway needs its original access code before any other system can be reached.</p>
          <div className="clue"><h3>Incident plaque</h3><p>“Commissioned in 1991. The gateway still remembers its first year.”</p></div>
          <p className="muted small">Find the four-digit code and send it to the gateway.</p>
        </section>
        <section className="inventory"><h3>Inventory <span className="count">{progress.data?.artifacts.length ?? 0}</span></h3>
          {progress.data?.artifacts.length ? progress.data.artifacts.map(artifact => <div className="artifact" key={artifact.kind}><span>Gateway receipt</span><code data-testid="artifact-value">{artifact.value}</code></div>) : <p className="muted small">Recovered credentials will appear here.</p>}
        </section>
        <section className="hint-section"><h3>Need a nudge?</h3><ol className="hint-list">{hints.map((text, index) => <li key={index}>{text}</li>)}</ol><button className="quiet hint-button" disabled={!progress.data || hints.length === 3 || busy} onClick={revealHint}>{hint.isPending ? 'Revealing...' : hints.length === 3 ? 'All hints revealed' : `Reveal hint ${hints.length + 1} of 3`}</button></section>
      </aside>

      <section className="request-pane" aria-labelledby="request-heading">
        <div className="pane-heading"><h2 id="request-heading">Request</h2><span className="badge">Mutation</span></div>
        <form onSubmit={sendRequest}>
          <label htmlFor="procedure">Procedure</label><select id="procedure" defaultValue="gateway.unlock"><option value="gateway.unlock">gateway.unlock</option></select>
          <div className="contract"><h3>Input contract</h3><code>{'{ accessCode: string }'}</code><p><code>accessCode</code> must contain exactly four digits. Send the value as a string.</p><details><summary>See a valid input shape</summary><pre>{'{ "accessCode": "0000" }'}</pre><p className="small muted">This demonstrates the syntax. It is not the solution.</p></details></div>
          <div className="editor-label"><label htmlFor="json-input">JSON input</label><span className="muted small">8 KB maximum</span></div>
          <textarea id="json-input" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={input} onChange={event => setInput(event.target.value)} disabled={!progress.data || busy} aria-describedby={error ? 'request-error' : 'input-help'} aria-invalid={!!error} />
          <p className="small muted" id="input-help">Requests run against your guest game. Refreshing keeps your progress.</p>
          {!progress.data ? <div className="start-panel"><p>{progress.isLoading ? 'Checking your saved game...' : 'Start a guest game to make your first request.'}</p><button type="button" className="primary" disabled={starting || progress.isLoading} onClick={startGame}>{starting ? 'Starting...' : 'Start guest game'}</button></div> : <button className="primary send-button" type="submit" disabled={busy}>{unlock.isPending ? 'Sending...' : 'Send request'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></button>}
          {error && <p className="error-message" id="request-error" role="alert">{error}</p>}
          {progressUnavailable && <p className="error-message" role="alert">Could not load your saved game. Check the connection and <button type="button" className="text-button" onClick={() => progress.refetch()}>retry</button>.</p>}
        </form>
      </section>

      <section className="response-pane" aria-labelledby="response-heading">
        <div className="pane-heading response-tabs"><h2 className="sr-only" id="response-heading">Response inspector</h2><div role="group" aria-label="Inspector view"><button aria-pressed={view === 'response'} onClick={() => setView('response')}>Response</button><button aria-pressed={view === 'history'} onClick={() => setView('history')}>History</button></div><span className="muted small">JSON</span></div>
        <div className="inspector-content">
          <p className="sr-only" role="status" aria-live="polite">{result?.message ?? (solved ? 'Gateway restored. Your progress is saved.' : '')}</p>
          {view === 'response' ? result ? <><div className={`result-status ${result.outcome === 'INCORRECT' ? 'incorrect' : 'solved'}`}><span className="badge">{result.outcome.replaceAll('_', ' ')}</span><h3>{result.outcome === 'INCORRECT' ? 'Valid request. Keep looking.' : 'Gateway restored.'}</h3><p>{result.message}</p></div><pre className="json-output" data-testid="response-json">{JSON.stringify(result, null, 2)}</pre></> : <div className="response-empty"><TerminalIcon /><h3>{solved ? 'Your gateway is restored.' : 'The server is listening.'}</h3><p>{solved ? 'Your receipt is saved in the inventory. Open History to inspect your previous requests.' : 'Send a request to inspect the response. Every accepted attempt is saved to your game history.'}</p></div>
          : <div className="history-list"><div className="history-heading"><h3>Request history</h3><span className="muted small">Latest first</span></div>{history.isLoading && <p className="muted">Loading attempts...</p>}{history.isError && <p className="error-message">Could not load history. <button className="text-button" onClick={() => history.refetch()}>Retry</button></p>}{!history.data?.items.length && !history.isLoading && !history.isError && <p className="muted">No accepted requests yet.</p>}{history.data?.items.map(attempt => {
            const response = attempt.response as { outcome?: string };
            return <details className="history-entry" key={attempt.id}><summary><span><code>{attempt.procedure}</code><small>{response.outcome?.replaceAll('_', ' ')}</small></span><time dateTime={attempt.createdAt}>{new Date(attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></summary><p className="muted small">{attempt.durationMs} ms · Input</p><pre>{JSON.stringify(attempt.input, null, 2)}</pre><p className="muted small">Response</p><pre>{JSON.stringify(attempt.response, null, 2)}</pre></details>;
          })}{(cursor || history.data?.nextCursor) && <div className="history-pagination">{cursor && <button className="quiet" onClick={() => setCursor(undefined)}>Latest attempts</button>}{history.data?.nextCursor && <button className="quiet" onClick={() => setCursor(history.data!.nextCursor!)}>Older attempts</button>}</div>}</div>}
          {solved && <div className="next-room-note"><h3>First system restored.</h3><p>This build includes the gateway room. Identity Vault and the remaining campaign rooms are planned next.</p></div>}
        </div>
      </section>
    </div>
    <footer><span><span className={`connection-dot ${progress.data ? 'connected' : ''}`} aria-hidden="true" />{progress.data ? 'Guest progress saved in Neon' : 'Guest game · no account needed'}</span><span>Gateway build · 1 playable room</span></footer>
    <dialog ref={restartDialog} onCancel={() => setConfirmRestart(false)} onClose={() => setConfirmRestart(false)} aria-labelledby="restart-heading"><h2 id="restart-heading">Start a fresh game?</h2><p>Your current progress and receipt will no longer be available in the active game.</p><div className="dialog-actions"><button className="quiet" disabled={restart.isPending} onClick={() => setConfirmRestart(false)} autoFocus>Keep playing</button><button className="primary" disabled={restart.isPending} onClick={restartGame}>{restart.isPending ? 'Restarting...' : 'Restart game'}</button></div></dialog>
  </main>;
}

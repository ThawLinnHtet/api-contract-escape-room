'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from './providers';
import type { QueryHistoryInput } from '@/shared/history';
import { rooms, contracts, schemas, artifactNames, type Procedure } from '@/shared/campaign';

const initialInput = '{\n  "accessCode": "0000"\n}';
type Result = { outcome: string; message: string; data?: unknown };

function TerminalIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 6 6-6 6M13 18h7" /></svg>;
}

export function Workspace() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const progress = useQuery(trpc.game.progress.queryOptions());
  const [roomIndex, setRoomIndex] = useState(0);
  const [procedure, setProcedure] = useState<Procedure>('gateway.unlock');
  const [showRecap, setShowRecap] = useState(true);
  const [unsavedQueries, setUnsavedQueries] = useState<QueryHistoryInput[]>([]);
  const [savingHistory, setSavingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const room = rooms[roomIndex];
  const contract = contracts[procedure];
  const [input, setInput] = useState(initialInput);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'response' | 'history'>('response');
  const [starting, setStarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [clock, setClock] = useState<number | null>(null);
  const seenRun = useRef<string | undefined>(undefined);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const retry = useRef<{ runId: string; requestId: string; serialized: string; procedure: Procedure } | null>(null);
  const unlock = useMutation(trpc.gateway.unlock.mutationOptions());
  const claim = useMutation(trpc.identity.claim.mutationOptions());
  const recover = useMutation(trpc.archive.recover.mutationOptions());
  const activate = useMutation(trpc.power.activate.mutationOptions());
  const restore = useMutation(trpc.control.restore.mutationOptions());
  const hint = useMutation(trpc.game.hint.mutationOptions());
  const saveQuery = useMutation(trpc.game.recordQuery.mutationOptions());
  const restart = useMutation(trpc.game.restart.mutationOptions());
  const history = useQuery(trpc.game.history.queryOptions({
    runId: progress.data?.id ?? '00000000-0000-4000-8000-000000000000', cursor,
  }, { enabled: !!progress.data }));
  const isSolved = (id: string) => !!progress.data?.rooms.find(r => r.roomId === id)?.solvedAt;
  const solved = isSolved(room.id);
  const solvedCount = progress.data?.rooms.filter(r => r.solvedAt).length ?? 0;
  const hints = progress.data?.roomHints[room.id] ?? [];
  const busy = sending || savingHistory || hint.isPending || restart.isPending || starting;
  const recap = !!progress.data?.completedAt && showRecap;
  const progressUnavailable = progress.error && !['UNAUTHORIZED', 'NOT_FOUND'].includes(progress.error.data?.code ?? '');

  useEffect(() => {
    if (!progress.data?.id || seenRun.current === progress.data.id) return;
    seenRun.current = progress.data.id;
    retry.current = null;
    setUnsavedQueries([]); setResult(null); setError(''); setCursor(undefined);
    setRoomIndex(0); setProcedure('gateway.unlock'); setInput(initialInput); setShowRecap(true);
  }, [progress.data?.id]);

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
    ? Math.max(0, Math.floor(((progress.data.completedAt ? Date.parse(progress.data.completedAt) : clock) - Date.parse(progress.data.startedAt)) / 1000)) : 0;
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
    const parsed = schemas[procedure].safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join(' '));
      return;
    }
    const previous = retry.current;
    const serialized = JSON.stringify(parsed.data);
    const requestId = previous?.runId === progress.data.id && previous.serialized === serialized && previous.procedure === procedure ? previous.requestId : crypto.randomUUID();
    retry.current = { runId: progress.data.id, requestId, serialized, procedure };
    const meta = { runId: progress.data.id, requestId };
    setSending(true);
    const started = performance.now();
    let queryRecord: QueryHistoryInput | undefined;
    try {
      let response: Result;
      switch (procedure) {
        case 'gateway.unlock': response = await unlock.mutateAsync({ ...meta, input: schemas[procedure].parse(data) }); break;
        case 'identity.claim': response = await claim.mutateAsync({ ...meta, input: schemas[procedure].parse(data) }); break;
        case 'archive.recover': response = await recover.mutateAsync({ ...meta, input: schemas[procedure].parse(data) }); break;
        case 'power.activate': response = await activate.mutateAsync({ ...meta, input: schemas[procedure].parse(data) }); break;
        case 'control.restore': response = await restore.mutateAsync({ ...meta, input: schemas[procedure].parse(data) }); break;
        case 'identity.status': {
          const queryInput = schemas[procedure].parse(data);
          const output = await queryClient.fetchQuery(trpc.identity.status.queryOptions({ runId: meta.runId }, { staleTime: 0 }));
          // The server stores only the documented public query shape.
          const clearance = output.clearance === 'archivist' ? 'archivist' : 'guest';
          response = { outcome: 'QUERY', message: 'Current clearance for your run.', data: output };
          queryRecord = { ...meta, durationMs: Math.min(600_000, Math.round(performance.now() - started)), procedure, input: queryInput, data: { clearance } };
          break;
        }
        case 'archive.search': {
          const queryInput = schemas[procedure].parse(data);
          const output = await queryClient.fetchQuery(trpc.archive.search.queryOptions({ runId: meta.runId, ...queryInput }, { staleTime: 0 }));
          response = { outcome: 'QUERY', message: 'Archive page retrieved. Follow nextCursor when present.', data: output };
          queryRecord = { ...meta, durationMs: Math.min(600_000, Math.round(performance.now() - started)), procedure, input: queryInput, data: output };
          break;
        }
        case 'power.status': {
          const queryInput = schemas[procedure].parse(data);
          const output = await queryClient.fetchQuery(trpc.power.status.queryOptions({ runId: meta.runId }, { staleTime: 0 }));
          response = { outcome: 'QUERY', message: 'Current switch sequence for your run.', data: output };
          queryRecord = { ...meta, durationMs: Math.min(600_000, Math.round(performance.now() - started)), procedure, input: queryInput, data: output };
          break;
        }
      }
      setResult(response);
      if (procedure === 'control.restore' && response.outcome !== 'INCORRECT') setShowRecap(true);
      retry.current = null;
      if (queryRecord) {
        try { await saveQuery.mutateAsync(queryRecord); }
        catch { setUnsavedQueries(previous => [...previous, queryRecord!]); }
      }
      setCursor(undefined);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request failed. Retry to send the same request safely.'); }
    finally { setSending(false); }
  }

  function chooseRoom(index: number) {
    if (busy) return;
    setShowRecap(false);
    setRoomIndex(index);
    const next = rooms[index].procedures[0];
    setProcedure(next);
    setInput(JSON.stringify(contracts[next].example, null, 2));
    setResult(null); setError(''); setView('response');
  }

  async function revealHint() {
    if (!progress.data) return;
    setError('');
    try { await hint.mutateAsync({ runId: progress.data.id, roomId: room.id, level: hints.length + 1 }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reveal a hint. Try again.'); }
  }

  async function restartGame() {
    if (!progress.data) return;
    setError('');
    try {
      await restart.mutateAsync({ runId: progress.data.id });
      retry.current = null;
      setUnsavedQueries([]);
      setShowRecap(true);
      setResult(null);
      chooseRoom(0);
      setInput(initialInput);
      setCursor(undefined);
      setView('response');
      setConfirmRestart(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restart. Try again.'); setConfirmRestart(false); }
  }

  async function retryHistory() {
    setSavingHistory(true);
    for (const entry of unsavedQueries) {
      try {
        await saveQuery.mutateAsync(entry);
        setUnsavedQueries(previous => previous.filter(item => item.requestId !== entry.requestId));
      } catch { break; }
    }
    await refresh();
    setSavingHistory(false);
  }

  return <main>
    <header className="topbar">
      <a href="/" className="brand" aria-label="API Contract Escape Room home"><span className="brand-icon"><TerminalIcon /></span><span>API Contract<span className="brand-subtitle">Escape Room</span></span></a>
      <div className="campaign-progress"><span>{solvedCount} of 5 rooms solved</span><div className="progress-track" aria-hidden="true"><span style={{ width: `${solvedCount * 20}%` }} /></div></div>
      <div className="header-actions">{progress.data?.completedAt && !recap && <button className="quiet" onClick={() => setShowRecap(true)}>View recap</button>}<span className="timer" aria-label={`Elapsed time ${elapsed}`}>{elapsed}</span><button className="quiet" disabled={!progress.data || busy} onClick={() => setConfirmRestart(true)}>Restart game</button></div>
    </header>

    <div className="workspace">
      <aside className="brief-pane" aria-label="Rooms and clues">
        <nav aria-label="Campaign rooms"><h2 className="section-title">Your route out</h2><ol className="room-list">
          {rooms.map((item, index) => {
            const locked = index > 0 && !isSolved(rooms[index - 1].id);
            const status = isSolved(item.id) ? 'Solved' : locked ? 'Locked' : 'Current room';
            return <li key={item.id}><button className={`room-item ${index === roomIndex && !recap ? 'active' : ''}`} disabled={locked || busy} onClick={() => chooseRoom(index)} aria-label={`${item.name}: ${status}`} aria-current={index === roomIndex && !recap ? 'step' : undefined}>
              <span className="room-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.name}</strong><small>{status}</small></span>
              {isSolved(item.id) && <svg className="room-check" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}
            </button></li>;
          })}
        </ol></nav>
        <section className="mission"><h1>{recap ? 'Server restored.' : room.title}</h1><p>{recap ? 'Your route is complete. Select a solved room to revisit its contracts, clues, and hints.' : room.story}</p>
          {!recap && <div className="clue"><h3>{room.clueTitle}</h3><p>{room.clue}</p></div>}
        </section>
        <section className="inventory"><h3>Inventory <span className="count">{progress.data?.artifacts.length ?? 0}</span></h3>
          {progress.data?.artifacts.length ? progress.data.artifacts.map(artifact => <div className="artifact" key={artifact.kind}><span>{artifactNames[artifact.kind] ?? artifact.kind}</span><code data-testid="artifact-value">{artifact.value}</code></div>) : <p className="muted small">Recovered credentials will appear here.</p>}
        </section>
        {!recap && <section className="hint-section"><h3>Need a nudge?</h3><ol className="hint-list">{hints.map((text, index) => <li key={index}>{text}</li>)}</ol><button className="quiet hint-button" disabled={!progress.data || hints.length === 3 || busy} onClick={revealHint}>{hint.isPending ? 'Revealing...' : hints.length === 3 ? 'All hints revealed' : `Reveal hint ${hints.length + 1} of 3`}</button></section>}
      </aside>

      <section className="request-pane" aria-labelledby="request-heading">
        <div className="pane-heading"><h2 id="request-heading">{recap ? 'Run complete' : 'Request'}</h2><span className="badge">{recap ? 'Restored' : contract.query ? 'Query' : 'Mutation'}</span></div>
        {recap ? <section className="run-recap" aria-labelledby="recap-heading"><h2 id="recap-heading">You’re out.</h2><p>All five systems are back online. Your completed run is saved.</p>
          <dl className="recap-facts"><div><dt>Rooms restored</dt><dd>{solvedCount} of 5</dd></div><div><dt>Elapsed time</dt><dd data-testid="completion-time">{elapsed}</dd></div><div><dt>Hints used</dt><dd>{progress.data?.hintsUsed ?? 0}</dd></div><div><dt>Requests saved</dt><dd>{progress.data?.requestCount ?? 0}</dd></div></dl>
          <h3>What you put into practice</h3><ol className="concept-list">{rooms.map(item => <li key={item.id}><strong>{item.name}</strong><p>{item.concept}</p></li>)}</ol>
          <button className="primary" onClick={() => setView('history')}>Review request history</button><p className="muted small recap-note">Revisit any solved room from the route, or restart for a fresh run.</p>
        </section> : <form onSubmit={sendRequest}>
          <label htmlFor="procedure">Procedure</label><select id="procedure" value={procedure} disabled={busy} onChange={event => {
            const next = event.target.value as Procedure;
            setProcedure(next); setInput(JSON.stringify(contracts[next].example, null, 2)); setError(''); setResult(null);
          }}>{room.procedures.map(name => <option key={name} value={name}>{name}</option>)}</select>
          <div className="contract"><h3>Input contract</h3><code>{contract.shape}</code><p>{contract.description}</p><details><summary>See a valid input shape</summary><pre>{JSON.stringify(contract.example, null, 2)}</pre><p className="small muted">An input template. Replace placeholder values with your evidence.</p></details></div>
          <div className="editor-label"><label htmlFor="json-input">JSON input</label><span className="muted small">8 KB maximum</span></div>
          <textarea id="json-input" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={input} onChange={event => setInput(event.target.value)} disabled={!progress.data || busy} aria-describedby={error ? 'request-error' : 'input-help'} aria-invalid={!!error} />
          <p className="small muted" id="input-help">Requests run against your guest game. Refreshing keeps your progress.</p>
          {!progress.data ? <div className="start-panel"><p>{progress.isLoading ? 'Checking your saved game...' : 'Start a guest game to make your first request.'}</p><button type="button" className="primary" disabled={starting || progress.isLoading} onClick={startGame}>{starting ? 'Starting...' : 'Start guest game'}</button></div> : <button className="primary send-button" type="submit" disabled={busy}>{sending ? 'Sending...' : 'Send request'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></button>}
          {error && <div><p className="error-message" id="request-error" role="alert">{error}</p><p className="muted small">Your input is kept. Send again to retry, or <button type="button" className="text-button" onClick={() => progress.refetch()}>reload the active game</button>.</p></div>}
          {progressUnavailable && <p className="error-message" role="alert">Could not load your saved game. Check the connection and <button type="button" className="text-button" onClick={() => progress.refetch()}>retry</button>.</p>}
        </form>}
      </section>

      <section className="response-pane" aria-labelledby="response-heading">
        <div className="pane-heading response-tabs"><h2 className="sr-only" id="response-heading">Response inspector</h2><div role="group" aria-label="Inspector view"><button aria-pressed={view === 'response'} onClick={() => setView('response')}>Response</button><button aria-pressed={view === 'history'} onClick={() => setView('history')}>History</button></div><span className="muted small">JSON</span></div>
        <div className="inspector-content">
          <p className="sr-only" role="status" aria-live="polite">{result?.message ?? (solved ? 'System restored. Your progress is saved.' : '')}</p>
          {unsavedQueries.length > 0 && <div className="history-warning" role="status"><p>{unsavedQueries.length} query {unsavedQueries.length === 1 ? 'response is' : 'responses are'} not saved. You can still inspect {unsavedQueries.length === 1 ? 'it' : 'them'} in History.</p><button className="quiet" disabled={savingHistory || busy} onClick={retryHistory}>{savingHistory ? 'Saving...' : 'Retry saving history'}</button></div>}
          {view === 'response' ? result ? <><div className={`result-status ${result.outcome === 'INCORRECT' ? 'incorrect' : result.outcome === 'QUERY' ? 'read' : 'solved'}`}><span className="badge">{result.outcome.replaceAll('_', ' ')}</span><h3>{result.outcome === 'INCORRECT' ? 'Valid request. Keep looking.' : result.outcome === 'QUERY' ? 'Response received.' : result.outcome === 'PROGRESS' ? 'Sequence advancing.' : 'System restored.'}</h3><p>{result.message}</p></div><pre className="json-output" data-testid="response-json">{JSON.stringify(result, null, 2)}</pre></> : <div className="response-empty"><TerminalIcon /><h3>{solved ? 'This system is restored.' : 'The server is listening.'}</h3><p>{solved ? 'Your progress is saved. Open History to inspect earlier requests, or continue to the next system.' : 'Send a request to inspect the response. Queries and accepted mutations are saved in your history.'}</p></div>
          : <div className="history-list"><div className="history-heading"><h3>Request history</h3><span className="muted small">Latest first</span></div>{history.isLoading && <p className="muted">Loading attempts...</p>}{history.isError && <p className="error-message">Could not load history. <button className="text-button" onClick={() => history.refetch()}>Retry</button></p>}{!unsavedQueries.length && !history.data?.items.length && !history.isLoading && !history.isError && <p className="muted">No accepted requests yet.</p>}{unsavedQueries.map(entry => <details className="history-entry" key={entry.requestId}><summary><span><code>{entry.procedure}</code><small>Query · not saved</small></span></summary><pre>{JSON.stringify({ input: entry.input, data: entry.data }, null, 2)}</pre></details>)}{history.data?.items.map(attempt => {
            const response = attempt.response as { outcome?: string };
            return <details className="history-entry" key={attempt.id}><summary><span><code>{attempt.procedure}</code><small>{attempt.source === 'query' ? 'Query · recorded response' : `Mutation · ${response.outcome?.replaceAll('_', ' ')}`}</small></span><time dateTime={attempt.createdAt}>{new Date(attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></summary><p className="muted small">{attempt.durationMs} ms · Input</p><pre>{JSON.stringify(attempt.input, null, 2)}</pre><p className="muted small">Response</p><pre>{JSON.stringify(attempt.response, null, 2)}</pre></details>;
          })}{(cursor || history.data?.nextCursor) && <div className="history-pagination">{cursor && <button className="quiet" onClick={() => setCursor(undefined)}>Latest attempts</button>}{history.data?.nextCursor && <button className="quiet" onClick={() => setCursor(history.data!.nextCursor!)}>Older attempts</button>}</div>}</div>}
          {!recap && solved && roomIndex < 4 && <div className="next-room-note"><h3>{room.name} restored.</h3><p>{room.concept}</p><button className="primary" onClick={() => chooseRoom(roomIndex + 1)} disabled={busy}>Continue to {rooms[roomIndex + 1].name}</button></div>}

        </div>
      </section>
    </div>
    <footer><span><span className={`connection-dot ${progress.data ? 'connected' : ''}`} aria-hidden="true" />{progress.data ? 'Progress saved' : 'Guest game · no account needed'}</span><span>Five systems. One way out.</span></footer>
    <dialog ref={restartDialog} onCancel={() => setConfirmRestart(false)} onClose={() => setConfirmRestart(false)} aria-labelledby="restart-heading"><h2 id="restart-heading">Start a fresh game?</h2><p>Your current progress and receipt will no longer be available in the active game.</p><div className="dialog-actions"><button className="quiet" disabled={restart.isPending} onClick={() => setConfirmRestart(false)} autoFocus>Keep playing</button><button className="primary" disabled={restart.isPending} onClick={restartGame}>{restart.isPending ? 'Restarting...' : 'Restart game'}</button></div></dialog>
  </main>;
}

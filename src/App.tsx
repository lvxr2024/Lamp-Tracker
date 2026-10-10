import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveSession, AppData, BlockReading, Screen, Session, SessionPatch, SubjectColor, Test } from './types';
import { loadData, saveData, uid } from './storage';
import { activeFocusedMs, activePausedMs, applySessionPatch, formatDuration } from './utils';
import { TopBar } from './components/TopBar';
import { FocusScreen } from './components/FocusScreen';
import { SessionsScreen } from './components/SessionsScreen';
import { StatsScreen } from './components/StatsScreen';
import { ResultsScreen, type LogTestRequest } from './components/ResultsScreen';
import { SessionLogSheet } from './components/SessionLogSheet';
import { Toast } from './components/Toast';
import type { TestFields } from './results';

export interface PendingLog {
  session: Session;
  subjectName: string;
}

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [screen, setScreen] = useState<Screen>('focus');
  const [pendingLog, setPendingLog] = useState<PendingLog | null>(null);
  const [logTestRequest, setLogTestRequest] = useState<LogTestRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const startSession = useCallback((subjectId: string, modeLabel: string) => {
    setData((d) => {
      const trimmed = modeLabel.trim();
      let mode = d.modes.find(
        (m) => m.subjectId === subjectId && m.label.toLowerCase() === trimmed.toLowerCase(),
      );
      let modes = d.modes;
      if (!mode) {
        mode = { id: uid(), subjectId, label: trimmed };
        modes = [...d.modes, mode];
      }
      const now = Date.now();
      const active: ActiveSession = {
        id: uid(),
        subjectId,
        modeId: mode.id,
        modeLabel: mode.label,
        startedAt: now,
        accumulatedMs: 0,
        accumulatedPausedMs: 0,
        runningSince: now,
        pausedSince: null,
        status: 'running',
      };
      return {
        ...d,
        modes,
        activeSession: active,
        lastUsed: { subjectId, modeLabel: mode.label },
      };
    });
  }, []);

  const togglePause = useCallback(() => {
    setData((d) => {
      const a = d.activeSession;
      if (!a) return d;
      const now = Date.now();
      if (a.status === 'running') {
        return {
          ...d,
          activeSession: {
            ...a,
            accumulatedMs: a.accumulatedMs + (now - (a.runningSince ?? now)),
            runningSince: null,
            pausedSince: now,
            status: 'paused',
          },
        };
      }
      return {
        ...d,
        activeSession: {
          ...a,
          accumulatedPausedMs: a.accumulatedPausedMs + (now - (a.pausedSince ?? now)),
          pausedSince: null,
          runningSince: now,
          status: 'running',
        },
      };
    });
  }, []);

  const endSession = useCallback(() => {
    setData((d) => {
      const a = d.activeSession;
      if (!a) return d;
      const now = Date.now();
      const session: Session = {
        id: a.id,
        subjectId: a.subjectId,
        modeId: a.modeId,
        modeLabel: a.modeLabel,
        startedAt: a.startedAt,
        endedAt: now,
        focusedMs: activeFocusedMs(a, now),
        pausedMs: activePausedMs(a, now),
        status: 'completed',
        notes: null,
        outputQuantity: null,
        outputUnit: null,
        efficiencyPerHour: null,
        friction: null,
      };
      setPendingLog({
        session,
        subjectName: d.subjects.find((s) => s.id === a.subjectId)?.name ?? '',
      });
      return { ...d, activeSession: null, sessions: [...d.sessions, session] };
    });
  }, []);

  const saveLog = useCallback(
    (sessionId: string, patch: SessionPatch) => {
      setData((d) => ({
        ...d,
        sessions: d.sessions.map((s) => (s.id === sessionId ? applySessionPatch(s, patch) : s)),
      }));
      setPendingLog((p) => {
        if (!p) return null;
        const focused = patch.focusedMs ?? p.session.focusedMs;
        const parts = [formatDuration(focused)];
        if (patch.qty !== null && patch.unit) {
          parts.push(`${patch.qty} ${patch.unit}`);
        }
        const note = patch.notes?.trim();
        if (note) parts.push(note.slice(0, 40) + (note.length > 40 ? '…' : ''));
        showToast(parts.join(' · '));
        return null;
      });
    },
    [showToast],
  );

  const discardSession = useCallback((sessionId: string) => {
    setData((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== sessionId) }));
    setPendingLog(null);
  }, []);

  const editSession = useCallback((sessionId: string, patch: SessionPatch) => {
    setData((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === sessionId ? applySessionPatch(s, patch) : s)),
    }));
  }, []);

  const addSubject = useCallback((name: string, color: SubjectColor) => {
    const id = uid();
    setData((d) => ({
      ...d,
      subjects: [...d.subjects, { id, name: name.trim(), color, createdAt: Date.now() }],
      lastUsed: { ...d.lastUsed, subjectId: id },
    }));
    return id;
  }, []);

  /** Rename (and recolor) a subject; sessions store subjectId, so history follows. */
  const renameSubject = useCallback((id: string, name: string, color: SubjectColor) => {
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) =>
        s.id === id ? { ...s, name: name.trim(), color } : s,
      ),
    }));
  }, []);

  /** Remove a subject and cascade: its modes, sessions, and tests go with it. */
  const deleteSubject = useCallback((id: string) => {
    setData((d) => {
      if (d.activeSession?.subjectId === id) return d; // guarded in the sheet too
      const subjects = d.subjects.filter((s) => s.id !== id);
      const lastUsed =
        d.lastUsed.subjectId === id
          ? { ...d.lastUsed, subjectId: subjects[0]?.id ?? null }
          : d.lastUsed;
      return {
        ...d,
        subjects,
        modes: d.modes.filter((m) => m.subjectId !== id),
        sessions: d.sessions.filter((s) => s.subjectId !== id),
        tests: d.tests.filter((t) => t.subjectId !== id),
        lastUsed,
      };
    });
  }, []);

  const saveTest = useCallback(
    (fields: TestFields) => {
      const test: Test = { ...fields, reading: null, id: uid(), createdAt: Date.now() };
      setData((d) => ({ ...d, tests: [...d.tests, test] }));
      showToast(`${test.title} logged`);
    },
    [showToast],
  );

  const updateTest = useCallback((id: string, fields: TestFields) => {
    setData((d) => ({
      ...d,
      tests: d.tests.map((t) => (t.id === id ? { ...t, ...fields } : t)),
    }));
  }, []);

  const deleteTest = useCallback((id: string) => {
    setData((d) => ({ ...d, tests: d.tests.filter((t) => t.id !== id) }));
  }, []);

  const saveReading = useCallback((id: string, reading: BlockReading) => {
    setData((d) => ({
      ...d,
      tests: d.tests.map((t) => (t.id === id ? { ...t, reading } : t)),
    }));
  }, []);

  /** Reading's "Next mode" → Focus, with the mode pre-filled for this subject. */
  const applyNextMode = useCallback((subjectId: string, modeLabel: string) => {
    setData((d) => ({ ...d, lastUsed: { subjectId, modeLabel } }));
    setScreen('focus');
  }, []);

  const requestLogTest = useCallback((subjectId: string | null) => {
    setLogTestRequest({ subjectId });
    setScreen('results');
  }, []);

  return (
    <div className="app">
      <TopBar
        screen={screen}
        onNavigate={setScreen}
        sessions={data.sessions}
        activeSession={data.activeSession}
      />
      <main className="main">
        {screen === 'focus' && (
          <FocusScreen
            data={data}
            onStart={startSession}
            onPause={togglePause}
            onEnd={endSession}
            onAddSubject={addSubject}
            onRenameSubject={renameSubject}
            onDeleteSubject={deleteSubject}
          />
        )}
        {screen === 'sessions' && <SessionsScreen data={data} onEdit={editSession} />}
        {screen === 'stats' && (
          <StatsScreen data={data} onOpenResults={() => setScreen('results')} onLogTest={requestLogTest} />
        )}
        {screen === 'results' && (
          <ResultsScreen
            data={data}
            logRequest={logTestRequest}
            onLogRequestHandled={() => setLogTestRequest(null)}
            onSaveTest={saveTest}
            onUpdateTest={updateTest}
            onDeleteTest={deleteTest}
            onSaveReading={saveReading}
            onApplyNextMode={applyNextMode}
          />
        )}
      </main>
      <footer className="footer">Data stays on this device.</footer>
      {pendingLog && (
        <SessionLogSheet
          pending={pendingLog}
          onSave={saveLog}
          onDiscard={discardSession}
          onSkip={(id, patch) => saveLog(id, { ...patch, notes: null })}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}

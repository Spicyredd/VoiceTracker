import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

// Helper to load data from LocalStorage safely
const loadState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (!saved) return defaultValue;
  try {
    return JSON.parse(saved);
  } catch (e) {
    return defaultValue;
  }
};

// Helper to restore Date objects within logs (JSON stores them as strings)
const loadLogs = () => {
  const saved = localStorage.getItem("session_logs");
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return parsed.map((log) => ({
      ...log,
      startTime: new Date(log.startTime),
      endTime: new Date(log.endTime),
    }));
  } catch (e) {
    return [];
  }
};

function App() {
  // --- STATE INITIALIZATION WITH PERSISTENCE ---
  const [setupDone, setSetupDone] = useState(() => loadState("session_setupDone", false));
  const [participants, setParticipants] = useState(() =>
    loadState("session_participants", [
      { id: 1, name: "Participant A", role: "Participant" },
      { id: 2, name: "Participant B", role: "Participant" },
      { id: 3, name: "Participant C", role: "Participant" },
    ])
  );

  const [surroundings, setSurroundings] = useState(() => loadState("session_surroundings", ""));
  const [darkMode, setDarkMode] = useState(() => loadState("session_darkMode", false));

  const [activeId, setActiveId] = useState(() => loadState("session_activeId", null));

  // Need to convert string back to Date if it exists
  const [currentStart, setCurrentStart] = useState(() => {
    const saved = localStorage.getItem("session_currentStart");
    return saved && saved !== "null" ? new Date(JSON.parse(saved)) : null;
  });

  const [logs, setLogs] = useState(() => loadLogs());
  const [, setTick] = useState(0);

  // --- PERSISTENCE EFFECT ---
  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("session_setupDone", JSON.stringify(setupDone));
    localStorage.setItem("session_participants", JSON.stringify(participants));
    localStorage.setItem("session_surroundings", JSON.stringify(surroundings));
    localStorage.setItem("session_darkMode", JSON.stringify(darkMode));
    localStorage.setItem("session_activeId", JSON.stringify(activeId));
    localStorage.setItem("session_currentStart", JSON.stringify(currentStart));
    localStorage.setItem("session_logs", JSON.stringify(logs));
  }, [setupDone, participants, surroundings, darkMode, activeId, currentStart, logs]);

  // --- TIMER TICK ---
  useEffect(() => {
    let interval = null;
    if (activeId !== null) {
      interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeId]);

  // --- DARK MODE CLASS ---
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  const handleNameChange = (id, newName) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  };

  const startSession = () => {
    setSetupDone(true);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset? All data will be lost.")) {
      localStorage.clear(); // Clear storage
      window.location.reload();
    }
  };

  const handleExport = () => {
    const envList = surroundings.split('\n').map(line => line.trim()).filter(l => l.length > 0);
    const formattedLogs = {};
    participants.forEach(p => {
      const userLogs = logs
        .filter(log => log.participantId === p.id)
        .map(log => [log.startTime.toISOString(), log.endTime.toISOString()]);
      formattedLogs[p.name] = userLogs;
    });

    const exportData = {
      env_objs: envList,
      participant_logs: formattedLogs
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Wrapped in useCallback so it works correctly inside the keyboard event listener
  const handleToggle = useCallback((participantId) => {
    const now = new Date();

    if (activeId !== null) {
      // Logic: If activeId is NOT null, it means someone was speaking.
      // We must check if currentStart exists to calculate duration.
      if (currentStart) {
        const newLog = {
          id: Date.now(),
          participantId: activeId,
          startTime: currentStart,
          endTime: now,
          duration: Math.floor((now - currentStart) / 1000),
        };
        setLogs((prev) => [newLog, ...prev]);
      }
    }

    if (activeId === participantId) {
      // Toggle OFF if clicking the same person
      setActiveId(null);
      setCurrentStart(null);
    } else {
      // Toggle ON new person
      setActiveId(participantId);
      setCurrentStart(now);
    }
  }, [activeId, currentStart]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    if (!setupDone) return;

    const handleKeyDown = (e) => {
      // Check which key was pressed and toggle specific IDs
      // Assumes IDs are 1, 2, 3 based on initial state
      if (e.key === "1") handleToggle(1);
      if (e.key === "2") handleToggle(2);
      if (e.key === "3") handleToggle(3);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setupDone, handleToggle]);


  const formatTime = (dateObj) => {
    if (!dateObj || !(dateObj instanceof Date)) return "--:--:--";
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getUserTotalSeconds = (id) => {
    let total = logs
      .filter((log) => log.participantId === id)
      .reduce((acc, curr) => acc + curr.duration, 0);

    if (activeId === id && currentStart) {
      total += Math.floor((new Date() - currentStart) / 1000);
    }
    return total;
  };

  const getCombinedTotalSeconds = () => {
    let total = logs.reduce((acc, curr) => acc + curr.duration, 0);
    if (activeId && currentStart) {
      total += Math.floor((new Date() - currentStart) / 1000);
    }
    return total;
  };

  const DarkModeToggle = () => (
    <button
      className="btn-icon"
      onClick={() => setDarkMode(!darkMode)}
      title="Toggle Dark Mode"
    >
      {darkMode ? "☀️" : "🌙"}
    </button>
  );

  // --- RENDER ---

  if (!setupDone) {
    return (
      <div className="setup-container">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <DarkModeToggle />
        </div>

        <div className="card setup-card">
          <h1>Session Setup</h1>
          {participants.map((p) => (
            <div key={p.id} className="input-group">
              <label>{p.role}</label>
              <input
                type="text"
                value={p.name}
                onChange={(e) => handleNameChange(p.id, e.target.value)}
              />
            </div>
          ))}
          <hr className="divider" />
          <div className="input-group">
            <label>Surrounding Environment / Objects</label>
            <textarea
              placeholder="Example(Separate By Enter):&#10;Table&#10;Chair&#10;Mic"
              value={surroundings}
              onChange={(e) => setSurroundings(e.target.value)}
              rows="4"
            />
          </div>
          <button className="btn-primary" onClick={startSession}>Start Session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-layout">
      {/* LEFT SIDE: CONTROLS */}
      <div className="control-panel">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>Session Controls</h2>
            <DarkModeToggle />
          </div>
          <button className="btn-secondary" onClick={handleReset}>Reset Session</button>
        </header>

        <div className="grid">
          {participants.map((p) => {
            const isActive = activeId === p.id;
            const totalSeconds = getUserTotalSeconds(p.id);
            return (
              <button
                key={p.id}
                className={`participant-card ${isActive ? "active" : ""}`}
                onClick={() => handleToggle(p.id)}
              >
                <h3>{p.name} <span style={{ fontSize: '0.8em', opacity: 0.7 }}>[{p.id}]</span></h3>
                <div className="current-timer">{formatDuration(totalSeconds)}</div>
                <span className="status">{isActive ? "SPEAKING NOW..." : "Tap or Press " + p.id}</span>
              </button>
            );
          })}
        </div>

        <div className="logs-section">
          <h3>History Log</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start - End</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const p = participants.find((p) => p.id === log.participantId);
                  const name = p ? p.name : "Unknown";
                  return (
                    <tr key={log.id}>
                      <td>{name}</td>
                      <td>{formatTime(log.startTime)} - {formatTime(log.endTime)}</td>
                      <td>{formatDuration(log.duration)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {logs.length === 0 && <p className="empty-logs">No activity yet.</p>}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: SIDEBAR */}
      <div className="sidebar">
        <div className="total-combined-section">
          <h4>Total Combined Time</h4>
          <div className="big-clock">
            {formatDuration(getCombinedTotalSeconds())}
          </div>
          <small>Limit: 03:00:00</small>
        </div>

        <div className="metadata-section">
          <h4>Environment</h4>
          <p className="metadata-text">{surroundings || "None"}</p>
        </div>

        <button className="btn-export" onClick={handleExport}>
          Download JSON Data
        </button>

        <h3>Individual Breakdown</h3>
        <ul className="stats-list">
          {participants.map(p => (
            <li key={p.id} className={activeId === p.id ? "active-stat" : ""}>
              <span className="stat-name">{p.name}</span>
              <span className="stat-time">{formatDuration(getUserTotalSeconds(p.id))}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
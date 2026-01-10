import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [setupDone, setSetupDone] = useState(false);
  const [participants, setParticipants] = useState([
    { id: 1, name: "Participant A", role: "Participant" },
    { id: 2, name: "Participant B", role: "Participant" },
    { id: 3, name: "Participant C", role: "Participant" },
  ]);

  const [surroundings, setSurroundings] = useState("");
  // NEW: Dark Mode State
  const [darkMode, setDarkMode] = useState(false);

  const [activeId, setActiveId] = useState(null);
  const [currentStart, setCurrentStart] = useState(null);
  const [logs, setLogs] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    let interval = null;
    if (activeId !== null) {
      interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeId]);

  // NEW: Apply Dark Mode class to body
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

  const handleToggle = (participantId) => {
    const now = new Date();

    if (activeId !== null) {
      const newLog = {
        id: Date.now(),
        participantId: activeId,
        startTime: currentStart,
        endTime: now,
        duration: Math.floor((now - currentStart) / 1000),
      };
      setLogs((prev) => [newLog, ...prev]);
    }

    if (activeId === participantId) {
      setActiveId(null);
      setCurrentStart(null);
    } else {
      setActiveId(participantId);
      setCurrentStart(now);
    }
  };

  const formatTime = (dateObj) => {
    if (!dateObj) return "--:--:--";
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

  // Helper component for the Toggle Button
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
        {/* Toggle placed in top right corner absolutely */}
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
              placeholder="Table&#10;Chair&#10;Mic"
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
                <h3>{p.name}</h3>
                <div className="current-timer">{formatDuration(totalSeconds)}</div>
                <span className="status">{isActive ? "SPEAKING NOW..." : "Tap to Continue"}</span>
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
                  const name = participants.find((p) => p.id === log.participantId).name;
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
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import API_BASE_URL from '../config/api';

const ImportantActionsList = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [importantActions, setImportantActions] = useState(
    JSON.parse(localStorage.getItem("importantActions") || "[]")
  );
  const [doneItems, setDoneItems] = useState(
    JSON.parse(localStorage.getItem("doneActions") || "[]")
  );

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports/filter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: currentUser?.uid })
        });
        const data = await res.json();
        setReports(data);
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
    };
    fetchReports();
  }, [currentUser?.uid]);

  const allActions = reports
    .flatMap((r) => (r.action_items || []).map((a) => ({
      id: `${r.id}-${a}`,
      meeting: r.title || "Untitled Meeting",
      date: r.date,
      action: a,
    })))
    .filter((item) => importantActions.includes(item.id));

  const toggleDone = (id) => {
    const updated = doneItems.includes(id)
      ? doneItems.filter((x) => x !== id)
      : [...doneItems, id];
    setDoneItems(updated);
    localStorage.setItem("doneActions", JSON.stringify(updated));
  };

  const removeAction = (id) => {
    const updated = importantActions.filter((x) => x !== id);
    setImportantActions(updated);
    localStorage.setItem("importantActions", JSON.stringify(updated));
  };

  if (allActions.length === 0) {
    return <p style={{ color: "#aaa" }}>No important action items selected.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {allActions.map((item) => (
        <div
          key={item.id}
          style={{
            background: "#1f1f2b",
            padding: "15px",
            borderRadius: "10px",
            border: "1px solid #2e2e3c",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: doneItems.includes(item.id) ? 0.6 : 1,
          }}
        >
          <div>
            <strong style={{ color: "#e3e1f7" }}>{item.action}</strong>
            <p style={{ color: "#888", fontSize: "0.85rem" }}>
              {item.meeting} — {new Date(item.date).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="checkbox"
              checked={doneItems.includes(item.id)}
              onChange={() => toggleDone(item.id)}
              title="Mark as done"
            />
            <button
              onClick={() => removeAction(item.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "#ff6b6b",
                cursor: "pointer",
                fontSize: "1rem",
              }}
              title="Remove action"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImportantActionsList;

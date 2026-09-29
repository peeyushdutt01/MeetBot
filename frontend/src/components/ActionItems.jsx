// frontend/components/ActionItems.jsx
import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { useAuth } from "../contexts/AuthContext";
import API_BASE_URL from '../config/api';


const ActionItems = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [importantActions, setImportantActions] = useState(
    JSON.parse(localStorage.getItem("importantActions") || "[]")
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
        setReports(data.reverse());
 // newest on top
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
    };
    fetchReports();
  }, []);

  const toggleImportant = (action, meetingId) => {
    const key = `${meetingId}-${action}`;
    let updated;
    if (importantActions.includes(key)) {
      updated = importantActions.filter((item) => item !== key);
    } else {
      updated = [...importantActions, key];
    }
    setImportantActions(updated);
    localStorage.setItem("importantActions", JSON.stringify(updated));
  };

  return (
    <div>
      <Navbar />
      <main className="container action-items-container">
        <span className="eyebrow">FOLLOW-THROUGH</span>
        <h1 className="action-items-title">Action items</h1>
        <p className="action-items-subtitle">
          Review all action items across meetings and mark important ones for your dashboard.
        </p>

        {reports.length === 0 ? (
          <div className="empty-state"><h3>No action items yet</h3><p>Actions from your meeting reports will appear here.</p></div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="action-item-card"
            >
              <h3 className="action-item-meeting-title">
                {report.title || "Untitled Meeting"}
              </h3>
              <p className="action-item-date">
                {new Date(report.date).toLocaleString()}
              </p>

              {report.action_items && report.action_items.length > 0 ? (
                <ul className="action-items-list">
                  {report.action_items.map((action, index) => {
                    const key = `${report.id}-${action}`;
                    const checked = importantActions.includes(key);
                    return (
                      <li
                        key={index}
                        className="action-item-row"
                      >
                        <span className="action-item-text">{action}</span>
                        <input
                          type="checkbox"
                          aria-label={`Mark important: ${action}`}
                          className="action-item-checkbox"
                          checked={checked}
                          onChange={() => toggleImportant(action, report.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="action-items-empty-list">No action items for this meeting.</p>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default ActionItems;

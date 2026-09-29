import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import API_BASE_URL from '../config/api';

const readItems = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
};

const ImportantActionsList = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [importantActions, setImportantActions] = useState(() => readItems('importantActions'));
  const [doneItems, setDoneItems] = useState(() => readItems('doneActions'));
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reports/filter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: currentUser?.uid }) });
        setReports(await response.json());
      } catch (err) { console.error('Error fetching reports:', err); }
    };
    fetchReports();
  }, [currentUser?.uid]);
  const allActions = reports.flatMap(report => (report.action_items || []).map(action => ({
    id: `${report.id}-${action}`, meeting: report.title || 'Untitled meeting', date: report.date, action
  }))).filter(item => importantActions.includes(item.id));
  const toggleDone = (id) => {
    const updated = doneItems.includes(id) ? doneItems.filter(item => item !== id) : [...doneItems, id];
    setDoneItems(updated); localStorage.setItem('doneActions', JSON.stringify(updated));
  };
  const removeAction = (id) => {
    const updated = importantActions.filter(item => item !== id);
    setImportantActions(updated); localStorage.setItem('importantActions', JSON.stringify(updated));
  };
  if (!allActions.length) return <p className="empty-note">No important actions selected. Mark actions on the Actions page to pin them here.</p>;
  return <div>{allActions.map(item => <div key={item.id} className={`important-action ${doneItems.includes(item.id) ? 'done' : ''}`}>
    <div><strong>{item.action}</strong><p>{item.meeting} · {new Date(item.date).toLocaleDateString()}</p></div>
    <div className="important-action-controls"><input type="checkbox" checked={doneItems.includes(item.id)} onChange={() => toggleDone(item.id)} aria-label={`Mark complete: ${item.action}`} /><button onClick={() => removeAction(item.id)} aria-label={`Remove: ${item.action}`}>×</button></div>
  </div>)}</div>;
};
export default ImportantActionsList;

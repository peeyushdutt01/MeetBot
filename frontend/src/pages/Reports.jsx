import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import ReportCard from '../components/ReportCard';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import API_BASE_URL from '../config/api';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/reports`, { uid: currentUser?.uid }, { headers: { 'Content-Type': 'application/json' } });
      setReports(response.data);
      setError('');
    } catch (err) { console.error('Error fetching reports:', err); setError('Could not load reports. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchReports(); }, [currentUser?.uid]);
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try { await axios.delete(`${API_BASE_URL}/api/reports/${id}`); await fetchReports(); }
    catch (err) { console.error('Error deleting report:', err); setError('Could not delete report. Please try again.'); }
  };
  return <div><Navbar /><main className="container"><div>
    <div className="page-header"><div><span className="eyebrow">MEETING LIBRARY</span><h1>Reports</h1><p>Find the key points, decisions, and transcripts from past meetings.</p></div><button className="btn-secondary" onClick={fetchReports}>Refresh</button></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {loading ? <div className="empty-state">Loading reports…</div> : reports.length ? <div id="reportsList">{reports.map((report, index) => <ReportCard key={report.id || index} report={report} onDelete={handleDelete} />)}</div> : <div className="empty-state"><h3>No reports yet</h3><p>Upload a meeting recording to generate your first report.</p></div>}
  </div></main></div>;
};
export default Reports;

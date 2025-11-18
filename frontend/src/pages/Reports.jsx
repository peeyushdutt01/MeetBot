import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ReportCard from '../components/ReportCard';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import API_BASE_URL from '../config/api';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const fetchReports = async () => {
  try {
    setLoading(true);

    const response = await axios.post(
      `${API_BASE_URL}/api/reports`,
      { uid: currentUser?.uid },
      { headers: { "Content-Type": "application/json" } }
    );

    setReports(response.data);
    setError(null);
  } catch (error) {
    console.error("Error fetching reports:", error);
    setError("Failed to load reports. Please try again.");
  } finally {
    setLoading(false);
  }
  };


  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/api/reports/${reportId}`);
      // Refresh reports list after successful deletion
      await fetchReports();
      // Or update state directly without refetching
      // setReports(reports.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report. Please try again.');
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container">
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '30px' 
          }}>
            <h2 style={{ color: '#a087fa' }}>
              Meeting Reports
            </h2>
            <button 
              onClick={fetchReports}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              🔄 Refresh
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <p>Loading reports...</p>
            </div>
          )}

          {error && (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              color: '#ff6b6b',
              background: '#2a2c3e',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#888',
              background: '#21232d',
              borderRadius: '12px'
            }}>
              <p style={{ fontSize: '3rem', marginBottom: '20px' }}>📋</p>
              <h3 style={{ marginBottom: '10px', color: '#a087fa' }}>No Reports Yet</h3>
              <p>Upload a meeting recording to generate your first report</p>
            </div>
          )}

          <div id="reportsList">
            {reports.map((report, index) => (
              <ReportCard 
                key={report.id || index} 
                report={report}
                onDelete={handleDelete} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;

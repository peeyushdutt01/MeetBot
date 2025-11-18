import React, { useState } from 'react';

const ReportCard = ({ report, onDelete }) => {
  const [activeTab, setActiveTab] = useState('summary');

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(report.id);
    }
  };

  return (
    <div className="report-card">
      <div className="report-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="report-title">{report.title || report.filename}</h3>
          <span className="report-date" style={{ marginTop: '8px', fontSize: '0.9rem', color: '#888' }}>
            {formatDate(report.date)}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleDelete}
            style={{
              background: 'transparent',
              border: '1px solid #ff6b6b',
              color: '#ff6b6b',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#ff6b6b';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = '#ff6b6b';
            }}
            title="Delete report"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="button-row">
        <button
          className={`card-toggle-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`card-toggle-btn ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          Participants
        </button>
        <button
          className={`card-toggle-btn ${activeTab === 'highlights' ? 'active' : ''}`}
          onClick={() => setActiveTab('highlights')}
        >
          Highlights
        </button>
        <button
          className={`card-toggle-btn ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
      </div>

      {activeTab === 'summary' && (
        <div className="report-content-section open">
          <div className="summary-content">
            <p>{report.summary || 'No summary available'}</p>
          </div>
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="report-content-section open">
          {report.participants && report.participants.length > 0 ? (
            <ul className="participant-list">
              {report.participants.map((participant, idx) => (
                <li key={idx}>
                  <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>👤</span>
                  {participant}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#888' }}>No participants identified</p>
          )}

          {report.key_dates && report.key_dates.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#a087fa' }}>
                Key Dates & Events
              </h4>
              <ul className="participant-list">
                {report.key_dates.map((date, idx) => (
                  <li key={idx}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>📅</span>
                    {date}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'highlights' && (
        <div className="report-content-section open">
          {report.key_topics && report.key_topics.length > 0 && (
            <>
              <h4 style={{ marginBottom: '10px', color: '#a087fa' }}>Key Topics</h4>
              <ul className="actions-list">
                {report.key_topics.map((topic, idx) => (
                  <li key={idx}>
                    {topic}
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.action_items && report.action_items.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#a087fa' }}>
                Action Items
              </h4>
              <ul className="actions-list">
                {report.action_items.map((action, idx) => (
                  <li key={idx}>
                    {action}
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.decisions && report.decisions.length > 0 && (
            <>
              <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#a087fa' }}>
                Decisions Made
              </h4>
              <ul className="actions-list">
                {report.decisions.map((decision, idx) => (
                  <li key={idx}>
                    {decision}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'transcript' && (
        <div className="report-content-section open">
          <div className="transcript-content">
            {report.transcript ? (
              <p style={{
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                color: '#ddd'
              }}>
                {report.transcript}
              </p>
            ) : (
              <p style={{ color: '#888' }}>No transcript available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportCard;

import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from "../contexts/AuthContext";
import API_BASE_URL from '../config/api';


const ActiveMeetings = ({ activeMeetings, onRefresh }) => {
  const { currentUser } = useAuth();  
  const [fetchingTranscript, setFetchingTranscript] = useState({});
  const [stoppingBot, setStoppingBot] = useState({});
  const [transcriptError, setTranscriptError] = useState(null);

  const handleFetchTranscriptManual = async (meetingId, meetingTitle, meeting) => {
    // Validate meeting ID before making API call
    if (!meetingId || meetingId === 'undefined') {
      alert('❌ Error: Meeting ID is missing. Cannot fetch transcript.');
      console.error('Invalid meeting ID:', meetingId);
      return;
    }

    setFetchingTranscript(prev => ({ ...prev, [meetingId]: true }));
    setTranscriptError(null);

    try {
      console.log("🔍 Fetching transcript for meeting ID:", meetingId);
      console.log("📋 Full meeting object:", meeting);

      const response = await axios.post(
        `${API_BASE_URL}/api/fetch-transcript/${meetingId}`,
        {
          uid: currentUser?.uid || null,      // 🔥 SEND UID
          email: currentUser?.email || null,       // Optional: store who fetched transcript
        }

      );
      
      if (response.data.success) {
        alert(`✅ Transcript fetched successfully for "${meetingTitle}"!\n\nReport has been generated and saved to your reports.`);
        // Refresh active meetings list
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        setTranscriptError(`Failed: ${response.data.error}`);
        alert(`⚠️ ${response.data.error}\n\nPlease try again in a few moments.`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setTranscriptError(errorMsg);
      
      if (errorMsg.includes('not available yet') || errorMsg.includes('Empty') || errorMsg.includes('not ready')) {
        alert(`⏳ Transcript Not Ready\n\nThe meeting recording is still being processed. This usually takes:\n• 1-2 minutes after someone starts speaking\n• Up to 5 minutes after the meeting ends\n\nPlease:\n1. Make sure people have spoken in the meeting\n2. Wait a few more minutes\n3. Try again\n\nThe bot is still active and recording!`);
      } else if (err.response?.status === 500) {
        alert(`❌ Server Error\n\nThe transcript is still being processed by Vexa. Please:\n• Wait 2-3 more minutes\n• Try clicking "Get Transcript Now" again\n• Or wait for the scheduled end time\n\nNote: Transcripts can take up to 5 minutes to become available after the meeting ends.`);
      } else {
        alert(`❌ Error: ${errorMsg}\n\nPlease try again or check the console for details.`);
      }
    } finally {
      setFetchingTranscript(prev => ({ ...prev, [meetingId]: false }));
    }
  };

  const handleStopBot = async (meetingId, meetingTitle) => {
    // Validate meeting ID before making API call
    if (!meetingId || meetingId === 'undefined') {
      alert('❌ Error: Meeting ID is missing. Cannot stop bot.');
      console.error('Invalid meeting ID:', meetingId);
      return;
    }

    const confirmed = window.confirm(
      `🛑 Stop Bot for "${meetingTitle}"?\n\n` +
      `This will:\n` +
      `• Remove the bot from the meeting\n` +
      `• Stop recording\n` +
      `• Mark the meeting as ended\n\n` +
      `You can still fetch the transcript if one is available.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setStoppingBot(prev => ({ ...prev, [meetingId]: true }));

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/stop-bot/${meetingId}`,
        {
          uid: currentUser?.uid || null
        }
      );
      
      if (response.data.success) {
        alert(`✅ Bot stopped successfully for "${meetingTitle}"!\n\nThe meeting has been marked as ended.`);
        // Refresh active meetings list
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        alert(`⚠️ ${response.data.error}`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      alert(`❌ Error stopping bot: ${errorMsg}`);
      console.error('Stop bot error:', err);
    } finally {
      setStoppingBot(prev => ({ ...prev, [meetingId]: false }));
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress': return { bg: '#1a472a', border: '#22c55e', text: '#4ade80' };
      case 'bot_joining': return { bg: '#1e3a5f', border: '#3b82f6', text: '#60a5fa' };
      case 'processing': return { bg: '#4a3a1a', border: '#f59e0b', text: '#fbbf24' };
      default: return { bg: '#2e2e3c', border: '#666', text: '#aaa' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'in_progress': return '🟢';
      case 'bot_joining': return '🔵';
      case 'processing': return '⏳';
      default: return '⚪';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_progress': return 'Active';
      case 'bot_joining': return 'Joining...';
      case 'processing': return 'Processing...';
      default: return status;
    }
  };

  return (
    <div className="card">
      <div className="active-meetings-header">
        <h3 style={{ margin: 0 }}>🤖 Active Meetings</h3>
        {activeMeetings.length > 0 && (
          <span className="active-meetings-badge">
            {activeMeetings.length} active
          </span>
        )}
      </div>

      {transcriptError && (
        <div className="active-meetings-error">
          {transcriptError}
        </div>
      )}

      {activeMeetings.length > 0 ? (
        <div className="active-meetings-list">
          {activeMeetings.map((meeting) => {
            const status = meeting.status_info?.status || 'unknown';
            const meetingId = meeting.meeting_id || meeting.id;  // Extract meeting ID once
            const isFetching = fetchingTranscript[meetingId];
            const isStopping = stoppingBot[meetingId];
            const canFetch = status === 'in_progress' && meetingId;  // Only allow if ID exists
            const canStop = (status === 'in_progress' || status === 'bot_joining') && meetingId;  // Only allow if ID exists
            const colors = getStatusColor(status);

            return (
              <div
                key={meeting.id || meeting.meeting_id || Math.random()}  // Fallback key
                className="active-meeting-item"
              >
                <div style={{ marginBottom: '8px' }}>
                  <div className="active-meeting-title">
                    {meeting.title}
                  </div>
                  
                  <div 
                    className="active-meeting-status"
                    style={{
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      color: colors.text
                    }}
                  >
                    <span>{getStatusIcon(status)}</span>
                    <span>{getStatusText(status)}</span>
                  </div>
                </div>

                <div className="active-meeting-details">
                  <div>Started: {formatTime(meeting.start)}</div>
                  {meeting.status_info?.bot_id && (
                    <div className="active-meeting-bot-id">
                      Bot ID: {meeting.status_info.bot_id}
                    </div>
                  )}
                </div>

                {meeting.link && (
                  <a
                    href={meeting.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="active-meeting-link"
                  >
                    🔗 Join Meeting
                  </a>
                )}

                {/* Action Buttons */}
                <div className="active-meeting-actions">
                  {canFetch && (
                    <button
                      onClick={() => handleFetchTranscriptManual(
                        meetingId,
                        meeting.title,
                        meeting
                      )}
                      disabled={isFetching || isStopping}
                      className={`active-meeting-btn active-meeting-btn-primary ${(isFetching || isStopping) ? 'disabled' : ''}`}
                    >
                      {isFetching ? (
                        <>
                          <span style={{ marginRight: '6px' }}>⏳</span>
                          Fetching...
                        </>
                      ) : (
                        <>
                          <span style={{ marginRight: '6px' }}>📥</span>
                          Get Transcript
                        </>
                      )}
                    </button>
                  )}

                  {/* Stop Bot Button */}
                  {canStop && (
                    <button
                      onClick={() => handleStopBot(meetingId, meeting.title)}
                      disabled={isStopping || isFetching}
                      className={`active-meeting-btn active-meeting-btn-danger ${(isStopping || isFetching) ? 'disabled' : ''}`}
                    >
                      {isStopping ? (
                        <>
                          <span style={{ marginRight: '4px' }}>⏳</span>
                          Stopping...
                        </>
                      ) : (
                        <>
                          <span style={{ marginRight: '4px' }}>🛑</span>
                          Stop Bot
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Warning when meeting ID is missing */}
                {!meetingId && (
                  <div className="active-meeting-status-message" style={{
                    background: '#4a3a1a',
                    border: '1px solid #f59e0b',
                    color: '#fbbf24',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    marginTop: '8px'
                  }}>
                    ⚠️ Meeting ID missing - actions unavailable
                  </div>
                )}

                {status === 'bot_joining' && !canFetch && (
                  <div className="active-meeting-status-message active-meeting-status-joining">
                    <div style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                      Bot is joining the meeting...
                    </div>
                  </div>
                )}

                {status === 'processing' && (
                  <div className="active-meeting-status-message active-meeting-status-processing">
                    <div style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                      Processing transcript...
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="active-meeting-empty">
          <div className="active-meeting-empty-icon">💤</div>
          <p className="active-meeting-empty-text">
            No active meetings
          </p>
          <p className="active-meeting-empty-subtext">
            Schedule or join a meeting to see it here
          </p>
        </div>
      )}

      <div className="active-meeting-tip">
        <div className="active-meeting-tip-title">
          💡 Quick Tip
        </div>
        <div>
          Click "Get Transcript" anytime during the meeting, or "Stop Bot" to end recording early.
        </div>
      </div>
    </div>
  );
};

export default ActiveMeetings;
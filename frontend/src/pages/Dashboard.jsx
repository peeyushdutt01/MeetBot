import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import CalendarModal from '../components/CalendarModal';
import ActiveMeetings from '../components/ActiveMeetings';
import ImportantActionsList from '../components/ImportantActionsList';
import { useAuth } from "../contexts/AuthContext";
import API_BASE_URL from '../config/api';



const Dashboard = () => {
  const { currentUser } = useAuth();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [activeMeetings, setActiveMeetings] = useState([]);

  // Load upcoming meetings from backend
  const loadUpcomingMeetings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-meetings/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser?.uid })   // or null if not signed in
      });
      const allEvents = await response.json();
      const now = new Date();
      const upcoming = allEvents
        .map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }))
        .filter(event => event.start > now)
        .sort((a, b) => a.start - b.start)
        .slice(0, 3);
      setUpcomingMeetings(upcoming);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setUpcomingMeetings([]);
    }
  };

  const loadActiveMeetings = async () => {
  try {
    // 🔄 Step 1: Verify and sync local data with live Vexa bots
    await fetch(`${API_BASE_URL}/api/verify-active-bots`)
      .then(res => res.json())
      .then(data => {
        console.log("✅ Synced with Vexa:", data);
        if (data.stopped_count > 0) {
          console.warn(`🛑 Cleaned up ${data.stopped_count} inactive meetings`);
        }
      })
      .catch(err => console.error("⚠️ Vexa sync failed:", err));

    // 📥 Step 2: Fetch the updated list of active meetings
    const response = await fetch(`${API_BASE_URL}/api/active-meetings`);
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    console.log("📊 Active meetings after sync:", data);
    setActiveMeetings(data);
  } catch (error) {
    console.error('❌ Error fetching active meetings:', error);
  }
};


  useEffect(() => {
    loadUpcomingMeetings();
    loadActiveMeetings();
    const upcomingInterval = setInterval(loadUpcomingMeetings, 60000);
    const activeInterval = setInterval(loadActiveMeetings, 10000);
    return () => {
      clearInterval(upcomingInterval);
      clearInterval(activeInterval);
    };
  }, []);

  const handleCalendarClose = () => {
    setIsCalendarOpen(false);
    loadUpcomingMeetings();
  };

  const formatMeetingTime = (date) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString('en-US', options);
  };

  const getTimeUntil = (date) => {
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `in ${minutes} min${minutes > 1 ? 's' : ''}`;
    return 'soon';
  };

  const handleSchedule = () => setIsCalendarOpen(true);
  const handleJoinClick = () => setShowUrlInput(true);
  
  const handleConfirmJoin = async () => {
    if (!meetingUrl.trim()) return alert("Please enter a meeting URL.");

    try {
      const response = await fetch(`${API_BASE_URL}/api/join-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_link: meetingUrl, uid: currentUser?.uid, createdBy: currentUser?.email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ MeetBot invited successfully for ${meetingUrl}`);
        console.log("Vexa Bot Response:", data);

        // ✅ Add the joined meeting to the active meetings state (so it appears in the list)
        setActiveMeetings((prev) => [
          ...prev,
          {
            id: data.meeting_id, // keep consistent naming
            meeting_id: data.meeting_id,
            bot_id: data.bot_id,
            native_meeting_id: data.native_meeting_id,
            link: meetingUrl,
            status: data.status || "in_progress",
            joined_at: data.joined_at,
            title: "Direct Joined Meeting",
          },
        ]);

        setJoined(true);
      } else {
        alert(`❌ Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Join error:", err);
      alert("Error connecting to backend.");
    }
  };

  const handleGetTranscript = async () => {
  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/api/get-transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_link: meetingUrl,
        uid: currentUser?.uid,          // ✅ REQUIRED
        createdBy: currentUser?.email    // ✅ REQUIRED
      }),
    });

    const data = await response.json();

    if (data.success && data.transcript) {
      setTranscript(data.transcript);
    } else {
      alert(data.message || "Transcript not ready yet.");
    }

  } catch (err) {
    console.error(err);
    alert("Error fetching transcript.");
  } finally {
    setLoading(false);
  }
};


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('');
    }
  };

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleUpload = async () => {
    if (!file) return alert('Please select a file first');
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      setUploadStatus('Uploading...');
      const response = await axios.post(`${API_BASE_URL}/api/process-meeting`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded * 100) / p.total)),
      });

      setUploadStatus('Processing complete!');
      alert('Meeting processed successfully!');
      console.log('Result:', response.data);
      setFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container">
        <div className="nata-sans hero">
          <h1>Automate, Analyze & Summarize Meetings with MeetBot</h1>
          <p>Your AI meeting ally – joins, transcribes, summarizes, and tracks decisions so you don't have to.</p>

          <div className="actions">
            <button className="btn-primary" onClick={handleSchedule}>Schedule a Meeting</button>
            <button className="btn-secondary" onClick={handleJoinClick}>Join a Meeting</button>
          </div>

          {showUrlInput && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Enter meeting URL"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #a087fa',
                  background: '#21232d',
                  color: '#fff',
                  fontSize: '1rem'
                }}
              />
              {!joined ? (
                <button className="btn-primary" onClick={handleConfirmJoin} disabled={loading}>
                  {loading ? "Joining..." : "Join"}
                </button>
              ) : (
                <button className="btn-secondary" onClick={handleGetTranscript} disabled={loading}>
                  {loading ? "Fetching..." : "Get Transcript"}
                </button>
              )}
            </div>
          )}

          {transcript && (
            <div style={{ marginTop: '20px', width: '100%' }}>
              <h3 style={{ color: '#a087fa' }}>📝 Live Transcript</h3>
              <pre style={{
                background: '#1f1f2b',
                color: '#e3e1f7',
                padding: '15px',
                borderRadius: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '400px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }}>
                {transcript}
              </pre>
            </div>
          )}

          <div className="upload-section" style={{ marginTop: '40px' }}>
            <h3>Upload Meeting Recording</h3>
            <span className='little-text'>(mp3 / wav / m4a / webm)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.webm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            <div style={{ marginTop: '20px' }}>
              <button className="btn-secondary" onClick={handleChooseFile} style={{ marginBottom: '15px' }}>
                <h3>📁 Choose File</h3> <span className='little-text'> less than 25mb in size</span>
              </button>
              {file && (
                <div style={{
                  padding: '12px', background: '#2a2c3e', borderRadius: '8px',
                  display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📄</span>
                    <span style={{ color: '#a087fa', fontWeight: '600' }}>{file.name}</span>
                    <span style={{ color: '#888', fontSize: '0.9rem' }}>
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button onClick={() => setFile(null)} style={{
                    background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer'
                  }}>✕</button>
                </div>
              )}
            </div>
            
            {file && (
              <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                <button className="btn-primary" onClick={handleUpload} disabled={uploading} style={{ width: '100%' }}>
                  {uploading ? '⏳ Processing...' : '🚀 Upload & Process'}
                </button>
              </div>
            )}
            {uploading && (
              <div className="progress-bar" style={{ marginTop: '20px' }}>
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                <span style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  color: '#fff', fontWeight: '600', fontSize: '0.85rem'
                }}>{uploadProgress}%</span>
              </div>
            )}
            {uploadStatus && (
              <p id="uploadStatus" style={{
                marginTop: '10px', color: uploadStatus.includes('failed') ? '#ff6b6b' : '#a087fa',
                fontWeight: '600', textAlign: 'center'
              }}>{uploadStatus}</p>
            )}
          </div>

          {/* Important Action Items Section */}
          <div className="action-items-section" style={{ marginTop: "30px" }}>
            <h2 style={{ color: "#a087fa", marginBottom: "15px" }}>Important Action Items</h2>
            <ImportantActionsList />
          </div>
        </div>

        <div className="sidebar">
          <div className="card">
            <h3>Upcoming Meetings ({upcomingMeetings.length})</h3>
            {upcomingMeetings.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {upcomingMeetings.map((meeting) => (
                  <li key={meeting.id} style={{ 
                    borderBottom: '1px solid #2e2e3c',
                    paddingBottom: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontWeight: '600', color: '#e3e1f7', marginBottom: '4px', fontSize: '0.95rem' }}>
                      {meeting.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#a087fa', marginBottom: '2px' }}>
                      {formatMeetingTime(meeting.start)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#aa9de8' }}>
                      {getTimeUntil(meeting.start)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#bbb7d1', fontSize: '0.9rem', marginTop: '10px' }}>
                No upcoming meetings scheduled. Click "Schedule a Meeting" to add one.
              </p>
            )}
            <button 
              className="btn-secondary" 
              onClick={() => setIsCalendarOpen(true)}
              style={{ marginTop: '16px', width: '100%' }}
            >
              View Calendar
            </button>
          </div>

          {/* Active Meetings Component */}
          <ActiveMeetings activeMeetings={activeMeetings} onRefresh={loadActiveMeetings} />
        </div>
      </div>

      <CalendarModal 
      isOpen={isCalendarOpen} 
      onClose={handleCalendarClose} 
      userEmail={currentUser?.email} 
      userUid={currentUser?.uid} />

    </div>
  );
};

export default Dashboard;

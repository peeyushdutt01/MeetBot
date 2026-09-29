import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import CalendarModal from '../components/CalendarModal';
import ActiveMeetings from '../components/ActiveMeetings';
import ImportantActionsList from '../components/ImportantActionsList';
import { useAuth } from '../contexts/AuthContext';
import API_BASE_URL from '../config/api';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const fileInputRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [activeMeetings, setActiveMeetings] = useState([]);
  const dashboardRef = useRef(null);

  const loadUpcomingMeetings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scheduled-meetings/filter`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser?.uid })
      });
      if (!response.ok) throw new Error('Could not load meetings');
      const events = await response.json();
      setUpcomingMeetings(events.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) }))
        .filter(event => event.start > new Date()).sort((a, b) => a.start - b.start).slice(0, 3));
    } catch (error) { console.error('Error fetching meetings:', error); setUpcomingMeetings([]); }
    finally { setUpcomingLoading(false); }
  };

  const loadActiveMeetings = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/verify-active-bots`).catch(() => {});
      const response = await fetch(`${API_BASE_URL}/api/active-meetings`);
      if (!response.ok) throw new Error('Could not load active meetings');
      setActiveMeetings(await response.json());
    } catch (error) { console.error('Error fetching active meetings:', error); }
  };

  useEffect(() => {
    loadUpcomingMeetings();
    loadActiveMeetings();
    const upcomingInterval = setInterval(loadUpcomingMeetings, 60000);
    const activeInterval = setInterval(loadActiveMeetings, 10000);
    return () => { clearInterval(upcomingInterval); clearInterval(activeInterval); };
  }, [currentUser?.uid]);

  useEffect(() => {
    const root = dashboardRef.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const sections = root.querySelectorAll('.dash-reveal');
    root.classList.add('dash-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 40px 0px' });
    sections.forEach(section => observer.observe(section));
    return () => { observer.disconnect(); root.classList.remove('dash-ready'); };
  }, []);

  const handleConfirmJoin = async () => {
    if (!meetingUrl.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/join-meeting`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_link: meetingUrl, uid: currentUser?.uid, createdBy: currentUser?.email })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not join meeting');
      setActiveMeetings(prev => [...prev, {
        id: data.meeting_id, meeting_id: data.meeting_id, bot_id: data.bot_id,
        native_meeting_id: data.native_meeting_id, link: meetingUrl,
        status: data.status || 'in_progress', joined_at: data.joined_at, title: 'Direct joined meeting'
      }]);
      setJoined(true);
      setJoinStatus('MeetBot has been invited to your meeting.');
    } catch (error) { setJoinStatus(error.message); } finally { setLoading(false); }
  };

  const handleGetTranscript = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-transcript`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_link: meetingUrl, uid: currentUser?.uid, createdBy: currentUser?.email })
      });
      const data = await response.json();
      if (data.success && data.transcript) setTranscript(data.transcript);
      else setJoinStatus(data.message || 'Transcript is not ready yet.');
    } catch (error) { setJoinStatus('Could not fetch transcript. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true); setUploadStatus('Uploading recording…');
      await axios.post(`${API_BASE_URL}/api/process-meeting`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded * 100) / (p.total || p.loaded)))
      });
      setUploadStatus('Recording processed. Your report is ready.');
      setFile(null); setUploadProgress(0);
    } catch (error) { console.error('Upload error:', error); setUploadStatus('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  };

  return <div className="app-shell">
    <Navbar />
    <main className="dashboard-page" ref={dashboardRef}>
      <section className="dashboard-intro">
        <div className="dashboard-intro-copy">
          <span className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</span>
          <h1>Meetings, <em>handled.</em></h1>
          <p>Bring MeetBot into a call, plan what is next, and keep every follow-up in one place.</p>
          <div className="dashboard-intro-actions"><button className="btn-primary" onClick={() => setIsCalendarOpen(true)}>Schedule a meeting <span aria-hidden="true">↗</span></button><button className="dashboard-quiet-link" onClick={() => setIsCalendarOpen(true)}>Open calendar <span aria-hidden="true">→</span></button></div>
        </div>
        <div className="dashboard-preview-card">
          <span className="dashboard-preview-kicker"><i /> NEXT ON YOUR CALENDAR</span>
          {upcomingLoading ? <><strong>Checking your schedule…</strong><span className="dashboard-preview-time">Just a moment.</span></> : upcomingMeetings.length ? <><strong>{upcomingMeetings[0].title}</strong><span className="dashboard-preview-time">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(upcomingMeetings[0].start)}</span></> : <><strong>A little room to breathe.</strong><span className="dashboard-preview-time">Your next meeting will appear here.</span></>}
          <div className="dashboard-preview-footer"><span>{activeMeetings.length ? `${activeMeetings.length} meeting${activeMeetings.length === 1 ? '' : 's'} live now` : 'No meetings live right now'}</span><span className="dashboard-preview-bars" aria-hidden="true"><i /><i /><i /><i /><i /></span></div>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="surface-panel quick-start dash-reveal">
            <div className="section-heading"><div><span className="eyebrow">GET STARTED</span><h2>What would you like to do?</h2></div></div>
            <div className="quick-actions">
              <button className="quick-action" onClick={() => setIsCalendarOpen(true)}><span className="quick-action-icon">01</span><strong>Schedule a meeting</strong><span>Add a time and meeting link to your calendar.</span><span className="quick-arrow">↗</span></button>
              <button className="quick-action" onClick={() => setShowUrlInput(value => !value)}><span className="quick-action-icon">02</span><strong>Join a meeting</strong><span>Invite MeetBot to a call already in progress.</span><span className="quick-arrow">↗</span></button>
            </div>
            {showUrlInput && <div className="join-panel"><label htmlFor="meeting-url">Meeting link</label><div className="join-row"><input id="meeting-url" type="url" placeholder="Paste a Google Meet or Zoom link" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} /><button className="btn-primary" onClick={joined ? handleGetTranscript : handleConfirmJoin} disabled={loading || !meetingUrl.trim()}>{loading ? 'Working…' : joined ? 'Get transcript' : 'Invite MeetBot'}</button></div></div>}
            {joinStatus && <p className="status-note" role="status">{joinStatus}</p>}
            {transcript && <div className="transcript-panel"><h3>Live transcript</h3><pre>{transcript}</pre></div>}
          </section>

          <section className="surface-panel upload-section dash-reveal">
            <div className="section-heading"><div><span className="eyebrow">FROM A RECORDING</span><h2>Process a past meeting</h2><p>Upload audio to get a summary, decisions, and action items.</p></div></div>
            <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.webm" onChange={e => { setFile(e.target.files[0] || null); setUploadStatus(''); }} hidden />
            <div className="upload-box"><div><strong>{file ? file.name : 'Choose an audio file'}</strong><span>{file ? `${(file.size / 1048576).toFixed(2)} MB` : 'MP3, WAV, M4A or WebM · up to 25 MB'}</span></div><button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>{file ? 'Change file' : 'Browse files'}</button></div>
            {file && <div className="upload-footer"><button className="btn-primary" onClick={handleUpload} disabled={uploading}>{uploading ? 'Processing…' : 'Upload and process'}</button><button className="text-button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove</button></div>}
            {uploading && <div className="progress-bar" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>}
            {uploadStatus && <p className="status-note" role="status">{uploadStatus}</p>}
          </section>

          <section className="surface-panel action-items-section dash-reveal"><div className="section-heading"><div><span className="eyebrow">FOLLOW-THROUGH</span><h2>Important actions</h2></div><a className="text-link" href="/actions">View all →</a></div><ImportantActionsList /></section>
        </div>
        <aside className="dashboard-sidebar">
          <section className="surface-panel upcoming-panel dash-reveal"><div className="section-heading"><div><span className="eyebrow">AHEAD OF YOU</span><h2>Upcoming meetings</h2></div><span className="count-badge">{upcomingMeetings.length}</span></div>
            {upcomingLoading ? <div className="dashboard-meeting-skeleton" aria-label="Loading upcoming meetings"><i /><i /><i /></div> : upcomingMeetings.length ? <ul className="upcoming-list">{upcomingMeetings.map(meeting => <li key={meeting.id}><span className="meeting-date-box"><strong>{meeting.start.toLocaleDateString(undefined, { day: '2-digit' })}</strong><small>{meeting.start.toLocaleDateString(undefined, { month: 'short' })}</small></span><span className="upcoming-detail"><strong>{meeting.title}</strong><small>{meeting.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></span></li>)}</ul> : <p className="empty-note">Your schedule is clear. Add a meeting to get started.</p>}
            <button className="btn-secondary full-width" onClick={() => setIsCalendarOpen(true)}>Open calendar</button>
          </section>
          <div className="dash-reveal"><ActiveMeetings activeMeetings={activeMeetings} onRefresh={loadActiveMeetings} /></div>
        </aside>
      </div>
    </main>
    <CalendarModal isOpen={isCalendarOpen} onClose={() => { setIsCalendarOpen(false); loadUpcomingMeetings(); }} userEmail={currentUser?.email} userUid={currentUser?.uid} />
  </div>;
};

export default Dashboard;

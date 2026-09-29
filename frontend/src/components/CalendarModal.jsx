import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import API_BASE_URL from '../config/api';

const localizer = momentLocalizer(moment);
const API_URL = `${API_BASE_URL}/api/scheduled-meetings`;
const formatTime = (date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
const sameDay = (a, b) => a.toDateString() === b.toDateString();

const CalendarModal = ({ isOpen, onClose, userEmail, userUid }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(() => window.matchMedia('(max-width: 640px)').matches ? 'agenda' : 'month');

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const updateView = () => {
      if (media.matches) setView(current => current === 'week' || current === 'day' ? 'agenda' : current);
    };
    media.addEventListener('change', updateView);
    return () => media.removeEventListener('change', updateView);
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userUid })
      });
      if (!response.ok) throw new Error('Could not load meetings.');
      const data = await response.json();
      setEvents(data.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) })));
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Could not load meetings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOpen) fetchEvents(); }, [isOpen, userUid]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') { showEventModal ? setShowEventModal(false) : onClose(); } };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showEventModal, onClose]);

  const saveEvent = async (meeting, isEdit = false) => {
    const response = await fetch(isEdit ? `${API_URL}/${meeting.id}` : API_URL, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meeting, createdBy: userEmail, uid: userUid })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save meeting.');
    await fetchEvents();
    setDate(new Date(meeting.start));
    setShowEventModal(false);
  };

  const deleteEvent = async (id) => {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: userUid })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Could not delete meeting.');
    await fetchEvents();
    setShowEventModal(false);
  };

  const openNew = (slot = { start: new Date(), end: moment().add(1, 'hour').toDate() }) => {
    setSelectedEvent(null);
    setSelectedSlot(slot);
    setShowEventModal(true);
  };
  const openEvent = (event) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setShowEventModal(true);
  };
  const dayMeetings = events.filter(event => sameDay(event.start, date)).sort((a, b) => a.start - b.start);

  if (!isOpen) return null;
  return (
    <div className="modal" onMouseDown={onClose}>
      <div className="modal-content calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-title" onMouseDown={event => event.stopPropagation()}>
        <div className="dialog-heading">
          <div><span className="eyebrow">YOUR SCHEDULE</span><h2 id="calendar-title">Meetings calendar</h2><p>Plan a meeting or select one to see its details.</p></div>
          <div className="dialog-heading-actions"><button className="btn-primary" onClick={() => openNew()}>New meeting</button><button className="icon-button" onClick={onClose} aria-label="Close calendar">×</button></div>
        </div>
        {error && <div className="inline-error" role="alert">{error} <button onClick={fetchEvents}>Retry</button></div>}
        {loading ? <div className="calendar-loading">Loading meetings…</div> : (
          <div className="calendar-layout">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={date}
              onNavigate={setDate}
              view={view}
              onView={setView}
              style={{ height: 620 }}
              selectable
              onSelectSlot={(slot) => {
                setDate(slot.start);
                if (view === 'month') {
                  const start = new Date(slot.start);
                  start.setHours(9, 0, 0, 0);
                  openNew({ start, end: moment(start).add(1, 'hour').toDate() });
                } else openNew(slot);
              }}
              onSelectEvent={openEvent}
              onDrillDown={(nextDate) => { setDate(nextDate); setView('day'); }}
              views={['month', 'week', 'day', 'agenda']}
              popup
              components={{ event: ({ event }) => <span className="meeting-event"><span className="meeting-event-time">{formatTime(event.start)}</span><span className="meeting-event-title">{event.title}</span></span> }}
            />
            <aside className="calendar-day-panel">
              <span className="eyebrow">SELECTED DAY</span>
              <h3>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date)}</h3>
              <p className="day-count">{dayMeetings.length} {dayMeetings.length === 1 ? 'meeting' : 'meetings'}</p>
              <div className="day-meeting-list">
                {dayMeetings.length ? dayMeetings.map(meeting => <button key={meeting.id} className="day-meeting" onClick={() => openEvent(meeting)}><span className="day-meeting-time">{formatTime(meeting.start)} – {formatTime(meeting.end)}</span><strong>{meeting.title}</strong><span>{meeting.link ? 'Meeting link added' : 'No link added'}</span></button>) : <p className="empty-note">No meetings on this day. Select a time on the calendar to add one.</p>}
              </div>
            </aside>
          </div>
        )}
        {showEventModal && <EventFormModal key={selectedEvent?.id || selectedSlot?.start?.toISOString()} event={selectedEvent} slot={selectedSlot} onSave={saveEvent} onDelete={deleteEvent} onClose={() => setShowEventModal(false)} />}
      </div>
    </div>
  );
};

const EventFormModal = ({ event, slot, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(event?.title || '');
  const [link, setLink] = useState(event?.link || '');
  const [startTime, setStartTime] = useState(moment(event?.start || slot?.start || new Date()).format('YYYY-MM-DDTHH:mm'));
  const [endTime, setEndTime] = useState(moment(event?.end || slot?.end || moment().add(1, 'hour')).format('YYYY-MM-DDTHH:mm'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const perform = async (action) => { setBusy(true); setError(''); try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (new Date(endTime) <= new Date(startTime)) { setError('End time must be after start time.'); return; }
    perform(() => onSave({ id: event?.id, title: title.trim(), link: link.trim(), start: new Date(startTime), end: new Date(endTime) }, Boolean(event)));
  };
  return <div className="event-modal" onMouseDown={onClose}><div className="event-modal-content" role="dialog" aria-modal="true" aria-labelledby="event-title" onMouseDown={e => e.stopPropagation()}>
    <div className="dialog-heading"><div><span className="eyebrow">MEETING DETAILS</span><h3 id="event-title">{event ? 'Edit meeting' : 'New meeting'}</h3></div><button className="icon-button" onClick={onClose} aria-label="Close meeting form">×</button></div>
    <form onSubmit={handleSubmit}>
      <label>Meeting title<input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly team sync" required /></label>
      <label>Meeting link <span className="optional">Optional</span><input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/…" /></label>
      {event?.link && <a className="text-link meeting-open-link" href={event.link} target="_blank" rel="noopener noreferrer">Open meeting link ↗</a>}
      <div className="form-grid"><label>Starts<input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required /></label><label>Ends<input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required /></label></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="button-group"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : event ? 'Save changes' : 'Create meeting'}</button><button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>{event && <button type="button" className="text-danger" disabled={busy} onClick={() => perform(() => onDelete(event.id))}>Delete meeting</button>}</div>
    </form>
  </div></div>;
};

export default CalendarModal;

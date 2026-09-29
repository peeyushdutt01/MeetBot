import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import API_BASE_URL from '../config/api';
import { calendarDays, defaultSlot, isInMonth, sameDay } from '../utils/calendarDates.mjs';

const API_URL = `${API_BASE_URL}/api/scheduled-meetings`;
const monthLabel = (date) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
const dayLabel = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
const timeLabel = (date) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
const shortDate = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);

const CalendarModal = ({ isOpen, onClose, userEmail, userUid }) => {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState('month');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setEvents(data.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) }))
        .filter(event => !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime())));
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') showEventModal ? setShowEventModal(false) : onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, showEventModal, onClose]);

  const eventsByDay = useMemo(() => {
    const days = new Map();
    events.forEach(event => {
      const key = event.start.toDateString();
      days.set(key, [...(days.get(key) || []), event]);
    });
    days.forEach(dayEvents => dayEvents.sort((a, b) => a.start - b.start));
    return days;
  }, [events]);
  const selectedMeetings = eventsByDay.get(selectedDate.toDateString()) || [];
  const monthMeetings = events.filter(event => isInMonth(event.start, visibleMonth)).sort((a, b) => a.start - b.start);
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);

  const goToMonth = (offset) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    setSelectedDate(next);
  };
  const selectDate = (day) => {
    setSelectedDate(day);
    if (!isInMonth(day, visibleMonth)) setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };
  const openNew = (day = selectedDate) => {
    setSelectedEvent(null);
    setSelectedSlot(defaultSlot(day));
    setShowEventModal(true);
  };
  const openEvent = (event) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setShowEventModal(true);
  };
  const saveEvent = async (meeting, isEdit = false) => {
    const response = await fetch(isEdit ? `${API_URL}/${meeting.id}` : API_URL, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...meeting, createdBy: userEmail, uid: userUid })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save meeting.');
    await fetchEvents();
    setSelectedDate(new Date(meeting.start));
    setVisibleMonth(new Date(meeting.start.getFullYear(), meeting.start.getMonth(), 1));
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

  if (!isOpen) return null;
  return (
    <div className="modal calendar-overlay" onMouseDown={onClose}>
      <div className="modal-content calendar-dialog calendar-v2" role="dialog" aria-modal="true" aria-labelledby="calendar-title" onMouseDown={event => event.stopPropagation()}>
        <div className="dialog-heading calendar-heading">
          <div><span className="eyebrow">YOUR SCHEDULE</span><h2 id="calendar-title">Meetings calendar</h2><p>Choose a day to see what is planned.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close calendar">×</button>
        </div>
        <div className="calendar-controls">
          <div className="calendar-month-heading"><h3>{monthLabel(visibleMonth)}</h3><button className="calendar-today" onClick={() => { const today = new Date(); setSelectedDate(today); setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}>Today</button></div>
          <div className="calendar-control-actions">
            <div className="calendar-view-toggle" role="group" aria-label="Calendar view"><button className={view === 'month' ? 'active' : ''} aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button><button className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button></div>
            <div className="calendar-nav"><button aria-label="Previous month" onClick={() => goToMonth(-1)}>‹</button><button aria-label="Next month" onClick={() => goToMonth(1)}>›</button></div>
            <button className="btn-primary calendar-add" onClick={() => openNew()}>+ New meeting</button>
          </div>
        </div>
        {error && <div className="inline-error" role="alert">{error} <button onClick={fetchEvents}>Retry</button></div>}
        {loading && <p className="calendar-loading" role="status">Loading meetings…</p>}
        {view === 'month' ? (
          <div className="calendar-layout">
            <div className="calendar-month" aria-label={monthLabel(visibleMonth)}>
              <div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid">
                {days.map(day => {
                  const meetings = eventsByDay.get(day.toDateString()) || [];
                  const selected = sameDay(day, selectedDate);
                  return <button key={day.toDateString()} className={['calendar-day', isInMonth(day, visibleMonth) ? '' : 'outside', sameDay(day, new Date()) ? 'today' : '', selected ? 'selected' : ''].filter(Boolean).join(' ')} aria-label={`${dayLabel(day)}, ${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'}`} aria-pressed={selected} onClick={() => selectDate(day)}>
                    <span className="calendar-day-number">{day.getDate()}</span>
                    <span className="calendar-cell-events">{meetings.slice(0, 2).map(meeting => <span key={meeting.id} className="calendar-event-chip"><b>{timeLabel(meeting.start)}</b> {meeting.title}</span>)}{meetings.length > 2 && <span className="calendar-more">+{meetings.length - 2} more</span>}</span>
                    {meetings.length > 0 && <span className="calendar-dots" aria-hidden="true">{Array.from({ length: Math.min(meetings.length, 3) }, (_, i) => <i key={i} />)}</span>}
                  </button>;
                })}
              </div>
            </div>
            <aside className="calendar-day-panel">
              <div className="calendar-day-panel-head"><div><span className="eyebrow">SELECTED DAY</span><h3>{dayLabel(selectedDate)}</h3><p className="day-count">{selectedMeetings.length} {selectedMeetings.length === 1 ? 'meeting' : 'meetings'}</p></div><button className="calendar-day-add" onClick={() => openNew(selectedDate)} aria-label={`Add meeting on ${dayLabel(selectedDate)}`}>+</button></div>
              <div className="day-meeting-list">{selectedMeetings.length ? selectedMeetings.map(meeting => <button key={meeting.id} className="day-meeting" onClick={() => openEvent(meeting)}><span className="day-meeting-time">{timeLabel(meeting.start)} – {timeLabel(meeting.end)}</span><strong>{meeting.title}</strong><span>{meeting.link ? 'Meeting link added' : 'No link added'}</span></button>) : <div className="calendar-empty-day"><span className="calendar-empty-symbol">◎</span><strong>Nothing on the calendar</strong><p>Enjoy the space, or add a meeting for this day.</p><button onClick={() => openNew(selectedDate)}>Add a meeting <span aria-hidden="true">↗</span></button></div>}</div>
            </aside>
          </div>
        ) : (
          <div className="calendar-agenda" aria-label={`Meetings in ${monthLabel(visibleMonth)}`}>{monthMeetings.length ? monthMeetings.map(meeting => <button key={meeting.id} className="calendar-agenda-item" onClick={() => openEvent(meeting)}><span className="calendar-agenda-date"><strong>{meeting.start.getDate()}</strong><small>{shortDate(meeting.start).split(',')[0]}</small></span><span className="calendar-agenda-info"><strong>{meeting.title}</strong><small>{timeLabel(meeting.start)} – {timeLabel(meeting.end)}</small></span><span className="calendar-agenda-arrow" aria-hidden="true">↗</span></button>) : <div className="calendar-empty-day"><span className="calendar-empty-symbol">◎</span><strong>No meetings this month</strong><p>There is room for something new.</p><button onClick={() => openNew(visibleMonth)}>Schedule a meeting <span aria-hidden="true">↗</span></button></div>}</div>
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
  const [endTime, setEndTime] = useState(moment(event?.end || slot?.end || new Date(Date.now() + 3600000)).format('YYYY-MM-DDTHH:mm'));
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

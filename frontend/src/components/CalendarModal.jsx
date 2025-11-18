import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import API_BASE_URL from '../config/api';

const localizer = momentLocalizer(moment);
const API_URL = `${API_BASE_URL}/api/scheduled-meetings`;

const CalendarModal = ({ isOpen, onClose, userEmail, userUid }) => {

  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) fetchEvents();
  }, [isOpen]);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userUid })
      });
      const data = await response.json();
      const formattedEvents = data.map(event => ({
        ...event,
        id: event.id,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
      setEvents(formattedEvents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };

  const saveEvent = async (event, isEdit = false) => {
  try {
    const meeting = {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      link: event.link || "",
      createdBy: userEmail,
      uid: userUid
    };

    const url = isEdit
      ? `${API_URL}/${event.id}`
      : API_URL;

    const response = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meeting)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unknown error");

    // return updated meeting so we can update local state
    return data.meeting || meeting;
  } catch (error) {
    console.error("❌ Error saving event:", error);
    alert("Failed to save event. Check console for details.");
    return null;
  }
};



  const handleSelectSlot = (slotInfo) => {
    setSelectedSlot(slotInfo);
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setShowEventModal(true);
  };

  const handleAddEvent = async (title, start, end, link) => {
  const newEvent = {
    title,
    start,
    end,
    link,
    createdBy: userEmail,
    uid: userUid
  };

  // only send to backend
  const savedMeeting = await saveEvent(newEvent);

  // refresh meetings from backend
  if (savedMeeting) {
    await fetchEvents();
  }

  setShowEventModal(false);
};


const handleEditEvent = async (id, title, start, end, link) => {
  const updatedEvent = {
    id,
    title,
    start,
    end,
    link,
    createdBy: userEmail,
    uid: userUid
  };

  const savedMeeting = await saveEvent(updatedEvent, true);

  if (savedMeeting) {
    await fetchEvents();   // refresh from backend
  }

  setShowEventModal(false);
};



  const handleDeleteEvent = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userUid })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh events from backend after successful deletion
        await fetchEvents();
      } else {
        alert('Failed to delete event: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Error deleting event. Please try again.');
    }
    
    setShowEventModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h2>Meetings Calendar</h2>

        {loading ? (
          <p>Loading events...</p>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            popup
          />
        )}

        {showEventModal && (
          <EventFormModal
            event={selectedEvent}
            slot={selectedSlot}
            onAdd={handleAddEvent}
            onEdit={handleEditEvent}
            onDelete={handleDeleteEvent}
            onClose={() => setShowEventModal(false)}
          />
        )}
      </div>
    </div>
  );
};

const EventFormModal = ({ event, slot, onAdd, onEdit, onDelete, onClose }) => {
  const [title, setTitle] = useState(event?.title || '');
  const [link, setLink] = useState(event?.link || '');
  const [startTime, setStartTime] = useState(
    event ? moment(event.start).format('YYYY-MM-DDTHH:mm') 
          : moment(slot.start).format('YYYY-MM-DDTHH:mm')
  );
  const [endTime, setEndTime] = useState(
    event ? moment(event.end).format('YYYY-MM-DDTHH:mm')
          : moment(slot.end).format('YYYY-MM-DDTHH:mm')
  );

  const handleSubmit = (e) => {
  e.preventDefault();
  if (event) {
    onEdit(event.id, title, new Date(startTime), new Date(endTime), link);
  } else {
    onAdd(title, new Date(startTime), new Date(endTime), link);
  }
};


  return (
    <div className="event-modal" onClick={onClose}>
      <div className="event-modal-content" onClick={e => e.stopPropagation()}>
        <h3>{event ? 'Edit Meeting' : 'Add Meeting'}</h3>
        <form onSubmit={handleSubmit}>
          <div>
            <label>Title:</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Link:</label>
            <input
              type="text"
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>
          <div>
            <label>Start:</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label>End:</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              required
            />
          </div>
          <div className="button-group">
            <button className='calendar-button' type="submit">{event ? 'Update' : 'Add'}</button>
            {event && (
              <button type="button" onClick={() => onDelete(event.id)} className="delete-btn">
                Delete
              </button>
            )}
            <button className='calendar-button cancel' onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarModal;

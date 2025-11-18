# backend/meeting_store.py
from datetime import datetime
import firebase_storage

def add_meeting(meeting: dict, push_to_firestore=True):
    """
    Add a meeting to Firestore.
    
    Args:
        meeting: Meeting dictionary
        push_to_firestore: Whether to save to Firestore (always True now)
    
    Returns:
        Dictionary with success status and firestore_id
    """
    # Copy incoming meeting
    meeting_entry = meeting.copy()

    # Add createdBy
    meeting_entry.setdefault("createdBy", meeting.get("createdBy", "unknown@example.com"))

    # Add other metadata
    meeting_entry.setdefault("status", "upcoming")
    meeting_entry.setdefault("createdAt", datetime.utcnow().isoformat())

    # Get user_uid for saving
    user_uid = meeting_entry.get("uid")
    if user_uid and user_uid != "unknown":
        # Save to Firestore using firebase_storage
        result = firebase_storage.save_scheduled_meeting(meeting_entry, user_uid=user_uid)
    else:
        # Save to global collection
        result = firebase_storage.save_scheduled_meeting(meeting_entry)
    
    return result


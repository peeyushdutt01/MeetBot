"""
Centralized Firebase Firestore Storage Manager
Replaces all local JSON file operations with cloud-based Firestore storage.
Supports both production (environment variable) and development (local file) credentials.
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
import firebase_admin
from firebase_admin import credentials, firestore


# ==================== Firebase Initialization ====================

def _initialize_firebase():
    """
    Initialize Firebase Admin SDK with support for both:
    1. Environment variable (FIREBASE_CREDENTIALS) for production (Render)
    2. Local firebase_key.json file for development
    """
    if firebase_admin._apps:
        return firestore.client()
    
    try:
        # Try environment variable first (production on Render)
        firebase_creds_json = os.getenv('FIREBASE_CREDENTIALS')
        
        if firebase_creds_json:
            print("[INFO] Using Firebase credentials from environment variable")
            cred_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(cred_dict)
        else:
            # Fallback to local file (development)
            print("[INFO] Using local firebase_key.json")
            cred = credentials.Certificate("firebase_key.json")
        
        firebase_admin.initialize_app(cred)
        print("[SUCCESS] Firebase initialized successfully")
        
    except Exception as e:
        print(f"[ERROR] Firebase initialization error: {e}")
        raise
    
    return firestore.client()


# Initialize Firebase and get Firestore client
db = _initialize_firebase()


# ==================== Bot Map Operations ====================

def load_bot_map() -> Dict[str, Any]:
    """
    Load bot mapping from Firestore.
    Maps meeting IDs to their Vexa bot IDs and native meeting IDs.
    
    Returns:
        Dictionary mapping meeting_id -> {bot_id, native_meeting_id}
    """
    try:
        doc_ref = db.collection('system').document('bot_map')
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            return data.get('mappings', {})
        
        return {}
    
    except Exception as e:
        print(f"[WARNING] Error loading bot_map from Firestore: {e}")
        return {}


def save_bot_map(bot_map: Dict[str, Any]) -> bool:
    """
    Save bot mapping to Firestore.
    
    Args:
        bot_map: Dictionary mapping meeting_id -> {bot_id, native_meeting_id}
    
    Returns:
        True if successful, False otherwise
    """
    try:
        doc_ref = db.collection('system').document('bot_map')
        doc_ref.set({
            'mappings': bot_map,
            'updated_at': datetime.utcnow().isoformat()
        })
        return True
    
    except Exception as e:
        print(f"[ERROR] Error saving bot_map to Firestore: {e}")
        return False


# ==================== Meeting Status Operations ====================

def load_meeting_status() -> Dict[str, Any]:
    """
    Load meeting status from Firestore.
    Tracks the current state of all meetings (scheduled, in_progress, completed, etc.)
    
    Returns:
        Dictionary mapping meeting_id -> status_entry
    """
    try:
        doc_ref = db.collection('system').document('meeting_status')
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            return data.get('statuses', {})
        
        return {}
    
    except Exception as e:
        print(f"[WARNING] Error loading meeting_status from Firestore: {e}")
        return {}


def save_meeting_status(meeting_status: Dict[str, Any]) -> bool:
    """
    Save meeting status to Firestore.
    
    Args:
        meeting_status: Dictionary mapping meeting_id -> status_entry
    
    Returns:
        True if successful, False otherwise
    """
    try:
        doc_ref = db.collection('system').document('meeting_status')
        doc_ref.set({
            'statuses': meeting_status,
            'updated_at': datetime.utcnow().isoformat()
        })
        return True
    
    except Exception as e:
        print(f"[ERROR] Error saving meeting_status to Firestore: {e}")
        return False


# ==================== Reports Operations ====================

def load_reports(user_uid: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Load reports from Firestore.
    
    Args:
        user_uid: If provided, only load reports for this user
    
    Returns:
        List of report dictionaries
    """
    try:
        if user_uid:
            # Load user-specific reports
            reports_ref = db.collection('users').document(user_uid).collection('reports')
        else:
            # Load all reports from global collection
            reports_ref = db.collection('reports')
        
        docs = reports_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        
        reports = []
        for doc in docs:
            report_data = doc.to_dict()
            report_data['firestore_id'] = doc.id
            reports.append(report_data)
        
        return reports
    
    except Exception as e:
        print(f"[WARNING] Error loading reports from Firestore: {e}")
        return []


def save_report(report: Dict[str, Any], user_uid: Optional[str] = None) -> Dict[str, Any]:
    """
    Save a report to Firestore.
    
    Args:
        report: Report dictionary
        user_uid: If provided, save under user's collection
    
    Returns:
        Dictionary with success status and firestore_id
    """
    try:
        # Ensure datetime fields are strings
        report_entry = _sanitize_for_firestore(report)
        report_entry.setdefault('createdAt', datetime.utcnow().isoformat())
        
        if user_uid:
            # Save under user's collection
            doc_ref = db.collection('users').document(user_uid).collection('reports').add(report_entry)
        else:
            # Save to global collection
            doc_ref = db.collection('reports').add(report_entry)
        
        firestore_id = doc_ref[1].id
        print(f"[SUCCESS] Report saved to Firestore with ID: {firestore_id}")
        
        return {'success': True, 'firestore_id': firestore_id}
    
    except Exception as e:
        print(f"[ERROR] Error saving report to Firestore: {e}")
        return {'success': False, 'error': str(e)}


def delete_report(report_id: str, user_uid: Optional[str] = None) -> bool:
    """
    Delete a report from Firestore.
    
    Args:
        report_id: The report's unique ID field (not firestore_id)
        user_uid: If provided, delete from user's collection
    
    Returns:
        True if successful, False otherwise
    """
    try:
        if user_uid:
            reports_ref = db.collection('users').document(user_uid).collection('reports')
        else:
            reports_ref = db.collection('reports')
        
        # Find the document with matching id field
        docs = reports_ref.where('id', '==', report_id).stream()
        
        deleted = False
        for doc in docs:
            doc.reference.delete()
            deleted = True
            print(f"[SUCCESS] Report {report_id} deleted from Firestore")
        
        return deleted
    
    except Exception as e:
        print(f"[ERROR] Error deleting report from Firestore: {e}")
        return False


# ==================== Scheduled Meetings Operations ====================

def load_scheduled_meetings(user_uid: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Load scheduled meetings from Firestore.
    
    Args:
        user_uid: If provided, only load meetings for this user
    
    Returns:
        List of meeting dictionaries
    """
    try:
        if user_uid:
            # Load user-specific meetings
            meetings_ref = db.collection('users').document(user_uid).collection('meetings')
        else:
            # Load all meetings from global collection
            meetings_ref = db.collection('meetings')
        
        docs = meetings_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        
        meetings = []
        for doc in docs:
            meeting_data = doc.to_dict()
            meeting_data['firestore_id'] = doc.id
            meetings.append(meeting_data)
        
        return meetings
    
    except Exception as e:
        print(f"[WARNING] Error loading meetings from Firestore: {e}")
        return []


def save_scheduled_meeting(meeting: Dict[str, Any], user_uid: Optional[str] = None) -> Dict[str, Any]:
    """
    Save a scheduled meeting to Firestore.
    
    Args:
        meeting: Meeting dictionary
        user_uid: If provided, save under user's collection
    
    Returns:
        Dictionary with success status and firestore_id
    """
    try:
        meeting_entry = _sanitize_for_firestore(meeting)
        meeting_entry.setdefault('createdAt', datetime.utcnow().isoformat())
        meeting_entry.setdefault('status', 'scheduled')
        
        # Ensure required fields
        meeting_entry.setdefault('uid', user_uid or 'unknown')
        meeting_entry.setdefault('createdBy', 'unknown@example.com')
        
        if user_uid:
            # Save under user's collection
            doc_ref = db.collection('users').document(user_uid).collection('meetings').add(meeting_entry)
        else:
            # Save to global collection
            doc_ref = db.collection('meetings').add(meeting_entry)
        
        firestore_id = doc_ref[1].id
        print(f"[SUCCESS] Meeting saved to Firestore with ID: {firestore_id}")
        
        return {'success': True, 'firestore_id': firestore_id}
    
    except Exception as e:
        print(f"[ERROR] Error saving meeting to Firestore: {e}")
        return {'success': False, 'error': str(e)}


def update_scheduled_meeting(meeting_id: str, updates: Dict[str, Any], user_uid: Optional[str] = None) -> bool:
    """
    Update a scheduled meeting in Firestore.
    
    Args:
        meeting_id: The meeting's unique ID field
        updates: Dictionary of fields to update
        user_uid: If provided, update in user's collection
    
    Returns:
        True if successful, False otherwise
    """
    try:
        updated = False
        sanitized_updates = _sanitize_for_firestore(updates)
        sanitized_updates['updatedAt'] = datetime.utcnow().isoformat()
        
        # Try user-specific collection if uid provided
        if user_uid:
            meetings_ref = db.collection('users').document(user_uid).collection('meetings')
            docs = meetings_ref.where('id', '==', meeting_id).stream()
            
            for doc in docs:
                doc.reference.update(sanitized_updates)
                updated = True
                print(f"[SUCCESS] Meeting {meeting_id} updated in user {user_uid} collection")
        
        # If not found in user collection or no user_uid, try global collection
        if not updated:
            meetings_ref = db.collection('meetings')
            docs = meetings_ref.where('id', '==', meeting_id).stream()
            
            for doc in docs:
                doc.reference.update(sanitized_updates)
                updated = True
                print(f"[SUCCESS] Meeting {meeting_id} updated in global collection")
        
        if not updated:
            print(f"[WARNING] No meeting found with id={meeting_id} in any collection")
            
        return updated
    
    except Exception as e:
        print(f"[ERROR] Error updating meeting in Firestore: {e}")
        import traceback
        print(traceback.format_exc())
        return False


def delete_scheduled_meeting(meeting_id: str, user_uid: Optional[str] = None) -> bool:
    """
    Delete a scheduled meeting from Firestore.
    
    Args:
        meeting_id: The meeting's unique ID field
        user_uid: If provided, delete from user's collection
    
    Returns:
        True if successful, False otherwise
    """
    try:
        deleted = False
        
        # Try user-specific collection if uid provided
        if user_uid:
            meetings_ref = db.collection('users').document(user_uid).collection('meetings')
            docs = meetings_ref.where('id', '==', meeting_id).stream()
            
            for doc in docs:
                doc.reference.delete()
                deleted = True
                print(f"[SUCCESS] Meeting {meeting_id} deleted from user {user_uid} collection")
        
        # If not found in user collection or no user_uid, try global collection
        if not deleted:
            meetings_ref = db.collection('meetings')
            docs = meetings_ref.where('id', '==', meeting_id).stream()
            
            for doc in docs:
                doc.reference.delete()
                deleted = True
                print(f"[SUCCESS] Meeting {meeting_id} deleted from global collection")
        
        if not deleted:
            print(f"[WARNING] No meeting found with id={meeting_id} in any collection")
            
        return deleted
    
    except Exception as e:
        print(f"[ERROR] Error deleting meeting from Firestore: {e}")
        import traceback
        print(traceback.format_exc())
        return False


# ==================== Helper Functions ====================

def _sanitize_for_firestore(data: Any) -> Any:
    """
    Convert data to be Firestore-compatible.
    Recursively converts datetime objects to ISO format strings.
    
    Args:
        data: Data to sanitize
    
    Returns:
        Sanitized data safe for Firestore storage
    """
    if isinstance(data, datetime):
        return data.isoformat()
    elif isinstance(data, dict):
        return {k: _sanitize_for_firestore(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_sanitize_for_firestore(item) for item in data]
    return data

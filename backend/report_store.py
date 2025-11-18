# backend/report_store.py
from datetime import datetime
import firebase_storage

# ------------------ Report Functions ------------------
def add_report(report: dict, user_uid: str = None, push_to_firestore=True):
    """
    Add a report to Firestore.
    
    Args:
        report: Report dictionary
        user_uid: User ID to save report under
        push_to_firestore: Whether to save to Firestore (always True now)
    
    Returns:
        Dictionary with success status and firestore_id
    """
    # Ensure report has required fields
    report.setdefault("createdAt", datetime.utcnow().isoformat())
    
    # Save to Firestore using firebase_storage
    result = firebase_storage.save_report(report, user_uid=user_uid)
    
    if result.get("success"):
        print(f"[SUCCESS] Report saved successfully! Firestore ID: {result.get('firestore_id')}")
    else:
        print(f"[ERROR] Firestore save error: {result.get('error')}")
    
    return result


def save_report(report_data):
    """
    Minimal function to save a report directly to Firestore.
    This is a wrapper for backward compatibility.
    """
    return add_report(report_data, push_to_firestore=True)

"""
Utility functions for the MeetBot backend.
"""


def extract_user_uid(request_data):
    """
    Extract user UID from request data.
    
    Args:
        request_data: Dictionary containing request data (from request.get_json() or request.form)
    
    Returns:
        str or None: The user UID if found, otherwise None
    """
    if not request_data:
        return None
    
    # Try common field names
    uid = request_data.get('uid') or request_data.get('user_uid')
    
    # Normalize "unknown" to None
    if uid == "unknown":
        return None
    
    return uid


def validate_meeting_data(meeting):
    """
    Validate meeting data structure.
    
    Args:
        meeting: Dictionary containing meeting data
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if not meeting or not isinstance(meeting, dict):
        return False, "Invalid meeting data"
    
    required_fields = ["title", "start", "end", "link"]
    missing_fields = [field for field in required_fields if not meeting.get(field)]
    
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, None


def normalize_user_uid(uid):
    """
    Normalize user UID, converting "unknown" to None.
    
    Args:
        uid: User UID string or None
    
    Returns:
        str or None: Normalized UID
    """
    if not uid or uid == "unknown":
        return None
    return uid

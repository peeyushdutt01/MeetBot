# backend/vexa_handler.py
import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.cloud.vexa.ai"


def _build_headers():
    key = os.getenv("VEXA_API_KEY")
    if not key:
        print("[WARNING] VEXA_API_KEY not found in environment!")
        return None
    # Both header styles may be accepted by hosted/self-hosted variants.
    return {
        "X-API-Key": key,
        "Authorization": f"Bearer {key}",   # harmless to include both
        "Content-Type": "application/json"
    }


def extract_meeting_id(meeting_link):
    """Try to extract the Google Meet code robustly (letters, digits, hyphens)."""
    if not meeting_link:
        return None
    # allow letters, digits, hyphen
    match = re.search(r"meet\.google\.com/([A-Za-z0-9\-]+)", meeting_link)
    return match.group(1) if match else None


import uuid

def create_vexa_bot(meeting_link, meeting_id):
    """
    Create a Vexa bot using the EXISTING meeting_id.
    Returns:
        - bot_id
        - native_meeting_id
        - meeting_id (SAME as provided)
    """
    try:
        native_meeting_id = extract_meeting_id(meeting_link)
        if not native_meeting_id:
            print("[ERROR] Invalid Google Meet link.")
            return None

        headers = _build_headers()
        if headers is None:
            print("[ERROR] Missing VEXA_API_KEY in environment.")
            return None

        payload = {
            "platform": "google_meet",
            "native_meeting_id": native_meeting_id,
            "language": "en",
            "bot_name": "MeetBot"
        }

        print(f"[INFO] Creating Vexa bot for meeting: {native_meeting_id}")
        print(f"[DEBUG] Request payload: {payload}")

        response = requests.post(
            f"{BASE_URL}/bots",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()

        data = response.json()
        print("[SUCCESS] Vexa bot created successfully!")
        print(f"[DEBUG] Full API response: {data}")

        # Extract bot_id from Vexa
        bot_id = data.get("id") or data.get("bot_id")
        if not bot_id:
            print("[WARNING] No bot_id in Vexa response")
            return None

        # -------------------------------------------------------
        # 🚫 NO UUID GENERATION — USE EXACTLY THE ID YOU PASSED
        # -------------------------------------------------------
        internal_meeting_id = meeting_id  # KEEP EXACT ID

        print(f"[DEBUG] Using provided meeting_id → {internal_meeting_id}")

        return {
            "bot_id": bot_id,
            "native_meeting_id": native_meeting_id,
            "meeting_id": internal_meeting_id,
            "full_response": data
        }

    except requests.Timeout:
        print(f"[WARNING] Timeout creating Vexa bot for {meeting_link}")
    except requests.HTTPError as http_err:
        print(f"[ERROR] HTTP error creating Vexa bot: {http_err}")
        if hasattr(http_err, "response") and http_err.response is not None:
            print(f"[DEBUG] Status: {http_err.response.status_code}")
            print(f"[DEBUG] Body: {http_err.response.text}")
    except Exception as e:
        print(f"[ERROR] Unexpected error creating Vexa bot: {e}")
        import traceback
        print(traceback.format_exc())

    return None



def _segments_to_text(segments):
    if not segments:
        return ""
    out_lines = []
    for seg in segments:
        if isinstance(seg, dict):
            speaker = seg.get('speaker') or seg.get('name') or 'Unknown'
            text = seg.get('text') or seg.get('content') or seg.get('transcript') or ''
            if text and text.strip():
                out_lines.append(f"[{speaker}] {text.strip()}")
        elif isinstance(seg, str):
            out_lines.append(seg.strip())
    return "\n".join(out_lines)

def get_bot_details(meeting_identifier: str, timeout=10):
    headers = _build_headers()
    if headers is None:
        return None

    try:
        resp = requests.get(f"{BASE_URL}/bots/status", headers=headers, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        bots = data.get("running_bots", data.get("bots", []))

        # Extract meeting code from link if needed
        identifier = str(meeting_identifier).strip()
        if identifier.startswith("https://"):
            from urllib.parse import urlparse
            parts = [p for p in urlparse(identifier).path.split("/") if p]
            if parts:
                identifier = parts[-1]

        # Filter all matching bots for this meeting code
        matching = []
        for bot in bots:
            labels = bot.get("labels", {}) or {}
            if (
                str(bot.get("native_meeting_id")) == identifier
                or str(labels.get("native_meeting_id")) == identifier
                or str(labels.get("meeting_url")) == meeting_identifier
            ):
                matching.append(bot)

        if not matching:
            print(f"[INFO] No bot found for identifier '{identifier}'")
            return None

        # Sort by created_at (descending)
        matching.sort(key=lambda b: int(b.get("created_at", 0)), reverse=True)
        latest_bot = matching[0]

        return latest_bot

    except Exception as e:
        print(f"[WARNING] Error fetching bot details for {meeting_identifier}: {e}")
        return None


# Replace your current get_vexa_transcript with this function in vexa_handler.py

def get_vexa_transcript(meeting_identifier, bot_id=None, max_retries=10, delay=8):
    """
    Fetch transcript.
    meeting_identifier: google meet code OR full url (fallback)
    bot_id: if you have the Vexa bot id, prefer querying /bots/{bot_id} first
    """
    headers = _build_headers()
    if headers is None:
        return ""

    # 1) If bot_id provided, query bot object first
    if bot_id:
        print(f"[DEBUG] Checking /bots/{bot_id} for transcript/native id")
        bot_data = get_bot_details(bot_id)
        if bot_data:
            # some responses contain transcript at root or under data
            if isinstance(bot_data, dict):
                # direct transcript
                if 'transcript' in bot_data and isinstance(bot_data['transcript'], str) and bot_data['transcript'].strip():
                    print("[SUCCESS] Found transcript in bot_data['transcript']")
                    return bot_data['transcript']
                if 'data' in bot_data:
                    data = bot_data['data']
                    if isinstance(data, dict):
                        if 'transcript' in data and isinstance(data['transcript'], str) and data['transcript'].strip():
                            print("[SUCCESS] Found transcript under bot_data['data']['transcript']")
                            return data['transcript']
                        # maybe segments
                        for candidate in ('segments','outputs','utterances','records','captions'):
                            if candidate in data and isinstance(data[candidate], (list,str)):
                                return _segments_to_text(data[candidate]) if isinstance(data[candidate], list) else data[candidate]

            # else, try to extract native meeting id to use transcript endpoint
            native_meeting = None
            if isinstance(bot_data, dict):
                native_meeting = bot_data.get('native_meeting_id') or bot_data.get('meeting_id') or None
            if native_meeting:
                print(f"[INFO] Found native meeting id from bot details: {native_meeting}")
                meeting_identifier = native_meeting

    # 2) Try transcript endpoint by meeting code / URL. Accept either full URL or native code.
    # Normalize to a meeting code if possible
    meeting_id = extract_meeting_id(str(meeting_identifier)) or str(meeting_identifier)
    transcript_url = f"{BASE_URL}/transcripts/google_meet/{meeting_id}"
    print(f"[DEBUG] Attempting transcript GET: {transcript_url}")

    for attempt in range(1, max_retries + 1):
        try:
            print(f"🔁 Attempt {attempt}/{max_retries}")
            resp = requests.get(transcript_url, headers=headers, timeout=30)
            if resp.status_code == 404:
                print("[WARNING] 404 - transcript not found (resource not ready).")
                if attempt < max_retries:
                    time.sleep(delay)
                    continue
                return ""
            resp.raise_for_status()
            data = resp.json()
            print(f"[SUCCESS] Received transcript response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")

            if isinstance(data, str) and data.strip():
                return data.strip()
            if isinstance(data, dict):
                # common payload layouts
                if 'transcript' in data and isinstance(data['transcript'], str):
                    return data['transcript']
                if 'data' in data and isinstance(data['data'], dict):
                    d = data['data']
                    if 'transcript' in d and isinstance(d['transcript'], str):
                        return d['transcript']
                    # segments or outputs
                    for candidate in ('segments','outputs','utterances','records','captions'):
                        if candidate in d:
                            v = d[candidate]
                            if isinstance(v, str) and v.strip():
                                return v
                            if isinstance(v, list):
                                return _segments_to_text(v)
                # top-level segments
                if 'segments' in data and isinstance(data['segments'], list):
                    return _segments_to_text(data['segments'])

            if attempt < max_retries:
                print(f"[INFO] Transcript not present yet. Sleeping {delay}s")
                time.sleep(delay)
            else:
                print("[ERROR] Transcript not found after retries.")
                return ""

        except requests.HTTPError as he:
            print(f"[ERROR] HTTP error while fetching transcript: {he} - status {getattr(he.response,'status_code', 'unknown')}")
            if attempt < max_retries:
                time.sleep(delay)
            else:
                return ""
        except Exception as e:
            print(f"[ERROR] Unexpected error while fetching transcript: {e}")
            if attempt < max_retries:
                time.sleep(delay)
            else:
                return ""

    return ""



def _parse_transcript(data):
    """Parse transcript from various response formats"""
    if not data:
        return ""
    
    print(f"   Parsing transcript data (type: {type(data).__name__})")
    
    segments = None
    
    # Handle different transcript formats
    if isinstance(data, str):
        # Transcript is already a string
        return data
    elif isinstance(data, dict):
        # Try common field names
        if "segments" in data:
            segments = data["segments"]
        elif "transcript" in data:
            segments = data["transcript"]
        elif "transcription" in data:
            segments = data["transcription"]
        elif "text" in data:
            return data["text"]
        else:
            print(f"   Unknown dict structure. Keys: {list(data.keys())}")
            return ""
    elif isinstance(data, list):
        segments = data
    else:
        print(f"   Unexpected data type: {type(data)}")
        return ""
    
    if not segments:
        print(f"   No segments found")
        return ""
    
    if not isinstance(segments, list):
        print(f"   Segments is not a list: {type(segments)}")
        return ""
    
    print(f"   Found {len(segments)} segments")
    
    # Build transcript text
    transcript_lines = []
    for seg in segments:
        if not isinstance(seg, dict):
            continue
            
        speaker = seg.get('speaker') or seg.get('name') or 'Unknown'
        text = seg.get('text') or seg.get('content') or ''
        
        if text.strip():
            transcript_lines.append(f"[{speaker}] {text}")
    
    transcript_text = "\n".join(transcript_lines)
    print(f"   Generated transcript with {len(transcript_lines)} lines")
    
    return transcript_text


def get_bot_status(bot_id):
    """
    Get the current status of a bot.
    Useful for checking if bot is ready before fetching transcript.
    """
    try:
        headers = _build_headers()
        if headers is None:
            return None
        
        response = requests.get(f"{BASE_URL}/bots/{bot_id}", headers=headers, timeout=10)
        response.raise_for_status()
        
        bot_data = response.json()
        return {
            'status': bot_data.get('status'),
            'start_time': bot_data.get('start_time'),
            'end_time': bot_data.get('end_time'),
            'has_transcript': 'transcript' in bot_data or ('data' in bot_data and 'transcript' in bot_data.get('data', {}))
        }
    except Exception as e:
        print(f"Error checking bot status: {e}")
        return None


def stop_vexa_bot(meeting_url,platform="google_meet"):
    """
    Stop a Vexa bot and remove it from the meeting.
    Returns True if successful, False otherwise.
    """
    try:
        headers = _build_headers()
        if headers is None:
            print("[ERROR] Missing VEXA_API_KEY in environment.")
            return False
        
        stop_url = f"{BASE_URL}/bots/{platform}/{meeting_url}"
        
        print(f"[INFO] Stopping Vexa bot {meeting_url}...")
        
        # DELETE request to stop the bot
        response = requests.delete(stop_url, headers=headers, timeout=30)
        response.raise_for_status()
        
        print(f"[SUCCESS] Bot {meeting_url} stopped successfully")
        return True
        
    except requests.HTTPError as http_err:
        print(f"[ERROR] HTTP error stopping bot: {http_err}")
        if hasattr(http_err, 'response') and http_err.response is not None:
            print(f"[DEBUG] Response status: {http_err.response.status_code}")
            print(f"[DEBUG] Response body: {http_err.response.text}")
        return False
    except Exception as e:
        print(f"[ERROR] Error stopping bot: {e}")
        import traceback
        print(traceback.format_exc())
        return False
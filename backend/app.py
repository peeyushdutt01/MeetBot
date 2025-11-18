from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from pytz import UTC
from uuid import uuid4
from meeting_bot import MeetingBot
from vexa_handler import create_vexa_bot, extract_meeting_id, get_vexa_transcript, get_bot_details
from dotenv import load_dotenv
import firebase_storage

load_dotenv()

from scheduler import start_scheduler, schedule_meeting, update_meeting_status, _load_bot_map, _save_bot_map

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv('FRONTEND_URL', 'http://localhost:5173')}})

UPLOAD_FOLDER = 'uploads'
REPORTS_FOLDER = 'reports'
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'webm', 'mp4', 'mpeg', 'mpga', 'ogg'}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(REPORTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

bot = MeetingBot()

def allowed_file(filename):
    if not filename or '.' not in filename:
        return False
    parts = filename.rsplit('.', 1)
    if len(parts) != 2:
        return False
    extension = parts[1].lower()
    return extension in ALLOWED_EXTENSIONS

def save_report(filename, transcript, summary_data, user_uid=None):
    report = {
        'id': datetime.now().strftime('%Y%m%d_%H%M%S'),
        'filename': filename,
        'date': datetime.now().isoformat(),
        'transcript': transcript,
        'summary': summary_data.get('summary', ''),
        'key_topics': summary_data.get('key_topics', []),
        'action_items': summary_data.get('action_items', []),
        'participants': summary_data.get('participants', []),
        'key_dates': summary_data.get('key_dates', []),
        'decisions': summary_data.get('decisions', []),
        'uid': user_uid
    }

    result = firebase_storage.save_report(report, user_uid=user_uid)
    if result.get('success'):
        report['firestore_id'] = result.get('firestore_id')
    
    return report

def load_scheduled_meetings(user_uid=None):
    """Load scheduled meetings from Firestore"""
    return firebase_storage.load_scheduled_meetings(user_uid=user_uid)

def save_scheduled_meetings(meetings):
    """
    Save scheduled meetings to Firestore.
    - Assign ID if missing
    - Deduplicate by ID
    - Do NOT overwrite uid/createdBy if provided by frontend
    """
    for m in meetings:
        if not isinstance(m, dict):
            continue

        mid = m.get("id") or str(uuid4())
        m["id"] = mid

        if m.get("uid") in (None, ""):
            m["uid"] = m.get("createdBy") or "unknown"

        if m.get("createdBy") in (None, ""):
            m["createdBy"] = "unknown@example.com"
        
        user_uid = m.get("uid")
        firebase_storage.save_scheduled_meeting(m, user_uid=user_uid if user_uid != "unknown" else None)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'MeetBot API is running'})

@app.route('/api/process-meeting', methods=['POST'])
def process_meeting():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

        user_uid = request.form.get('uid') or request.form.get('user_uid')

        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        print(f"Transcribing audio: {filename}")
        transcript = bot.transcribe_audio(filepath)

        print("Generating summary...")
        summary_data = bot.generate_summary(transcript)

        report = save_report(filename, transcript, summary_data, user_uid=user_uid)

        return jsonify({
            'success': True,
            'message': 'Meeting processed successfully',
            'report': report
        })

    except Exception as e:
        import traceback
        print(f"Error processing meeting: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports', methods=['GET', 'POST'])
def get_reports():
    try:
        uid = None

        if request.method == "POST":
            body = request.get_json(silent=True) or {}
            uid = body.get("uid") or body.get("user_uid")

        reports = firebase_storage.load_reports(user_uid=uid)

        return jsonify(reports)

    except Exception as e:
        print(f"Error fetching reports: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/filter', methods=['POST'])
def filter_reports():
    """Return reports only for the given uid"""
    try:
        body = request.get_json(silent=True) or {}
        uid = body.get("uid") or body.get("user_uid")

        if not uid:
            return jsonify({'error': 'UID required'}), 400

        filtered = firebase_storage.load_reports(user_uid=uid)

        return jsonify(filtered), 200

    except Exception as e:
        print("[ERROR] Error filtering reports:", str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/<report_id>', methods=['DELETE'])
def delete_report(report_id):
    try:
        body = request.get_json(silent=True) or {}
        uid = body.get("uid") or body.get("user_uid")
        
        deleted = firebase_storage.delete_report(report_id, user_uid=uid)
        
        if not deleted:
            return jsonify({'error': 'Report not found'}), 404

        return jsonify({'success': True, 'message': 'Report deleted'})
    except Exception as e:
        print(f"Error deleting report: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ========== CALENDAR ENDPOINTS ==========

@app.route('/api/scheduled-meetings/filter', methods=['POST'])
def filter_scheduled_meetings():
    """Return meetings filtered by uid."""
    body = request.get_json(silent=True) or {}
    uid = body.get("uid") or body.get("user_uid")

    meetings = firebase_storage.load_scheduled_meetings(user_uid=uid)

    return jsonify(meetings), 200

@app.route('/api/scheduled-meetings', methods=['GET'])
def get_scheduled_meetings():
    """Return ALL scheduled meetings (no filtering)."""
    meetings = firebase_storage.load_scheduled_meetings()
    return jsonify(meetings), 200


@app.route('/api/scheduled-meetings', methods=['POST'])
def add_scheduled_meeting():
    """Add a new meeting (from React CalendarModal)."""
    print("\n" + "="*70)
    print("[INFO] ADD /api/scheduled-meetings called")
    print("="*70)

    try:
        meeting = request.get_json()
        print(f"[DEBUG] Received meeting data: {meeting}")

        if not meeting or not isinstance(meeting, dict):
            return jsonify({'success': False, 'error': 'Invalid meeting data'}), 400

        if not meeting.get("id"):
            meeting["id"] = str(uuid4())

        required = ["title", "start", "end", "link"]
        missing = [x for x in required if not meeting.get(x)]
        if missing:
            return jsonify({
                "success": False,
                "error": f"Missing: {', '.join(missing)}"
            }), 400

        meeting["uid"] = meeting.get("uid") or meeting.get("createdBy") or "unknown"
        meeting["createdBy"] = meeting.get("createdBy") or "unknown@example.com"

        user_uid = meeting.get("uid") if meeting.get("uid") != "unknown" else None

        result = firebase_storage.save_scheduled_meeting(meeting, user_uid=user_uid)
        
        if result.get("success"):
            meeting["firestore_id"] = result["firestore_id"]
            print("[INFO] Saved to Firestore")
        else:
            print("[WARNING] Firestore save failed")

        try:
            schedule_meeting(meeting)
        except Exception as e:
            print("[WARNING] Scheduler error:", e)

        return jsonify({"success": True, "meeting": meeting}), 201

    except Exception as e:
        import traceback
        print(f"[ERROR] Error adding meeting: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/scheduled-meetings/<meeting_id>', methods=['PUT'])
def update_meeting(meeting_id):
    updated = request.get_json()

    uid = updated.get("uid")
    user_uid = uid if uid and uid != "unknown" else None

    success = firebase_storage.update_scheduled_meeting(meeting_id, updated, user_uid=user_uid)
    
    if not success:
        return jsonify({"success": False, "error": "Not found"}), 404

    try:
        schedule_meeting(updated)
    except Exception as e:
        print(f"[WARNING] Failed to reschedule meeting: {e}")

    return jsonify({"success": True}), 200


@app.route('/api/scheduled-meetings/<meeting_id>', methods=['DELETE'])
def delete_meeting(meeting_id):

    body = request.get_json(silent=True) or {}
    uid = body.get("uid") or body.get("user_uid")
    user_uid = uid if uid and uid != "unknown" else None
    
    deleted = firebase_storage.delete_scheduled_meeting(meeting_id, user_uid=user_uid)

    if not deleted:
        return jsonify({"success": False, "error": "Not found"}), 404

    try:
        from scheduler import scheduler
        scheduler.remove_job(f"start_{meeting_id}")
        scheduler.remove_job(f"end_{meeting_id}")
    except Exception as e:
        print(f"[WARNING] Failed to remove scheduler jobs: {e}")

    return jsonify({"success": True}), 200


# ================== VEXA BOT ENDPOINT ==================
@app.route('/api/join-meeting', methods=['POST'])
def join_meeting():
    """Join a meeting immediately (not scheduled)"""
    import uuid

    try:
        data = request.json
        meeting_link = data.get('meeting_link')
        meeting_title = data.get('title', 'Instant Meeting')
        meeting_id = data.get('meeting_id')

        if not meeting_link:
            return jsonify({'error': 'Meeting link required'}), 400

        if not meeting_id:
            meeting_id = str(uuid.uuid4())
            print(f"[INFO] Generated meeting_id for instant: {meeting_id}")

        print(f"\n[INFO] Joining meeting directly: {meeting_link}")
        result = create_vexa_bot(meeting_link, meeting_id)

        if not result or not isinstance(result, dict):
            return jsonify({'error': 'Failed to create Vexa bot'}), 500

        bot_id = result["bot_id"]
        native_meeting_id = result["native_meeting_id"]

        print(f"[DEBUG] Using meeting_id → {meeting_id}")

        # Save bot map
        bot_map = _load_bot_map()
        bot_map[meeting_id] = {
            "bot_id": bot_id,
            "native_meeting_id": native_meeting_id
        }
        _save_bot_map(bot_map)

        update_meeting_status(meeting_id, "in_progress", bot_id=bot_id)

        # Save instant meeting to Firestore
        user_uid = data.get("uid")
        new_meeting_entry = {
            "id": meeting_id,
            "title": meeting_title,
            "link": meeting_link,
            "start": datetime.now(UTC).isoformat(),
            "end": None,
            "createdBy": data.get("createdBy") or "unknown@example.com",
            "uid": user_uid,
            "isInstant": True
        }

        firebase_storage.save_scheduled_meeting(
            new_meeting_entry, 
            user_uid=user_uid if user_uid and user_uid != "unknown" else None
        )

        print(f"[INFO] Instant meeting saved → {meeting_id}")

        return jsonify({
            'success': True,
            'bot_id': bot_id,
            'meeting_id': meeting_id,
            'native_meeting_id': native_meeting_id,
            'status': 'in_progress'
        }), 200

    except Exception as e:
        print(f"[ERROR] Error:", e)
        return jsonify({'error': str(e)}), 500


@app.route('/api/verify-active-bots', methods=['GET'])
def verify_active_bots():
    from scheduler import _load_meeting_status, _save_meeting_status, _load_bot_map
    import requests, os

    BASE_URL = "https://api.cloud.vexa.ai"
    API_KEY = os.getenv("VEXA_API_KEY")

    if not API_KEY:
        return jsonify({"error": "VEXA_API_KEY missing"}), 500

    try:
        #Fetch live bots from Vexa
        headers = {"X-API-Key": API_KEY}
        resp = requests.get(f"{BASE_URL}/bots/status", headers=headers, timeout=10)
        resp.raise_for_status()
        vexa_data = resp.json()

        running_native_ids = {
            bot.get("native_meeting_id")
            for bot in vexa_data.get("running_bots", [])
            if bot.get("status") == "running"
        }

        print(f"[INFO] Vexa currently running {len(running_native_ids)} bots")

        local_status = _load_meeting_status()
        bot_map = _load_bot_map()

        verified_meetings = []
        stopped_meetings = []

        for meeting_id, status_entry in local_status.items():
            bot_entry = bot_map.get(meeting_id)
            if not bot_entry:
                continue

            native_id = bot_entry.get("native_meeting_id")

            if native_id in running_native_ids:
                verified_meetings.append({
                    "meeting_id": meeting_id,
                    "bot_id": bot_entry.get("bot_id"),
                    "native_meeting_id": native_id,
                    "status": status_entry.get("status"),
                    "updated_at": status_entry.get("updated_at")
                })

            elif status_entry.get("status") in ("in_progress", "bot_joining"):
                print(f"[WARNING] Bot {native_id} not found in Vexa → marking as stopped")
                status_entry["status"] = "stopped"
                local_status[meeting_id] = status_entry
                stopped_meetings.append(meeting_id)

        _save_meeting_status(local_status)

        return jsonify({
            "verified_count": len(verified_meetings),
            "stopped_count": len(stopped_meetings),
            "verified_meetings": verified_meetings,
            "stopped_meetings": stopped_meetings
        }), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Vexa API error: {str(e)}"}), 500
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route('/api/get-transcript', methods=['POST'])
def get_transcript():
    """Fetch transcript for a meeting that already ended"""
    print("[INFO] /api/get-transcript called")

    try:
        from report_store import add_report
        data = request.get_json(silent=True) or {}
        print("[DEBUG] Received data:", data)

        meeting_link = data.get('meeting_link')
        bot_id = data.get("bot_id")
        user_uid = data.get("uid") or data.get("user_uid")

        print("[DEBUG] User UID:", user_uid)

        if not meeting_link:
            return jsonify({'error': 'Meeting link required'}), 400

        meeting_id = extract_meeting_id(meeting_link)
        print("[DEBUG] Extracted meeting ID:", meeting_id)

        if not meeting_id:
            return jsonify({'error': 'Invalid Google Meet link'}), 400

        print("[INFO] Fetching transcript for:", meeting_id)
        transcript = get_vexa_transcript(meeting_id, bot_id=bot_id)

        if not transcript or not transcript.strip():
            print("[WARNING] Transcript empty or not ready")
            return jsonify({
                'success': False,
                'message': 'Transcript not available yet. It may still be processing.'
            }), 404

        print("[INFO] Generating summary...")
        bot = MeetingBot()
        summary_data = bot.generate_summary(transcript)

        report = {
            "id": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "title": f"Meeting Report ({meeting_id})",
            "link": meeting_link,
            "date": datetime.now().isoformat(),
            "transcript": transcript,
            "summary": summary_data.get("summary", ""),
            "key_topics": summary_data.get("key_topics", []),
            "action_items": summary_data.get("action_items", []),
            "participants": summary_data.get("participants", []),
            "key_dates": summary_data.get("key_dates", []),
            "decisions": summary_data.get("decisions", []),
            "uid": user_uid
        }

        print("[INFO] Saving report to Firestore...")
        firestore_result = add_report(report, user_uid=user_uid, push_to_firestore=True)

        if firestore_result.get("success"):
            report["firestore_id"] = firestore_result["firestore_id"]
            print("[SUCCESS] Saved to Firestore")
        else:
            print("[WARNING] Firestore save failed:", firestore_result.get("error"))

        return jsonify({
            "success": True,
            "message": "Transcript processed, summarized, and saved successfully",
            "report": report
        })

    except Exception as e:
        import traceback
        print("[ERROR] Error:", str(e))
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500



# ================== NEW: MEETING STATUS & ACTIVE MEETINGS ENDPOINTS ==================

@app.route('/api/meeting-status', methods=['GET'])
def get_all_meeting_statuses():
    """Get status of all meetings"""
    try:
        from scheduler import _load_meeting_status
        statuses = _load_meeting_status()
        return jsonify(statuses), 200
    except Exception as e:
        print(f"[ERROR] Error fetching meeting statuses: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/meeting-status/<meeting_id>', methods=['GET'])
def get_meeting_status_endpoint(meeting_id):
    """Get status of a specific meeting"""
    try:
        from scheduler import get_meeting_status
        status = get_meeting_status(meeting_id)
        
        if not status:
            return jsonify({'error': 'Meeting not found'}), 404
        
        return jsonify(status), 200
    except Exception as e:
        print(f"[ERROR] Error fetching meeting status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/active-meetings', methods=['GET'])
def get_active_meetings():
    """Get all meetings currently in progress"""
    try:
        from scheduler import get_all_active_meetings
        active = get_all_active_meetings()
        
        meetings = firebase_storage.load_scheduled_meetings()

        meeting_dict = {m['id']: m for m in meetings if isinstance(m, dict) and m.get('id')}
        
        result = []
        for meeting_id, status in active.items():
            meeting_data = meeting_dict.get(meeting_id, {})
            
            if meeting_data:

                if 'id' not in meeting_data:
                    meeting_data['id'] = meeting_id
            else:

                meeting_data = {
                    'id': meeting_id,
                    'title': 'Unknown Meeting',
                    'link': None,
                    'start': status.get('updated_at')
                }
            
            result.append({
                **meeting_data,
                'status_info': status
            })
        
        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR] Error fetching active meetings: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/fetch-transcript/<meeting_id>', methods=['POST'])
def fetch_transcript_manual(meeting_id):

    print(f"\n{'='*70}")
    print("[INFO] MANUAL TRANSCRIPT FETCH REQUEST")
    print(f"{'='*70}")
    print(f"Meeting ID (URL): {meeting_id}")

    if not meeting_id or meeting_id == 'undefined' or meeting_id == 'null':
        print(f"[ERROR] Invalid meeting ID received: {meeting_id}")
        return jsonify({
            "success": False,
            "error": "Invalid meeting ID. Meeting ID is required and cannot be 'undefined' or 'null'."
        }), 400

    try:
        from scheduler import fetch_meeting_transcript

        body = request.get_json(silent=True) or {}
        user_uid = body.get("uid")

        print(f"[DEBUG] User UID from frontend: {user_uid}")

        print(f"[DEBUG] Looking up meeting_id: {meeting_id}")
        print(f"[DEBUG] All available meeting statuses:")
        from scheduler import _load_meeting_status
        all_statuses = _load_meeting_status()
        for mid, stat in all_statuses.items():
            print(f"   - {mid}: {stat.get('status')}")
        
        status = all_statuses.get(meeting_id)
        print(f"[DEBUG] Status lookup result: {status}")
        
        if not status:

            bot_map = firebase_storage.load_bot_map()
            print(f"[DEBUG] Available bot_map entries: {list(bot_map.keys())}")
            
            if meeting_id in bot_map:
                print(f"[INFO] Found meeting in bot_map, creating status from bot data")
                status = {
                    "meeting_id": meeting_id,
                    "status": "in_progress",
                    "bot_id": bot_map[meeting_id].get("bot_id")
                }
            else:
                print(f"[ERROR] Meeting {meeting_id} not found in status map or bot map")
                return jsonify({
                    "success": False,
                    "error": f"Meeting not found. Available IDs: {list(all_statuses.keys())[:3]}"
                }), 404

        if status.get("status") == "completed":
            return jsonify({
                "success": False,
                "error": "Transcript already fetched for this meeting"
            }), 400

        if status.get("status") not in ["in_progress", "bot_joining"]:
            return jsonify({
                "success": False,
                "error": f"Meeting is in '{status.get('status')}' state. Bot must be active."
            }), 400

        meetings = firebase_storage.load_scheduled_meetings()
        meeting_data = next((m for m in meetings if m["id"] == meeting_id), None)

        if not meeting_data:
            print(f"[WARNING] Meeting data not found in Firestore for {meeting_id}")
            print(f"[DEBUG] Creating minimal meeting data from bot_map")

            bot_map = firebase_storage.load_bot_map()
            bot_entry = bot_map.get(meeting_id)
            
            if not bot_entry:
                return jsonify({
                    "success": False,
                    "error": "Meeting data not found in Firestore and no bot mapping exists"
                }), 404

            native_id = bot_entry.get('native_meeting_id', meeting_id)
            meeting_data = {
                "id": meeting_id,
                "title": f"Meeting {meeting_id[:8]}",
                "link": f"https://meet.google.com/{native_id}",
                "start": status.get('updated_at'),
                "uid": user_uid
            }
            print(f"[INFO] Created minimal meeting data: {meeting_data}")

        print(f"[INFO] Fetching transcript for: {meeting_data.get('title')}")

        result = fetch_meeting_transcript(
            meeting_id=meeting_id,
            meeting_data=meeting_data,
            user_uid=user_uid
        )

        if result.get("success"):
            return jsonify({
                "success": True,
                "message": "Transcript fetched and report generated successfully",
                "report": result.get("report")
            }), 200

        return jsonify({
            "success": False,
            "error": result.get("error", "Unknown error")
        }), 500

    except Exception as e:
        import traceback
        print("[ERROR] Error in manual transcript fetch:", str(e))
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/meeting-status/<meeting_id>', methods=['DELETE'])
def clear_meeting_status(meeting_id):
    """Clear/reset status for a meeting (admin/debug endpoint)"""
    try:
        from scheduler import _load_meeting_status, _save_meeting_status
        
        statuses = _load_meeting_status()
        if meeting_id in statuses:
            del statuses[meeting_id]
            _save_meeting_status(statuses)
            return jsonify({'success': True, 'message': 'Status cleared'}), 200
        else:
            return jsonify({'error': 'Meeting status not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stop-bot/<meeting_id>', methods=['POST'])
def stop_bot_endpoint(meeting_id):
    """
    Stop the Vexa bot for a meeting and mark it as stopped.
    Used when user manually ends the meeting early.
    """
    print(f"\n{'='*70}")
    print(f"[INFO] STOP BOT REQUEST")
    print(f"{'='*70}")
    print(f"Meeting ID: {meeting_id}")
    
    if not meeting_id or meeting_id == 'undefined' or meeting_id == 'null':
        print(f"[ERROR] Invalid meeting ID received: {meeting_id}")
        return jsonify({
            'success': False,
            'error': 'Invalid meeting ID. Meeting ID is required and cannot be \'undefined\' or \'null\'.'
        }), 400
    
    try:
        from scheduler import get_meeting_status
        from vexa_handler import stop_vexa_bot

        status = get_meeting_status(meeting_id)
        
        if not status:
            return jsonify({
                'success': False,
                'error': 'Meeting not found'
            }), 404
        
        current_status = status.get('status')
        
        if current_status in ['completed', 'stopped', 'failed']:
            return jsonify({
                'success': False,
                'error': f'Meeting already {current_status}'
            }), 400

        bot_map = firebase_storage.load_bot_map()
        bot_entry = bot_map.get(meeting_id)
        
        if not bot_entry:
            return jsonify({
                'success': False,
                'error': 'Bot mapping not found for this meeting'
            }), 404
        
        native_meeting_id = bot_entry.get("native_meeting_id")

        print(f"[INFO] Stopping bot for meeting: {meeting_id} → native: {native_meeting_id}")
        success = stop_vexa_bot(native_meeting_id)
        
        if success:
            print(f"[SUCCESS] Bot stopped successfully for meeting {meeting_id}")

            try:
                from scheduler import update_meeting_status
                update_meeting_status(meeting_id, "stopped")
                print(f"[INFO] Meeting status updated → stopped")
            except Exception as e:
                print(f"[WARNING] Failed to update meeting status locally: {e}")

            return jsonify({
                'success': True,
                'message': 'Bot stopped and meeting marked as stopped'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to stop bot'
            }), 500
    
    except Exception as e:
        import traceback
        print(f"[ERROR] Error stopping bot: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ================== ENHANCED SCHEDULER STATUS ENDPOINT ==================

@app.route('/api/scheduler-status', methods=['GET'])
def scheduler_status():
    """Enhanced debug endpoint with meeting status info"""
    try:
        from scheduler import scheduler, _load_bot_map, _load_meeting_status, get_all_active_meetings
        from pytz import UTC
        
        jobs = scheduler.get_jobs()
        job_list = [{
            'id': job.id,
            'next_run': str(job.next_run_time),
            'trigger': str(job.trigger),
            'func_name': job.func.__name__
        } for job in jobs]
        
        bot_map = _load_bot_map()
        meeting_statuses = _load_meeting_status()
        active_meetings = get_all_active_meetings()
        
        return jsonify({
            'scheduler_running': scheduler.running,
            'current_time_utc': datetime.now(UTC).isoformat(),
            'total_jobs': len(jobs),
            'jobs': job_list,
            'bot_map': bot_map,
            'meeting_statuses': meeting_statuses,
            'active_meetings_count': len(active_meetings),
            'active_meetings': active_meetings,
            'env_vars_present': {
                'VEXA_API_KEY': bool(os.getenv('VEXA_API_KEY')),
                'GOOGLE_API_KEY': bool(os.getenv('GOOGLE_API_KEY')),
                'GROQ_API_KEY': bool(os.getenv('GROQ_API_KEY'))
            }
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "="*70)
    print("[INFO] Starting MeetBot Backend")
    print("="*70)

    print("\n[INFO] Environment Variables:")
    print(f"   VEXA_API_KEY: {'Present' if os.getenv('VEXA_API_KEY') else 'Missing'}")
    print(f"   GOOGLE_API_KEY: {'Present' if os.getenv('GOOGLE_API_KEY') else 'Missing'}")
    print(f"   GROQ_API_KEY: {'Present' if os.getenv('GROQ_API_KEY') else 'Missing'}")
    
    try:
        start_scheduler()
        print("\n[SUCCESS] Scheduler initialized successfully")
    except Exception as e:
        print(f"\n[ERROR] Failed to start scheduler: {e}")
        import traceback
        print(traceback.format_exc())
    
    print("\n[INFO] Starting Flask server on port 5000...")
    print("="*70 + "\n")
    
    app.run(debug=True, port=5000, use_reloader=False)
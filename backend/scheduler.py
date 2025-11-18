# backend/scheduler.py
import os
import time
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from dateutil import parser
from pytz import UTC
from dotenv import load_dotenv

load_dotenv()

from meeting_bot import MeetingBot
from vexa_handler import create_vexa_bot, get_bot_details, extract_meeting_id, get_vexa_transcript
from report_store import add_report
import firebase_storage

# Absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

scheduler = BackgroundScheduler(timezone=UTC)


# -------------------- Utility Helpers -------------------- #

def _load_bot_map():
    return firebase_storage.load_bot_map()


def _save_bot_map(data):
    firebase_storage.save_bot_map(data)


def _load_meeting_status():
    return firebase_storage.load_meeting_status()


def _save_meeting_status(data):
    firebase_storage.save_meeting_status(data)


# -------------------- Meeting Status -------------------- #

def update_meeting_status(meeting_id, status, bot_id=None, error=None):
    statuses = _load_meeting_status()
    prev = statuses.get(meeting_id, {}).get('status')

    status_entry = {
        "meeting_id": meeting_id,
        "status": status,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    if bot_id:
        status_entry["bot_id"] = bot_id
    if error:
        status_entry["error"] = error

    statuses[meeting_id] = status_entry
    _save_meeting_status(statuses)
    print(f"[INFO] Meeting status updated: {meeting_id} {prev or ''} → {status}")
    return status_entry


def get_meeting_status(meeting_id):
    return _load_meeting_status().get(meeting_id)


def get_all_active_meetings():
    statuses = _load_meeting_status()
    return {
        mid: s for mid, s in statuses.items()
        if s.get("status") in ["bot_joining", "in_progress"]
    }


# -------------------- Scheduler Setup -------------------- #

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("[INFO] Scheduler started successfully.")
    else:
        print("[WARNING] Scheduler already running.")


# -------------------- Scheduling Core -------------------- #

def schedule_meeting(meeting):
    meeting_id = meeting.get("id")

    print(f"\n{'='*70}")
    print("[INFO] SCHEDULING NEW MEETING")
    print(f"{'='*70}")
    print(f"Meeting ID: {meeting_id}")
    print(f"Title: {meeting.get('title')}")
    print(f"Link: {meeting.get('link')}")
    update_meeting_status(meeting_id, "scheduled")
    
    # Load and update meetings in Firestore
    user_uid = meeting.get("uid")
    if user_uid and user_uid != "unknown":
        firebase_storage.update_scheduled_meeting(meeting_id, meeting, user_uid=user_uid)
    else:
        firebase_storage.update_scheduled_meeting(meeting_id, meeting)

    try:
        start_dt = parser.isoparse(meeting.get("start")).astimezone(UTC)
        end_dt = parser.isoparse(meeting.get("end")).astimezone(UTC)
        now_utc = datetime.now(UTC)
        time_until_start = (start_dt - now_utc).total_seconds()
        print(f"Current UTC: {now_utc:%Y-%m-%d %H:%M:%S}")
        print(f"Start UTC:   {start_dt:%Y-%m-%d %H:%M:%S}")
        print(f"End UTC:     {end_dt:%Y-%m-%d %H:%M:%S}")
        print(f"Starts in:   {time_until_start:.1f}s ({time_until_start/60:.1f} min)")
    except Exception as e:
        print(f"[ERROR] Failed to parse datetimes: {e}")
        update_meeting_status(meeting_id, "failed", error=str(e))
        return

    try:
        for job_id in [f"start_{meeting_id}", f"end_{meeting_id}"]:
            try:
                scheduler.remove_job(job_id)
            except:
                pass

        start_job = scheduler.add_job(
            func=run_vexa_start,
            trigger="date",
            run_date=start_dt,
            args=[meeting],
            id=f"start_{meeting_id}",
            replace_existing=True,
            misfire_grace_time=300,
        )
        end_job = scheduler.add_job(
            func=run_vexa_end,
            trigger="date",
            run_date=end_dt,
            args=[meeting],
            id=f"end_{meeting_id}",
            replace_existing=True,
            misfire_grace_time=300,
        )
        print(f"[SUCCESS] Scheduled START job: {start_job.id}")
        print(f"[SUCCESS] Scheduled END job: {end_job.id}")
        print(f"[DEBUG] Total scheduled jobs: {len(scheduler.get_jobs())}")
        print(f"{'='*70}\n")
    except Exception as e:
        print(f"[ERROR] Scheduler error: {e}")
        update_meeting_status(meeting_id, "failed", error=str(e))


# -------------------- Vexa Bot Flow -------------------- #

def run_vexa_start(meeting):
    """Triggered at meeting start → creates and monitors Vexa bot"""
    load_dotenv()

    original_meeting_id = meeting.get("id")
    update_meeting_status(original_meeting_id, "bot_joining")

    print(f"\n{'='*70}")
    print("[INFO] MEETING START JOB TRIGGERED")
    print(f"{'='*70}")
    print(f"Time: {datetime.now(UTC):%Y-%m-%d %H:%M:%S %Z}")
    print(f"Meeting: {meeting.get('title')}")
    print(f"Meeting ID: {original_meeting_id}")

    meeting_link = meeting.get("link")
    if not meeting_link:
        update_meeting_status(original_meeting_id, "failed", error="No meeting link")
        print("[ERROR] No meeting link provided!")
        return

    # ------------------------------------------
    # 1️⃣ CREATE THE BOT (use ORIGINAL meeting ID)
    # ------------------------------------------
    result = create_vexa_bot(meeting_link, original_meeting_id)

    if not result or not isinstance(result, dict):
        update_meeting_status(original_meeting_id, "failed", error="Failed to create bot")
        print("[ERROR] Failed to create Vexa bot")
        return

    bot_id = result["bot_id"]
    native_meeting = result["native_meeting_id"]

    print(f"[INFO] Bot created → bot_id={bot_id}, native={native_meeting}")

    # ------------------------------------------
    # 2️⃣ SAVE BOT MAP (USE ORIGINAL ID)
    # ------------------------------------------
    bot_map = _load_bot_map()
    bot_map[original_meeting_id] = {
        "bot_id": bot_id,
        "native_meeting_id": native_meeting
    }
    _save_bot_map(bot_map)

    print(f"[INFO] Bot map saved for {original_meeting_id}")

    # ------------------------------------------
    # 3️⃣ STATUS → bot_joining
    # ------------------------------------------
    update_meeting_status(original_meeting_id, "bot_joining", bot_id=bot_id)

    # ------------------------------------------
    # 4️⃣ BOT ACTIVATION POLLING
    # ------------------------------------------
    print("[INFO] Waiting 10 seconds for Vexa to register the bot...")
    time.sleep(10)

    for attempt in range(12):
        bot_status = get_bot_details(meeting_link)

        if bot_status:
            status = bot_status.get("status")
            norm = bot_status.get("normalized_status")
            print(f"[DEBUG] Poll {attempt+1}: Bot={status}/{norm}")

            if status in ("running", "active", "joined") or norm == "Up":
                print("[SUCCESS] Bot active")
                update_meeting_status(original_meeting_id, "in_progress", bot_id=bot_id)
                break
        else:
            print(f"[WARNING] Poll {attempt+1}: Bot not found")

        time.sleep(10)

    else:
        print("[WARNING] Bot never reached 'in_progress'. Keeping bot_joining state.")
        update_meeting_status(original_meeting_id, "bot_joining", bot_id=bot_id)



def run_vexa_end(meeting):
    """Triggered at scheduled meeting end → fetches transcript"""
    load_dotenv()
    meeting_id = meeting.get("id")

    status = get_meeting_status(meeting_id)
    if status and status.get("status") == "completed":
        print(f"[SUCCESS] Meeting {meeting_id} already completed (manual fetch); skipping end job.")
        return

    print(f"\n{'='*70}")
    print("[INFO] MEETING END JOB TRIGGERED (Scheduled)")
    print(f"{'='*70}")
    print(f"Meeting: {meeting.get('title')}")

    user_uid = meeting.get("uid")

    print(f"[DEBUG] UID for auto-save: {user_uid}")

    fetch_meeting_transcript(
        meeting_id,
        meeting,
        user_uid=user_uid
    )





# -------------------- Transcript & Reporting -------------------- #

def fetch_meeting_transcript(meeting_id, meeting_data=None, user_uid=None):
    load_dotenv()
    update_meeting_status(meeting_id, "processing")

    print(f"\n{'='*70}")
    print("[INFO] FETCHING TRANSCRIPT FOR MEETING")
    print(f"{'='*70}")
    print(f"Meeting ID: {meeting_id}")
    print(f"Time: {datetime.now(UTC):%Y-%m-%d %H:%M:%S %Z}")

    try:
        bot = MeetingBot()
    except Exception as e:
        update_meeting_status(meeting_id, "failed", error=f"MeetingBot init failed: {e}")
        print(f"[ERROR] Error initializing MeetingBot: {e}")
        return {"success": False, "error": str(e)}

    bot_map = _load_bot_map()
    bot_entry = bot_map.get(meeting_id)
    if not bot_entry:
        msg = f"No bot entry found for meeting {meeting_id}"
        update_meeting_status(meeting_id, "failed", error=msg)
        print(f"[ERROR] {msg}")
        return {"success": False, "error": msg}

    bot_id = bot_entry.get("bot_id") if isinstance(bot_entry, dict) else bot_entry
    native_meeting = bot_entry.get("native_meeting_id") if isinstance(bot_entry, dict) else None
    print(f"[INFO] Using bot_id={bot_id}, native_meeting={native_meeting}")

    # fallback if missing
    if not native_meeting and meeting_data and meeting_data.get("link"):
        native_meeting = extract_meeting_id(meeting_data["link"])

    identifier = native_meeting or meeting_id
    print(f"[INFO] Fetching transcript using native meeting id: {identifier}")

    transcript = get_vexa_transcript(identifier, bot_id=bot_id, max_retries=15, delay=12)
    if not transcript or not transcript.strip():
        update_meeting_status(meeting_id, "in_progress")
        print("[WARNING] Empty or no transcript available.")
        return {"success": False, "error": "No transcript"}

    print(f"[SUCCESS] Transcript retrieved ({len(transcript)} chars)")

    try:
        print("[INFO] Generating summary...")
        summary_data = bot.generate_summary(transcript)
        print("[SUCCESS] Summary generated.")
    except Exception as e:
        update_meeting_status(meeting_id, "failed", error=f"Summary generation failed: {e}")
        print(f"[ERROR] Error generating summary: {e}")
        return {"success": False, "error": str(e)}

    if not meeting_data:
        meeting_data = {"id": meeting_id, "title": "Unknown Meeting", "link": ""}

    report = {
        "id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "title": meeting_data.get("title", "Untitled Meeting"),
        "link": meeting_data.get("link", ""),
        "date": datetime.now().isoformat(),
        "transcript": transcript,
        "summary": summary_data.get("summary", ""),
        "key_topics": summary_data.get("key_topics", []),
        "action_items": summary_data.get("action_items", []),
        "participants": summary_data.get("participants", []),
        "key_dates": summary_data.get("key_dates", []),
        "decisions": summary_data.get("decisions", []),
        "createdBy": meeting_data.get("createdBy", "system@meetbot.ai"),
        "uid": user_uid,  
    }

    try:
        print("[INFO] Saving report...")
        result = add_report(report, push_to_firestore=True,user_uid=user_uid)
        if result and result.get("success"):
            print("[SUCCESS] Report saved successfully.")
            update_meeting_status(meeting_id, "in_progress", bot_id=bot_id)
            return {"success": True, "report": report}
        else:
            msg = f"Report save failed: {result.get('error') if result else 'Unknown error'}"
            update_meeting_status(meeting_id, "failed", error=msg)
            print(f"[WARNING] {msg}")
            return {"success": False, "error": msg}
    except Exception as e:
        update_meeting_status(meeting_id, "failed", error=f"Report save failed: {e}")
        print(f"[ERROR] Error saving report: {e}")
        return {"success": False, "error": str(e)}

# MeetBot Backend

AI-powered meeting assistant backend built with Flask.

## Features

- Audio transcription using Groq Whisper
- Meeting summary generation using Google Gemini AI
- Integration with Vexa.ai for live meeting bots
- Firebase Firestore for data persistence
- Scheduled meeting management with APScheduler
- Meeting transcript retrieval and processing

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip package manager
- Firebase project with Firestore enabled
- API keys for:
  - Groq (for transcription)
  - Google Gemini (for summarization)
  - Vexa.ai (for live meeting bots)

### Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set up environment variables (see Environment Variables section below)

3. Configure Firebase:
   - Place your Firebase service account JSON file in the backend directory
   - Update `firebase_config.py` with your configuration

### Running the Backend

Development mode:

```bash
python app.py
```

Production mode (with gunicorn):

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

The server will start on `http://localhost:5000`

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# API Keys
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
VEXA_API_KEY=your_vexa_api_key_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Firebase Configuration (if not using service account JSON)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_CLIENT_ID=your_client_id
```

See `.env.example` for a template.

## API Endpoints

### Health Check
- `GET /api/health` - Check if the API is running

### Meeting Processing
- `POST /api/process-meeting` - Upload and process audio file
- `POST /api/join-meeting` - Join a meeting with a bot immediately
- `POST /api/get-transcript` - Fetch transcript for a completed meeting

### Reports
- `GET /api/reports` - Get all reports
- `POST /api/reports/filter` - Filter reports by user UID
- `DELETE /api/reports/:id` - Delete a report

### Scheduled Meetings
- `GET /api/scheduled-meetings` - Get all scheduled meetings
- `POST /api/scheduled-meetings` - Create a new scheduled meeting
- `POST /api/scheduled-meetings/filter` - Filter meetings by user UID
- `PUT /api/scheduled-meetings/:id` - Update a meeting
- `DELETE /api/scheduled-meetings/:id` - Delete a meeting

### Meeting Status
- `GET /api/meeting-status` - Get all meeting statuses
- `GET /api/meeting-status/:id` - Get specific meeting status
- `DELETE /api/meeting-status/:id` - Clear meeting status
- `POST /api/stop-bot/:id` - Stop a bot for a meeting
- `POST /api/fetch-transcript/:id` - Manually fetch transcript

### Active Meetings
- `GET /api/active-meetings` - Get currently active meetings
- `GET /api/verify-active-bots` - Verify and sync bot status with Vexa

### Scheduler
- `GET /api/scheduler-status` - Get scheduler debug information

## Project Structure

```
backend/
├── app.py                  # Main Flask application
├── meeting_bot.py          # AI transcription and summarization
├── scheduler.py            # Meeting scheduling logic
├── vexa_handler.py         # Vexa.ai bot management
├── firebase_config.py      # Firebase configuration
├── firebase_storage.py     # Firebase Firestore operations
├── report_store.py         # Report storage helpers
├── meeting_store.py        # Meeting data helpers
├── utils.py                # Utility functions
├── requirements.txt        # Python dependencies
├── uploads/                # Uploaded audio files (temporary)
└── reports/                # Generated reports (temporary)
```

## Configuration

### File Size Limits
- Maximum upload file size: 25MB

### Supported Audio Formats
- mp3, wav, m4a, webm, mp4, mpeg, mpga, ogg

### Scheduler
- Uses UTC timezone
- Polls meeting bot status every 10 seconds
- Automatically starts and stops bots based on scheduled times

## Development

### Adding New Endpoints

1. Define the route in `app.py`
2. Add helper functions to appropriate modules
3. Update this README with endpoint documentation

### Error Handling

All endpoints should:
- Return appropriate HTTP status codes
- Include error messages in JSON response
- Log errors with appropriate log levels

### Logging

Use the logging prefixes for consistency:
- `[INFO]` - General information
- `[DEBUG]` - Debug information
- `[WARNING]` - Warnings
- `[ERROR]` - Errors
- `[SUCCESS]` - Success messages

## Troubleshooting

### Common Issues

1. **Firebase Connection Errors**
   - Verify Firebase credentials are correct
   - Check that Firestore is enabled in your Firebase project

2. **API Key Errors**
   - Ensure all required API keys are set in `.env`
   - Verify API keys are valid and have proper permissions

3. **Scheduler Not Starting**
   - Check logs for initialization errors
   - Verify timezone settings

4. **Bot Not Joining Meetings**
   - Verify Vexa API key is valid
   - Check meeting link format is correct
   - Review Vexa API logs

## License

Refer to the project's root LICENSE file.

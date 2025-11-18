# MeetBot Frontend

AI-powered meeting assistant web application built with React and Vite.

## Features

- Upload and process meeting audio files
- Join live meetings with AI bot
- View meeting transcripts and summaries
- Track action items across meetings
- Schedule and manage meetings
- View active meeting bots
- Firebase authentication
- Real-time meeting status updates

## Prerequisites

- Node.js 16 or higher
- npm or yarn package manager
- Firebase project for authentication

## Installation

1. Install dependencies:

```bash
npm install
```

2. Configure Firebase:

Create a `src/config/firebase.js` file with your Firebase configuration:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your_api_key",
  authDomain: "your_auth_domain",
  projectId: "your_project_id",
  storageBucket: "your_storage_bucket",
  messagingSenderId: "your_messaging_sender_id",
  appId: "your_app_id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

3. Configure API endpoint:

Update `src/config/api.js` with your backend URL:

```javascript
const API_BASE_URL = 'http://localhost:5000';
export default API_BASE_URL;
```

## Running the Application

Development mode:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Environment Variables

Create a `.env` file in the frontend directory (optional):

```env
VITE_API_URL=http://localhost:5000
```

See `.env.example` for a template.

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable React components
│   │   ├── ActionItems.jsx
│   │   ├── ActiveMeetings.jsx
│   │   ├── CalendarModal.jsx
│   │   ├── Navbar.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── ReportCard.jsx
│   │   └── SettingsModal.jsx
│   ├── contexts/        # React context providers
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Login.jsx
│   │   ├── Reports.jsx
│   │   ├── Signup.jsx
│   │   └── ThankYou.jsx
│   ├── config/          # Configuration files
│   │   ├── api.js
│   │   └── firebase.js
│   ├── styles/          # CSS styles
│   ├── App.jsx          # Main app component
│   ├── App.css          # App styles
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── package.json         # Dependencies
└── vite.config.js       # Vite configuration
```

## Features Guide

### Dashboard
- Upload audio files for transcription
- Join meetings with AI bot
- View upcoming and active meetings
- Access important action items

### Reports
- Browse all meeting reports
- View transcripts, summaries, and action items
- Filter by date or keywords
- Delete reports

### Action Items
- View all action items across meetings
- Mark items as important
- Mark items as done
- Navigate to source reports

### Calendar
- Schedule future meetings
- Edit existing meetings
- Delete meetings
- View meeting details

### Active Meetings
- Monitor bots currently in meetings
- Stop bots manually
- Fetch transcripts for completed meetings

## Technology Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Firebase** - Authentication
- **Axios** - HTTP client
- **React Big Calendar** - Calendar component
- **Moment.js** - Date/time handling
- **React Icons** - Icon library

## Development

### Code Style

- Use functional components with hooks
- Follow camelCase naming convention
- Keep components focused and under 300 lines
- Extract reusable logic into custom hooks
- Use CSS modules or inline styles consistently

### Adding New Features

1. Create component in appropriate directory
2. Add routing if needed in `App.jsx`
3. Update navigation in `Navbar.jsx`
4. Add API calls in component or dedicated service file

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify backend is running on correct port
   - Check CORS configuration
   - Ensure API_BASE_URL is correct

2. **Firebase Auth Errors**
   - Verify Firebase configuration
   - Check Firebase console for auth settings
   - Ensure auth domain is whitelisted

3. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Clear Vite cache: `rm -rf node_modules/.vite`

## License

Refer to the project's root LICENSE file.


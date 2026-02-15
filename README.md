# [Meetbot](https://meetbot.netlify.app/)

An AI-powered meeting assistant that automates meeting transcription, generates comprehensive summaries with action items, and deploys live meeting bots to Google Meet sessions. Built to streamline meeting workflows through intelligent audio processing and real-time bot integration.

## Project Overview

MeetBot is a full-stack web application that combines AI-driven audio transcription with automated meeting analysis. The platform enables users to either upload recorded meetings or deploy live bots to join Google Meet sessions, automatically extracting transcripts, summaries, action items, participants, and key decisions. The system features a scheduling mechanism that deploys bots at predetermined times and retrieves transcripts when meetings conclude.

## Key Features

**Audio Processing Pipeline**
- Multi-format audio file upload support (MP3, WAV, M4A, WEBM, MP4, OGG)
- AI-powered transcription using Groq Whisper API
- Structured content extraction with Google Gemini AI for hierarchical summarization
- Automated detection of action items, key decisions, and temporal information

**Live Meeting Bot Integration**
- Real-time bot deployment to Google Meet sessions via Vexa.ai API
- Automated meeting scheduling with APScheduler for precise bot join times
- Meeting status tracking (scheduled, bot_joining, in_progress, completed)
- Post-meeting transcript retrieval and processing

**Meeting Management System**
- Interactive calendar interface for scheduling and tracking meetings
- Multi-user support with Firebase Authentication
- Cloud-based data persistence with Firestore
- Real-time meeting status monitoring dashboard

**Report Generation**
- Comprehensive meeting reports with structured summaries
- Participant tracking and engagement analysis
- Action item extraction with contextual assignments
- Key dates, decisions, and topic identification

## Technical Architecture

**Backend - Flask REST API**
- Microservices-oriented architecture with modular handlers for bot management, transcription, and storage
- Asynchronous job scheduling with APScheduler for meeting automation
- Centralized Firebase Firestore storage layer replacing local JSON persistence
- RESTful API design with CORS-enabled endpoints for cross-origin frontend communication
- Production-ready deployment with Gunicorn WSGI server

**Frontend - React SPA**
- Component-based architecture with React 18 and React Router for client-side routing
- Context API for global state management (AuthContext, ThemeContext)
- Real-time UI updates for meeting status and bot activities
- Calendar visualization with react-big-calendar for meeting scheduling
- Protected routes with authentication guards

**AI Integration**
- Groq Whisper (whisper-large-v3) for high-accuracy audio transcription
- Google Gemini (gemini-2.5-pro) for advanced natural language understanding
- Structured JSON output parsing with prompt engineering for consistent data extraction
- Multi-level content analysis: summaries, topics, action items, decisions

**Cloud Infrastructure**
- Firebase Authentication for secure user management
- Firestore for scalable NoSQL document storage with user-scoped collections
- Environment-based configuration supporting development and production credentials
- Netlify (frontend) and Render (backend) deployment configurations

## Core Functionality

**Meeting Processing Workflow**
1. User uploads audio file or schedules live bot deployment
2. System validates file format and schedules processing job
3. Groq Whisper transcribes audio with verbose JSON response
4. Google Gemini analyzes transcript and generates structured summary
5. Report persists to Firestore with user-specific scoping
6. Frontend displays comprehensive meeting analysis

**Bot Lifecycle Management**
1. User schedules meeting with title, time, and Google Meet link
2. APScheduler registers job to deploy bot at meeting start time
3. Vexa.ai API creates bot and injects into meeting session
4. System polls bot status and tracks meeting progress
5. On completion, transcript fetches from Vexa.ai API
6. Transcript processes through AI pipeline and generates report

**Data Architecture**
- User-scoped Firestore collections for reports and scheduled meetings
- Global system collections for bot mappings and meeting status
- Atomic updates and reads with Firebase SDK
- Optimistic UI updates with error handling and rollback

## Skills Demonstrated

**Full-Stack Development**
- End-to-end application architecture from API design to UI implementation
- RESTful API development with Flask and modern frontend with React
- State management patterns and component lifecycle optimization
- Asynchronous programming and job scheduling

**AI/ML Integration**
- Multi-model AI orchestration (Groq Whisper, Google Gemini)
- Prompt engineering for structured output generation
- Large language model API consumption and response parsing
- Error handling and fallback strategies for AI services

**Cloud & DevOps**
- Firebase services integration (Auth, Firestore)
- Environment-based configuration management
- Production deployment with Netlify and Render
- API key security and credential management

**Third-Party API Integration**
- Vexa.ai meeting bot API for real-time meeting participation
- Complex API workflows with authentication and error handling
- Polling mechanisms for asynchronous job status tracking
- Webhook-style event processing

**Database Design**
- NoSQL document modeling for hierarchical data
- User-scoped data architecture for multi-tenancy
- Efficient querying strategies with Firestore
- Data migration from local JSON to cloud storage

## Architecture Patterns

**Separation of Concerns**
- Dedicated modules for bot handling, storage, scheduling, and AI processing
- Firebase storage abstraction layer isolating Firestore operations
- Frontend context providers separating business logic from UI components

**Event-Driven Scheduling**
- APScheduler background jobs for time-based bot deployment
- Status-driven state machine for meeting lifecycle management
- Polling mechanisms with configurable intervals for real-time updates

**API Gateway Pattern**
- Flask application as centralized entry point for all backend operations
- Route handlers delegating to specialized service modules
- Consistent error handling and response formatting

**Repository Pattern**
- Storage abstraction through firebase_storage.py module
- Unified interface for CRUD operations across different entities
- Environment-aware credential management (production vs development)

**Component Composition**
- React component hierarchy with reusable UI elements (ReportCard, Navbar, CalendarModal)
- Higher-order component pattern for route protection (ProtectedRoute)
- Context providers for cross-cutting concerns (auth, theme)


Meetbot Link : [Meetbot](https://meetbot.netlify.app/)

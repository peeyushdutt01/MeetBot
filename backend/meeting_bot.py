import os
import re
import json
from groq import Groq
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class MeetingBot:
    def __init__(self):
        groq_key = os.getenv("GROQ_API_KEY")
        google_key = os.getenv("GOOGLE_API_KEY")
        
        if not groq_key:
            print("[WARNING] GROQ_API_KEY not found in environment!")
        if not google_key:
            print("[WARNING] GOOGLE_API_KEY not found in environment!")
        
        self.groq_client = Groq(api_key=groq_key)
        genai.configure(api_key=google_key)
        
        # Use gemini-2.0-flash-exp or gemini-1.5-pro as fallback
        try:
            self.gemini_model = genai.GenerativeModel("gemini-2.5-pro")
            print("[SUCCESS] Using Gemini model: gemini-2.5-pro")
        except:
            try:
                self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
                print("[SUCCESS] Using Gemini model: gemini-2.0-flash-exp")
            except:
                print("[ERROR] Failed to initialize Gemini model!")
                raise
        
        print(f"[DEBUG] GROQ_API_KEY present: {bool(groq_key)}")
        print(f"[DEBUG] GOOGLE_API_KEY present: {bool(google_key)}")

    
    def transcribe_audio(self, audio_file_path):
        """Transcribe audio using Groq Whisper"""
        try:
            print(f"[INFO] Transcribing audio file: {audio_file_path}")
            
            with open(audio_file_path, "rb") as file:
                transcription = self.groq_client.audio.transcriptions.create(
                    file=(audio_file_path, file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                )
            
            print(f"[SUCCESS] Transcription complete ({len(transcription.text)} chars)")
            return transcription.text
            
        except Exception as e:
            print(f"[ERROR] Transcription error: {str(e)}")
            raise Exception(f"Error in transcription: {str(e)}")
    
    def generate_summary(self, transcript):
        """Generate meeting summary using Gemini with structured JSON output"""
        
        if not transcript or not transcript.strip():
            print("[WARNING] Empty transcript provided to generate_summary")
            return {
                "summary": "No transcript available",
                "key_topics": [],
                "action_items": [],
                "participants": [],
                "key_dates": [],
                "decisions": []
            }
        
        print(f"[INFO] Generating summary for transcript ({len(transcript)} chars)...")
        
        prompt = f"""
You are MeetBot, an AI-powered meeting assistant designed to provide comprehensive, structured analysis of meeting transcripts with high accuracy and contextual understanding.

ANALYSIS INSTRUCTIONS:
1. Generate a hierarchical summary that captures meeting content at multiple levels of granularity
2. Identify and extract action items with participant assignments using contextual attention
3. Detect key decisions and their rationale
4. Track participant contributions and engagement patterns
5. Extract temporal information (deadlines, dates, milestones)
6. Ignore participant of the form Google Participant (spaces/) as that is just the screen sharing system


TRANSCRIPT:
{transcript}

Please respond with ONLY a valid JSON object (no markdown, no code blocks) in this exact format:
{{
    "summary": "A clear and concise summary of the main points discussed in the meeting",
    "key_topics": [
        "First key discussion topic",
        "Second key discussion topic",
        "Third key discussion topic"
    ],
    "action_items": [
        "Action item 1 with responsible person if mentioned",
        "Action item 2 with responsible person if mentioned"
    ],
    "participants": [
        "Person 1 name",
        "Person 2 name"
    ],
    "key_dates": [
        "Date or event mentioned with context"
    ],
    "decisions": [
        "Key decision 1",
        "Key decision 2"
    ]
}}

CRITICAL GUIDELINES:
- Maintain factual accuracy: Only include information explicitly stated or clearly implied in the transcript
- Use extractive grounding: Ensure all claims can be traced back to specific parts of the transcript
- Preserve speaker attribution: Accurately identify who said or contributed what
- Handle uncertainty: Use "Not specified", "Unclear", or "Not mentioned" when information is absent
- Contextual attention: Pay special attention to phrases indicating tasks ("we need to", "action item", "follow up"), decisions ("we decided", "let's go with"), and temporal markers ("by Friday", "next week")
- If transcript contains multiple speakers, ensure speaker diarization is reflected in participant tracking

Return ONLY the JSON object with no additional text, markdown formatting, or code blocks.
"""
        
        try:
            response = self.gemini_model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean up possible Markdown code fences
            result_text = re.sub(r"^```(?:json)?", "", result_text)
            result_text = re.sub(r"```$", "", result_text)
            result_text = result_text.strip()
            
            # Parse JSON
            try:
                parsed_summary = json.loads(result_text)
                print("[SUCCESS] Summary generated and parsed successfully")
                return parsed_summary
            except json.JSONDecodeError as je:
                print(f"[WARNING] JSON parsing failed: {je}")
                print(f"   Response text: {result_text[:200]}...")
                # Fallback: return raw text if JSON parsing fails
                return {
                    "summary": result_text,
                    "key_topics": [],
                    "action_items": [],
                    "participants": [],
                    "key_dates": [],
                    "decisions": []
                }
                
        except Exception as e:
            print(f"[ERROR] Error generating summary: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise Exception(f"Error generating summary: {str(e)}")
# 💡💡💡 Lamp (Lamp-Tracker) 💡💡💡

> **An AI-driven academic focus environment that replaces generic time-tracking with qualitative cognitive friction diagnostics**

Standard productivity apps can only reduce studying to a cold metric: *"You studied for 40 minutes."* But cognitive efficiency isn't a clean numeric formula! Lamp is hence built to track the actual mental process of studying. I used structured focus blocks with unstructured friction logging, as wellas a Gemini API to cross-reference study habits with actual exam mark schemes and provide actionable diagnostic feedback.

## Core Features

*   **Qualitative Friction Logging:** A structured environment to log real-time cognitive roadblocks (e.g., "stuck on kinematic chain rotation!") instead of just tracking elapsed time.
*   **Gemini Diagnostic Engine:** Uses a custom-prompted LLM pipeline to act as a ruthless diagnostic engine, returning gaps, issues and possible adaptions to solve them.
*   **Mark-Scheme Aligned Feedback:** Generates specific, imperative "next modes" (e.g., "Drill Paper 1 Q4 synthesis under 15-minute time pressure") rather than just generic study tips.
*   **Built-in Eye Care & Focus Tooling:** Integrates background-friendly notifications for eye-care breaks (When turned on, every 25min, Lamp makes a sound to remind you to go to lamp and pause).

## System Architecture

Lamp processes unstructured study data into structured behavioral insights:

`User Friction Log & Focus Timer` ➔ `Client State` ➔ `System Prompt & Context Injection` ➔ `Gemini API` ➔ `Parsed Structured JSON Diagnostic` ➔ `UI Render`

## Tech Stack

*   **Frontend:** React, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **AI Integration:** Google Gemini API 
*   **Development Tools:** Claude, Kimi for coding, Cursor (for prompt engineering and some state debugging)

## Quick Start

To run Lamp locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lvxr2024/Lamp-Tracker.git
   cd Lamp-Tracker
2. **Install dependencies:**
    npm install
3. **Set up environment variables:**
    Create a .env file in the root directory and add your Gemini API key (there is a .env.example file available too):
    VITE_GEMINI_API_KEY=your_api_key_here
4. **Start the server**
    npm run dev
# BigQuery Release Explorer

web application built with Python Flask and plain vanilla HTML, CSS, and JS that fetches the BigQuery Release Notes from the official RSS/Atom feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`), segments them, and provides interactive search, filtering, and X (formerly Twitter) sharing capabilities.

## Features

1. **Structured Feed Parsing**: Parses the Atom XML feed on the backend and breaks down the daily grouped content into individual, semantic updates (Features, Issues, Changes, Deprecations, and General Notes).
2. **Premium Dark Glassmorphism Theme**: An immersive visual design utilizing:
   - Modern typography (`Plus Jakarta Sans` for body, `JetBrains Mono` for code blocks).
   - Glassmorphic panels with backdrop blurs and subtle border gradients.
   - Smooth transition animations and interactive micro-interactions.
   - Dynamic badges matched with custom color coding per update type.
3. **Advanced Client-Side Filtering**:
   - Live text search across release titles, descriptions, and categories.
   - Dynamic filter chips to segment feed updates by type, displaying real-time counts.
   - Chronological sorting (newest/oldest first).
4. **On-Demand Refresh & Intelligent Cache**:
   - A dedicated **Refresh** button with a loading spinner that fetches the latest updates.
   - Backed by an intelligent in-memory cache on the Flask server (5-minute TTL) to optimize server performance and prevent rate-limiting, which can be bypassed with the force-refresh.
   - Relative cache-age indicator (`Updated 2m ago`, etc.) that updates in real-time.
5. **Interactive X/Twitter Sharing Composer**:
   - Select any specific update card to open a custom sharing dialog.
   - Pre-formatted text template containing the update title, description (auto-truncated to preserve the 280 character limit), relevant hashtags, and a direct URL to the official Google Cloud documentation for that specific release.
   - Dynamic character counter with warn/danger states (changes colors at 250 and 270 characters).
   - Click "Post to X" to launch the official X Web Intent in a new tab.

## Project Structure

```
agy-cli-projects/
├── app.py                  # Flask backend & Feed Parser
├── templates/
│   └── index.html          # Main HTML structure & layouts
├── static/
│   ├── css/
│   │   └── style.css       # Custom Glassmorphic styles & responsiveness
│   └── js/
│       └── app.js          # Client-side state & UI controllers
├── README.md               # User documentation
└── .venv/                  # Python Virtual Environment (ignored)
```

## Quick Start

### 1. Prerequisites
- Python 3.x installed on your system.

### 2. Setup and Installation
Navigate to the project directory and run:

```bash
# Verify virtual environment is active, or activate it:
source .venv/bin/activate

# (Optional - already pre-installed) Install dependencies:
pip install flask requests beautifulsoup4
```

### 3. Run the App
Start the Flask development server:
```bash
python app.py
```
The server will start on [http://127.0.0.1:5001](http://127.0.0.1:5001).

### 4. Open in Browser
Open [http://127.0.0.1:5001](http://127.0.0.1:5001) in your web browser to explore your new BigQuery Release Notes Dashboard!

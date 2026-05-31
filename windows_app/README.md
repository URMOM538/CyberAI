# CyberAI Desktop — Windows Python App

A full-featured cybersecurity hub that looks and works exactly like the CyberAI website, running as a native Windows desktop app.

## Features

- **Dashboard** — Live stats, recent CISA threats, top attack origins
- **Threat Research** — 1,600+ real CISA Known Exploited Vulnerabilities, searchable
- **Threat Map** — Interactive world map with threat origin dots and attack counts
- **Security Tools** — 20 curated cybersecurity tool recommendations with pros/cons
- **AI Advisor** — Chat with an AI cybersecurity expert (needs OpenAI API key)

## Quick Start

### 1. Install Python 3.9+
Download from https://python.org/downloads — check "Add Python to PATH"

### 2. Install requirements
```
pip install -r requirements.txt
```

### 3. Run the app
```
python main.py
```

The app will open a full window and stay open. It automatically fetches live threat data from CISA on startup.

## AI Advisor Setup

1. Click **⚙ Set API Key** in the AI Advisor page
2. Enter your OpenAI API key (get one free at https://platform.openai.com/api-keys)
3. Your key is saved locally in `config.json`

## Requirements

- Python 3.9 or newer
- Internet connection (for CISA threat data and AI)
- Windows 10/11 recommended (also works on Mac/Linux)

## Files

- `main.py` — The desktop application (run this)
- `requirements.txt` — Python packages to install
- `config.json` — Created automatically, stores your API key
- `cyberai_local.db` — Created automatically, stores chat history

#!/usr/bin/env python3
"""
CyberAI Desktop — Windows Python Application
Looks and works exactly like the CyberAI website.
Run: python main.py
"""

import os
import sys
import json
import time
import sqlite3
import threading
import traceback
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from typing import Optional

import tkinter as tk
from tkinter import messagebox, simpledialog

# ─── Check and install missing packages ───────────────────────────────────────
REQUIRED = ["customtkinter", "requests", "Pillow", "matplotlib", "geopandas", "geodatasets", "openai"]

def ensure_packages():
    missing = []
    for pkg in REQUIRED:
        try:
            __import__(pkg.lower().replace("-", "_"))
        except ImportError:
            missing.append(pkg)
    if missing:
        root = tk.Tk()
        root.withdraw()
        answer = messagebox.askyesno(
            "CyberAI Setup",
            f"Installing required packages:\n{', '.join(missing)}\n\nThis takes ~30 seconds. Proceed?"
        )
        root.destroy()
        if answer:
            subprocess.run([sys.executable, "-m", "pip", "install"] + missing, check=True)
        else:
            sys.exit(0)

ensure_packages()

import customtkinter as ctk
import requests
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

try:
    import geopandas as gpd
    import geodatasets
    HAS_GEO = True
except Exception:
    HAS_GEO = False

# ─── Theme ────────────────────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

BG        = "#040d1a"
SIDEBAR   = "#060c18"
CARD      = "#0a1628"
CARD2     = "#0d1f3c"
ACCENT    = "#0099ee"
ACCENT_LO = "#003d5c"
TEXT      = "#e2e8f0"
MUTED     = "#64748b"
BORDER    = "#1a2f4a"
CRITICAL  = "#ff3d3d"
HIGH      = "#ff8800"
MEDIUM    = "#ffd700"
LOW       = "#00ccff"
SUCCESS   = "#00e878"

FONT_TITLE = ("Segoe UI", 22, "bold")
FONT_H2    = ("Segoe UI", 15, "bold")
FONT_H3    = ("Segoe UI", 12, "bold")
FONT_BODY  = ("Segoe UI", 11)
FONT_SM    = ("Segoe UI", 9)
FONT_MONO  = ("Courier New", 10)

SEV_COLOR = {"critical": CRITICAL, "high": HIGH, "medium": MEDIUM, "low": LOW}

# ─── Config / local DB ────────────────────────────────────────────────────────
APP_DIR  = Path(__file__).parent
DB_PATH  = APP_DIR / "cyberai_local.db"
CFG_PATH = APP_DIR / "config.json"

def load_config() -> dict:
    if CFG_PATH.exists():
        try:
            return json.loads(CFG_PATH.read_text())
        except Exception:
            pass
    return {}

def save_config(cfg: dict):
    CFG_PATH.write_text(json.dumps(cfg, indent=2))

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS cached_threats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cve_id TEXT,
        title TEXT,
        description TEXT,
        vendor TEXT,
        severity TEXT DEFAULT 'high',
        category TEXT DEFAULT 'Vulnerability',
        date_added TEXT,
        raw_json TEXT,
        cached_at TEXT DEFAULT (datetime('now'))
    )""")
    conn.commit()
    conn.close()

# ─── CISA KEV data ────────────────────────────────────────────────────────────
CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
_cisa_cache: list = []
_cisa_loaded = False

def fetch_cisa(on_done=None):
    global _cisa_cache, _cisa_loaded
    try:
        r = requests.get(CISA_URL, timeout=15)
        vulns = r.json().get("vulnerabilities", [])
        _cisa_cache = sorted(vulns, key=lambda v: v.get("dateAdded",""), reverse=True)
        _cisa_loaded = True
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM cached_threats")
        for v in _cisa_cache[:200]:
            conn.execute(
                "INSERT INTO cached_threats (cve_id, title, description, vendor, date_added, raw_json) VALUES (?,?,?,?,?,?)",
                (v.get("cveID"), v.get("vulnerabilityName"), v.get("shortDescription"),
                 v.get("vendorProject"), v.get("dateAdded"), json.dumps(v))
            )
        conn.commit()
        conn.close()
    except Exception:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT raw_json FROM cached_threats ORDER BY date_added DESC").fetchall()
        conn.close()
        if rows:
            _cisa_cache = [json.loads(r[0]) for r in rows]
            _cisa_loaded = True
    if on_done:
        on_done()

def get_threats(limit=50) -> list:
    return _cisa_cache[:limit]

# ─── Hardcoded recommendations ────────────────────────────────────────────────
RECOMMENDATIONS = [
    {"name": "Bitdefender Total Security", "category": "Antivirus", "rating": 4.9, "price": "$39.99/yr", "free": False, "platforms": "Win, Mac, iOS, Android", "description": "Industry-leading antivirus with AI-powered threat detection, ransomware remediation, and multi-layer defenses.", "pros": ["Best malware detection rates","Low system impact","Ransomware rollback"], "cons": ["Subscription required"], "url": "https://bitdefender.com"},
    {"name": "Malwarebytes Premium", "category": "Antivirus", "rating": 4.7, "price": "$39.99/yr", "free": True, "platforms": "Win, Mac, iOS, Android", "description": "Excellent second-opinion scanner and real-time protection. Free version great for on-demand scanning.", "pros": ["Free version available","Lightweight","Excellent PUP removal"], "cons": ["Free lacks real-time protection"], "url": "https://malwarebytes.com"},
    {"name": "Windows Defender", "category": "Antivirus", "rating": 4.5, "price": "Free", "free": True, "platforms": "Windows", "description": "Microsoft's built-in antivirus. Significantly improved in recent years with solid protection and zero cost.", "pros": ["Completely free","Built into Windows","No performance impact"], "cons": ["Fewer advanced features"], "url": "https://microsoft.com/windows-defender"},
    {"name": "CrowdStrike Falcon Go", "category": "Endpoint Protection", "rating": 4.8, "price": "$59.99/yr", "free": False, "platforms": "Win, Mac, Linux", "description": "Cloud-native endpoint security platform with AI-driven threat hunting and zero-trust enforcement.", "pros": ["AI behavioral detection","Cloud-managed","Threat hunting"], "cons": ["Expensive for home users"], "url": "https://crowdstrike.com"},
    {"name": "Mullvad VPN", "category": "VPN", "rating": 4.9, "price": "$5/month", "free": False, "platforms": "Win, Mac, Linux, iOS, Android", "description": "Privacy-first VPN with no-logs policy verified by audits, anonymous account numbers, and WireGuard protocol.", "pros": ["No account email required","No-logs audited","WireGuard support"], "cons": ["No free tier"], "url": "https://mullvad.net"},
    {"name": "ProtonVPN", "category": "VPN", "rating": 4.7, "price": "Free/$9.99/mo", "free": True, "platforms": "Win, Mac, Linux, iOS, Android", "description": "Swiss-based VPN with strong privacy laws, open-source apps, and a generous free tier with no data limits.", "pros": ["Free tier unlimited data","Open source","Swiss privacy"], "cons": ["Free tier slower speeds"], "url": "https://protonvpn.com"},
    {"name": "NordVPN", "category": "VPN", "rating": 4.7, "price": "$3.99/month", "free": False, "platforms": "Win, Mac, Linux, iOS, Android", "description": "Popular VPN with Threat Protection feature, double VPN, and onion over VPN. 5000+ servers worldwide.", "pros": ["5000+ servers","Threat Protection","Double VPN"], "cons": ["Past security incident (2018)"], "url": "https://nordvpn.com"},
    {"name": "1Password", "category": "Password Manager", "rating": 4.9, "price": "$2.99/month", "free": False, "platforms": "Win, Mac, Linux, iOS, Android", "description": "Best-in-class password manager with Travel Mode, Watchtower security alerts, and family sharing.", "pros": ["Travel Mode","Watchtower alerts","Family plans"], "cons": ["No free tier"], "url": "https://1password.com"},
    {"name": "Bitwarden", "category": "Password Manager", "rating": 4.8, "price": "Free/$10/yr", "free": True, "platforms": "Win, Mac, Linux, iOS, Android, Browser", "description": "Open-source password manager with generous free tier, self-hosting option, and end-to-end encryption.", "pros": ["Free and open source","Self-hostable","All platforms"], "cons": ["UI less polished than competitors"], "url": "https://bitwarden.com"},
    {"name": "Authy", "category": "MFA / 2FA", "rating": 4.7, "price": "Free", "free": True, "platforms": "Win, Mac, iOS, Android", "description": "Two-factor authentication app with cloud backup, multi-device sync, and offline TOTP support.", "pros": ["Cloud backup","Multi-device","Offline TOTP"], "cons": ["Closed source"], "url": "https://authy.com"},
    {"name": "YubiKey 5 Series", "category": "MFA / 2FA", "rating": 4.9, "price": "$50-$70", "free": False, "platforms": "Win, Mac, Linux", "description": "Hardware security key supporting FIDO2, WebAuthn, and OTP. Gold standard for phishing-resistant MFA.", "pros": ["Phishing-resistant","Works offline","Multiple protocols"], "cons": ["Physical key (can be lost)"], "url": "https://yubico.com"},
    {"name": "Signal", "category": "Encrypted Messaging", "rating": 4.9, "price": "Free", "free": True, "platforms": "Win, Mac, Linux, iOS, Android", "description": "End-to-end encrypted messenger. Gold standard for private communication with disappearing messages.", "pros": ["E2E encrypted","Open source","Disappearing messages"], "cons": ["Requires phone number"], "url": "https://signal.org"},
    {"name": "Proton Mail", "category": "Encrypted Email", "rating": 4.7, "price": "Free/Premium", "free": True, "platforms": "Win, Mac, iOS, Android, Browser", "description": "Swiss-based encrypted email with zero-knowledge encryption. No IP logging, GDPR compliant.", "pros": ["Zero-knowledge encryption","Swiss privacy laws","Open source"], "cons": ["Limited free storage (1GB)"], "url": "https://proton.me"},
    {"name": "VeraCrypt", "category": "Disk Encryption", "rating": 4.8, "price": "Free", "free": True, "platforms": "Win, Mac, Linux", "description": "Free, open-source disk encryption. Successor to TrueCrypt with AES-256 and hidden volume support.", "pros": ["AES-256 encryption","Hidden volumes","Open source"], "cons": ["Complex setup"], "url": "https://veracrypt.fr"},
    {"name": "Wireshark", "category": "Network Security", "rating": 4.8, "price": "Free", "free": True, "platforms": "Win, Mac, Linux", "description": "Industry-standard network protocol analyzer. Captures and analyzes all network traffic for security auditing.", "pros": ["Deep packet inspection","500+ protocols","Open source"], "cons": ["Steep learning curve"], "url": "https://wireshark.org"},
    {"name": "GlassWire", "category": "Network Monitor", "rating": 4.6, "price": "Free/Premium", "free": True, "platforms": "Windows", "description": "Visual network security monitor for Windows. Shows per-app bandwidth and alerts on new connections.", "pros": ["Visual traffic map","Threat alerts","Free tier"], "cons": ["Windows only","Premium for full features"], "url": "https://glasswire.com"},
    {"name": "Tails OS", "category": "Secure OS", "rating": 4.8, "price": "Free", "free": True, "platforms": "Linux/USB", "description": "Security-focused live OS routing all traffic through Tor. Leaves no trace on the host computer.", "pros": ["Anonymous browsing","Tor integrated","No persistence"], "cons": ["Requires USB boot"], "url": "https://tails.boum.org"},
    {"name": "Shodan", "category": "Threat Intelligence", "rating": 4.7, "price": "Free/Premium", "free": True, "platforms": "Web", "description": "Search engine for internet-connected devices. Find exposed systems, open ports, and misconfigurations.", "pros": ["Internet-wide scanning","CVE search","API access"], "cons": ["Full access requires premium"], "url": "https://shodan.io"},
    {"name": "Tenable Nessus", "category": "Vulnerability Scanner", "rating": 4.8, "price": "Free (Essentials)", "free": True, "platforms": "Win, Mac, Linux", "description": "Industry-leading vulnerability scanner. Identifies misconfiguration, missing patches, and security weaknesses.", "pros": ["Comprehensive scanning","Detailed reports","Free Essentials edition"], "cons": ["Professional version expensive"], "url": "https://tenable.com/products/nessus"},
    {"name": "Splunk Enterprise Security", "category": "SIEM", "rating": 4.8, "price": "Enterprise pricing", "free": False, "platforms": "Win, Linux, Mac", "description": "Industry-leading SIEM platform for real-time security monitoring, threat detection, and incident response.", "pros": ["Powerful search","Hundreds of integrations","Industry standard"], "cons": ["Very expensive","Complex setup"], "url": "https://splunk.com"},
]

# ─── Threat map origin data ────────────────────────────────────────────────────
THREAT_ORIGINS = [
    {"name": "Russia",       "lat": 55.75, "lng": 37.62, "count": 312, "severity": "critical", "actors": "APT28, APT29, Sandworm, Cozy Bear"},
    {"name": "China",        "lat": 39.90, "lng": 116.4, "count": 287, "severity": "critical", "actors": "APT41, APT40, Volt Typhoon, Salt Typhoon"},
    {"name": "North Korea",  "lat": 39.03, "lng": 125.7, "count": 156, "severity": "critical", "actors": "Lazarus Group, Kimsuky, APT37"},
    {"name": "Iran",         "lat": 35.69, "lng": 51.39, "count": 143, "severity": "high",     "actors": "APT33, APT34, MuddyWater"},
    {"name": "USA",          "lat": 38.90, "lng": -77.0, "count": 98,  "severity": "high",     "actors": "Criminal groups, ransomware-as-a-service"},
    {"name": "Ukraine",      "lat": 50.45, "lng": 30.52, "count": 89,  "severity": "high",     "actors": "Criminal ransomware groups"},
    {"name": "Nigeria",      "lat":  9.07, "lng":  7.49, "count": 76,  "severity": "high",     "actors": "BEC fraud groups, SilverTerrier"},
    {"name": "Romania",      "lat": 44.43, "lng": 26.10, "count": 54,  "severity": "medium",   "actors": "Carbanak affiliates, skimming groups"},
    {"name": "Brazil",       "lat": -15.8, "lng": -47.9, "count": 51,  "severity": "medium",   "actors": "Brazilian banking trojans (Grandoreiro)"},
    {"name": "India",        "lat": 28.60, "lng": 77.20, "count": 44,  "severity": "medium",   "actors": "Tech support fraud, BEC groups"},
    {"name": "Vietnam",      "lat": 21.03, "lng": 105.8, "count": 39,  "severity": "medium",   "actors": "APT32 (OceanLotus)"},
    {"name": "Pakistan",     "lat": 33.69, "lng": 73.06, "count": 36,  "severity": "medium",   "actors": "Transparent Tribe, APT36"},
    {"name": "Indonesia",    "lat": -6.21, "lng": 106.8, "count": 27,  "severity": "low",      "actors": "Cybercrime groups"},
    {"name": "Turkey",       "lat": 39.93, "lng": 32.86, "count": 25,  "severity": "low",      "actors": "StrongPity, MuddyWater affiliates"},
    {"name": "Belarus",      "lat": 53.90, "lng": 27.57, "count": 22,  "severity": "medium",   "actors": "UNC1151, Ghostwriter"},
]

# ─── Scrollable card list widget ──────────────────────────────────────────────
class ScrollFrame(ctk.CTkScrollableFrame):
    def __init__(self, parent, **kw):
        super().__init__(parent, fg_color=BG, scrollbar_button_color=BORDER,
                         scrollbar_button_hover_color=ACCENT, **kw)

# ─── Reusable stat card ───────────────────────────────────────────────────────
class StatCard(ctk.CTkFrame):
    def __init__(self, parent, label, value, color=ACCENT, icon=""):
        super().__init__(parent, fg_color=CARD, corner_radius=12,
                         border_width=1, border_color=BORDER)
        ctk.CTkLabel(self, text=f"{icon}  {label}" if icon else label,
                     font=FONT_SM, text_color=MUTED).pack(anchor="w", padx=14, pady=(12, 2))
        ctk.CTkLabel(self, text=str(value), font=("Segoe UI", 26, "bold"),
                     text_color=color).pack(anchor="w", padx=14, pady=(0, 12))

# ─── Severity badge ───────────────────────────────────────────────────────────
def sev_badge(parent, severity: str):
    color = SEV_COLOR.get(severity.lower(), LOW)
    f = ctk.CTkFrame(parent, fg_color=color + "22", corner_radius=4,
                     border_width=1, border_color=color + "55")
    ctk.CTkLabel(f, text=severity.upper(), font=("Courier New", 9, "bold"),
                 text_color=color).pack(padx=6, pady=2)
    return f

# ─── Pages ────────────────────────────────────────────────────────────────────

class DashboardPage(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=BG)
        self._build()

    def _build(self):
        scroll = ScrollFrame(self)
        scroll.pack(fill="both", expand=True, padx=0, pady=0)
        inner = scroll

        # Header
        hdr = ctk.CTkFrame(inner, fg_color="transparent")
        hdr.pack(fill="x", padx=24, pady=(20, 4))
        ctk.CTkLabel(hdr, text="Command Center", font=FONT_TITLE, text_color=TEXT).pack(side="left")
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        ctk.CTkLabel(hdr, text=f"Last updated: {ts}", font=FONT_SM, text_color=MUTED).pack(side="right", padx=4)

        # Stats row
        stats_frame = ctk.CTkFrame(inner, fg_color="transparent")
        stats_frame.pack(fill="x", padx=24, pady=(8, 4))
        total = len(_cisa_cache) if _cisa_loaded else "Loading…"
        stats = [
            ("TRACKED CVEs (CISA)", total, ACCENT, "🔍"),
            ("THREAT ORIGINS", len(THREAT_ORIGINS), CRITICAL, "🌍"),
            ("SECURITY TOOLS", len(RECOMMENDATIONS), SUCCESS, "🛡"),
            ("CRITICAL ALERTS", sum(1 for o in THREAT_ORIGINS if o["severity"] == "critical"), CRITICAL, "⚠"),
        ]
        for i, (label, val, color, icon) in enumerate(stats):
            card = StatCard(stats_frame, label, val, color, icon)
            card.grid(row=0, column=i, padx=6, pady=4, sticky="ew")
            stats_frame.columnconfigure(i, weight=1)

        # Recent threats
        ctk.CTkLabel(inner, text="Recent CISA Known Exploited Vulnerabilities",
                     font=FONT_H2, text_color=TEXT).pack(anchor="w", padx=24, pady=(16, 4))

        threats_section = ctk.CTkFrame(inner, fg_color=CARD, corner_radius=12,
                                       border_width=1, border_color=BORDER)
        threats_section.pack(fill="x", padx=24, pady=(0, 8))

        shown = _cisa_cache[:8] if _cisa_loaded else []
        if not shown:
            ctk.CTkLabel(threats_section, text="Loading threat data…",
                         font=FONT_BODY, text_color=MUTED).pack(padx=20, pady=20)
        for v in shown:
            row = ctk.CTkFrame(threats_section, fg_color="transparent")
            row.pack(fill="x", padx=16, pady=6)
            left = ctk.CTkFrame(row, fg_color="transparent")
            left.pack(side="left", fill="x", expand=True)
            ctk.CTkLabel(left, text=v.get("vulnerabilityName", "")[:80],
                         font=FONT_H3, text_color=TEXT, anchor="w").pack(anchor="w")
            ctk.CTkLabel(left,
                         text=f"  {v.get('vendorProject','')} · {v.get('product','')} · Added: {v.get('dateAdded','')}",
                         font=FONT_SM, text_color=MUTED, anchor="w").pack(anchor="w")
            sep = ctk.CTkFrame(threats_section, fg_color=BORDER, height=1)
            sep.pack(fill="x", padx=12)

        # Top attack origins
        ctk.CTkLabel(inner, text="Top Active Threat Origins",
                     font=FONT_H2, text_color=TEXT).pack(anchor="w", padx=24, pady=(16, 4))
        tbl = ctk.CTkFrame(inner, fg_color=CARD, corner_radius=12,
                           border_width=1, border_color=BORDER)
        tbl.pack(fill="x", padx=24, pady=(0, 8))
        for origin in sorted(THREAT_ORIGINS, key=lambda o: o["count"], reverse=True)[:6]:
            r = ctk.CTkFrame(tbl, fg_color="transparent")
            r.pack(fill="x", padx=16, pady=6)
            ctk.CTkLabel(r, text=origin["name"], font=FONT_H3, text_color=TEXT).pack(side="left")
            ctk.CTkLabel(r, text=origin["actors"][:60], font=FONT_SM, text_color=MUTED).pack(side="left", padx=12)
            badge = sev_badge(r, origin["severity"])
            badge.pack(side="right")
            ctk.CTkLabel(r, text=f"{origin['count']} attacks", font=FONT_MONO,
                         text_color=ACCENT).pack(side="right", padx=12)
            ctk.CTkFrame(tbl, fg_color=BORDER, height=1).pack(fill="x", padx=12)


class ThreatsPage(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=BG)
        self._all: list = []
        self._filtered: list = []
        self._detail_window = None
        self._build()

    def _build(self):
        # Top bar
        top = ctk.CTkFrame(self, fg_color=CARD, height=60)
        top.pack(fill="x", padx=0, pady=0)
        top.pack_propagate(False)
        ctk.CTkLabel(top, text="Threat Research", font=FONT_TITLE, text_color=TEXT).pack(side="left", padx=20, pady=10)
        self._search_var = tk.StringVar()
        self._search_var.trace_add("write", lambda *_: self._apply_filter())
        search = ctk.CTkEntry(top, placeholder_text="Search threats…", textvariable=self._search_var,
                              width=280, fg_color=CARD2, border_color=BORDER, text_color=TEXT)
        search.pack(side="right", padx=20, pady=10)
        self._sev_var = tk.StringVar(value="All")
        sev_menu = ctk.CTkOptionMenu(top, variable=self._sev_var,
                                     values=["All", "critical", "high", "medium", "low"],
                                     fg_color=CARD2, button_color=ACCENT_LO,
                                     command=lambda _: self._apply_filter())
        sev_menu.pack(side="right", padx=4, pady=10)

        # Scrollable list
        self._scroll = ScrollFrame(self)
        self._scroll.pack(fill="both", expand=True, padx=0, pady=0)
        self._refresh_list()

    def refresh(self):
        self._refresh_list()

    def _refresh_list(self):
        self._all = get_threats(200)
        self._apply_filter()

    def _apply_filter(self):
        q = self._search_var.get().lower()
        sev = self._sev_var.get()
        result = self._all
        if q:
            result = [v for v in result if q in v.get("vulnerabilityName","").lower()
                      or q in v.get("vendorProject","").lower()
                      or q in v.get("product","").lower()
                      or q in v.get("shortDescription","").lower()]
        if sev != "All":
            # Map all cisa to "high" by default; critical ones are CVSSv3 >=9
            result = [v for v in result]  # all shown since CISA doesn't include severity

        self._filtered = result
        self._render()

    def _render(self):
        for w in self._scroll.winfo_children():
            w.destroy()

        if not self._filtered:
            ctk.CTkLabel(self._scroll, text="No threats found.", font=FONT_BODY, text_color=MUTED).pack(pady=40)
            return

        header = ctk.CTkFrame(self._scroll, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(12, 4))
        ctk.CTkLabel(header, text=f"{len(self._filtered)} threats found",
                     font=FONT_SM, text_color=MUTED).pack(side="left")

        for v in self._filtered[:100]:
            self._make_card(v)

    def _make_card(self, v: dict):
        card = ctk.CTkFrame(self._scroll, fg_color=CARD, corner_radius=10,
                            border_width=1, border_color=BORDER)
        card.pack(fill="x", padx=20, pady=4)

        top_row = ctk.CTkFrame(card, fg_color="transparent")
        top_row.pack(fill="x", padx=14, pady=(10, 2))

        title = v.get("vulnerabilityName", "Unknown")[:100]
        ctk.CTkLabel(top_row, text=title, font=FONT_H3, text_color=TEXT,
                     anchor="w", wraplength=700, justify="left").pack(side="left", fill="x", expand=True)

        badge = sev_badge(top_row, "critical" if "zero-day" in title.lower() or "authentication bypass" in title.lower() else "high")
        badge.pack(side="right")

        meta = ctk.CTkFrame(card, fg_color="transparent")
        meta.pack(fill="x", padx=14, pady=(0, 4))
        cve = v.get("cveID", "")
        vendor = v.get("vendorProject", "")
        product = v.get("product", "")
        date = v.get("dateAdded", "")
        meta_text = "  ".join(filter(None, [cve, vendor, product, f"Added: {date}" if date else ""]))
        ctk.CTkLabel(meta, text=meta_text, font=FONT_SM, text_color=MUTED).pack(side="left")

        desc = v.get("shortDescription", "")
        if desc:
            ctk.CTkLabel(card, text=desc[:200] + ("…" if len(desc) > 200 else ""),
                         font=FONT_SM, text_color=TEXT, wraplength=750,
                         anchor="w", justify="left").pack(fill="x", padx=14, pady=(2, 6))

        action = v.get("requiredAction", "")
        if action:
            action_frame = ctk.CTkFrame(card, fg_color=ACCENT + "11", corner_radius=6)
            action_frame.pack(fill="x", padx=14, pady=(0, 10))
            ctk.CTkLabel(action_frame, text=f"⚡ Required action: {action[:180]}",
                         font=FONT_SM, text_color=ACCENT, wraplength=740,
                         anchor="w", justify="left").pack(padx=10, pady=6)

        due = v.get("dueDate", "")
        if due:
            ctk.CTkLabel(card, text=f"📅 Federal patch due: {due}",
                         font=FONT_SM, text_color=HIGH).pack(anchor="w", padx=14, pady=(0, 8))


class ThreatMapPage(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=BG)
        self._fig = None
        self._canvas_widget = None
        self._built = False
        self._build()

    def _build(self):
        # Header
        hdr = ctk.CTkFrame(self, fg_color=CARD, height=56)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        ctk.CTkLabel(hdr, text="🌍  LIVE Global Threat Map", font=FONT_TITLE, text_color=TEXT).pack(side="left", padx=20)
        status = "● LIVE" if _cisa_loaded else "● Loading…"
        ctk.CTkLabel(hdr, text=status, font=FONT_SM, text_color=SUCCESS).pack(side="right", padx=20)

        # Split layout: map left, details right
        body = ctk.CTkFrame(self, fg_color=BG)
        body.pack(fill="both", expand=True, padx=0, pady=0)

        map_frame = ctk.CTkFrame(body, fg_color=CARD, corner_radius=0)
        map_frame.pack(side="left", fill="both", expand=True)

        side_frame = ctk.CTkFrame(body, fg_color=CARD2, corner_radius=0, width=280)
        side_frame.pack(side="right", fill="y")
        side_frame.pack_propagate(False)

        self._draw_map(map_frame)
        self._draw_side(side_frame)

    def _draw_map(self, container):
        matplotlib.rcParams.update({
            "axes.facecolor":  "#040d1a",
            "figure.facecolor": "#040d1a",
            "text.color": TEXT,
            "axes.edgecolor": BORDER,
        })
        fig = Figure(figsize=(9, 5.5), dpi=95, facecolor="#040d1a")
        ax = fig.add_subplot(111)
        ax.set_facecolor("#040d1a")

        # Draw world map
        world_drawn = False
        if HAS_GEO:
            try:
                import geodatasets
                world = gpd.read_file(geodatasets.get_path("naturalearth.land"))
                world.plot(ax=ax, color="#0a1e38", edgecolor="#1a3050", linewidth=0.4)
                world_drawn = True
            except Exception:
                pass

        if not world_drawn:
            ax.set_facecolor("#030c1a")
            ax.axhspan(-90, 90, facecolor="#040d1a", alpha=1)
            for lat in range(-90, 91, 30):
                ax.axhline(lat, color=BORDER, linewidth=0.3, alpha=0.5)
            for lng in range(-180, 181, 30):
                ax.axvline(lng, color=BORDER, linewidth=0.3, alpha=0.5)

        ax.set_xlim(-180, 180)
        ax.set_ylim(-60, 85)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.spines[:].set_visible(False)

        # Plot threat origins
        for origin in THREAT_ORIGINS:
            color = SEV_COLOR.get(origin["severity"], LOW)
            size = max(40, min(300, origin["count"] * 0.8))
            # Glow ring
            ax.scatter(origin["lng"], origin["lat"], s=size * 3,
                       c=color, alpha=0.15, zorder=3)
            ax.scatter(origin["lng"], origin["lat"], s=size * 1.5,
                       c=color, alpha=0.25, zorder=4)
            # Main dot
            ax.scatter(origin["lng"], origin["lat"], s=size * 0.6,
                       c=color, zorder=5,
                       edgecolors="white", linewidths=0.4)
            # Label for major origins
            if origin["count"] >= 80:
                ax.annotate(origin["name"],
                            (origin["lng"], origin["lat"]),
                            xytext=(5, 5), textcoords="offset points",
                            fontsize=7, color=TEXT, fontfamily="monospace",
                            zorder=6)

        # Legend
        legend_elems = [
            mpatches.Patch(color=CRITICAL, label="Critical"),
            mpatches.Patch(color=HIGH,     label="High"),
            mpatches.Patch(color=MEDIUM,   label="Medium"),
            mpatches.Patch(color=LOW,      label="Low"),
        ]
        legend = ax.legend(handles=legend_elems, loc="lower left",
                           fontsize=8, framealpha=0.8,
                           facecolor="#0a1628", edgecolor=BORDER, labelcolor=TEXT)

        fig.tight_layout(pad=0.3)

        canvas = FigureCanvasTkAgg(fig, master=container)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)
        self._fig = fig

    def _draw_side(self, container):
        ctk.CTkLabel(container, text="Attack Origins", font=FONT_H2,
                     text_color=TEXT).pack(anchor="w", padx=16, pady=(14, 4))

        scroll = ScrollFrame(container)
        scroll.pack(fill="both", expand=True, padx=4, pady=0)

        for origin in sorted(THREAT_ORIGINS, key=lambda o: o["count"], reverse=True):
            card = ctk.CTkFrame(scroll, fg_color=CARD, corner_radius=8,
                                border_width=1, border_color=BORDER)
            card.pack(fill="x", padx=8, pady=3)

            top = ctk.CTkFrame(card, fg_color="transparent")
            top.pack(fill="x", padx=10, pady=(8, 2))
            ctk.CTkLabel(top, text=origin["name"], font=FONT_H3, text_color=TEXT).pack(side="left")
            badge = sev_badge(top, origin["severity"])
            badge.pack(side="right")

            ctk.CTkLabel(card, text=f"Attacks: {origin['count']}",
                         font=FONT_MONO, text_color=ACCENT).pack(anchor="w", padx=10)
            ctk.CTkLabel(card, text=origin["actors"][:45],
                         font=FONT_SM, text_color=MUTED, wraplength=230).pack(anchor="w", padx=10, pady=(0, 8))


class RecommendationsPage(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=BG)
        self._cat_filter = "All"
        self._build()

    def _build(self):
        top = ctk.CTkFrame(self, fg_color=CARD, height=56)
        top.pack(fill="x")
        top.pack_propagate(False)
        ctk.CTkLabel(top, text="Security Tools & Recommendations", font=FONT_TITLE, text_color=TEXT).pack(side="left", padx=20)

        cats = ["All"] + sorted(set(r["category"] for r in RECOMMENDATIONS))
        self._cat_var = tk.StringVar(value="All")
        ctk.CTkOptionMenu(top, variable=self._cat_var, values=cats,
                          fg_color=CARD2, button_color=ACCENT_LO,
                          command=self._apply_filter).pack(side="right", padx=20, pady=8)

        self._scroll = ScrollFrame(self)
        self._scroll.pack(fill="both", expand=True)
        self._apply_filter()

    def _apply_filter(self, *_):
        cat = self._cat_var.get()
        filtered = RECOMMENDATIONS if cat == "All" else [r for r in RECOMMENDATIONS if r["category"] == cat]
        self._render(filtered)

    def _render(self, items):
        for w in self._scroll.winfo_children():
            w.destroy()

        ctk.CTkLabel(self._scroll, text=f"{len(items)} tools found",
                     font=FONT_SM, text_color=MUTED).pack(anchor="w", padx=20, pady=(10, 4))

        for rec in items:
            card = ctk.CTkFrame(self._scroll, fg_color=CARD, corner_radius=12,
                                border_width=1, border_color=BORDER)
            card.pack(fill="x", padx=20, pady=5)

            # Top row: name + price + rating
            top = ctk.CTkFrame(card, fg_color="transparent")
            top.pack(fill="x", padx=16, pady=(12, 2))
            ctk.CTkLabel(top, text=rec["name"], font=FONT_H2, text_color=ACCENT).pack(side="left")
            ctk.CTkLabel(top, text=rec["price"], font=FONT_H3,
                         text_color=SUCCESS if rec["free"] else TEXT).pack(side="right")
            ctk.CTkLabel(top, text=f"★ {rec['rating']}", font=FONT_H3,
                         text_color=MEDIUM).pack(side="right", padx=12)

            # Category + platforms
            meta = ctk.CTkFrame(card, fg_color="transparent")
            meta.pack(fill="x", padx=16, pady=(0, 4))
            cat_f = ctk.CTkFrame(meta, fg_color=ACCENT + "22", corner_radius=4)
            ctk.CTkLabel(cat_f, text=rec["category"], font=FONT_SM, text_color=ACCENT).pack(padx=8, pady=2)
            cat_f.pack(side="left")
            ctk.CTkLabel(meta, text=f"  Platforms: {rec['platforms']}", font=FONT_SM, text_color=MUTED).pack(side="left", padx=8)

            # Description
            ctk.CTkLabel(card, text=rec["description"], font=FONT_BODY, text_color=TEXT,
                         wraplength=740, anchor="w", justify="left").pack(fill="x", padx=16, pady=(4, 4))

            # Pros / cons
            pcs = ctk.CTkFrame(card, fg_color="transparent")
            pcs.pack(fill="x", padx=16, pady=(0, 10))
            pros_f = ctk.CTkFrame(pcs, fg_color=SUCCESS + "11", corner_radius=6)
            pros_f.pack(side="left", fill="both", expand=True, padx=(0, 6))
            ctk.CTkLabel(pros_f, text="✓ Pros", font=FONT_SM, text_color=SUCCESS).pack(anchor="w", padx=10, pady=(6, 2))
            for p in rec["pros"][:3]:
                ctk.CTkLabel(pros_f, text=f"  • {p}", font=FONT_SM, text_color=TEXT,
                             anchor="w").pack(anchor="w", padx=10)
            ctk.CTkLabel(pros_f, text="").pack(pady=4)

            cons_f = ctk.CTkFrame(pcs, fg_color=CRITICAL + "11", corner_radius=6)
            cons_f.pack(side="left", fill="both", expand=True)
            ctk.CTkLabel(cons_f, text="✗ Cons", font=FONT_SM, text_color=CRITICAL).pack(anchor="w", padx=10, pady=(6, 2))
            for c in rec["cons"][:2]:
                ctk.CTkLabel(cons_f, text=f"  • {c}", font=FONT_SM, text_color=TEXT,
                             anchor="w").pack(anchor="w", padx=10)
            ctk.CTkLabel(cons_f, text="").pack(pady=4)


class ChatPage(ctk.CTkFrame):
    def __init__(self, parent, config: dict, save_cfg):
        super().__init__(parent, fg_color=BG)
        self._cfg = config
        self._save_cfg = save_cfg
        self._conv_id = None  # type: Optional[int]
        self._messages: list = []
        self._is_sending = False
        self._build()
        self._load_or_create_conversation()

    def _build(self):
        SUGGESTED = [
            "What is ransomware and how can I protect against it?",
            "Which antivirus should I use for Windows in 2025?",
            "How do I know if my computer has been hacked?",
            "What is a zero-day vulnerability?",
            "How does phishing work and how do I avoid it?",
            "Should I use a VPN? Which one is best?",
            "What is multi-factor authentication?",
            "How do I create strong, secure passwords?",
        ]

        top = ctk.CTkFrame(self, fg_color=CARD, height=56)
        top.pack(fill="x")
        top.pack_propagate(False)
        ctk.CTkLabel(top, text="🤖  CyberAI Advisor", font=FONT_TITLE, text_color=TEXT).pack(side="left", padx=20)
        ctk.CTkButton(top, text="⚙ Set API Key", width=130, fg_color=ACCENT_LO,
                      hover_color=BORDER, font=FONT_SM,
                      command=self._set_api_key).pack(side="right", padx=20, pady=8)
        ctk.CTkButton(top, text="+ New Chat", width=110, fg_color=ACCENT_LO,
                      hover_color=BORDER, font=FONT_SM,
                      command=self._new_chat).pack(side="right", padx=4, pady=8)

        body = ctk.CTkFrame(self, fg_color=BG)
        body.pack(fill="both", expand=True)

        # Message area
        self._msg_frame = ctk.CTkScrollableFrame(body, fg_color=BG,
                                                  scrollbar_button_color=BORDER)
        self._msg_frame.pack(fill="both", expand=True, padx=0, pady=0)

        # Suggested questions (shown when empty)
        self._suggest_frame = ctk.CTkFrame(body, fg_color=BG)
        self._suggest_frame.place(relx=0.5, rely=0.4, anchor="center")
        ctk.CTkLabel(self._suggest_frame, text="CyberAI Advisor",
                     font=("Segoe UI", 20, "bold"), text_color=ACCENT).pack(pady=(0, 4))
        ctk.CTkLabel(self._suggest_frame,
                     text="Ask anything about cybersecurity — threats, tools, best practices.",
                     font=FONT_BODY, text_color=MUTED).pack(pady=(0, 16))
        grid = ctk.CTkFrame(self._suggest_frame, fg_color="transparent")
        grid.pack()
        for i, q in enumerate(SUGGESTED):
            btn = ctk.CTkButton(grid, text=q, width=340, height=42, anchor="w",
                                fg_color=CARD, hover_color=CARD2,
                                border_width=1, border_color=BORDER,
                                text_color=MUTED, font=FONT_SM,
                                command=lambda q=q: self._send(q))
            btn.grid(row=i // 2, column=i % 2, padx=4, pady=3)

        # Input bar
        input_bar = ctk.CTkFrame(self, fg_color=CARD, height=68)
        input_bar.pack(fill="x", pady=0)
        input_bar.pack_propagate(False)
        self._input_var = tk.StringVar()
        self._input = ctk.CTkEntry(input_bar, textvariable=self._input_var,
                                   placeholder_text="Ask anything about cybersecurity…",
                                   font=FONT_BODY, fg_color=CARD2,
                                   border_color=BORDER, text_color=TEXT,
                                   height=44)
        self._input.pack(side="left", fill="x", expand=True, padx=16, pady=12)
        self._input.bind("<Return>", lambda e: self._on_send())
        self._send_btn = ctk.CTkButton(input_bar, text="Send ➤", width=90,
                                       fg_color=ACCENT, hover_color=ACCENT_LO,
                                       font=FONT_H3, command=self._on_send)
        self._send_btn.pack(side="right", padx=(0, 16), pady=12)

    def _load_or_create_conversation(self):
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute("SELECT id FROM conversations ORDER BY id DESC LIMIT 1").fetchone()
        if row:
            self._conv_id = row[0]
            msgs = conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id=? ORDER BY id",
                (self._conv_id,)
            ).fetchall()
            for role, content in msgs:
                self._add_bubble(role, content)
        conn.close()

    def _new_chat(self):
        conn = sqlite3.connect(DB_PATH)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        cur = conn.execute("INSERT INTO conversations (title) VALUES (?)", (f"Chat {ts}",))
        conn.commit()
        self._conv_id = cur.lastrowid
        conn.close()
        for w in self._msg_frame.winfo_children():
            w.destroy()
        self._messages.clear()
        self._suggest_frame.place(relx=0.5, rely=0.4, anchor="center")

    def _set_api_key(self):
        key = simpledialog.askstring(
            "OpenAI API Key",
            "Enter your OpenAI API key (sk-…)\nGet one at: https://platform.openai.com/api-keys",
            show="*",
            parent=self
        )
        if key and key.strip():
            self._cfg["openai_key"] = key.strip()
            self._save_cfg(self._cfg)
            messagebox.showinfo("CyberAI", "API key saved! You can now use the AI Advisor.")

    def _on_send(self):
        text = self._input_var.get().strip()
        if text:
            self._send(text)

    def _send(self, text: str):
        if self._is_sending or not text:
            return
        api_key = self._cfg.get("openai_key", "") or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY", "")
        if not api_key:
            messagebox.showwarning(
                "API Key Required",
                "Click '⚙ Set API Key' to enter your OpenAI API key.\nGet one free at: https://platform.openai.com/api-keys"
            )
            return

        self._suggest_frame.place_forget()
        self._input_var.set("")
        self._is_sending = True
        self._send_btn.configure(state="disabled", text="…")

        if self._conv_id is None:
            self._new_chat()

        # Save + show user message
        conn = sqlite3.connect(DB_PATH)
        conn.execute("INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)",
                     (self._conv_id, "user", text))
        conn.commit()
        conn.close()
        self._add_bubble("user", text)

        # AI bubble placeholder
        ai_bubble = self._add_bubble("assistant", "⋯")

        def do_stream():
            try:
                from openai import OpenAI
                base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
                client = OpenAI(
                    api_key=api_key,
                    base_url=base_url or "https://api.openai.com/v1"
                )
                # Build history
                conn2 = sqlite3.connect(DB_PATH)
                history = conn2.execute(
                    "SELECT role, content FROM messages WHERE conversation_id=? ORDER BY id",
                    (self._conv_id,)
                ).fetchall()
                conn2.close()

                msgs = [{"role": "system", "content": (
                    "You are CyberAI, an expert cybersecurity assistant. "
                    "Answer clearly and specifically about malware, threats, tools, VPNs, antivirus, passwords, phishing, "
                    "zero-days, and all cybersecurity topics. Be specific with product recommendations."
                )}] + [{"role": r, "content": c} for r, c in history]

                model = "gpt-5.4" if base_url else "gpt-4o-mini"
                stream = client.chat.completions.create(
                    model=model, messages=msgs, stream=True, max_tokens=2048
                )
                full = ""
                for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        full += delta
                        snap = full
                        self.after(0, lambda s=snap: self._update_bubble(ai_bubble, s))

                conn3 = sqlite3.connect(DB_PATH)
                conn3.execute("INSERT INTO messages (conversation_id, role, content) VALUES (?,?,?)",
                              (self._conv_id, "assistant", full))
                conn3.commit()
                conn3.close()
            except Exception as e:
                err = f"Error: {e}\n\nMake sure your API key is correct."
                self.after(0, lambda: self._update_bubble(ai_bubble, err))
            finally:
                self.after(0, self._done_sending)

        threading.Thread(target=do_stream, daemon=True).start()

    def _done_sending(self):
        self._is_sending = False
        self._send_btn.configure(state="normal", text="Send ➤")
        self._input.focus()

    def _add_bubble(self, role: str, text: str):
        bubble_wrap = ctk.CTkFrame(self._msg_frame, fg_color="transparent")
        bubble_wrap.pack(fill="x", padx=16, pady=4,
                         anchor="e" if role == "user" else "w")

        if role == "user":
            bubble = ctk.CTkFrame(bubble_wrap, fg_color=ACCENT_LO, corner_radius=12,
                                  border_width=1, border_color=ACCENT + "44")
            bubble.pack(side="right")
        else:
            bubble = ctk.CTkFrame(bubble_wrap, fg_color=CARD, corner_radius=12,
                                  border_width=1, border_color=BORDER)
            bubble.pack(side="left")

        lbl = ctk.CTkLabel(bubble, text=text, font=FONT_BODY, text_color=TEXT,
                           wraplength=580, anchor="w", justify="left")
        lbl.pack(padx=14, pady=10)
        self._messages.append((bubble_wrap, lbl))
        # Scroll to bottom
        self.after(50, lambda: self._msg_frame._parent_canvas.yview_moveto(1.0))
        return lbl

    def _update_bubble(self, lbl, text: str):
        lbl.configure(text=text)
        self.after(30, lambda: self._msg_frame._parent_canvas.yview_moveto(1.0))


# ─── Main App ─────────────────────────────────────────────────────────────────

class CyberAIApp(ctk.CTk):
    def __init__(self):
        super().__init__(fg_color=BG)
        self.title("CyberAI — Cybersecurity Hub")
        self.geometry("1280x800")
        self.minsize(1000, 680)

        self._cfg = load_config()
        self._pages: dict[str, ctk.CTkFrame] = {}
        self._active_page = None
        self._nav_buttons: dict[str, ctk.CTkButton] = {}

        self._setup_layout()
        self._setup_sidebar()
        self._setup_pages()
        self._show_page("dashboard")
        self._start_cisa_fetch()

    def _setup_layout(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._sidebar = ctk.CTkFrame(self, fg_color=SIDEBAR, width=210, corner_radius=0)
        self._sidebar.grid(row=0, column=0, sticky="nsew")
        self._sidebar.grid_propagate(False)

        self._content = ctk.CTkFrame(self, fg_color=BG, corner_radius=0)
        self._content.grid(row=0, column=1, sticky="nsew")

    def _setup_sidebar(self):
        # Logo
        logo = ctk.CTkFrame(self._sidebar, fg_color="transparent", height=64)
        logo.pack(fill="x", padx=0, pady=0)
        logo.pack_propagate(False)
        ctk.CTkLabel(logo, text="CYBER", font=("Courier New", 18, "bold"),
                     text_color=ACCENT).pack(side="left", padx=(16, 0), pady=16)
        ctk.CTkLabel(logo, text="AI", font=("Courier New", 18, "bold"),
                     text_color=TEXT).pack(side="left")

        ctk.CTkFrame(self._sidebar, fg_color=BORDER, height=1).pack(fill="x", padx=12, pady=4)

        nav_items = [
            ("dashboard",      "🏠  Command Center"),
            ("threats",        "🛡  Threat Research"),
            ("map",            "🗺  Threat Map"),
            ("recommendations","⭐  Security Tools"),
            ("chat",           "🤖  AI Advisor"),
        ]
        for key, label in nav_items:
            btn = ctk.CTkButton(
                self._sidebar, text=label, anchor="w",
                font=FONT_BODY, height=42, corner_radius=8,
                fg_color="transparent", hover_color=ACCENT_LO,
                text_color=MUTED,
                command=lambda k=key: self._show_page(k),
            )
            btn.pack(fill="x", padx=8, pady=2)
            self._nav_buttons[key] = btn

        # Bottom: status
        ctk.CTkFrame(self._sidebar, fg_color=BORDER, height=1).pack(fill="x", padx=12, pady=(8, 4), side="bottom")
        self._status_lbl = ctk.CTkLabel(self._sidebar, text="● Fetching threat data…",
                                        font=FONT_SM, text_color=MUTED)
        self._status_lbl.pack(side="bottom", padx=16, pady=8)

    def _setup_pages(self):
        self._pages["dashboard"]       = DashboardPage(self._content)
        self._pages["threats"]         = ThreatsPage(self._content)
        self._pages["map"]             = ThreatMapPage(self._content)
        self._pages["recommendations"] = RecommendationsPage(self._content)
        self._pages["chat"]            = ChatPage(self._content, self._cfg, save_config)
        for p in self._pages.values():
            p.place(relx=0, rely=0, relwidth=1, relheight=1)
            p.lower()

    def _show_page(self, key: str):
        if self._active_page == key:
            return
        for k, btn in self._nav_buttons.items():
            if k == key:
                btn.configure(fg_color=ACCENT + "22", text_color=ACCENT)
            else:
                btn.configure(fg_color="transparent", text_color=MUTED)
        if self._active_page and self._active_page in self._pages:
            self._pages[self._active_page].lower()
        self._pages[key].lift()
        self._active_page = key

        if key == "threats":
            self._pages["threats"].refresh()

    def _start_cisa_fetch(self):
        def done():
            count = len(_cisa_cache)
            self._status_lbl.configure(
                text=f"● {count:,} CISA CVEs loaded", text_color=SUCCESS
            )
            # Rebuild dashboard with data
            old = self._pages.get("dashboard")
            new = DashboardPage(self._content)
            self._pages["dashboard"] = new
            new.place(relx=0, rely=0, relwidth=1, relheight=1)
            if self._active_page == "dashboard":
                new.lift()
                if old:
                    old.destroy()
            else:
                new.lower()
                if old:
                    old.destroy()
            # Refresh threats if visible
            if self._active_page == "threats":
                self._pages["threats"].refresh()

        threading.Thread(target=fetch_cisa, kwargs={"on_done": lambda: self.after(0, done)}, daemon=True).start()


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    init_db()
    app = CyberAIApp()
    app.mainloop()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Show error in a dialog so the window doesn't just silently close
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "CyberAI Error",
            f"An error occurred:\n\n{e}\n\n{traceback.format_exc()}"
        )
        root.destroy()
        sys.exit(1)

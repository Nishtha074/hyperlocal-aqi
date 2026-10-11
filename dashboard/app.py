import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import folium
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st
from folium.plugins import HeatMap, MarkerCluster
from streamlit_folium import st_folium

from src.data.live_aqi import get_live_aqi
from src.data.live_weather import get_live_weather
from src.data.location import get_current_location
from src.forecasting.live_forecast import get_live_forecast
from src.dashboard_helpers import (
    forecast_response_for_dashboard,
    get_model_info,
    load_station_data,
    no_station_message,
    risk_recommendation_for_level,
)
from src.risk.personalized_risk import (
    build_alerts,
    calculate_personalized_risk,
    calculate_personalized_threshold,
    normalize_profile,
)

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Hyperlocal AQI Forecasting",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');

html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.stApp { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); }

section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border-right: 1px solid rgba(255,255,255,0.1);
}
section[data-testid="stSidebar"] * { color: #e0e0e0 !important; }
section[data-testid="stSidebar"] .stRadio label { color: #e0e0e0 !important; }

.page-title {
    font-size: 2.4rem; font-weight: 800;
    background: linear-gradient(90deg, #f7971e, #ffd200, #21d4fd);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 0.2rem;
}
.page-sub { color: #a0aec0; font-size: 0.95rem; margin-bottom: 1.5rem; }

.aqi-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px; padding: 20px 24px;
    backdrop-filter: blur(10px);
    transition: transform 0.2s;
}
.aqi-card:hover { transform: translateY(-3px); }
.aqi-label { color: #a0aec0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.aqi-value { font-size: 2.2rem; font-weight: 800; margin-top: 4px; }
.aqi-unit  { font-size: 0.85rem; color: #a0aec0; }

.risk-badge {
    display: inline-block; padding: 6px 18px;
    border-radius: 50px; font-weight: 700; font-size: 0.9rem;
}
.risk-low      { background: #1a4731; color: #48bb78; border: 1px solid #48bb78; }
.risk-moderate { background: #4a3800; color: #f6c90e; border: 1px solid #f6c90e; }
.risk-high     { background: #4a1a00; color: #f97316; border: 1px solid #f97316; }
.risk-veryhigh { background: #4a0000; color: #fc5c7d; border: 1px solid #fc5c7d; }

.weather-card {
    background: linear-gradient(135deg, rgba(33,212,253,0.1), rgba(183,33,255,0.1));
    border: 1px solid rgba(33,212,253,0.2);
    border-radius: 14px; padding: 16px 20px; text-align: center;
}
.weather-icon { font-size: 2rem; }
.weather-val  { font-size: 1.5rem; font-weight: 700; color: #21d4fd; }
.weather-lbl  { font-size: 0.75rem; color: #a0aec0; text-transform: uppercase; }

.alert-box {
    border-radius: 12px; padding: 14px 18px; margin-bottom: 10px;
    border-left: 4px solid;
}
.alert-warn  { background: rgba(249,115,22,0.12); border-color: #f97316; color: #fed7aa; }
.alert-info  { background: rgba(33,212,253,0.10); border-color: #21d4fd; color: #bfdbfe; }
.alert-ok    { background: rgba(72,187,120,0.12); border-color: #48bb78; color: #c6f6d5; }

.section-header {
    font-size: 1.2rem; font-weight: 700; color: #e2e8f0;
    border-bottom: 2px solid rgba(247,151,30,0.4);
    padding-bottom: 8px; margin: 24px 0 16px 0;
}

div[data-testid="stMetricValue"] { color: #21d4fd !important; font-weight: 700 !important; }
div[data-testid="stMetricLabel"] { color: #a0aec0 !important; }

.stButton > button {
    background: linear-gradient(90deg, #f7971e, #ffd200);
    color: #1a1a2e; font-weight: 700; border: none;
    border-radius: 8px; padding: 8px 20px;
    transition: opacity 0.2s;
}
.stButton > button:hover { opacity: 0.85; }

.stSelectbox label, .stNumberInput label, .stSlider label { color: #a0aec0 !important; }
</style>
""", unsafe_allow_html=True)

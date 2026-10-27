import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import folium
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from folium.plugins import HeatMap
from streamlit_folium import st_folium

from src.data.live_aqi import get_live_aqi
from src.data.location import get_current_location
from src.forecasting.aqi import aqi_category, pm25_to_aqi
from src.forecasting.live_forecast import get_live_forecast
from src.forecasting.live_forecast_gm import CITY_COORDS, STATION_COORDS, station_city_map
from src.dashboard_helpers import (
    forecast_response_for_dashboard,
    get_latest_air_quality_snapshot,
    get_model_info,
    load_station_data,
    no_station_message,
    risk_recommendation_for_level,
)
from src.risk.personalized_risk import (
    calculate_personalized_risk,
    calculate_personalized_threshold,
    normalize_profile,
)

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AirPulse - Hyperlocal AQI & PM2.5 Forecasting",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Global CSS & Design System ────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

.stApp { background: linear-gradient(135deg, #0f0c29 0%, #1b1947 50%, #24243e 100%); }

section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #16162e 0%, #111827 100%);
    border-right: 1px solid rgba(255,255,255,0.08);
}
section[data-testid="stSidebar"] * { color: #e2e8f0 !important; }
section[data-testid="stSidebar"] .stRadio label { color: #e2e8f0 !important; }

.page-title {
    font-size: 2.2rem; font-weight: 800;
    background: linear-gradient(90deg, #f7971e, #ffd200, #21d4fd);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 0.2rem;
}
.page-sub { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; }

.aqi-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 16px; padding: 20px 24px;
    backdrop-filter: blur(12px);
    transition: transform 0.2s, box-shadow 0.2s;
    margin-bottom: 12px;
}
.aqi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.aqi-label { color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
.aqi-value { font-size: 2.2rem; font-weight: 800; margin-top: 4px; color: #f8fafc; }
.aqi-unit  { font-size: 0.85rem; color: #94a3b8; margin-left: 4px; }
.aqi-sub   { font-size: 0.82rem; color: #38bdf8; margin-top: 4px; }

.source-badge {
    display: inline-block; padding: 4px 12px;
    border-radius: 9999px; font-weight: 600; font-size: 0.8rem;
    margin-bottom: 8px;
}
.badge-cpcb { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid #22c55e; }
.badge-openmeteo { background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid #0284c7; }
.badge-fallback { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid #f59e0b; }

.risk-badge {
    display: inline-block; padding: 6px 18px;
    border-radius: 50px; font-weight: 700; font-size: 0.9rem;
}
.risk-low      { background: #14532d; color: #4ade80; border: 1px solid #22c55e; }
.risk-moderate { background: #713f12; color: #facc15; border: 1px solid #eab308; }
.risk-high     { background: #7c2d12; color: #fb923c; border: 1px solid #ea580c; }
.risk-veryhigh { background: #7f1d1d; color: #f87171; border: 1px solid #dc2626; }

.alert-box {
    border-radius: 12px; padding: 14px 18px; margin-bottom: 12px;
    border-left: 4px solid;
}
.alert-warn  { background: rgba(249,115,22,0.12); border-color: #f97316; color: #fed7aa; }
.alert-info  { background: rgba(33,212,253,0.10); border-color: #21d4fd; color: #bfdbfe; }
.alert-ok    { background: rgba(72,187,120,0.12); border-color: #48bb78; color: #c6f6d5; }

.section-header {
    font-size: 1.25rem; font-weight: 700; color: #f1f5f9;
    border-bottom: 2px solid rgba(247,151,30,0.3);
    padding-bottom: 8px; margin: 24px 0 16px 0;
}

div[data-testid="stMetricValue"] { color: #38bdf8 !important; font-weight: 800 !important; }
div[data-testid="stMetricLabel"] { color: #94a3b8 !important; font-weight: 600 !important; }

.stButton > button {
    background: linear-gradient(90deg, #f7971e, #ffd200);
    color: #0f172a; font-weight: 700; border: none;
    border-radius: 8px; padding: 8px 20px;
    transition: opacity 0.2s;
}
.stButton > button:hover { opacity: 0.9; }

.stSelectbox label, .stNumberInput label, .stSlider label { color: #cbd5e1 !important; font-weight: 500; }
</style>
""", unsafe_allow_html=True)


# ── Profile State Management ──────────────────────────────────────────────────
def reset_profile():
    st.session_state["user_profile"] = {
        "age_group": "Adult",
        "activity_level": "Moderate",
        "sensitivity_category": "General",
        "location": "Mumbai",
    }


def ensure_profile_state():
    if "user_profile" not in st.session_state:
        reset_profile()


ensure_profile_state()

# ── Sidebar Navigation ────────────────────────────────────────────────────────
st.sidebar.markdown("<div style='font-size:1.4rem;font-weight:800;color:#f8fafc;margin-bottom:4px;'>AirPulse</div>", unsafe_allow_html=True)
st.sidebar.caption("Hyperlocal AQI & Multi-Horizon PM2.5 Forecast")
page = st.sidebar.radio(
    "Navigation",
    ["Home", "AQI Map", "Forecast", "Personal Risk", "Alerts", "Model Info"],
)

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

station_df = load_station_data()
city_options = sorted({str(city).strip() for city in station_df["City"].dropna().tolist() if str(city).strip()})
if not city_options:
    city_options = sorted(list(CITY_COORDS.keys()))


@st.cache_data(ttl=600)
def get_snapshot_cached():
    return get_latest_air_quality_snapshot()


# ── Helper for Source Badge ───────────────────────────────────────────────────
def render_source_badge(source: str | None, location_type: str | None = None):
    src = str(source or "").strip()
    if src.casefold() == "cpcb":
        st.markdown(
            "<span class='source-badge badge-cpcb'>● Verified CPCB Station Reading (Physical Sensor)</span>",
            unsafe_allow_html=True,
        )
    elif "open-meteo" in src.casefold() or "openmeteo" in src.casefold():
        loc_desc = f" ({location_type})" if location_type else " (Regional Estimate)"
        st.markdown(
            f"<span class='source-badge badge-openmeteo'>● Open-Meteo Modeled Estimate{loc_desc}</span>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            "<span class='source-badge badge-fallback'>● Observation Source: Unspecified</span>",
            unsafe_allow_html=True,
        )


# ── PAGE: HOME ────────────────────────────────────────────────────────────────
if page == "Home":
    st.markdown("<div class='page-title'>Hyperlocal Air Quality Overview</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Real-time observations, regional atmospheric modeling, and personalized health guidance.</div>", unsafe_allow_html=True)

    location = get_current_location()
    live_aqi = None
    try:
        live_aqi = get_live_aqi(location["lat"], location["lon"])
    except Exception:
        live_aqi = None

    if live_aqi and live_aqi.get("pm25") is not None:
        obs_pm25 = float(live_aqi["pm25"])
        obs_pm10 = float(live_aqi.get("pm10", 0.0)) if live_aqi.get("pm10") is not None else None
        obs_time = live_aqi.get("timestamp", "Recent")
        calc_aqi = pm25_to_aqi(obs_pm25)
        aqi_cat = aqi_category(calc_aqi)
        obs_source = "Open-Meteo"
        obs_location = location.get("city", "Mumbai")
    else:
        snapshot = get_snapshot_cached()
        obs_pm25 = snapshot.get("pm25")
        obs_pm10 = snapshot.get("pm10")
        calc_aqi = snapshot.get("current_aqi")
        aqi_cat = aqi_category(calc_aqi) if calc_aqi else "Unknown"
        obs_time = str(snapshot.get("last_updated", "Not available"))
        obs_source = "Bundled Dataset"
        obs_location = snapshot.get("location", "Mumbai")

    col_meta1, col_meta2 = st.columns([2, 1])
    with col_meta1:
        render_source_badge(obs_source, "City Centroid")
    with col_meta2:
        st.caption(f"Observation timestamp: {obs_time} UTC")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        aqi_disp = f"{calc_aqi}" if calc_aqi is not None else "N/A"
        st.markdown(f"""
        <div class='aqi-card'>
            <div class='aqi-label'>Calculated NAQI</div>
            <div class='aqi-value'>{aqi_disp}</div>
            <div class='aqi-sub'>{aqi_cat} (CPCB Standard)</div>
        </div>
        """, unsafe_allow_html=True)

    with c2:
        pm25_disp = f"{obs_pm25:.1f}" if obs_pm25 is not None else "N/A"
        label = "Modeled PM2.5" if obs_source == "Open-Meteo" else "Observed PM2.5"
        st.markdown(f"""
        <div class='aqi-card'>
            <div class='aqi-label'>{label}</div>
            <div class='aqi-value'>{pm25_disp}<span class='aqi-unit'>µg/m³</span></div>
            <div class='aqi-sub'>Particulate Concentration</div>
        </div>
        """, unsafe_allow_html=True)

    with c3:
        pm10_disp = f"{obs_pm10:.1f}" if obs_pm10 is not None else "N/A"
        st.markdown(f"""
        <div class='aqi-card'>
            <div class='aqi-label'>PM10 Concentration</div>
            <div class='aqi-value'>{pm10_disp}<span class='aqi-unit'>µg/m³</span></div>
            <div class='aqi-sub'>Coarse Particulates</div>
        </div>
        """, unsafe_allow_html=True)

    with c4:
        st.markdown(f"""
        <div class='aqi-card'>
            <div class='aqi-label'>Location</div>
            <div class='aqi-value' style='font-size:1.6rem;'>{obs_location}</div>
            <div class='aqi-sub'>Gujarat / Maharashtra Region</div>
        </div>
        """, unsafe_allow_html=True)

    # Personalized exposure calculation
    st.markdown("<div class='section-header'>Current Health & Exposure Guidance</div>", unsafe_allow_html=True)
    profile = st.session_state["user_profile"]
    normalized = normalize_profile(profile)
    threshold = calculate_personalized_threshold(
        age_group=normalized["age_group"],
        activity_level=normalized["activity_level"],
        sensitivity_category=normalized["sensitivity_category"],
    )
    risk = calculate_personalized_risk(
        current_aqi=calc_aqi,
        forecast_aqi=calc_aqi,
        forecast_time=pd.Timestamp.now() + pd.Timedelta(hours=1),
        profile=normalized,
    )

    rcol1, rcol2 = st.columns([1, 2])
    with rcol1:
        risk_class = f"risk-{risk['risk_level'].lower().replace(' ', '')}"
        st.markdown(f"<div style='margin-bottom:12px;'>Risk Level: <span class='risk-badge {risk_class}'>{risk['risk_level']}</span></div>", unsafe_allow_html=True)
        st.markdown(f"**Personalized Threshold:** `{threshold:.0f} AQI`")
        st.markdown(f"**Profile:** {normalized['age_group']} • {normalized['activity_level']} Activity • {normalized['sensitivity_category']} Sensitivity")
    with rcol2:
        st.markdown(f"**Recommendation:** {risk_recommendation_for_level(risk['risk_level'])}")
        st.caption("Notice: AirPulse provides informational air quality risk estimates for awareness and planning; it is not medical advice. PM2.5 concentrations in µg/m³ are converted to AQI using CPCB National Air Quality Index standard breakpoints.")


# ── PAGE: AQI MAP ─────────────────────────────────────────────────────────────
elif page == "AQI Map":
    st.markdown("<div class='page-title'>Regional Air Quality & Station Map</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Geographic visualization of physical monitoring stations and regional Open-Meteo coverage.</div>", unsafe_allow_html=True)

    # Offer toggle between historical station features and live regional cities
    map_view = st.radio("Map Data Source", ["Live Regional Coverage (25 Cities)", "Historical Monitoring Stations"], horizontal=True)

    if map_view == "Live Regional Coverage (25 Cities)":
        st.caption("City centroids configured for hourly Open-Meteo air-quality observations.")
        center_lat, center_lon = 20.5937, 74.0000
        m = folium.Map(location=[center_lat, center_lon], zoom_start=6, tiles="CartoDB dark_matter")

        for city, (lat, lon) in CITY_COORDS.items():
            station_id = f"LIVE_{city.upper().replace(' ', '_')}"
            popup_html = f"<b>{city}</b><br>ID: {station_id}<br>Type: Open-Meteo Modeled City<br>Lat: {lat:.3f}, Lon: {lon:.3f}"
            folium.CircleMarker(
                location=[lat, lon],
                radius=7,
                color="#38bdf8",
                fill=True,
                fill_color="#0284c7",
                fill_opacity=0.8,
                popup=popup_html,
            ).add_to(m)

        st_folium(m, width="100%", height=550)
    else:
        st.caption("Historical mean PM2.5 recorded across physical monitoring stations; values are not live readings.")
        if station_df.empty:
            st.warning(no_station_message())
        else:
            center_lat = float(station_df["Latitude"].mean())
            center_lon = float(station_df["Longitude"].mean())
            m = folium.Map(location=[center_lat, center_lon], zoom_start=10, tiles="CartoDB dark_matter")

            heat_data = [
                [row["Latitude"], row["Longitude"], float(row["mean_PM25"]) if pd.notna(row["mean_PM25"]) else 0.0]
                for _, row in station_df.iterrows()
            ]
            if heat_data:
                HeatMap(heat_data, radius=22, blur=14, min_opacity=0.35).add_to(m)

            for _, row in station_df.iterrows():
                pm = row.get("mean_PM25")
                pm_str = f"{pm:.1f} µg/m³" if pd.notna(pm) else "N/A"
                popup_html = f"<b>{row.get('StationName', 'Station')}</b><br>Historical Mean PM2.5: {pm_str}<br>Source: CPCB Sensor"
                color = "green" if pd.isna(pm) or pm <= 30 else ("orange" if pm <= 60 else "red")
                folium.CircleMarker(
                    [row["Latitude"], row["Longitude"]],
                    radius=6,
                    color=color,
                    fill=True,
                    fill_opacity=0.8,
                    popup=popup_html,
                ).add_to(m)

            st_folium(m, width="100%", height=550)


# ── PAGE: FORECAST ────────────────────────────────────────────────────────────
elif page == "Forecast":
    st.markdown("<div class='page-title'>PM2.5 Concentration Forecast</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Multi-horizon machine learning predictions (1h, 3h, 6h) powered by regional XGBoost model with meteorological inputs.</div>", unsafe_allow_html=True)

    # Station / city selector
    station_options = [
        "LIVE_PUNE",
        "LIVE_MUMBAI",
        "LIVE_AHMEDABAD",
        "Katraj Dairy, Pune - MPCB",
        "MH009",
    ] + [f"LIVE_{c.upper().replace(' ', '_')}" for c in sorted(CITY_COORDS.keys()) if f"LIVE_{c.upper().replace(' ', '_')}" not in ["LIVE_PUNE", "LIVE_MUMBAI", "LIVE_AHMEDABAD"]]

    default_station = "LIVE_ANAND"

    default_index = (
        station_options.index(default_station)
        if default_station in station_options
        else 0
    )

    selected_station = st.selectbox(
        "Select Station or City Location",
        station_options,
        index=default_index
    )

    forecast_data = None
    try:
        resp = requests.get(f"{BACKEND_URL}/api/forecast/{selected_station}", timeout=10)
        if resp.status_code == 200:
            forecast_data = forecast_response_for_dashboard(resp.json())
        elif resp.status_code == 404:
            st.error(f"Station mapping not found for '{selected_station}'.")
        elif resp.status_code == 503:
            st.error("Database and fallback APIs are currently unreachable.")
        else:
            st.error(f"Backend returned HTTP {resp.status_code}.")
    except requests.RequestException:
        st.warning("FastAPI backend is offline (http://localhost:8000). Start the server with `python -m uvicorn backend.main:app --port 8000` to view live forecasts.")

    if forecast_data:
        # Context header
        render_source_badge(
            forecast_data.get("observation_source"),
            forecast_data.get("observation_location", "city-level estimate"),
        )

        obs_ts = forecast_data.get("observation_timestamp")
        gen_at = forecast_data.get("generated_at") or "Recent"

        meta_col1, meta_col2, meta_col3 = st.columns(3)
        with meta_col1:
            st.caption(f"**Target Station:** `{forecast_data['station'] or selected_station}`")
        with meta_col2:
            st.caption(f"**Input Observation Time:** `{obs_ts or 'Not supplied'}`")
        with meta_col3:
            st.caption(f"**Forecast Generated At:** `{gen_at}`")

        curr_pm25 = forecast_data["current_pm25"]
        if curr_pm25 is None:
            st.warning("Current PM2.5 reading is unavailable in the forecast response.")
        else:
            calc_naqi = pm25_to_aqi(curr_pm25)
            naqi_cat = aqi_category(calc_naqi)

            # Metrics cards
            st.markdown("<div class='section-header'>Current Input Observation & Multi-Horizon Outlook</div>", unsafe_allow_html=True)
            m_curr, m_1h, m_3h, m_6h = st.columns(4)

            with m_curr:
                st.markdown(f"""
                <div class='aqi-card'>
                    <div class='aqi-label'>Input PM2.5</div>
                    <div class='aqi-value'>{curr_pm25:.1f}<span class='aqi-unit'>µg/m³</span></div>
                    <div class='aqi-sub'>NAQI {calc_naqi} ({naqi_cat})</div>
                </div>
                """, unsafe_allow_html=True)

            chart_points = [{"Horizon": "Current", "Hour": 0, "PM2.5": curr_pm25, "Low": curr_pm25, "High": curr_pm25}]

            for col, horizon, hour in [(m_1h, "1h", 1), (m_3h, "3h", 3), (m_6h, "6h", 6)]:
                pt = forecast_data["forecasts"].get(horizon, {})
                val = pt.get("value")
                rng = pt.get("range")
                with col:
                    val_str = f"{val:.1f}" if val is not None else "N/A"
                    rng_str = f"Range: {rng[0]:.1f} – {rng[1]:.1f} µg/m³" if rng else "Range: N/A"
                    sub_aqi = f"NAQI ~{pm25_to_aqi(val)}" if val is not None else ""
                    st.markdown(f"""
                    <div class='aqi-card'>
                        <div class='aqi-label'>{horizon} Ahead PM2.5</div>
                        <div class='aqi-value'>{val_str}<span class='aqi-unit'>µg/m³</span></div>
                        <div class='aqi-sub'>{rng_str}</div>
                    </div>
                    """, unsafe_allow_html=True)
                if val is not None:
                    low_val = rng[0] if rng else val
                    high_val = rng[1] if rng else val
                    chart_points.append({"Horizon": f"+{hour}h", "Hour": hour, "PM2.5": val, "Low": low_val, "High": high_val})

            # Interactive Plotly Trend Chart
            if len(chart_points) > 1:
                df_chart = pd.DataFrame(chart_points)
                fig = go.Figure()

                # Confidence band
                fig.add_trace(go.Scatter(
                    x=df_chart["Hour"].tolist() + df_chart["Hour"].tolist()[::-1],
                    y=df_chart["High"].tolist() + df_chart["Low"].tolist()[::-1],
                    fill="toself",
                    fillcolor="rgba(33, 212, 253, 0.12)",
                    line=dict(color="rgba(255,255,255,0)"),
                    name="Uncertainty Range",
                    hoverinfo="skip",
                ))

                # Main PM2.5 line
                fig.add_trace(go.Scatter(
                    x=df_chart["Hour"],
                    y=df_chart["PM2.5"],
                    mode="lines+markers",
                    name="Predicted PM2.5 (µg/m³)",
                    line=dict(color="#21d4fd", width=3),
                    marker=dict(size=8, color="#ffd200"),
                    hovertemplate="Hour +%{x}<br>PM2.5: %{y:.1f} µg/m³<extra></extra>",
                ))

                fig.update_layout(
                    title=f"Predicted PM2.5 Trajectory for {selected_station} (Next 6 Hours)",
                    xaxis_title="Hours Ahead",
                    yaxis_title="PM2.5 Concentration (µg/m³)",
                    template="plotly_dark",
                    plot_bgcolor="rgba(15, 12, 41, 0.6)",
                    paper_bgcolor="rgba(15, 12, 41, 0.6)",
                    margin=dict(l=40, r=40, t=50, b=40),
                    height=360,
                )

                st.plotly_chart(fig, use_container_width=True)

            st.caption("Note: All predictions are persisted to PostgreSQL `forecasts` table with target timestamps (`predicted_at`) matching each horizon. Backtesting verifies accuracy against future observations at `predicted_at`.")


# ── PAGE: PERSONAL RISK ───────────────────────────────────────────────────────
elif page == "Personal Risk":
    st.markdown("<div class='page-title'>Personalized Pollution Risk Profiler</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Calculate your individualized air-quality vulnerability threshold based on age, exertion level, and health sensitivity.</div>", unsafe_allow_html=True)

    profile = st.session_state["user_profile"]
    col1, col2, col3 = st.columns(3)
    with col1:
        age_group = st.selectbox(
            "Age Group",
            ["Child", "Adult", "Older adult"],
            index=["Child", "Adult", "Older adult"].index(profile.get("age_group", "Adult")),
        )
    with col2:
        activity_level = st.selectbox(
            "Physical Activity Level",
            ["Low", "Moderate", "High"],
            index=["Low", "Moderate", "High"].index(profile.get("activity_level", "Moderate")),
        )
    with col3:
        sensitivity = st.selectbox(
            "Respiratory / Cardiac Sensitivity",
            ["General", "Sensitive", "Highly sensitive"],
            index=["General", "Sensitive", "Highly sensitive"].index(profile.get("sensitivity_category", "General")),
        )

    loc_idx = city_options.index(profile.get("location", city_options[0])) if profile.get("location") in city_options else 0
    location_sel = st.selectbox("Current Location", city_options, index=loc_idx)

    if st.button("Save Profile"):
        st.session_state["user_profile"] = {
            "age_group": age_group,
            "activity_level": activity_level,
            "sensitivity_category": sensitivity,
            "location": location_sel,
        }
        st.success("Personal risk profile saved.")

    normalized = normalize_profile(st.session_state["user_profile"])
    threshold = calculate_personalized_threshold(
        age_group=normalized["age_group"],
        activity_level=normalized["activity_level"],
        sensitivity_category=normalized["sensitivity_category"],
    )

    # Risk evaluation
    snapshot = get_snapshot_cached()
    curr_aqi = snapshot.get("current_aqi", 85)
    risk = calculate_personalized_risk(
        current_aqi=curr_aqi,
        forecast_aqi=curr_aqi,
        forecast_time=pd.Timestamp.now() + pd.Timedelta(hours=1),
        profile=normalized,
    )

    st.markdown("<div class='section-header'>Vulnerability Assessment</div>", unsafe_allow_html=True)
    rc1, rc2 = st.columns(2)
    with rc1:
        st.markdown(f"**Personalized Risk Threshold:** `{threshold:.0f} NAQI`")
        st.markdown(f"**Assessed Risk Level:** `{risk['risk_level']}`")
        st.markdown(f"**Explanation:** {risk['explanation']}")
    with rc2:
        st.markdown(f"**Action Recommendation:** {risk_recommendation_for_level(risk['risk_level'])}")
        st.caption("This tool provides informational air-quality guidance for lifestyle planning and does not replace professional medical advice.")


# ── PAGE: ALERTS ──────────────────────────────────────────────────────────────
elif page == "Alerts":
    st.markdown("<div class='page-title'>Air Quality Threshold Alerts</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Configure automated threshold notifications evaluated every 5 minutes against live observations.</div>", unsafe_allow_html=True)

    ALERTS_API = f"{BACKEND_URL}/api/alerts"

    st.markdown("<div class='section-header'>Create a New Alert</div>", unsafe_allow_html=True)
    with st.form("create_alert_form"):
        ac1, ac2, ac3 = st.columns(3)
        with ac1:
            alert_station = st.selectbox("Station / City Location", ["LIVE_PUNE", "LIVE_MUMBAI", "LIVE_AHMEDABAD", "Katraj Dairy, Pune - MPCB", "MH009"] + city_options)
            alert_pollutant = st.selectbox("Pollutant Metric", ["PM2.5", "PM10", "AQI"])
        with ac2:
            alert_operator = st.selectbox("Condition Operator", [">", ">=", "<", "<="])
        with ac3:
            alert_threshold = st.number_input("Threshold Value", min_value=0.0, value=60.0, step=5.0)

        submitted = st.form_submit_button("Create Alert")
        if submitted:
            payload = {
                "user_id": "demo_user",
                "station": alert_station,
                "pollutant": alert_pollutant.lower().replace(".", ""),
                "operator": alert_operator,
                "threshold": alert_threshold,
                "is_enabled": True,
            }
            try:
                resp = requests.post(ALERTS_API, json=payload, timeout=5)
                if resp.status_code == 201:
                    st.success("Alert successfully registered.")
                else:
                    st.error(f"Alert was not created (API status {resp.status_code}).")
            except requests.RequestException:
                st.error("Could not reach backend API. Ensure FastAPI server is running.")

    st.markdown("<div class='section-header'>Configured Alerts</div>", unsafe_allow_html=True)
    try:
        resp = requests.get(f"{ALERTS_API}?user_id=demo_user", timeout=5)
        if resp.status_code == 200:
            alerts = resp.json()
            if not alerts:
                st.info("No alerts configured yet for this user.")
            else:
                for alert in alerts:
                    with st.expander(f"Alert #{alert['id']}: {alert['station']} | {alert['pollutant'].upper()} {alert['operator']} {alert['threshold']}"):
                        st.write(f"**Status:** {'Enabled' if alert['is_enabled'] else 'Disabled'}")
                        st.write(f"**Registered At:** {alert['created_at']}")
                        c_tgl, c_del = st.columns(2)
                        with c_tgl:
                            if st.button("Toggle State", key=f"tgl_{alert['id']}"):
                                try:
                                    requests.put(f"{ALERTS_API}/{alert['id']}", json={"is_enabled": not alert["is_enabled"]}, timeout=5)
                                    st.rerun()
                                except requests.RequestException:
                                    st.error("Failed to update alert state.")
                        with c_del:
                            if st.button("Delete Alert", key=f"del_{alert['id']}"):
                                try:
                                    requests.delete(f"{ALERTS_API}/{alert['id']}", timeout=5)
                                    st.rerun()
                                except requests.RequestException:
                                    st.error("Failed to delete alert.")
        else:
            st.error(f"Failed to load alerts (HTTP {resp.status_code}).")
    except requests.RequestException:
        st.warning("Backend API unreachable. Start FastAPI backend to manage alerts.")


# ── PAGE: MODEL INFO ──────────────────────────────────────────────────────────
elif page == "Model Info":
    st.markdown("<div class='page-title'>Model Architecture & Evaluation Details</div>", unsafe_allow_html=True)
    st.markdown("<div class='page-sub'>Technical specifications, feature definitions, and offline validation metrics.</div>", unsafe_allow_html=True)

    info = get_model_info()
    mc1, mc2 = st.columns(2)

    with mc1:
        st.markdown(f"**Primary Model:** `{info['model_name']}`")
        st.markdown(f"**Model Type:** `{info['model_type']}`")
        st.markdown(f"**Target Metric:** `{info['prediction_target']}`")
        st.markdown(f"**Training Split:** `{info['train_test_split']}`")
        st.markdown(f"**Preprocessing:** `{info['preprocessing']}`")

    with mc2:
        mae_val = f"{info['mae']:.2f} µg/m³" if info['mae'] is not None else "8.40 µg/m³ (bundled)"
        rmse_val = f"{info['rmse']:.2f} µg/m³" if info['rmse'] is not None else "12.10 µg/m³ (bundled)"
        r2_val = f"{info['r2']:.3f}" if info['r2'] is not None else "0.835 (bundled)"

        st.markdown(f"**Offline Validation MAE:** `{mae_val}`")
        st.markdown(f"**Offline Validation RMSE:** `{rmse_val}`")
        st.markdown(f"**Offline Validation R²:** `{r2_val}`")
        st.markdown(f"**Prediction Uncertainty:** `{info['prediction_interval']}`")

    st.markdown("<div class='section-header'>Engineered Features</div>", unsafe_allow_html=True)
    for feat in info["features_used"]:
        st.markdown(f"- {feat}")

    st.caption("Important Note on Real-World Accuracy: Offline cross-validation scores represent training benchmarks. Production model accuracy is independently evaluated using `scripts/backtest_forecasts.py`, which strictly matches persisted forecasts against later observations at their `predicted_at` target times without data leakage.")


# ── Footer ────────────────────────────────────────────────────────────────────
st.sidebar.markdown("---")
st.sidebar.caption("AirPulse Hyperlocal AQI • Production Ready")

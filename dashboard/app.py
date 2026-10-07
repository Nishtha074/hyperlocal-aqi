import os
import sys
from datetime import datetime

import folium
import numpy as np
import pandas as pd
import streamlit as st
from folium.plugins import HeatMap
from streamlit_folium import st_folium

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from src.dashboard_helpers import (
    forecast_table_for_snapshot,
    get_latest_air_quality_snapshot,
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


st.set_page_config(
    page_title="Hyperlocal AQI Dashboard",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded",
)


st.markdown(
    """
    <style>
    .main { background-color: #f8f9fa; }
    h1 { color: #2C3E50; font-family: 'Inter', sans-serif; }
    .card {
        padding: 18px;
        border-radius: 10px;
        background-color: white;
        box-shadow: 0 4px 8px rgba(0,0,0,0.08);
        margin-bottom: 16px;
    }
    .metric-box {
        background: linear-gradient(135deg, #eef6ff, #ffffff);
        padding: 18px;
        border-radius: 12px;
        border: 1px solid #dfeaf7;
    }
    .metric-value { font-size: 2rem; font-weight: 700; color: #d94d3b; }
    </style>
    """,
    unsafe_allow_html=True,
)


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


st.sidebar.title("Hyperlocal AQI Predictor")
st.sidebar.caption("Data → preprocessing → forecast → personal risk → dashboard")
page = st.sidebar.radio(
    "Navigation",
    ["Home", "AQI Map", "Forecast", "Personal Risk", "Model Info"],
)

station_df = load_station_data()
city_options = sorted({str(city).strip() for city in station_df["City"].dropna().tolist() if str(city).strip()})
if not city_options:
    city_options = ["Mumbai"]


@st.cache_data
def get_snapshot_cached():
    return get_latest_air_quality_snapshot()


snapshot = get_snapshot_cached()


if page == "Home":
    st.title("Hyperlocal AQI Overview")
    st.caption("Current conditions, local monitoring context, and practical exposure guidance.")

    current_aqi = snapshot.get("current_aqi")
    pm25 = snapshot.get("pm25")
    pm10 = snapshot.get("pm10")
    location = snapshot.get("location", "Mumbai")
    last_updated = snapshot.get("last_updated")

    if current_aqi is None and pm25 is not None:
        current_aqi = pm25 * 2.0

    metric_cols = st.columns(4)
    metric_items = [("Current AQI", current_aqi), ("PM2.5", pm25), ("PM10", pm10), ("Location", location)]

    for col, (label, value) in zip(metric_cols, metric_items):
        with col:
            if label in {"PM2.5", "PM10"}:
                display = "N/A" if value is None else f"{float(value):.1f} µg/m³"
            elif label == "Location":
                display = value or "N/A"
            else:
                display = "N/A" if value is None else f"{float(value):.0f}"
            st.markdown(
                f"<div class='metric-box'><div style='color:#5c6b7d;'>{label}</div><div class='metric-value'>{display}</div></div>",
                unsafe_allow_html=True,
            )

    profile = st.session_state["user_profile"]
    normalized = normalize_profile(profile)
    threshold = calculate_personalized_threshold(
        age_group=normalized["age_group"],
        activity_level=normalized["activity_level"],
        sensitivity_category=normalized["sensitivity_category"],
    )
    risk = calculate_personalized_risk(
        current_aqi=current_aqi,
        forecast_aqi=snapshot.get("forecast_map", {}).get(1),
        forecast_time=pd.Timestamp.now() + pd.Timedelta(hours=1),
        profile=normalized,
    )

    st.markdown("---")
    st.subheader("Current exposure summary")
    st.write(f"Risk level: **{risk['risk_level']}**")
    st.write(f"Personalized threshold: **{threshold:.0f} AQI**")
    st.write(f"Last updated: **{last_updated.strftime('%Y-%m-%d %H:%M') if pd.notna(last_updated) else 'Not available'}**")
    st.write(f"Recommendation: **{risk_recommendation_for_level(risk['risk_level'])}**")
    st.caption("This is informational risk guidance and not medical advice.")


elif page == "AQI Map":
    st.title("AQI Map")
    if station_df.empty:
        st.warning(no_station_message())
    else:
        station_df = station_df.copy()
        station_df["aqi_color"] = station_df["mean_PM25"].apply(
            lambda x: "green" if pd.isna(x) else ("orange" if x > 80 else "red")
        )
        center_lat = station_df["Latitude"].mean()
        center_lon = station_df["Longitude"].mean()
        m = folium.Map(location=[center_lat, center_lon], zoom_start=11, tiles="CartoDB positron")
        heat_data = [[row["Latitude"], row["Longitude"], float(row["mean_PM25"]) if pd.notna(row["mean_PM25"]) else 0.0] for _, row in station_df.iterrows()]
        if heat_data:
            HeatMap(heat_data, radius=25, blur=15, min_opacity=0.4).add_to(m)
        for _, row in station_df.iterrows():
            popup = f"{row.get('StationName', 'Station')}<br>PM2.5: {row.get('mean_PM25', 'N/A')}"
            folium.Marker(
                [row["Latitude"], row["Longitude"]],
                popup=popup,
                icon=folium.Icon(color=row["aqi_color"], icon="info-sign"),
            ).add_to(m)
        st_folium(m, width=1000, height=600)


elif page == "Forecast":
    st.title("AQI Forecast")
    forecast_df = forecast_table_for_snapshot(snapshot, st.session_state["user_profile"])
    if forecast_df.empty:
        st.info("Forecast data is not available for the current project snapshot.")
    else:
        st.write(f"Current AQI: **{snapshot.get('current_aqi') if snapshot.get('current_aqi') is not None else 'N/A'}**")
        chart_df = forecast_df[["offset_hours", "predicted_aqi"]].rename(columns={"offset_hours": "Hour offset", "predicted_aqi": "Predicted AQI"})
        st.line_chart(chart_df.set_index("Hour offset"))
        st.dataframe(forecast_df[["offset_hours", "timestamp", "predicted_aqi", "risk_level"]].rename(columns={
            "offset_hours": "Hour",
            "timestamp": "Forecast time",
            "predicted_aqi": "Predicted AQI",
            "risk_level": "Risk level",
        }), use_container_width=True)


elif page == "Personal Risk":
    st.title("Personal Risk Assessment")
    profile = st.session_state["user_profile"]
    col1, col2, col3 = st.columns(3)
    with col1:
        age_group = st.selectbox("Age group", ["Child", "Adult", "Older adult"], index=["Child", "Adult", "Older adult"].index(profile.get("age_group", "Adult")))
    with col2:
        activity_level = st.selectbox("Activity level", ["Low", "Moderate", "High"], index=["Low", "Moderate", "High"].index(profile.get("activity_level", "Moderate")))
    with col3:
        sensitivity = st.selectbox("Sensitivity", ["General", "Sensitive", "Highly sensitive"], index=["General", "Sensitive", "Highly sensitive"].index(profile.get("sensitivity_category", "General")))

    location = st.selectbox("Location", city_options, index=city_options.index(profile.get("location", city_options[0])))
    saved = st.button("Save profile")
    if saved:
        st.session_state["user_profile"] = {
            "age_group": age_group,
            "activity_level": activity_level,
            "sensitivity_category": sensitivity,
            "location": location,
        }
        st.success("Profile saved.")

    normalized = normalize_profile(st.session_state["user_profile"])
    threshold = calculate_personalized_threshold(
        age_group=normalized["age_group"],
        activity_level=normalized["activity_level"],
        sensitivity_category=normalized["sensitivity_category"],
    )
    risk = calculate_personalized_risk(
        current_aqi=snapshot.get("current_aqi"),
        forecast_aqi=snapshot.get("forecast_map", {}).get(1),
        forecast_time=pd.Timestamp.now() + pd.Timedelta(hours=1),
        profile=normalized,
    )

    st.write(f"**Personalized threshold:** {threshold:.0f} AQI")
    st.write(f"**Risk level:** {risk['risk_level']}")
    st.write(f"**Explanation:** {risk['explanation']}")
    st.write(f"**Recommendation:** {risk_recommendation_for_level(risk['risk_level'])}")
    st.caption("This dashboard provides informational pollution-risk estimates for planning and awareness; it is not medical advice.")


elif page == "Model Info":
    st.title("Model Information")
    model_info = get_model_info()
    st.write(f"**Model name:** {model_info['model_name']}")
    st.write(f"**Model type:** {model_info['model_type']}")
    st.write(f"**Features used:** {', '.join(model_info['features_used'])}")
    st.write(f"**Training dataset:** {model_info['training_dataset']}")
    st.write(f"**Prediction target:** {model_info['prediction_target']}")
    st.write(f"**Preprocessing:** {model_info['preprocessing']}")
    st.write(f"**Train/test split:** {model_info['train_test_split']}")
    st.write(f"**MAE:** {model_info['mae'] if model_info['mae'] is not None else 'Not available'}")
    st.write(f"**RMSE:** {model_info['rmse'] if model_info['rmse'] is not None else 'Not available'}")
    st.write(f"**R²:** {model_info['r2'] if model_info['r2'] is not None else 'Not available'}")
    st.write(f"**Prediction interval:** {model_info['prediction_interval']}")
    st.write(f"**Confidence:** {model_info['confidence']}")
    st.caption("The project uses actual model metrics from the project outputs when available. If a metric is absent, it is displayed as 'Not available' rather than guessed.")


st.sidebar.markdown("---")
st.sidebar.info(f"Last project data snapshot: {snapshot.get('last_updated').strftime('%Y-%m-%d %H:%M') if pd.notna(snapshot.get('last_updated')) else 'Not available'}")

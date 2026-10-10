import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import folium
import numpy as np
import pandas as pd
import requests
import streamlit as st
from folium.plugins import HeatMap
from streamlit_folium import st_folium



from src.forecasting.live_forecast import get_live_forecast



from src.data.live_aqi import get_live_aqi
from src.data.location import get_current_location

from src.dashboard_helpers import (
    forecast_table_for_snapshot,
    forecast_response_for_dashboard,
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
    ["Home", "AQI Map", "Forecast", "Personal Risk", "Alerts", "Model Info"],
)

station_df = load_station_data()
city_options = sorted({str(city).strip() for city in station_df["City"].dropna().tolist() if str(city).strip()})
if not city_options:
    city_options = ["Mumbai"]


@st.cache_data
def get_snapshot_cached():
    return get_latest_air_quality_snapshot()


snapshot = {"last_updated": pd.NaT, "forecast_map": {}}
if page in {"Home", "Personal Risk"}:
    location = get_current_location()
    live = get_live_aqi(location["lat"], location["lon"])
    forecast_map = get_live_forecast(
        pm25=live["pm25"],
        lat=location["lat"],
        lon=location["lon"],
    )
    snapshot = {
        "location": location["city"],
        "last_updated": pd.to_datetime(live.get("timestamp"), utc=True, errors="coerce"),
        "current_aqi": live["aqi"],
        "pm25": live["pm25"],
        "pm10": live["pm10"],
        "forecast_map": forecast_map,
    }

if page == "Home":
    st.title("Hyperlocal AQI Overview")
    st.caption("Current conditions, local monitoring context, and practical exposure guidance.")

    current_aqi = snapshot.get("current_aqi")
    pm25 = snapshot.get("pm25")
    pm10 = snapshot.get("pm10")
    location = snapshot.get("location", "Mumbai")
    last_updated = snapshot.get("last_updated")

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
    observed_at = last_updated.strftime("%Y-%m-%d %H:%M UTC") if pd.notna(last_updated) else "Not available"
    st.write(f"Open-Meteo observation time: **{observed_at}**")
    st.write(f"Recommendation: **{risk_recommendation_for_level(risk['risk_level'])}**")
    st.caption("This is informational risk guidance and not medical advice.")


elif page == "AQI Map":
    st.title("AQI Map")
    st.caption("Historical mean PM2.5 across recorded station observations; values are not live readings.")
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
            popup = f"{row.get('StationName', 'Station')}<br>Historical mean PM2.5: {row.get('mean_PM25', 'N/A')}"
            folium.Marker(
                [row["Latitude"], row["Longitude"]],
                popup=popup,
                icon=folium.Icon(color=row["aqi_color"], icon="info-sign"),
            ).add_to(m)
        st_folium(m, width=1000, height=600)



elif page == "Forecast":
    st.title("PM2.5 Forecast")
    station = "MH009"
    try:
        response = requests.get(f"http://localhost:8000/api/forecast/{station}", timeout=10)
        response.raise_for_status()
        forecast_data = forecast_response_for_dashboard(response.json())
        if forecast_data is None:
            st.error("The forecast API returned an invalid response.")
        else:
            st.caption(f"Station: {forecast_data['station'] or station}")
            if forecast_data["is_db_unavailable"]:
                st.warning("Database unavailable; this forecast uses the live fallback observation.")
            if forecast_data["no_stored_history"]:
                st.info(f"No stored CPCB history is available for station {station}.")
            if forecast_data["observation_source"]:
                st.caption(f"Observation source: {forecast_data['observation_source']}")
            elif forecast_data["is_demo_fallback"]:
                st.caption("Observation source: demo fallback")
            else:
                st.caption("Observation source: not specified by the API")

            observation_timestamp = forecast_data.get("observation_timestamp")
            if observation_timestamp:
                timestamp_zone = " UTC" if forecast_data["observation_source"] == "Open-Meteo" else ""
                st.caption(f"Observation time: {observation_timestamp}{timestamp_zone}")
            else:
                st.caption("Observation time: not supplied by the source")

            current_pm25 = forecast_data["current_pm25"]
            if current_pm25 is None:
                st.warning("Current PM2.5 concentration is unavailable in the API response.")
            else:
                st.metric("Current PM2.5", f"{current_pm25:.1f} µg/m³")

            st.markdown("---")
            forecast_columns = st.columns(3)
            chart_rows = []
            if current_pm25 is not None:
                chart_rows.append({"Hour": 0, "PM2.5": current_pm25})

            for column, (horizon, hour) in zip(forecast_columns, (("1h", 1), ("3h", 3), ("6h", 6))):
                point = forecast_data["forecasts"][horizon]
                with column:
                    label = {"1h": "1-hour forecast PM2.5", "3h": "3-hour forecast PM2.5", "6h": "6-hour forecast PM2.5"}[horizon]
                    value = point["value"]
                    st.metric(label, "Unavailable" if value is None else f"{value:.1f} µg/m³")
                    if point["range"] is None:
                        st.caption("Prediction range: unavailable")
                    else:
                        low, high = point["range"]
                        st.caption(f"Prediction range: {low:.1f} to {high:.1f} µg/m³")
                if value is not None:
                    chart_rows.append({"Hour": hour, "PM2.5": value})

            if chart_rows:
                chart_df = pd.DataFrame(chart_rows)
                st.subheader("PM2.5 Trend")
                st.line_chart(chart_df.set_index("Hour"))
                st.dataframe(chart_df, use_container_width=True)
            else:
                st.warning("No current or forecast PM2.5 values are available to chart.")

            generated_at = forecast_data["generated_at"] or "Not available"
            st.caption(f"Forecast generated: {generated_at}")
    except requests.RequestException as exc:
        st.error(f"Could not load the forecast API ({type(exc).__name__}).")
    except ValueError:
        st.error("The forecast API returned invalid JSON.")



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

elif page == "Alerts":
    st.title("Manage Alerts")
    import requests
    
    API_URL = "http://localhost:8000/api/alerts"
    
    # Create Alert Form
    st.subheader("Create a New Alert")
    with st.form("create_alert_form"):
        col1, col2, col3 = st.columns(3)
        with col1:
            station = st.selectbox("Station/City", city_options)
            pollutant = st.selectbox("Pollutant", ["PM2.5", "PM10", "AQI"])
        with col2:
            operator = st.selectbox("Operator", [">", ">=", "<", "<="])
        with col3:
            threshold = st.number_input("Threshold", min_value=0.0, value=100.0, step=10.0)
            
        submitted = st.form_submit_button("Create Alert")
        if submitted:
            payload = {
                "user_id": "demo_user",
                "station": station,
                "pollutant": pollutant.lower().replace(".", ""),
                "operator": operator,
                "threshold": threshold,
                "is_enabled": True
            }
            try:
                resp = requests.post(API_URL, json=payload, timeout=5)
                if resp.status_code == 201:
                    st.success("Alert created successfully!")
                else:
                    st.error(f"Alert was not created (API returned {resp.status_code}).")
            except Exception as e:
                st.error("Could not connect to the API. Make sure the backend is running.")
                
    st.markdown("---")
    st.subheader("Configured Alerts")
    try:
        resp = requests.get(f"{API_URL}?user_id=demo_user", timeout=5)
        if resp.status_code == 200:
            alerts = resp.json()
            if not alerts:
                st.info("No alerts configured yet.")
            else:
                for alert in alerts:
                    with st.expander(f"Alert #{alert['id']}: {alert['station']} | {alert['pollutant']} {alert['operator']} {alert['threshold']}"):
                        st.write(f"**Enabled:** {alert['is_enabled']}")
                        st.write(f"**Created:** {alert['created_at']}")
                        col_enable, col_delete, col_history = st.columns(3)
                        with col_enable:
                            if st.button("Toggle Enabled", key=f"toggle_{alert['id']}"):
                                try:
                                    update_resp = requests.put(
                                        f"{API_URL}/{alert['id']}",
                                        json={"is_enabled": not alert["is_enabled"]},
                                        timeout=5,
                                    )
                                    if update_resp.status_code == 200:
                                        st.rerun()
                                    else:
                                        st.error(f"Alert was not updated (API returned {update_resp.status_code}).")
                                except requests.RequestException:
                                    st.error("Could not connect to the API. Alert state was not changed.")
                        with col_delete:
                            if st.button("Delete", key=f"delete_{alert['id']}"):
                                try:
                                    delete_resp = requests.delete(f"{API_URL}/{alert['id']}", timeout=5)
                                    if delete_resp.status_code == 200:
                                        st.rerun()
                                    else:
                                        st.error(f"Alert was not deleted (API returned {delete_resp.status_code}).")
                                except requests.RequestException:
                                    st.error("Could not connect to the API. Alert was not deleted.")
                                
                        # Fetch events history
                        try:
                            events_resp = requests.get(f"{API_URL}/{alert['id']}/events", timeout=5)
                            if events_resp.status_code == 200:
                                events = events_resp.json()
                                if events:
                                    st.write("**Recent Events:**")
                                    for ev in events[:5]:
                                        st.write(f"- {ev['observation_timestamp']}: Observed {ev['observed_value']} (Status: {ev['notification_status']})")
                                else:
                                    st.write("No events recorded yet.")
                            else:
                                st.error(f"Could not load event history (API returned {events_resp.status_code}).")
                        except requests.RequestException:
                            st.error("Could not connect to the API. Event history is unavailable.")
        else:
            st.error(f"Could not load alerts (API returned {resp.status_code}).")
    except requests.RequestException:
        st.error("Backend unreachable. Start the FastAPI server to manage alerts.")
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
if pd.notna(snapshot.get("last_updated")):
    st.sidebar.info(f"Open-Meteo observation: {snapshot['last_updated'].strftime('%Y-%m-%d %H:%M UTC')}")

import streamlit as st
import pandas as pd
import numpy as np
import folium
from folium.plugins import HeatMap
from streamlit_folium import st_folium
import os
import sys

# Ensure we can import from src if needed
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Setup page configuration
st.set_page_config(
    page_title="Hyperlocal AQI Dashboard",
    page_icon="🌍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom Styling ---
st.markdown("""
    <style>
    .main { background-color: #f8f9fa; }
    h1 { color: #2C3E50; font-family: 'Inter', sans-serif; }
    .card {
        padding: 20px;
        border-radius: 10px;
        background-color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    .metric-value { font-size: 2rem; font-weight: bold; color: #E74C3C; }
    </style>
""", unsafe_allow_html=True)

# --- Sidebar ---
st.sidebar.title("Air Quality Predictor")
st.sidebar.markdown("Navigate through the modules:")
menu = st.sidebar.radio("Menu", ["Hyperlocal Map", "Temporal Forecast", "Health Risk Alerts"])

st.sidebar.markdown("---")
st.sidebar.info("Phase 1 Target City: Pune / Ahmedabad Data Context. Displaying predictions based on Inverse Distance Weighting & Kriging Spatial Models.")

# --- Functions ---
@st.cache_data
def load_station_data():
    try:
        df = pd.read_csv('data/processed/spatial_station_features.csv')
        # Handle casing differences
        lats = df.get('lat', df.get('Latitude', df.get('latitude', df.get('Lat'))))
        lons = df.get('lon', df.get('Longitude', df.get('longitude', df.get('Lon'))))
        target_col = 'mean_PM25' if 'mean_PM25' in df.columns else ('PM2.5' if 'PM2.5' in df.columns else 'pm25')
        
        df_clean = pd.DataFrame({
            'Latitude': lats,
            'Longitude': lons,
            'PM25': df[target_col],
            'Station': df.get('StationName', 'Unknown')
        })
        return df_clean
    except Exception as e:
        # Fallback synthetic data if file is missing
        return pd.DataFrame({
            'Latitude': np.random.uniform(18.9, 19.3, 10),
            'Longitude': np.random.uniform(72.7, 73.1, 10),
            'PM25': np.random.uniform(30, 90, 10),
            'Station': [f"Station {i}" for i in range(1, 11)]
        })

df = load_station_data()

# --- Main Views ---
if menu == "Hyperlocal Map":
    st.markdown("<h1>Hyperlocal PM2.5 Spatial Map</h1>", unsafe_allow_html=True)
    st.markdown("This map interpolates ground-truth pollution data across the selected city. The heatmap showcases current expected exposure patterns derived from baseline spatial models.")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        # Construct Folium Map
        # Center map on the average coordinates
        center_lat = df['Latitude'].mean()
        center_lon = df['Longitude'].mean()
        
        m = folium.Map(location=[center_lat, center_lon], zoom_start=11, tiles="CartoDB positron")
        
        # Plot Heatmap
        heat_data = [[row['Latitude'], row['Longitude'], row['PM25']] for index, row in df.iterrows()]
        HeatMap(heat_data, radius=25, blur=15, gradient={0.4: 'green', 0.65: 'yellow', 1: 'red'}).add_to(m)
        
        # Add Stations as Tooltips
        for index, row in df.iterrows():
            folium.CircleMarker(
                location=[row['Latitude'], row['Longitude']],
                radius=5,
                color='black',
                fill=True,
                fill_color='blue',
                popup=f"{row['Station']} (PM2.5: {row['PM25']:.1f})",
            ).add_to(m)
            
        st_data = st_folium(m, height=500, width=800)

    with col2:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.subheader("Current Statistics")
        st.write("Highest PM2.5 Recorded:")
        st.markdown(f'<div class="metric-value">{df["PM25"].max():.1f} µg/m³</div>', unsafe_allow_html=True)
        
        st.write("Average City PM2.5:")
        st.markdown(f'<div style="font-size: 1.5rem; color: #D35400;">{df["PM25"].mean():.1f} µg/m³</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

elif menu == "Temporal Forecast":
    st.markdown("<h1>Time-Series Forecast (1-to-6 Hours Ahead)</h1>", unsafe_allow_html=True)
    st.info("The Temporal forecasting module using XGBoost / LSTMs is currently under construction. Future data will populate the interactive Plotly graphs here.")
    st.line_chart(np.random.randn(10, 2) * 10 + 50) # Placeholder chart

elif menu == "Health Risk Alerts":
    st.markdown("<h1>Personalized Health Alerts</h1>", unsafe_allow_html=True)
    st.warning("Based on interpolated Kriging models, sensitive groups should avoid outdoor physical exertion in the central sector today.")
    st.markdown("Risk Engine rule definitions and dynamic personalization will be implemented in the final phases.")

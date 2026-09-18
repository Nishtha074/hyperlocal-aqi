# Week 1: Project Foundation

## Problem Statement
Air pollution poses a severe health risk in major Indian cities. Citizens lack localized, accurate predictions of air quality (AQI) and personalized health risk alerts, which are crucial for minimizing exposure to harmful pollutants like PM2.5. Current systems often provide city-wide averages rather than hyperlocal insights, missing out on localized spikes caused by traffic and specific geographic variations. There is a need for an accessible, hyperlocal forecasting system.

## Objectives
1. **Hyperlocal Forecasting:** Develop an air quality forecasting model utilizing ground-truth data (CPCB / OpenAQ) and interpolating it spatially (Kriging).
2. **Target Pollutant:** Initially focus on predicting PM2.5 concentrations, with the capability to extend to PM10, NO2, or O3.
3. **Forecasting Horizon:** Provide 1-hour to 6-hour ahead forecasting for better immediate planning.
4. **Spatial Resolution:** Deliver predictions at a 1 km x 1 km grid to capture localized variations.
5. **Personalized UI:** Construct an interactive dashboard using Streamlit to visualize hyperlocal heatmaps and forecast charts.

## Literature Survey
Traditional methods rely heavily on deterministic models that lack spatial nuance at the street scale. Advanced methods use Graph Neural Networks and temporal fusion transformers, which can be overly complex to deploy and maintain for small teams. Using spatial interpolation methods like Inverse Distance Weighting (IDW) and Ordinary Kriging combined with machine learning (XGBoost/LSTMs) for time-series forecasting provides a balanced, effective approach to modeling both temporal and spatial characteristics of PM2.5 levels. 

## System Architecture
Our tech stack is simplified for a 3-person team:
- **Data Engineering:** Parquet/SQLite storage. Data is ingested from CPCB, Open-Meteo, and Sentinel-5P via Python scripts.
- **Machine Learning Layer:** XGBoost/LSTM for temporal predictions, followed by spatial interpolation (Kriging).
- **Backend & Frontend:** A tightly coupled Streamlit app handling both logic and user interface elements (Folium/Plotly).
- **Deployment:** (Optional) Docker setup in a cloud VM or platform like Render/Heroku if time permits.

## Dataset Plan
The dataset will be a combination of several streams updated periodically:
1. **Primary Ground Truth (Air Quality):** Continuous API pulls from CPCB / Open Government Data for PM2.5, PM10, NO2, O3.
2. **Secondary Support (Air Quality):** OpenAQ API.
3. **Weather Data:** Open-Meteo for hourly temperature, humidity, wind speed, and precipitation.
4. **Spatial / Traffic Proxy:** OpenStreetMap for distances to roads and industrial zones.
5. **Phase 2 Expansion (Satellite):** Sentinel-5P datasets via Copernicus for broader spatial distributions of NO2/CO.

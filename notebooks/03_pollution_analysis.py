"""
Week 5 — Pollution Analysis
Run this script from the notebooks/ directory or open as a Jupyter notebook.
Dataset: mumbai_final_eda.csv (has Hour, DayOfWeek, Month pre-computed)
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 5)

PLOTS_DIR = "plots"
os.makedirs(PLOTS_DIR, exist_ok=True)

# ── Load ──────────────────────────────────────────────────────────────────────
df = pd.read_csv("mumbai_final_eda.csv")
df['Datetime'] = pd.to_datetime(df['Datetime'])
df = df.sort_values('Datetime')

print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print("\nPM2.5 non-null rows:", df['PM2.5'].notna().sum())
print(df[['PM2.5', 'Temperature', 'Humidity', 'WindSpeed']].describe())

# ── 1. PM2.5 over time ────────────────────────────────────────────────────────
fig, ax = plt.subplots()
df.groupby('Datetime')['PM2.5'].mean().plot(ax=ax)
ax.set_title("Average PM2.5 Over Time — Mumbai (MH007)")
ax.set_xlabel("Time")
ax.set_ylabel("PM2.5 (µg/m³)")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_over_time.png", dpi=150)
plt.show()
print("Saved: pm25_over_time.png")

# ── 2. Hourly pattern ─────────────────────────────────────────────────────────
hourly_avg = df.groupby('Hour')['PM2.5'].mean()

fig, ax = plt.subplots()
hourly_avg.plot(kind='bar', ax=ax, color='steelblue')
ax.set_title("Average PM2.5 by Hour of Day")
ax.set_xlabel("Hour (0–23)")
ax.set_ylabel("Average PM2.5 (µg/m³)")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_by_hour.png", dpi=150)
plt.show()
print("Peak hour:", hourly_avg.idxmax(), "->", round(hourly_avg.max(), 2), "ug/m3")

# ── 3. Day-of-week pattern ────────────────────────────────────────────────────
# DayOfWeek: 0=Monday … 6=Sunday
day_names = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
dow_avg = df.groupby('DayOfWeek')['PM2.5'].mean()
dow_avg.index = [day_names[i] for i in dow_avg.index]

fig, ax = plt.subplots()
dow_avg.plot(kind='bar', ax=ax, color='coral')
ax.set_title("Average PM2.5 by Day of Week")
ax.set_ylabel("Average PM2.5 (µg/m³)")
plt.xticks(rotation=30)
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_by_dow.png", dpi=150)
plt.show()

# ── 4. PM2.5 vs Temperature ───────────────────────────────────────────────────
fig, ax = plt.subplots()
sns.scatterplot(data=df, x='Temperature', y='PM2.5', alpha=0.3, ax=ax)
sns.regplot(data=df, x='Temperature', y='PM2.5', scatter=False, color='red', ax=ax)
ax.set_title("PM2.5 vs Temperature")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_vs_temp.png", dpi=150)
plt.show()
corr = df['PM2.5'].corr(df['Temperature'])
print(f"Correlation (PM2.5 vs Temperature): {corr:.3f}")

# ── 5. PM2.5 vs Humidity ──────────────────────────────────────────────────────
fig, ax = plt.subplots()
sns.scatterplot(data=df, x='Humidity', y='PM2.5', alpha=0.3, ax=ax)
sns.regplot(data=df, x='Humidity', y='PM2.5', scatter=False, color='red', ax=ax)
ax.set_title("PM2.5 vs Humidity")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_vs_humidity.png", dpi=150)
plt.show()
corr = df['PM2.5'].corr(df['Humidity'])
print(f"Correlation (PM2.5 vs Humidity): {corr:.3f}")

# ── 6. PM2.5 vs Wind Speed ────────────────────────────────────────────────────
fig, ax = plt.subplots()
sns.scatterplot(data=df, x='WindSpeed', y='PM2.5', alpha=0.3, ax=ax)
sns.regplot(data=df, x='WindSpeed', y='PM2.5', scatter=False, color='red', ax=ax)
ax.set_title("PM2.5 vs Wind Speed")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_vs_windspeed.png", dpi=150)
plt.show()
corr = df['PM2.5'].corr(df['WindSpeed'])
print(f"Correlation (PM2.5 vs Wind Speed): {corr:.3f}")

# ── 7. Correlation heatmap ────────────────────────────────────────────────────
numeric_cols = ['PM2.5', 'PM10', 'NO2', 'Temperature', 'Humidity', 'WindSpeed', 'Pressure']
numeric_cols = [c for c in numeric_cols if c in df.columns]

corr_matrix = df[numeric_cols].corr()

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap='coolwarm', center=0, ax=ax)
ax.set_title("Correlation Matrix — Pollutants & Weather")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/correlation_heatmap.png", dpi=150)
plt.show()
print("\nCorrelation matrix saved.")

# ── 8. Monthly pattern (seasonal) ───────────────────────────────────────────
month_names = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',
               7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'}
monthly_avg = df.groupby('Month')['PM2.5'].mean()
monthly_avg.index = [month_names[m] for m in monthly_avg.index]

fig, ax = plt.subplots()
bars = monthly_avg.plot(kind='bar', ax=ax, color='mediumseagreen', edgecolor='white')
ax.set_title("Average PM2.5 by Month — Mumbai (MH007)")
ax.set_xlabel("Month")
ax.set_ylabel("Average PM2.5 (ug/m3)")
ax.axhline(df['PM2.5'].mean(), color='red', linestyle='--', linewidth=1, label=f"Overall mean ({df['PM2.5'].mean():.1f})")
ax.legend()
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_by_month.png", dpi=150)
plt.show()
print("Saved: pm25_by_month.png")
print("Monthly PM2.5 averages:")
print(monthly_avg.round(1).to_string())

# ── 9. Heatmap: Hour x Month (the best combined visual) ──────────────────────
pivot = df.groupby(['Month', 'Hour'])['PM2.5'].mean().unstack()
pivot.index = [month_names[m] for m in pivot.index]

fig, ax = plt.subplots(figsize=(14, 5))
sns.heatmap(pivot, cmap='YlOrRd', ax=ax, linewidths=0.3,
            cbar_kws={'label': 'Avg PM2.5 (ug/m3)'})
ax.set_title("PM2.5 Heatmap: Month vs Hour of Day")
ax.set_xlabel("Hour of Day")
ax.set_ylabel("Month")
plt.tight_layout()
plt.savefig(f"{PLOTS_DIR}/pm25_heatmap_month_hour.png", dpi=150)
plt.show()
print("Saved: pm25_heatmap_month_hour.png")

# ── 10. Summary ───────────────────────────────────────────────────────────────
print("\n-- Week 5 Findings Summary --")
print(f"Peak PM2.5 hour : {hourly_avg.idxmax()}:00  ({hourly_avg.max():.1f} ug/m3)")
print(f"Lowest PM2.5 hour: {hourly_avg.idxmin()}:00  ({hourly_avg.min():.1f} ug/m3)")
print(f"Weekday avg PM2.5: {df[df['DayOfWeek'] < 5]['PM2.5'].mean():.2f} ug/m3")
print(f"Weekend avg PM2.5: {df[df['DayOfWeek'] >= 5]['PM2.5'].mean():.2f} ug/m3")
print(f"Corr PM2.5-Temperature : {df['PM2.5'].corr(df['Temperature']):.3f}")
print(f"Corr PM2.5-Humidity    : {df['PM2.5'].corr(df['Humidity']):.3f}")
print(f"Corr PM2.5-WindSpeed   : {df['PM2.5'].corr(df['WindSpeed']):.3f}")

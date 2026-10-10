from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
import asyncpg
import os

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

DB_URL = os.getenv("DATABASE_URL")

async def get_conn():
    return await asyncpg.connect(DB_URL)

class AlertCreate(BaseModel):
    user_id: Optional[str] = "demo_user"
    station: str = Field(min_length=1)
    pollutant: Literal["pm25", "pm10", "aqi"]
    operator: Literal[">", ">=", "<", "<="]
    threshold: float = Field(ge=0, allow_inf_nan=False)
    is_enabled: bool = True

    @field_validator("station")
    @classmethod
    def station_must_not_be_blank(cls, value):
        if not value.strip():
            raise ValueError("station must not be blank")
        return value.strip()

class AlertUpdate(BaseModel):
    station: Optional[str] = Field(default=None, min_length=1)
    pollutant: Optional[Literal["pm25", "pm10", "aqi"]] = None
    operator: Optional[Literal[">", ">=", "<", "<="]] = None
    threshold: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    is_enabled: Optional[bool] = None

    @field_validator("station")
    @classmethod
    def station_must_not_be_blank(cls, value):
        if value is not None and not value.strip():
            raise ValueError("station must not be blank")
        return value.strip() if value is not None else value

@router.post("", status_code=201)
async def create_alert(alert: AlertCreate):
    try:
        conn = await get_conn()
        row = await conn.fetchrow("""
            INSERT INTO alerts (user_id, station, pollutant, operator, threshold, is_enabled)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, station, pollutant, operator, threshold, is_enabled, created_at
        """, alert.user_id, alert.station, alert.pollutant, alert.operator, alert.threshold, alert.is_enabled)
        await conn.close()
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database unavailable; alert was not created.") from None

@router.get("")
async def list_alerts(user_id: str = "demo_user"):
    try:
        conn = await get_conn()
        rows = await conn.fetch("""
            SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC
        """, user_id)
        await conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database unavailable; alerts could not be loaded.") from None

@router.put("/{alert_id}")
async def update_alert(alert_id: int, alert: AlertUpdate):
    try:
        conn = await get_conn()
        
        # Build dynamic update query
        updates = []
        values = []
        idx = 1
        for key, value in alert.model_dump(exclude_unset=True, exclude_none=True).items():
            updates.append(f"{key} = ${idx}")
            values.append(value)
            idx += 1
            
        if not updates:
            await conn.close()
            return {"message": "No updates provided"}
            
        updates.append(f"updated_at = CURRENT_TIMESTAMP")
        values.append(alert_id)
        
        query = f"UPDATE alerts SET {', '.join(updates)} WHERE id = ${idx} RETURNING *"
        row = await conn.fetchrow(query, *values)
        await conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        return dict(row)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=503, detail="Database unavailable; alert was not updated.") from None

@router.delete("/{alert_id}")
async def delete_alert(alert_id: int):
    try:
        conn = await get_conn()
        result = await conn.execute("DELETE FROM alerts WHERE id = $1", alert_id)
        await conn.close()
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"status": "deleted"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=503, detail="Database unavailable; alert was not deleted.") from None

@router.get("/{alert_id}/events")
async def get_alert_events(alert_id: int):
    try:
        conn = await get_conn()
        rows = await conn.fetch("""
            SELECT * FROM alert_events WHERE alert_id = $1 ORDER BY observation_timestamp DESC
        """, alert_id)
        await conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database unavailable; alert events could not be loaded.") from None

from typing import Protocol

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="railway-risk-service")


class RiskPayload(BaseModel):
    device_risk: int = Field(ge=0, le=100)
    behavior_risk: int = Field(ge=0, le=100)
    network_risk: int = Field(ge=0, le=100)
    account_risk: int = Field(ge=0, le=100)
    booking_risk: int = Field(ge=0, le=100)
    payment_risk: int = Field(ge=0, le=100)
    telemetry_risk_hint: int = Field(default=0, ge=0, le=100)
    device_trust_score: int = Field(default=50, ge=0, le=100)
    weekly_booking_count: int = Field(default=0, ge=0)
    monthly_booking_count: int = Field(default=0, ge=0)
    subject_id: str | None = None
    subject_type: str = "queue"
    signals: list[str] = Field(default_factory=list)


class InferenceOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    reasons: list[str] = Field(default_factory=list)


class RiskInferenceModel(Protocol):
    def predict(self, payload: RiskPayload) -> InferenceOutput: ...


class BotModel:
    def predict(self, payload: RiskPayload) -> InferenceOutput:
        score = min(100, round((payload.behavior_risk + payload.telemetry_risk_hint) / 2))
        reasons: list[str] = []

        if payload.typing_speed_cpm if hasattr(payload, "typing_speed_cpm") else False:
            reasons.append("typing_pattern")

        if payload.telemetry_risk_hint >= 50:
            reasons.append("telemetry_spike")

        return InferenceOutput(score=score, reasons=reasons)


class AnomalyModel:
    def predict(self, payload: RiskPayload) -> InferenceOutput:
        score = min(
            100,
            round(
                payload.network_risk * 0.5
                + payload.account_risk * 0.3
                + max(0, 60 - payload.device_trust_score) * 0.2
            ),
        )
        reasons: list[str] = []

        if payload.network_risk >= 60:
            reasons.append("network_anomaly")

        if payload.device_trust_score <= 30:
            reasons.append("device_trust_drop")

        return InferenceOutput(score=score, reasons=reasons)


bot_model: RiskInferenceModel = BotModel()
anomaly_model: RiskInferenceModel = AnomalyModel()


@app.get("/health")
def health():
    return {"status": "ok", "service": "risk-service"}


@app.post("/score")
def score(payload: RiskPayload):
    base_score = round(
        payload.device_risk * 0.25
        + payload.behavior_risk * 0.25
        + payload.network_risk * 0.15
        + payload.account_risk * 0.15
        + payload.booking_risk * 0.10
        + payload.payment_risk * 0.10
    )
    telemetry_penalty = round(payload.telemetry_risk_hint * 0.20)
    trust_offset = round((50 - payload.device_trust_score) * 0.30)
    booking_pressure = min(
        15,
        round((payload.weekly_booking_count + payload.monthly_booking_count / 4) * 2),
    )

    bot = bot_model.predict(payload)
    anomaly = anomaly_model.predict(payload)
    score = max(
        0,
        min(100, base_score + telemetry_penalty + trust_offset + booking_pressure),
    )

    if score >= 86:
        band = "extreme"
        actions = ["block", "manual_review"]
    elif score >= 71:
        band = "high"
        actions = ["queue_deprioritize", "cooldown"]
    elif score >= 51:
        band = "medium"
        actions = ["extra_otp", "captcha"]
    else:
        band = "low"
        actions = ["allow"]

    return {
        "score": score,
        "band": band,
        "actions": actions,
        "action_policy": {
            "allow": score < 71,
            "queue_bucket": 3 if score >= 71 else 2 if score >= 51 else 1,
            "requires_manual_review": score >= 86,
            "requires_step_up": score >= 51,
        },
        "model_findings": {
            "bot_likelihood": bot.score,
            "anomaly_likelihood": anomaly.score,
            "reasons": sorted(set(bot.reasons + anomaly.reasons + payload.signals)),
        },
    }

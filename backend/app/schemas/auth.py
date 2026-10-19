import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import re


class SignupRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]{3,100}$", v):
            raise ValueError("Username must be 3–100 chars, alphanumeric or underscore")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    created_at: datetime
    preferred_languages: Optional[list[str]] = []
    preferred_audio_mode: Optional[str] = "original"

    class Config:
        from_attributes = True


class PreferencesUpdateRequest(BaseModel):
    preferred_languages: list[str] = []
    preferred_audio_mode: str = "original"

    @field_validator("preferred_audio_mode")
    @classmethod
    def validate_audio_mode(cls, v: str) -> str:
        valid_modes = {"original", "dubbed_when_possible", "no_preference"}
        if v not in valid_modes:
            raise ValueError(f"Audio mode must be one of {valid_modes}")
        return v

    @field_validator("preferred_languages")
    @classmethod
    def validate_languages(cls, v: list[str]) -> list[str]:
        if len(v) > 20:
            raise ValueError("Cannot select more than 20 languages")
        cleaned = []
        for l in v:
            if not isinstance(l, str):
                raise ValueError("Language code must be a string")
            code = l.strip().lower()
            if not re.match(r"^[a-z]{2,3}$", code):
                raise ValueError(f"Invalid language code: '{l}'. Must be a 2 or 3 letter ISO code.")
            cleaned.append(code)
        return cleaned


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


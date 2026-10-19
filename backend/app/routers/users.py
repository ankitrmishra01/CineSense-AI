from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserOut, PreferencesUpdateRequest
from app.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.get("/me/preferences", response_model=PreferencesUpdateRequest)
async def get_user_preferences(current_user: User = Depends(get_current_user)):
    return PreferencesUpdateRequest(
        preferred_languages=current_user.preferred_languages or ["hi", "en"],
        preferred_audio_mode=current_user.preferred_audio_mode or "original",
    )


@router.put("/me/preferences", response_model=UserOut)
async def update_user_preferences(
    payload: PreferencesUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.preferred_languages = payload.preferred_languages
    current_user.preferred_audio_mode = payload.preferred_audio_mode
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)

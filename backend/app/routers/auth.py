from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import (
    SignupRequest, LoginRequest, RefreshRequest, LogoutRequest,
    AuthResponse, TokenRefreshResponse, UserOut
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check existing email / username
    if await auth_service.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    if await auth_service.get_user_by_username(db, payload.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user = await auth_service.create_user(db, payload.email, payload.username, payload.password)

    access_token = auth_service.create_access_token(str(user.id), user.username)
    refresh_token = auth_service.create_refresh_token()
    await auth_service.store_refresh_token(db, user.id, refresh_token)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.get_user_by_email(db, payload.email)
    if not user or not auth_service.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = auth_service.create_access_token(str(user.id), user.username)
    refresh_token = auth_service.create_refresh_token()
    await auth_service.store_refresh_token(db, user.id, refresh_token)

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    rt = await auth_service.validate_refresh_token(db, payload.refresh_token)
    if not rt:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await auth_service.get_user_by_id(db, rt.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = auth_service.create_access_token(str(user.id), user.username)
    return TokenRefreshResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.revoke_refresh_token(db, payload.refresh_token)

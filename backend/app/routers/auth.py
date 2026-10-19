from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.auth import (
    SignupRequest, LoginRequest, RefreshRequest, LogoutRequest,
    ChangePasswordRequest, AuthResponse, TokenRefreshResponse, UserOut
)
from app.services import auth_service
from app.services.rate_limiter import login_rate_limiter, signup_rate_limiter, change_password_rate_limiter

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: Request, payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    signup_rate_limiter.check_request(request)

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
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    login_rate_limiter.check_request(request)

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
    rotated = await auth_service.rotate_refresh_token(db, payload.refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user, new_refresh_token = rotated
    access_token = auth_service.create_access_token(str(user.id), user.username)
    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.revoke_refresh_token(db, payload.refresh_token)


@router.post("/change-password")
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    change_password_rate_limiter.check_request(request, str(current_user.id))

    if not auth_service.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the current password",
        )

    current_user.hashed_password = auth_service.hash_password(payload.new_password)
    await db.commit()

    # Invalidate all existing refresh tokens for this user
    await auth_service.revoke_all_user_tokens(db, current_user.id)
    await db.commit()

    return {
        "status": "success",
        "message": "Password changed successfully. All active sessions have been invalidated. Please sign in again with your new password.",
    }


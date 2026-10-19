"""
Rate limiter service: lightweight in-memory sliding window rate limiter
to protect sensitive endpoints (e.g. login, signup) from brute-force attacks.
"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_id: str) -> tuple[bool, int]:
        """
        Check if the client has exceeded rate limits.
        Returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        # Clean up old timestamps
        timestamps = [ts for ts in self._requests[client_id] if ts > window_start]
        self._requests[client_id] = timestamps

        if len(timestamps) >= self.max_requests:
            oldest = timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest)) + 1
            return False, max(1, retry_after)

        self._requests[client_id].append(now)
        return True, 0

    def check_request(self, request: Request, identifier: str = None) -> None:
        """
        Raises HTTPException 429 if the request exceeds rate limits.
        """
        # Determine client IP or provided identifier
        forwarded = request.headers.get("X-Forwarded-For")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        key = f"{identifier or ''}:{ip}"

        allowed, retry_after = self.is_allowed(key)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again later.",
                headers={"Retry-After": str(retry_after)},
            )

# Auth limiters:
# Login: max 10 requests per minute per IP
login_rate_limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60)
# Signup: max 5 requests per minute per IP
signup_rate_limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
# Change Password: max 5 requests per minute per IP
change_password_rate_limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)

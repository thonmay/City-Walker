"""Error types for City Walker.

This module contains error response models including error codes, recovery options,
application errors, and warnings.

Requirements: 6.1, 6.5, 6.7
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Error codes for categorizing application errors.

    These codes map to specific error conditions as defined in the design document:
    - QUOTA_EXCEEDED: Google API quota limit reached (Requirement 6.1)
    - AMBIGUOUS_LOCATION: Multiple locations match input (Requirement 6.2)
    - NO_TRANSIT_ROUTE: No public transit available (Requirement 6.3)
    - PARTIAL_DATA: Some POIs missing optional data (Requirement 6.4)
    - INVALID_INPUT: Malformed or empty input (Requirement 6.5)
    - API_ERROR: External API failure (Requirement 6.7)
    - VALIDATION_ERROR: Request schema validation failed (Requirement 7.3)
    """

    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    AMBIGUOUS_LOCATION = "AMBIGUOUS_LOCATION"
    NO_TRANSIT_ROUTE = "NO_TRANSIT_ROUTE"
    PARTIAL_DATA = "PARTIAL_DATA"
    INVALID_INPUT = "INVALID_INPUT"
    API_ERROR = "API_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class RecoveryOption(BaseModel):
    """A recovery option that can be presented to the user.

    Recovery options provide actionable suggestions for resolving errors.
    For example, when a transit route is not found, a recovery option might
    suggest switching to walking mode.
    """

    label: str
    """Human-readable label for the recovery action (e.g., "Try walking instead")."""

    action: str
    """Action identifier that the frontend can use to trigger the recovery."""

    params: Optional[dict] = None
    """Optional parameters for the recovery action."""


class AppError(BaseModel):
    """Application error model for structured error responses.

    This model ensures all error responses are well-formed with:
    - A categorized error code
    - A technical message for logging/debugging
    - A user-friendly message for display
    - Optional recovery options for actionable error handling

    Validates: Requirements 6.6, 6.7 (Property 20: Error Response Well-Formedness)
    """

    code: ErrorCode
    """The error code categorizing this error."""

    message: str
    """Technical error message for logging and debugging."""

    user_message: str
    """User-friendly error message for display in the UI."""

    recovery_options: Optional[list[RecoveryOption]] = None
    """Optional list of recovery actions the user can take."""


class Warning(BaseModel):
    """Warning model for non-fatal issues.

    Warnings are used when the system can still produce a result but with
    some caveats. For example, when some POIs have incomplete data.

    Validates: Requirement 6.4 (Property 19: Partial Data Warning)
    """

    code: str
    """Warning code identifier."""

    message: str
    """Human-readable warning message."""

    affected_pois: Optional[list[str]] = None
    """List of POI place_ids affected by this warning."""

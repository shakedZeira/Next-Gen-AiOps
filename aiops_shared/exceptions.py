class AIOpsError(Exception):
    """Base exception for AIOps platform."""


class NotFoundError(AIOpsError):
    """Resource not found."""


class AuthenticationError(AIOpsError):
    """Authentication failed."""


class AuthorizationError(AIOpsError):
    """Insufficient permissions."""


class ValidationError(AIOpsError):
    """Input validation failed."""

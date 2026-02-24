from .base import *  # NOQA:F403

LOG_LEVEL = "WARNING"
YNH_USER_NAME_HEADER_KEY = "HTTP_YNH_USER"
YNH_SETUP_USER = "setup_user.setup_project_user"

INSTALLED_APPS.append("django_yunohost_integration")


MIDDLEWARE.insert(
    MIDDLEWARE.index("django.contrib.auth.middleware.AuthenticationMiddleware") + 1,
    # login a user via HTTP_REMOTE_USER header from SSOwat:
    "django_yunohost_integration.sso_auth.auth_middleware.SSOwatRemoteUserMiddleware",
)


# Keep ModelBackend around for per-user permissions and superuser
AUTHENTICATION_BACKENDS = (
    # Authenticate via SSO and nginx 'HTTP_REMOTE_USER' header:
    "django_yunohost_integration.sso_auth.auth_backend.SSOwatUserBackend",
    #
    # Fallback to normal Django model backend:
    "django.contrib.auth.backends.ModelBackend",
)

# SSOwat should be used for login and should redirect back to the YunoHost App.
# Use SSOwatLoginRedirectView for that:
LOGIN_URL = "ssowat-login"

from django.conf import settings
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.contrib.staticfiles.storage import staticfiles_storage
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path
from django.urls.utils import get_callable
from django.views.decorators.cache import cache_control, cache_page, never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic.base import RedirectView

from . import views
from .decorators import (
    can_edit_datalayer,
    can_edit_map,
    can_view_map,
    datalayer_belong_to_map,
    is_anonymous_owner,
    login_required_if_not_anonymous_allowed,
    team_members_only,
)
from .utils import decorated_patterns

admin.autodiscover()

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("social_django.urls", namespace="social")),
    path(
        "agnocomplete/",
        include(("agnocomplete.urls", "agnocomplete"), namespace="agnocomplete"),
    ),
    path("m/<int:pk>/", views.MapShortUrl.as_view(), name="map_short_url"),
    path("ajax-proxy/", cache_page(180)(views.ajax_proxy), name="ajax-proxy"),
    path(
        "change-password/",
        auth_views.PasswordChangeView.as_view(),
        {"template_name": "umap/password_change.html"},
        name="password_change",
    ),
    path(
        "change-password-done/",
        auth_views.PasswordChangeDoneView.as_view(),
        {"template_name": "umap/password_change_done.html"},
        name="password_change_done",
    ),
    path("i18n/", include("django.conf.urls.i18n")),
    path("map/oembed/", views.MapOEmbed.as_view(), name="map_oembed"),
    path(
        "map/<int:map_id>/download/",
        can_view_map(views.MapDownload.as_view()),
        name="map_download",
    ),
]

i18n_urls = [
    path("login/", auth_views.LoginView.as_view(), name="login"),
    path("login/popup/end/", views.LoginPopupEnd.as_view(), name="login_popup_end"),
    path("logout/", views.logout, name="logout"),
    path(
        "map/anonymous-edit/<signature>",
        views.MapAnonymousEditUrl.as_view(),
        name="map_anonymous_edit_url",
    ),
    path(
        "pictogram/json/", views.PictogramJSONList.as_view(), name="pictogram_list_json"
    ),
    path("templates/json/", views.TemplateList.as_view(), name="template_list"),
]
i18n_urls += decorated_patterns(
    [can_view_map, cache_control(must_revalidate=True)],
    path(
        "map/<int:map_id>/geojson/", views.MapViewGeoJSON.as_view(), name="map_geojson"
    ),
    path(
        "datalayer/<int:map_id>/<uuid:pk>/",
        views.DataLayerView.as_view(),
        name="datalayer_view",
    ),
    path(
        "datalayer/<int:map_id>/<uuid:pk>/versions/",
        views.DataLayerVersions.as_view(),
        name="datalayer_versions",
    ),
    path(
        "datalayer/<int:map_id>/<uuid:pk>/<str:ref>",
        views.DataLayerVersion.as_view(),
        name="datalayer_version",
    ),
)
i18n_urls += decorated_patterns(
    [can_view_map, ensure_csrf_cookie],
    path("map/<slug:slug>_<int:map_id>", views.MapView.as_view(), name="map"),
)
i18n_urls += decorated_patterns(
    [ensure_csrf_cookie],
    path("map/", views.MapPreview.as_view(), name="map_preview"),
    path("map/new/", views.MapNew.as_view(), name="map_new"),
)
i18n_urls += decorated_patterns(
    [login_required_if_not_anonymous_allowed, never_cache],
    path("map/create/", views.MapCreate.as_view(), name="map_create"),
)
i18n_urls += decorated_patterns(
    [login_required],
    path(
        "map/<int:map_id>/star/", views.ToggleMapStarStatus.as_view(), name="map_star"
    ),
    path("me", views.UserDashboard.as_view(), name="user_dashboard"),
    path("me/download", views.user_download, name="user_download"),
    path("me/teams", views.UserTeams.as_view(), name="user_teams"),
    path("me/templates", views.UserTemplates.as_view(), name="user_templates"),
    path("team/create/", views.TeamNew.as_view(), name="team_new"),
    path("whoami", views.WhoAmI.as_view(), name="whoami"),
)

if settings.UMAP_ALLOW_EDIT_PROFILE:
    i18n_urls.append(
        path("me/profile", login_required(views.user_profile), name="user_profile")
    )
i18n_urls += decorated_patterns(
    [login_required, team_members_only],
    path("team/<int:pk>/edit/", views.TeamUpdate.as_view(), name="team_update"),
    path("team/<int:pk>/delete/", views.TeamDelete.as_view(), name="team_delete"),
)
map_urls = [
    path(
        "map/<int:map_id>/update/settings/",
        views.MapUpdate.as_view(),
        name="map_update",
    ),
    path(
        "map/<int:map_id>/update/permissions/",
        views.UpdateMapPermissions.as_view(),
        name="map_update_permissions",
    ),
    path(
        "map/<int:map_id>/update/delete/", views.MapDelete.as_view(), name="map_delete"
    ),
    path("map/<int:map_id>/update/clone/", views.MapClone.as_view(), name="map_clone"),
    path(
        "map/<int:map_id>/datalayer/create/<uuid:pk>/",
        views.DataLayerCreate.as_view(),
        name="datalayer_create",
    ),
    path(
        "map/<int:map_id>/ws-token/",
        views.get_websocket_auth_token,
        name="map_websocket_auth_token",
    ),
]
anonymous_owner_urls = [
    path(
        "map/<int:map_id>/update/owner/",
        views.AttachAnonymousMap.as_view(),
        name="map_attach_owner",
    ),
]
if settings.DEFAULT_FROM_EMAIL:
    anonymous_owner_urls.append(
        path(
            "map/<int:map_id>/send-edit-link/",
            views.SendEditLink.as_view(),
            name="map_send_edit_link",
        )
    )
datalayer_urls = [
    path(
        "map/<int:map_id>/datalayer/update/<uuid:pk>/",
        views.DataLayerUpdate.as_view(),
        name="datalayer_update",
    ),
]
restricted_datalayer_urls = [
    path(
        "map/<int:map_id>/datalayer/delete/<uuid:pk>/",
        views.DataLayerDelete.as_view(),
        name="datalayer_delete",
    ),
    path(
        "map/<int:map_id>/datalayer/permissions/<uuid:pk>/",
        views.UpdateDataLayerPermissions.as_view(),
        name="datalayer_permissions",
    ),
]
i18n_urls += decorated_patterns([can_edit_map, never_cache], *map_urls)
i18n_urls += decorated_patterns(
    [can_edit_map, datalayer_belong_to_map, never_cache], *restricted_datalayer_urls
)
i18n_urls += decorated_patterns(
    [can_edit_datalayer, datalayer_belong_to_map, never_cache], *datalayer_urls
)
i18n_urls += decorated_patterns(
    [is_anonymous_owner, never_cache], *anonymous_owner_urls
)
i18n_urls += decorated_patterns([never_cache], *datalayer_urls)
urlpatterns += i18n_patterns(
    path("", views.home, name="home"),
    path("showcase/", cache_page(24 * 60 * 60)(views.showcase), name="maps_showcase"),
    path("search/", views.search, name="search"),
    path("about/", views.about, name="about"),
    path("user/<identifier>/stars/", views.user_stars, name="user_stars"),
    path("user/<identifier>/", views.user_maps, name="user_maps"),
    path("team/<int:pk>/", views.TeamMaps.as_view(), name="team_maps"),
    path("", include(i18n_urls)),
)
urlpatterns += (
    path("stats/", cache_page(60 * 60)(views.stats), name="stats"),
    path("design_system/", views.design_system, name="design_system"),
    path(
        "favicon.ico",
        cache_control(max_age=60 * 60 * 24, immutable=True, public=True)(
            RedirectView.as_view(
                url=staticfiles_storage.url("umap/favicons/favicon.ico")
            )
        ),
    ),
    path(
        "manifest.webmanifest",
        cache_control(max_age=60 * 60 * 24, immutable=True, public=True)(
            views.webmanifest
        ),
    ),
)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()
for urlpath, lookup_view, name in settings.EXTRA_URL_PATTERNS:
    view = get_callable(lookup_view)
    if hasattr(view, "as_view"):
        view = view.as_view()
    urlpatterns += (path(urlpath, view, name=name),)

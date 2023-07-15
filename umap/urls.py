from django.conf import settings
from django.urls import include, path, re_path
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.decorators.cache import cache_control, cache_page, never_cache
from django.views.decorators.csrf import ensure_csrf_cookie

from . import views
from .decorators import (
    jsonize_view,
    login_required_if_not_anonymous_allowed,
    map_permissions_check,
)
from .utils import decorated_patterns

admin.autodiscover()

urlpatterns = [
    re_path(r"^admin/", admin.site.urls),
    re_path("", include("social_django.urls", namespace="social")),
    re_path(r"^m/(?P<pk>\d+)/$", views.MapShortUrl.as_view(), name="map_short_url"),
    re_path(r"^ajax-proxy/$", cache_page(180)(views.ajax_proxy), name="ajax-proxy"),
    re_path(
        r"^change-password/",
        auth_views.PasswordChangeView.as_view(),
        {"template_name": "umap/password_change.html"},
        name="password_change",
    ),
    re_path(
        r"^change-password-done/",
        auth_views.PasswordChangeDoneView.as_view(),
        {"template_name": "umap/password_change_done.html"},
        name="password_change_done",
    ),
    re_path(r"^i18n/", include("django.conf.urls.i18n")),
    re_path(r"^agnocomplete/", include("agnocomplete.urls")),
]

i18n_urls = [
    re_path(r"^login/$", jsonize_view(auth_views.LoginView.as_view()), name="login"),
    re_path(
        r"^login/popup/end/$", views.LoginPopupEnd.as_view(), name="login_popup_end"
    ),
    re_path(r"^logout/$", views.logout, name="logout"),
    re_path(
        r"^map/(?P<pk>\d+)/geojson/$",
        views.MapViewGeoJSON.as_view(),
        name="map_geojson",
    ),
    re_path(
        r"^map/anonymous-edit/(?P<signature>.+)$",
        views.MapAnonymousEditUrl.as_view(),
        name="map_anonymous_edit_url",
    ),
    re_path(
        r"^pictogram/json/$",
        views.PictogramJSONList.as_view(),
        name="pictogram_list_json",
    ),
]
i18n_urls += decorated_patterns(
    cache_control(must_revalidate=True),
    re_path(
        r"^datalayer/(?P<pk>[\d]+)/$",
        views.DataLayerView.as_view(),
        name="datalayer_view",
    ),
    re_path(
        r"^datalayer/(?P<pk>[\d]+)/versions/$",
        views.DataLayerVersions.as_view(),
        name="datalayer_versions",
    ),
    re_path(
        r"^datalayer/(?P<pk>[\d]+)/(?P<name>[_\w]+.geojson)$",
        views.DataLayerVersion.as_view(),
        name="datalayer_version",
    ),
)
i18n_urls += decorated_patterns(
    [ensure_csrf_cookie],
    re_path(
        r"^map/(?P<slug>[-_\w]+)_(?P<pk>\d+)$", views.MapView.as_view(), name="map"
    ),
    re_path(r"^map/new/$", views.MapNew.as_view(), name="map_new"),
)
i18n_urls += decorated_patterns(
    [login_required_if_not_anonymous_allowed, never_cache],
    re_path(r"^map/create/$", views.MapCreate.as_view(), name="map_create"),
)
i18n_urls += decorated_patterns(
    [login_required],
    re_path(
        r"^map/(?P<map_id>[\d]+)/star/$",
        views.ToggleMapStarStatus.as_view(),
        name="map_star",
    ),
    re_path(
        r"^me$",
        views.user_dashboard,
        name="user_dashboard",
    ),
)
map_urls = [
    re_path(
        r"^map/(?P<map_id>[\d]+)/update/settings/$",
        views.MapUpdate.as_view(),
        name="map_update",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/update/permissions/$",
        views.UpdateMapPermissions.as_view(),
        name="map_update_permissions",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/update/owner/$",
        views.AttachAnonymousMap.as_view(),
        name="map_attach_owner",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/update/delete/$",
        views.MapDelete.as_view(),
        name="map_delete",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/update/clone/$",
        views.MapClone.as_view(),
        name="map_clone",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/datalayer/create/$",
        views.DataLayerCreate.as_view(),
        name="datalayer_create",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/datalayer/update/(?P<pk>\d+)/$",
        views.DataLayerUpdate.as_view(),
        name="datalayer_update",
    ),
    re_path(
        r"^map/(?P<map_id>[\d]+)/datalayer/delete/(?P<pk>\d+)/$",
        views.DataLayerDelete.as_view(),
        name="datalayer_delete",
    ),
]
if settings.FROM_EMAIL:
    map_urls.append(
        re_path(
            r"^map/(?P<map_id>[\d]+)/send-edit-link/$",
            views.SendEditLink.as_view(),
            name="map_send_edit_link",
        )
    )
i18n_urls += decorated_patterns([map_permissions_check, never_cache], *map_urls)
urlpatterns += i18n_patterns(
    re_path(r"^$", views.home, name="home"),
    re_path(
        r"^showcase/$", cache_page(24 * 60 * 60)(views.showcase), name="maps_showcase"
    ),
    re_path(r"^search/$", views.search, name="search"),
    re_path(r"^about/$", views.about, name="about"),
    re_path(r"^user/(?P<identifier>.+)/stars/$", views.user_stars, name="user_stars"),
    re_path(r"^user/(?P<identifier>.+)/$", views.user_maps, name="user_maps"),
    re_path(r"", include(i18n_urls)),
)
urlpatterns += (path("stats/", cache_page(60 * 60)(views.stats), name="stats"),)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()

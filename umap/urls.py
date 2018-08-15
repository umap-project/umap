from django.conf import settings
from django.conf.urls import include, url
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.decorators.cache import (cache_control, cache_page,
                                           never_cache)
from django.views.decorators.csrf import ensure_csrf_cookie

from . import views
from .decorators import (jsonize_view, login_required_if_not_anonymous_allowed,
                         map_permissions_check)
from .utils import decorated_patterns

admin.autodiscover()

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url('', include('social_django.urls', namespace='social')),
    url(r'^m/(?P<pk>\d+)/$', views.MapShortUrl.as_view(),
        name='map_short_url'),
    url(r'^ajax-proxy/$', cache_page(180)(views.ajax_proxy),
        name='ajax-proxy'),
    url(r'^change-password/', auth_views.PasswordChangeView.as_view(),
        {'template_name': 'umap/password_change.html'},
        name='password_change'),
    url(r'^change-password-done/', auth_views.PasswordChangeDoneView.as_view(),
        {'template_name': 'umap/password_change_done.html'},
        name='password_change_done'),
    url(r'^i18n/', include('django.conf.urls.i18n')),
    url(r'^agnocomplete/', include('agnocomplete.urls')),
]

i18n_urls = [
    url(r'^login/$', jsonize_view(auth_views.LoginView.as_view()), name='login'),  # noqa
    url(r'^login/popup/end/$', views.LoginPopupEnd.as_view(),
        name='login_popup_end'),
    url(r'^logout/$', views.logout, name='logout'),
    url(r'^map/(?P<pk>\d+)/geojson/$', views.MapViewGeoJSON.as_view(),
        name='map_geojson'),
    url(r'^map/anonymous-edit/(?P<signature>.+)$',
        views.MapAnonymousEditUrl.as_view(), name='map_anonymous_edit_url'),
    url(r'^pictogram/json/$', views.PictogramJSONList.as_view(),
        name='pictogram_list_json'),
]
i18n_urls += decorated_patterns(cache_control(must_revalidate=True),
    url(r'^datalayer/(?P<pk>[\d]+)/$', views.DataLayerView.as_view(), name='datalayer_view'),  # noqa
    url(r'^datalayer/(?P<pk>[\d]+)/versions/$', views.DataLayerVersions.as_view(), name='datalayer_versions'),  # noqa
    url(r'^datalayer/(?P<pk>[\d]+)/(?P<name>[_\w]+.geojson)$', views.DataLayerVersion.as_view(), name='datalayer_version'),  # noqa
)
i18n_urls += decorated_patterns([ensure_csrf_cookie],
    url(r'^map/(?P<slug>[-_\w]+)_(?P<pk>\d+)$', views.MapView.as_view(), name='map'),  # noqa
    url(r'^map/new/$', views.MapNew.as_view(), name='map_new'),
)
i18n_urls += decorated_patterns(
    [login_required_if_not_anonymous_allowed, never_cache],
    url(r'^map/create/$', views.MapCreate.as_view(), name='map_create'),
)
i18n_urls += decorated_patterns(
    [map_permissions_check, never_cache],
    url(r'^map/(?P<map_id>[\d]+)/update/settings/$', views.MapUpdate.as_view(),
        name='map_update'),
    url(r'^map/(?P<map_id>[\d]+)/update/permissions/$',
        views.UpdateMapPermissions.as_view(), name='map_update_permissions'),
    url(r'^map/(?P<map_id>[\d]+)/update/owner/$',
        views.AttachAnonymousMap.as_view(), name='map_attach_owner'),
    url(r'^map/(?P<map_id>[\d]+)/update/delete/$',
        views.MapDelete.as_view(), name='map_delete'),
    url(r'^map/(?P<map_id>[\d]+)/update/clone/$',
        views.MapClone.as_view(), name='map_clone'),
    url(r'^map/(?P<map_id>[\d]+)/datalayer/create/$',
        views.DataLayerCreate.as_view(), name='datalayer_create'),
    url(r'^map/(?P<map_id>[\d]+)/datalayer/update/(?P<pk>\d+)/$',
        views.DataLayerUpdate.as_view(), name='datalayer_update'),
    url(r'^map/(?P<map_id>[\d]+)/datalayer/delete/(?P<pk>\d+)/$',
        views.DataLayerDelete.as_view(), name='datalayer_delete'),
)
urlpatterns += i18n_patterns(
    url(r'^$', views.home, name="home"),
    url(r'^showcase/$', cache_page(24 * 60 * 60)(views.showcase),
        name='maps_showcase'),
    url(r'^search/$', views.search, name="search"),
    url(r'^about/$', views.about, name="about"),
    url(r'^user/(?P<username>[-_\w@]+)/$', views.user_maps, name='user_maps'),
    url(r'', include(i18n_urls)),
)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()

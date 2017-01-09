from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls import url, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib import admin
from django.views.decorators.cache import cache_page
from django.contrib.auth import views as auth_views

from leaflet_storage.views import MapShortUrl

from . import views

admin.autodiscover()

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url('', include('social_django.urls', namespace='social')),
    url(r'^m/(?P<pk>\d+)/$', MapShortUrl.as_view(), name='umap_short_url'),
    url(r'^ajax-proxy/$', cache_page(180)(views.ajax_proxy),
        name='ajax-proxy'),
    url(r'^change-password/', auth_views.password_change,
        {'template_name': 'umap/password_change.html'},
        name='password_change'),
    url(r'^change-password-done/', auth_views.password_change_done,
        {'template_name': 'umap/password_change_done.html'},
        name='password_change_done'),
]
urlpatterns += i18n_patterns(
    url(r'^$', views.home, name="home"),
    url(r'^showcase/$', cache_page(24 * 60 * 60)(views.showcase),
        name='maps_showcase'),
    url(r'^search/$', views.search, name="search"),
    url(r'^about/$', views.about, name="about"),
    url(r'^user/(?P<username>[-_\w@]+)/$', views.user_maps, name='user_maps'),
    url(r'', include('leaflet_storage.urls')),
)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()

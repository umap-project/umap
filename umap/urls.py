from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.defaults import patterns, url, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib import admin

from leaflet_storage.views import MapShortUrl

from . import views

admin.autodiscover()

urlpatterns = patterns('',
    (r'^admin/', include(admin.site.urls)),
    url(r'', include('social_auth.urls')),
    # We don't want it to be localized
    url(r'^m/(?P<pk>\d+)/$', MapShortUrl.as_view(), name='map_short_url'),
)
urlpatterns += i18n_patterns('',
    url(r'^$', views.home, name="home"),
    url(r'^search/$', views.search, name="search"),
    url(r'^about/$', views.about, name="about"),
    url(r'^user/(?P<username>[-_\w]+)/$', views.user_maps, name='user_maps'),
    (r'', include('leaflet_storage.urls')),
)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()

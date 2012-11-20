from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.defaults import patterns, url, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

from django.contrib import admin

from . import views

admin.autodiscover()

urlpatterns = patterns('',
   # (r'', include('youmap.apps.')),
    (r'^admin/doc/', include('django.contrib.admindocs.urls')),
    (r'^admin/', include(admin.site.urls)),
    url(r'^$', views.home, name="home"),
    (r'', include('chickpea.urls')),
)

if settings.DEBUG and settings.MEDIA_ROOT:
    urlpatterns += static(settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT)
urlpatterns += staticfiles_urlpatterns()

from django.contrib.gis import admin
from .models import Map, DataLayer, Pictogram, TileLayer, Licence


class TileLayerAdmin(admin.ModelAdmin):
    list_display = ('name', 'rank', )
    list_editable = ('rank', )

admin.site.register(Map, admin.OSMGeoAdmin)
admin.site.register(DataLayer)
admin.site.register(Pictogram)
admin.site.register(TileLayer, TileLayerAdmin)
admin.site.register(Licence)

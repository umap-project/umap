from django.contrib.gis import admin
from .models import Map, DataLayer, Pictogram, TileLayer, Licence


class TileLayerAdmin(admin.ModelAdmin):
    list_display = ('name', 'rank', )
    list_editable = ('rank', )


class MapAdmin(admin.GISModelAdmin):
    search_fields = ("name",)
    autocomplete_fields = ("owner", "editors")
    list_filter = ("share_status",)


admin.site.register(Map, MapAdmin)
admin.site.register(DataLayer)
admin.site.register(Pictogram)
admin.site.register(TileLayer, TileLayerAdmin)
admin.site.register(Licence)

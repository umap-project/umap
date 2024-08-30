from django.contrib.gis import admin

from .models import DataLayer, Licence, Map, Pictogram, Team, TileLayer


class TileLayerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "rank",
    )
    list_editable = ("rank",)


class MapAdmin(admin.GISModelAdmin):
    search_fields = ("name",)
    autocomplete_fields = ("owner", "editors")
    list_filter = ("share_status",)


class PictogramAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
    )
    list_editable = ("category",)
    list_filter = ("category",)


class TeamAdmin(admin.ModelAdmin):
    filter_horizontal = ("users",)


admin.site.register(Map, MapAdmin)
admin.site.register(DataLayer)
admin.site.register(Pictogram, PictogramAdmin)
admin.site.register(TileLayer, TileLayerAdmin)
admin.site.register(Licence)
admin.site.register(Team, TeamAdmin)

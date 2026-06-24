import csv
from datetime import datetime

from django.contrib import admin as djadmin
from django.contrib.auth.admin import UserAdmin as UserAdminBase
from django.contrib.auth.models import User
from django.contrib.gis import admin
from django.http import HttpResponse
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from .models import DataLayer, Licence, Map, Pictogram, Team, TileLayer

admin.site.disable_action("delete_selected")


class CSVExportMixin:
    actions = ["as_csv"]

    @admin.action(description=_("CSV Export"))
    def as_csv(self, request, queryset):
        modelname = queryset.model.__name__.lower()
        filename = f"umap_{modelname}_{datetime.now().isoformat()}.csv"
        response = HttpResponse(
            content_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

        def get_cell(user, field):
            if hasattr(self, field):
                return getattr(self, field)(user)
            return getattr(user, field)

        writer = csv.writer(response)
        writer.writerow(self.csv_fields)
        for user in queryset:
            writer.writerow(get_cell(user, field) for field in self.csv_fields)
        return response


class TileLayerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "rank",
    )
    list_editable = ("rank",)


class MapAdmin(CSVExportMixin, admin.GISModelAdmin):
    search_fields = ("name", "id")
    autocomplete_fields = ("owner", "editors")
    list_filter = (
        "share_status",
        "is_template",
        ("owner", djadmin.EmptyFieldListFilter),
    )
    list_display = ["id", "name", "share_status", "edit_status", "edit_link"]
    actions = ["trash_maps", "block_maps", "restore_maps"]
    csv_fields = (
        "pk",
        "name",
        "center",
        "zoom",
        "created_at",
        "modified_at",
        "edit_status",
        "share_status",
        "owner_id",
        "team_id",
    )
    empty_value_display = "&lt;anonymous>"

    @admin.action(description="Move selected maps to trash")
    def trash_maps(modeladmin, request, queryset):
        queryset.update(share_status=Map.DELETED)

    @admin.action(description="Block selected maps")
    def block_maps(modeladmin, request, queryset):
        queryset.update(share_status=Map.BLOCK)

    @admin.action(description="Restore selected maps")
    def restore_maps(modeladmin, request, queryset):
        queryset.update(share_status=Map.DRAFT)

    def edit_link(self, obj):
        if not obj.owner:
            return format_html(
                '<a href="{}">Secret edit link</a>',
                obj.get_anonymous_edit_url(),
            )
        return obj.owner

    edit_link.allow_tags = True


class PictogramAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
    )
    list_editable = ("category",)
    list_filter = ("category",)


class TeamAdmin(CSVExportMixin, admin.ModelAdmin):
    csv_fields = [
        "pk",
        "name",
        "users_count",
    ]
    list_display = list(admin.ModelAdmin.list_display) + ["users_count"]
    filter_horizontal = ("users",)

    def users_count(self, obj):
        return obj.users.count()


class UserAdmin(CSVExportMixin, UserAdminBase):
    csv_fields = [
        "pk",
        "username",
        "email",
        "first_name",
        "last_name",
        "last_login",
        "date_joined",
        "maps_count",
        "user_teams",
    ]
    list_display = list(UserAdminBase.list_display) + [
        "maps_count",
        "user_teams",
        "last_maps",
    ]

    def last_maps(self, obj):
        maps = obj.owned_maps.order_by("-modified_at")[:10]
        output = []
        for map in maps:
            url = reverse("admin:umap_map_change", args=(map.pk,))
            output.append(f'<a href="{url}">{map.name}</a>')
        output = ", ".join(output)
        if len(maps) == 10:
            output += "…"
        return format_html(output)

    last_maps.allow_tags = True

    def maps_count(self, obj):
        # owner maps + maps as editor
        return obj.owned_maps.count() + obj.map_set.count()

    def user_teams(self, obj):
        return " ; ".join(obj.teams.values_list("name", flat=True))


admin.site.register(Map, MapAdmin)
admin.site.register(DataLayer)
admin.site.register(Pictogram, PictogramAdmin)
admin.site.register(TileLayer, TileLayerAdmin)
admin.site.register(Licence)
admin.site.register(Team, TeamAdmin)
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

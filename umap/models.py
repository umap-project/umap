import os
import time

from django.contrib.auth.models import User
from django.contrib.gis.db import models
from django.conf import settings
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.core.signing import Signer
from django.template.defaultfilters import slugify
from django.core.files.base import File

from .managers import PublicManager


# Did not find a clean way to do this in Django
# - creating a Proxy model would mean replacing get_user_model by this proxy model
#   in every template
# - extending User model woulc mean a non trivial migration
def display_name(self):
    return settings.USER_DISPLAY_NAME.format(**self.__dict__)


def get_user_url(self):
    identifier = getattr(self, settings.USER_URL_FIELD)
    return reverse(settings.USER_MAPS_URL, kwargs={"identifier": identifier})


def get_user_stars_url(self):
    identifier = getattr(self, settings.USER_URL_FIELD)
    return reverse("user_stars", kwargs={"identifier": identifier})


User.add_to_class("__str__", display_name)
User.add_to_class("get_url", get_user_url)
User.add_to_class("get_stars_url", get_user_stars_url)


class NamedModel(models.Model):
    name = models.CharField(max_length=200, verbose_name=_("name"))

    class Meta:
        abstract = True
        ordering = ("name",)

    def __unicode__(self):
        return self.name

    def __str__(self):
        return self.name


def get_default_licence():
    """
    Returns a default Licence, creates it if it doesn't exist.
    Needed to prevent a licence deletion from deleting all the linked
    maps.
    """
    return Licence.objects.get_or_create(
        # can't use ugettext_lazy for database storage, see #13965
        name=getattr(settings, "UMAP_DEFAULT_LICENCE_NAME", "No licence set")
    )[0]


class Licence(NamedModel):
    """
    The licence one map is published on.
    """

    details = models.URLField(
        verbose_name=_("details"),
        help_text=_("Link to a page where the licence is detailed."),
    )

    @property
    def json(self):
        return {"name": self.name, "url": self.details}


class TileLayer(NamedModel):
    url_template = models.CharField(
        max_length=200, help_text=_("URL template using OSM tile format")
    )
    minZoom = models.IntegerField(default=0)
    maxZoom = models.IntegerField(default=18)
    attribution = models.CharField(max_length=300)
    rank = models.SmallIntegerField(
        blank=True, null=True, help_text=_("Order of the tilelayers in the edit box")
    )
    # See https://wiki.openstreetmap.org/wiki/TMS#The_Y_coordinate
    tms = models.BooleanField(default=False)

    @property
    def json(self):
        return dict(
            (field.name, getattr(self, field.name)) for field in self._meta.fields
        )

    @classmethod
    def get_default(cls):
        """
        Returns the default tile layer (used for a map when no layer is set).
        """
        return cls.objects.order_by("rank")[0]  # FIXME, make it administrable

    @classmethod
    def get_list(cls):
        default = cls.get_default()
        l = []
        for t in cls.objects.all():
            fields = t.json
            if default and default.pk == t.pk:
                fields["selected"] = True
            l.append(fields)
        return l

    class Meta:
        ordering = ("rank", "name")


class Map(NamedModel):
    """
    A single thematical map.
    """

    ANONYMOUS = 1
    EDITORS = 2
    OWNER = 3
    PUBLIC = 1
    OPEN = 2
    PRIVATE = 3
    BLOCKED = 9
    EDIT_STATUS = (
        (ANONYMOUS, _("Everyone")),
        (EDITORS, _("Editors only")),
        (OWNER, _("Owner only")),
    )
    SHARE_STATUS = (
        (PUBLIC, _("Everyone (public)")),
        (OPEN, _("Anyone with link")),
        (PRIVATE, _("Editors only")),
        (BLOCKED, _("Blocked")),
    )
    slug = models.SlugField(db_index=True)
    description = models.TextField(blank=True, null=True, verbose_name=_("description"))
    center = models.PointField(geography=True, verbose_name=_("center"))
    zoom = models.IntegerField(default=7, verbose_name=_("zoom"))
    locate = models.BooleanField(
        default=False, verbose_name=_("locate"), help_text=_("Locate user on load?")
    )
    licence = models.ForeignKey(
        Licence,
        help_text=_("Choose the map licence."),
        verbose_name=_("licence"),
        on_delete=models.SET_DEFAULT,
        default=get_default_licence,
    )
    modified_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        related_name="owned_maps",
        verbose_name=_("owner"),
        on_delete=models.PROTECT,
    )
    editors = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, verbose_name=_("editors")
    )
    edit_status = models.SmallIntegerField(
        choices=EDIT_STATUS, default=OWNER, verbose_name=_("edit status")
    )
    share_status = models.SmallIntegerField(
        choices=SHARE_STATUS, default=PUBLIC, verbose_name=_("share status")
    )
    settings = models.JSONField(
        blank=True, null=True, verbose_name=_("settings"), default=dict
    )

    objects = models.Manager()
    public = PublicManager()

    def get_absolute_url(self):
        return reverse("map", kwargs={"slug": self.slug or "map", "pk": self.pk})

    def get_anonymous_edit_url(self):
        signer = Signer()
        signature = signer.sign(self.pk)
        path = reverse("map_anonymous_edit_url", kwargs={"signature": signature})
        return settings.SITE_URL + path

    def is_anonymous_owner(self, request):
        if self.owner:
            # edit cookies are only valid while map hasn't owner
            return False
        key, value = self.signed_cookie_elements
        try:
            has_anonymous_cookie = int(request.get_signed_cookie(key, False)) == value
        except ValueError:
            has_anonymous_cookie = False
        return has_anonymous_cookie

    def can_edit(self, user=None, request=None):
        """
        Define if a user can edit or not the instance, according to his account
        or the request.
        """
        can = False
        if request and not self.owner:
            if getattr(
                settings, "UMAP_ALLOW_ANONYMOUS", False
            ) and self.is_anonymous_owner(request):
                can = True
        if self.edit_status == self.ANONYMOUS:
            can = True
        elif not user.is_authenticated:
            pass
        elif user == self.owner:
            can = True
        elif self.edit_status == self.EDITORS and user in self.editors.all():
            can = True
        return can

    def can_view(self, request):
        if self.share_status == self.BLOCKED:
            can = False
        elif self.owner is None:
            can = True
        elif self.share_status in [self.PUBLIC, self.OPEN]:
            can = True
        elif request.user == self.owner:
            can = True
        else:
            can = not (
                self.share_status == self.PRIVATE
                and request.user not in self.editors.all()
            )
        return can

    @property
    def signed_cookie_elements(self):
        return ("anonymous_owner|%s" % self.pk, self.pk)

    def get_tilelayer(self):
        return self.tilelayer or TileLayer.get_default()

    def clone(self, **kwargs):
        new = self.__class__.objects.get(pk=self.pk)
        new.pk = None
        new.name = "%s %s" % (_("Clone of"), self.name)
        if "owner" in kwargs:
            # can be None in case of anonymous cloning
            new.owner = kwargs["owner"]
        new.save()
        for editor in self.editors.all():
            new.editors.add(editor)
        for datalayer in self.datalayer_set.all():
            datalayer.clone(map_inst=new)
        return new


class Pictogram(NamedModel):
    """
    An image added to an icon of the map.
    """

    attribution = models.CharField(max_length=300)
    pictogram = models.ImageField(upload_to="pictogram")

    @property
    def json(self):
        return {
            "id": self.pk,
            "attribution": self.attribution,
            "name": self.name,
            "src": self.pictogram.url,
        }


# Must be out of Datalayer for Django migration to run, because of python 2
# serialize limitations.
def upload_to(instance, filename):
    if instance.pk:
        return instance.upload_to()
    name = "%s.geojson" % slugify(instance.name)[:50] or "untitled"
    return os.path.join(instance.storage_root(), name)


class DataLayer(NamedModel):
    """
    Layer to store Features in.
    """

    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    description = models.TextField(blank=True, null=True, verbose_name=_("description"))
    geojson = models.FileField(upload_to=upload_to, blank=True, null=True)
    display_on_load = models.BooleanField(
        default=False,
        verbose_name=_("display on load"),
        help_text=_("Display this layer on load."),
    )
    rank = models.SmallIntegerField(default=0)

    class Meta:
        ordering = ("rank",)

    def save(self, force_insert=False, force_update=False, **kwargs):
        is_new = not bool(self.pk)
        super(DataLayer, self).save(force_insert, force_update, **kwargs)

        if is_new:
            force_insert, force_update = False, True
            filename = self.upload_to()
            old_name = self.geojson.name
            new_name = self.geojson.storage.save(filename, self.geojson)
            self.geojson.storage.delete(old_name)
            self.geojson.name = new_name
            super(DataLayer, self).save(force_insert, force_update, **kwargs)
        self.purge_old_versions()

    def upload_to(self):
        root = self.storage_root()
        name = "%s_%s.geojson" % (self.pk, int(time.time() * 1000))
        return os.path.join(root, name)

    def storage_root(self):
        path = ["datalayer", str(self.map.pk)[-1]]
        if len(str(self.map.pk)) > 1:
            path.append(str(self.map.pk)[-2])
        path.append(str(self.map.pk))
        return os.path.join(*path)

    @property
    def metadata(self):
        return {"name": self.name, "id": self.pk, "displayOnLoad": self.display_on_load}

    def clone(self, map_inst=None):
        new = self.__class__.objects.get(pk=self.pk)
        new.pk = None
        if map_inst:
            new.map = map_inst
        new.geojson = File(new.geojson.file.file)
        new.save()
        return new

    def is_valid_version(self, name):
        return name.startswith("%s_" % self.pk) and name.endswith(".geojson")

    def version_metadata(self, name):
        els = name.split(".")[0].split("_")
        return {
            "name": name,
            "at": els[1],
            "size": self.geojson.storage.size(self.get_version_path(name)),
        }

    def get_versions(self):
        root = self.storage_root()
        names = self.geojson.storage.listdir(root)[1]
        names = [name for name in names if self.is_valid_version(name)]
        names.sort(reverse=True)  # Recent first.
        return names

    @property
    def versions(self):
        names = self.get_versions()
        return [self.version_metadata(name) for name in names]

    def get_version(self, name):
        path = self.get_version_path(name)
        with self.geojson.storage.open(path, "r") as f:
            return f.read()

    def get_version_path(self, name):
        return "{root}/{name}".format(root=self.storage_root(), name=name)

    def purge_old_versions(self):
        root = self.storage_root()
        names = self.get_versions()[settings.UMAP_KEEP_VERSIONS :]
        for name in names:
            for ext in ["", ".gz"]:
                path = os.path.join(root, name + ext)
                try:
                    self.geojson.storage.delete(path)
                except FileNotFoundError:
                    pass


class Star(models.Model):
    at = models.DateTimeField(auto_now=True)
    map = models.ForeignKey(Map, on_delete=models.CASCADE)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="stars", on_delete=models.CASCADE
    )

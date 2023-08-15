# Configuration

uMap runs with Django, so any Django setting should work, if you know what you
are doing.

The Django settings reference is here: https://docs.djangoproject.com/en/4.2/ref/settings/

Here are a few relevent settings for uMap.

## Usage

Those settings should either:

- be in `/etc/umap/umap.conf`, which uMap will try to load by default
- be in a random place on your server, which is then reference with the
  `UMAP_SETTINGS` env var
- be declared as env vars directly, for simple ones (string/boolean/list)

#### ALLOWED_HOSTS

The hosts that uMap expects.
`ALLOWED_HOSTS = ['umap.mydomain.org']`

Can be set through env var too: `ALLOWED_HOSTS=umap.mydomain.org,u.mydomain.org`

#### DEBUG

Set it to True for easier debugging in case of error.

#### EMAIL_BACKEND

Must be configured if you want uMap to send emails to anonymous users.

See [Emails](install.md#emails) for more details.

#### ENABLE_ACCOUNT_LOGIN

Do you want users to be able to create an account directly on your uMap instance
(instead of only using OAuth).

Can be set through env var: `ENABLE_ACCOUNT_LOGIN=1`

#### FROM_EMAIL

See `EMAIL_BACKEND`.

#### LANGUAGE_CODE

Set it to the default language you want. `LANGUAGE_CODE = "it"`

#### LEAFLET_LONGITUDE, LEAFLET_LATITUDE, LEAFLET_ZOOM

Default longitude, latitude and zoom for the map

#### MEDIA_ROOT

Where uMap should store your datalayers and icons, must be consistent with your
Nginx configuration.

See [Django documentation for MEDIA_ROOT](https://docs.djangoproject.com/en/4.2/ref/settings/#media-root)

#### SECRET_KEY

Must be defined to something unique and secret.

#### SITE_URL

The final URL of you instance, including the protocol:

`SITE_URL=http://umap.org`


#### SHORT_SITE_URL

If you have a short domain for sharing links.

Eg.: `SHORT_SITE_URL=https://u.umap.org`


#### SITE_NAME

The name of the site, to be used in header and HTML title.


#### STATIC_ROOT

Where uMap should store static files (CSS, JS…), must be consistent with your
Nginx configuration.

See [Django documentation for STATIC_ROOT](https://docs.djangoproject.com/en/4.2/ref/settings/#static-root)

#### USE_I18N

Default is True. Set it to False if you don't want uMap to localize the app.

#### USER_AUTOCOMPLETE_FIELDS

Which fields to search when autocompleting users (in permissions).
Eg.: `USER_AUTOCOMPLETE_FIELDS = ["^username", "email"]`


#### USER_DISPLAY_NAME

Advanced setting for controling which user fields will be used for displaying
their name on the application, depending on which fields you collect with your
OAuth configuration.
For example: `USER_DISPLAY_NAME = "{username}"`

#### USER_URL_FIELD

Which field to be used in URL for user. Must be a unique field.

Eg.: `USER_URL_FIELD = "pk"`

#### UMAP_ALLOW_ANONYMOUS

Should uMap allows user without an account to create maps (default is False).

Can be set through env var: `UMAP_ALLOW_ANONYMOUS=1`

#### UMAP_CUSTOM_TEMPLATES
To be used when you want to override some HTML templates:

    UMAP_CUSTOM_TEMPLATES = "/path/to/custom/templates"

See [customization](custom.md) for details.

#### UMAP_CUSTOM_STATICS
To be used when you want to override some CSS or images:

    UMAP_CUSTOM_STATICS = "/path/to/custom/static"

See [customization](custom.md) for details.

#### UMAP_EXTRA_URLS

By default:
```
UMAP_EXTRA_URLS = {
    'routing': 'http://www.openstreetmap.org/directions?engine=osrm_car&route={lat},{lng}&locale={locale}#map={zoom}/{lat}/{lng}',
    'ajax_proxy': '/ajax-proxy/?url={url}&ttl={ttl}',
    'search': 'https://photon.komoot.io/api/?',
}
```

#### UMAP_KEEP_VERSIONS

How many datalayer versions to keep. 10 by default.


#### UMAP_DEFAULT_EDIT_STATUS

Define the map default edit status.
Possible values:

- 1 (Everyone)
- 2 (Editors only)
- 3 (Owner only)


#### UMAP_DEFAULT_SHARE_STATUS

Define the map default share status.
Possible values:

- 1 (Everyone (public))
- 2 (Anyone with link)
- 3 (Editors only)


#### UMAP_DEMO_SITE

Set to True if you want to display a message saying that your instance is not
ready for production use (no backup, etc.)

#### UMAP_FEEDBACK_LINK

Link to show on the header under the "Feedback and help" label.

#### UMAP_MAPS_PER_PAGE

How many maps to show in maps list, like search or home page.

#### UMAP_MAPS_PER_SEARCH

How many total maps to return in the search.

#### UMAP_MAPS_PER_PAGE_OWNER

How many maps to show in the user "my maps" page.

#### UMAP_SEARCH_CONFIGURATION

Use it if you take control over the search configuration.

See [search](install.md#search) for details.

#### UMAP_READONLY

Is your instance readonly? Useful for server maintenance.

#### UMAP_GZIP

Should uMap gzip datalayers geojson.

#### SOCIAL_AUTH_OPENSTREETMAP_KEY, SOCIAL_AUTH_OPENSTREETMAP_SECRET

If you use OpenStreetMap as OAuth provider, use those settings.

Otherwise, use any valid [python-social-auth configuration](https://python-social-auth.readthedocs.io/en/latest/configuration/django.html).

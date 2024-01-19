from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles.storage import ManifestStaticFilesStorage
from rcssmin import cssmin
from rjsmin import jsmin


class UmapManifestStaticFilesStorage(ManifestStaticFilesStorage):
    support_js_module_import_aggregation = True

    # We remove `;` at the end of all regexps to match our prettier config.
    _js_module_import_aggregation_patterns = (
        "*.js",
        (
            (
                (
                    r"""(?P<matched>import(?s:(?P<import>[\s\{].*?))"""
                    r"""\s*from\s*['"](?P<url>[\.\/].*?)["']\s*)"""
                ),
                'import%(import)s from "%(url)s"\n',
            ),
            (
                (
                    r"""(?P<matched>export(?s:(?P<exports>[\s\{].*?))"""
                    r"""\s*from\s*["'](?P<url>[\.\/].*?)["']\s*)"""
                ),
                'export%(exports)s from "%(url)s"\n',
            ),
            (
                r"""(?P<matched>import\s*['"](?P<url>[\.\/].*?)["']\s*)""",
                'import"%(url)s"\n',
            ),
            (
                r"""(?P<matched>import\(["'](?P<url>.*?)["']\))""",
                """import("%(url)s")""",
            ),
        ),
    )

    # https://github.com/django/django/blob/0fcee1676c7f14bb08e2cc662898dee56d9cf207↩
    # /django/contrib/staticfiles/storage.py#L78C5-L105C6
    patterns = (
        (
            "*.css",
            (
                r"""(?P<matched>url\(['"]{0,1}\s*(?P<url>.*?)["']{0,1}\))""",
                (
                    r"""(?P<matched>@import\s*["']\s*(?P<url>.*?)["'])""",
                    """@import url("%(url)s")""",
                ),
                # Remove CSS source map rewriting
            ),
        ),
        # Remove JS source map rewriting
    )

    def post_process(self, paths, **options):
        collected = super().post_process(paths, **options)
        for original_path, processed_path, processed in collected:
            if processed_path.endswith(".js"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                minified = jsmin(initial)
                path.write_text(minified)
            if processed_path.endswith(".css"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                minified = cssmin(initial)
                path.write_text(minified)
            yield original_path, processed_path, True

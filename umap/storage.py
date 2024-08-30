from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles.storage import ManifestStaticFilesStorage
from rcssmin import cssmin
from rjsmin import jsmin


class UmapManifestStaticFilesStorage(ManifestStaticFilesStorage):
    support_js_module_import_aggregation = True
    max_post_process_passes = 15

    # We remove `;` at the end of all regexps to match our biome config.
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
                r"""(?P<matched>import\(["'](?P<url>.*?)["']\)\.then)""",
                """import("%(url)s").then""",
            ),
            (
                r"""(?P<matched>await import\(["'](?P<url>.*?)["']\))""",
                """await import("%(url)s")""",
            ),
        ),
    )

    def post_process(self, paths, **options):
        collected = super().post_process(paths, **options)
        for original_path, processed_path, processed in collected:
            if isinstance(processed, Exception):
                print("Error with file", original_path)
                raise processed
            if processed_path.endswith(".js"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                if "sourceMappingURL" not in initial:  # Already minified.
                    minified = jsmin(initial)
                    path.write_text(minified)
            if processed_path.endswith(".css"):
                path = Path(settings.STATIC_ROOT) / processed_path
                initial = path.read_text()
                if "sourceMappingURL" not in initial:  # Already minified.
                    minified = cssmin(initial)
                    path.write_text(minified)
            yield original_path, processed_path, True

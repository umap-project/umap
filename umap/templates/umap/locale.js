const locale = {{ locale|safe }}
L.registerLocale("{{ locale_code }}", locale)
L.setLocale("{{ locale_code }}")

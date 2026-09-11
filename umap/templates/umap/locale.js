{% load static %}
import { registerLocale, setLocale } from '{% static "umap/dist/i18n.js" %}'

setLocale('{{ locale_code }}')
registerLocale('{{ locale_code }}', {{ locale|safe }})

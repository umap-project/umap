import json

import six
from django.db import models
from django.utils.encoding import smart_str


class DictField(models.TextField):
    """
    A very simple field to store JSON in db.
    """

    def get_prep_value(self, value):
        if not value:
            value = {}
        if not isinstance(value, six.string_types):
            value = json.dumps(value)
        return value

    def from_db_value(self, value, expression, connection):
        return self.to_python(value)

    def to_python(self, value):
        if not value:
            value = {}
        if isinstance(value, six.string_types):
            return json.loads(value)
        else:
            return value

    def value_to_string(self, obj):
        """Return value from object converted to string properly"""
        return smart_str(self.get_prep_value(self.value_from_object(obj)))

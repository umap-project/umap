# -*- coding: utf-8 -*-

# Copyright (c) Pilot Systems and Libération, 2010-2011

# This file is part of SeSQL.

# SeSQL is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 2 of the License, or
# (at your option) any later version.

# Foobar is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with SeSQL.  If not, see <http://www.gnu.org/licenses/>.

#
# Full text search configuration - we must define that before the imports,
# because those are used by the imports
#

# Name of the PostgreSQL Text Search Configuration
TS_CONFIG_NAME = "simple_french"

# Name of the stopwards file, must be plain ASCII
STOPWORDS_FILE = "ascii_french"

# Global charset to use
CHARSET = "utf-8"

from sesql.fields import *
from sesql.sources import *
from django.db.models import Q
from leaflet_storage import models

#
# Select the ORM to use
#
from sesql.orm.django import DjangoOrmAdapter
orm = DjangoOrmAdapter()


#
# Fields and tables configuration
#

# Configuration of SeSQL search fields
FIELDS = (ClassField("classname"),
          IntField("id"),
          DateField("modified_at"),
          FullTextField("name"),
          FullTextField("fulltext",
                        ['name', 'description',
                          SubField("owner", ["username"])
                          ],
                        primary=True,
                        ),
          DateField('indexed_at', sql_default='NOW()'),
          )

# Name of the global lookup table that should contain no real data
MASTER_TABLE_NAME = "sesql_index"

# Type map, associating Django classes to SeSQL tables
TYPE_MAP = ((models.Map, "sesql_default"), )

# Additional indexes to create
CROSS_INDEXES = ()

#
# Cleanup configuration
#

from htmlentitydefs import name2codepoint
from xml.sax import saxutils

html_entities = dict([('&%s;' % k, unichr(v).encode(CHARSET)) for k,v in name2codepoint.items() ])
ADDITIONAL_CLEANUP_FUNCTION = lambda value: saxutils.unescape(value, html_entities)

#
# Query configuration
#

# General condition to skip indexing content
SKIP_CONDITION = None

# Default sort order for queries
DEFAULT_ORDER = ('-modified_at',)

# Default LIMIT in short queries
DEFAULT_LIMIT = 20

# First we ask for the SMART_QUERY_INITIAL first sorted items
SMART_QUERY_INITIAL = 2500
# Then, if we have at least SMART_QUERY_THRESOLD of our limit, we go on
SMART_QUERY_THRESOLD = 0.35
# If we have a second query, we do * (wanted/result) * SMART_QUERY_RATIO
SMART_QUERY_RATIO = 3.0

#
# Long query cache configuration
#

# Maximal number of queries to store in the long query cache
QUERY_CACHE_MAX_SIZE = 10000
# Life time of a query in the query cache
QUERY_CACHE_EXPIRY = 24 * 3600

#
# Daemon configuration
#

DAEMON_DEFAULT_CHUNK = 100
DAEMON_DEFAULT_DELAY = 120
DAEMON_DEFAULT_PID = '/var/run/sesql/update.pid'

#
# Suggest/history configuration
#

# default number of hit before including query in db
HISTORY_DEFAULT_FILTER = 5

# erode factor for time-based decay of recent searches score
HISTORY_ALPHA = 0.95
# weight of frequency of the search in the final score
HISTORY_BETA = 1.0
# weight of number of results in the final score
HISTORY_GAMMA = 1.0

# queries to ignore in history
HISTORY_BLACKLIST = []


#
# Enable sesql searches from Django admin ?
#
ENABLE_SESQL_ADMIN = False

#
# Enable to force all updates to be processed asynchronously by the daemon
#

ASYNCHRONOUS_INDEXING = False

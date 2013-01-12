"""
OSM OAuth support.

This adds support for OSM OAuth service. An application must
be registered first on OSM and the settings OSM_CONSUMER_KEY
and OSM_CONSUMER_SECRET must be defined with the corresponding
values.

More info: http://wiki.openstreetmap.org/wiki/OAuth
"""
from xml.dom import minidom
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend, USERNAME

# OSM configuration
OSM_SERVER = 'http://www.openstreetmap.org/oauth'
OSM_REQUEST_TOKEN_URL = '%s/request_token' % OSM_SERVER
OSM_ACCESS_TOKEN_URL = '%s/access_token' % OSM_SERVER
OSM_AUTHORIZATION_URL = '%s/authorize' % OSM_SERVER
OSM_USER_DATA_URL = 'http://api.openstreetmap.org/api/0.6/user/details'


class OSMBackend(OAuthBackend):
    """OSM OAuth authentication backend"""
    name = 'openstreetmap'
    EXTRA_DATA = [
        ('username', 'username'),
    ]

    def get_user_details(self, response):
        """Return user details from OSM account"""
        return {USERNAME: response.get('username')}

    def get_user_id(self, details, response):
        """Return the user id, both email and username can change in OSM."""
        return response['id']


class OSMAuth(ConsumerBasedOAuth):
    """OSM OAuth authentication mechanism"""
    AUTHORIZATION_URL = OSM_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = OSM_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = OSM_ACCESS_TOKEN_URL
    AUTH_BACKEND = OSMBackend
    SETTINGS_KEY_NAME = 'OSM_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'OSM_CONSUMER_SECRET'

    def user_data(self, access_token):
        """Return user data provided"""
        url = OSM_USER_DATA_URL
        request = self.oauth_request(access_token, url)
        response = self.fetch_response(request)
        doc = minidom.parseString(response)
        user_node = doc.getElementsByTagName('user')[0]
        username = user_node.getAttribute('display_name')
        user_id = user_node.getAttribute('id')
        return {
            "username": username,
            "id": user_id
        }

# Backend definition
BACKENDS = {
    'openstreetmap': OSMAuth,
}

import socket

from django.test import TestCase, RequestFactory
from django.conf import settings
from django.core.urlresolvers import reverse

from umap.views import validate_url


class TestsValidateProxyURL(TestCase):

    def buildRequest(self, target="http://osm.org/georss.xml", verb="get", **kwargs):
        defaults = {
            'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest',
            'HTTP_REFERER': '%s/path/' % settings.SITE_URL
        }
        defaults.update(kwargs)
        func = getattr(RequestFactory(**defaults), verb)
        return func('/', {'url': target})

    def test_good_request_passes(self):
        target = "http://osm.org/georss.xml"
        request = self.buildRequest(target)
        url = validate_url(request)
        self.assertEquals(url, target)

    def test_no_url_raises(self):
        request = self.buildRequest("")
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_relative_url_raises(self):
        request = self.buildRequest("/just/a/path/")
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_file_uri_raises(self):
        request = self.buildRequest("file:///etc/passwd")
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_localhost_raises(self):
        request = self.buildRequest("http://localhost/path/")
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_local_IP_raises(self):
        url = "http://{}/path/".format(socket.gethostname())
        request = self.buildRequest(url)
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_POST_raises(self):
        request = self.buildRequest(verb="post")
        with self.assertRaises(AssertionError):
            validate_url(request)

    def test_unkown_domain_raises(self):
        request = self.buildRequest("http://xlkjdkjsdlkjfd.com")
        with self.assertRaises(AssertionError):
            validate_url(request)


class TestsProxy(TestCase):

    def test_valid_proxy_request(self):
        url = reverse('ajax-proxy')
        params = {'url': 'http://example.org'}
        headers = {
            'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest',
            'HTTP_REFERER': settings.SITE_URL
        }
        response = self.client.get(url, params, **headers)
        self.assertEquals(response.status_code, 200)
        self.assertIn('Example Domain', response.content)
        self.assertNotIn("Cookie", response['Vary'])

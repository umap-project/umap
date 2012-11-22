#!/usr/bin/env python
# -*- coding: utf-8 -*-

import codecs

from setuptools import setup, find_packages

import youmap

long_description = codecs.open('README.rst', "r", "utf-8").read()

setup(
    name="youmap",
    version=youmap.__version__,
    author=youmap.__author__,
    author_email=youmap.__contact__,
    description=youmap.__doc__,
    keywords="django leaflet geodjango openstreetmap",
    url=youmap.__homepage__,
    download_url="https://bitbucket.org/yohanboniface/youmap_project/downloads",
    packages=find_packages(),
    include_package_data=True,
    platforms=["any"],
    zip_safe=True,
    long_description=long_description,

    classifiers=[
        "Development Status :: 3 - Alpha",
        #"Environment :: Web Environment",
        "Intended Audience :: Developers",
        #"License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python",
    ],
)

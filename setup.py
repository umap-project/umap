#!/usr/bin/env python
# -*- coding: utf-8 -*-

import codecs

from setuptools import setup, find_packages

import umap

long_description = codecs.open('README.rst', "r", "utf-8").read()

setup(
    name="umap",
    version=umap.__version__,
    author=umap.__author__,
    author_email=umap.__contact__,
    description=umap.__doc__,
    keywords="django leaflet geodjango openstreetmap",
    url=umap.__homepage__,
    download_url="https://bitbucket.org/yohanboniface/umap/downloads",
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

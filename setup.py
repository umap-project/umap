#!/usr/bin/env python
# -*- coding: utf-8 -*-

import codecs
import io

from setuptools import setup, find_packages

import umap

long_description = codecs.open('README.md', "r", "utf-8").read()


def is_pkg(line):
    return line and not line.startswith(('--', 'git', '#'))


def reqs_to_list(filename):
    with io.open('requirements.txt', encoding='utf-8') as reqs:
        return [l for l in reqs.read().split('\n') if is_pkg(l)]


setup(
    name="umap-project",
    version=umap.__version__,
    author=umap.__author__,
    author_email=umap.__contact__,
    description=umap.__doc__,
    keywords="django leaflet geodjango openstreetmap",
    url=umap.__homepage__,
    packages=find_packages(),
    include_package_data=True,
    platforms=["any"],
    zip_safe=True,
    long_description=long_description,
    install_requires=reqs_to_list('requirements.txt'),
    extras_require={
        'dev': reqs_to_list('requirements-dev.txt'),
        'docker': reqs_to_list('requirements-docker.txt'),
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python",
    ],
    entry_points={
        'console_scripts': ['umap=umap.bin:main'],
    },
 )

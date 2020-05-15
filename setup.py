#!/usr/bin/env python

import io
from pathlib import Path

from setuptools import setup, find_packages

import umap


def is_pkg(line):
    return line and not line.startswith(('--', 'git', '#'))


with io.open('requirements.txt', encoding='utf-8') as reqs:
    install_requires = [l for l in reqs.read().split('\n') if is_pkg(l)]

setup(
    name="umap-project",
    version=umap.__version__,
    author=umap.__author__,
    author_email=umap.__contact__,
    description=umap.__doc__,
    keywords="django leaflet geodjango openstreetmap map",
    url=umap.__homepage__,
    packages=find_packages(),
    include_package_data=True,
    platforms=["any"],
    zip_safe=True,
    long_description=Path('README.md').read_text(),
    long_description_content_type='text/markdown',
    install_requires=install_requires,
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3 :: Only",
        "Programming Language :: Python :: 3.4",
        "Programming Language :: Python :: 3.5",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
    ],
    entry_points={
        'console_scripts': ['umap=umap.bin:main'],
    },
 )

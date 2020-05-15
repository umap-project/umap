# Installing uMap on Windows

The **good news** is that it is possible to run uMap server on Windows.  However, it is recommended using uMap on a 
Linux distribution as it will be easier to install, modify, and deploy.  While the following steps have been tested on
Windows 7, they may work for other versions of Windows.


## 1. Prepare the Database 

This assumes you've installed PostgreSQL.
- Create a database called "umap"
- Install PostGIS extension in it

##2. Create a directory and a Python virtual environment 

This assumes you've installed Python (version 3.8+ 64-bit is a good choice) and virtualenv.

Open a Windows command window, and cd to a directory of your choice.  You need to create a sub-directory but the name is
up to you (it doesn't need to be called "production"):
```
mkdir production
cd production
virtualenv venv
venv\Scripts\activate.bat
```

##3. Install GDAL for Python

It is really difficult to install GDAL the "standard" way since it requires compiling GDAL.  Instead download an already 
compiled pip-compatible wheel package file from 
[Unofficial Windows Binaries for Python Extension Packages](https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal).  Note 
that cp38 refers to the Python version you are using, so make sure you select the one that matches your Python version
for download.

In the command window, install the downloaded wheel package:
`pip install GDAL-3.0.4-cp38-cp38-win_amd64.whl`

You can test the install from the Python command line.  From the Windows command window invoke Python:
```
python
```
then enter some Python commands:
```python
>>> import gdal
>>> print(int(gdal.VersionInfo('VERSION_NUM')))
>>> exit()
```

##4. Install uMap

In the Windows command window:
```
mkdir static
mkdir data
pip install umap-project
```
***Windows Work-Around 1***

Setting the UMAP_SETTINGS environment variable doesn't seem to work on Windows, so put the file in umap's fall-back
location of \etc\umap\umap.conf :
```
mkdir \etc\umap
wget https://raw.githubusercontent.com/umap-project/umap/master/umap/settings/local.py.sample -O \etc\umap\umap.conf
```
Edit the umap.conf file:

***Windows Work-Around 2***

It might be possible to modify django's libgdal.py (umap installed django as one of its dependencies) to detect the 
installed GDAL, but until then you can explicitly state the required paths.

Add the GDAL paths somewhere near the top of the umap.conf file (make sure the last part, "gdal300", is the name of the 
GDAL DLL in its package dir):
```python
GDAL_LIBRARY_PATH = r'C:\temp\production\venv\Lib\site-packages\osgeo\gdal300'
GEOS_LIBRARY_PATH = r'C:\temp\production\venv\Lib\site-packages\osgeo\geos_c'
PROJ_LIB =          r'C:\temp\production\venv\Lib\site-packages\osgeo\data\proj'
```
And while you're editing umap.conf, add the needed parameters to the DATABASES default object :
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'umap',
        'USER': 'postgres',
        'PASSWORD': 'postgres',
        'HOST': 'localhost',
        'PORT': '5432'
    }
}
```
And set umap's paths to where you've created the directories:
```python
STATIC_ROOT = '/temp/production/static'
MEDIA_ROOT  = '/temp/production/data'
```
Now that the minimal configuration is done, you can do the django-ish portion of the umap install.  In the Windows 
command window:
```
umap migrate
umap collectstatic
umap createsuperuser
```

***Windows Work-Around 3***

Strangely, having the installed `umap.exe` is not enough.   Some script tries to execute "umap" without the ".exe" 
extension, so here's a hack to make that work:
```
copy venv\scripts\umap.exe venv\scripts\umap
```

##5. Run umap server
In the Windows command window:
```
umap runserver 127.0.0.1:8000
```
You should now be able to open a browser and go to http://127.0.0.1:8000

If  you add some features to a new map and try to save them, you will likely see an error in the Windows command window
running the umap server.   This error is a Python error related to doing 
`os.remove(name)` on Windows:
```
  File "c:\temp\test\venv\lib\site-packages\django\core\files\storage.py", line 303, in delete
    os.remove(name)
PermissionError: [WinError 32] The process cannot access the file because it is being used by another process: 
'C:\\temp\\production\\data\\datalayer\\1\\1\\layer-1.geojson'
```

***Windows Work-Around 4***

Edit `test\venv\lib\site-packages\django\core\files\storage.py`, and comment out lines 302 and 303:
```python
#            else:
#                os.remove(name)
```
Now adding features and saving should work.  _Now here's the weird part._   Edit `storage.py` to restore it to it's 
original state by removing the comment characters you put in.  Save the changes, do some more feature editing and 
saving in your browser.  It still works!  This may be due to file/directory locking by Windows.

##6. Installing for development

The previous sections describe the install procedure for running the released version of uMap "as-is".  If you want to 
modify uMap (and possibly contribute your changes back to the uMap team), have a look at [Contributing](contributing.md)
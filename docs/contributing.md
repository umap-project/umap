# Contributing

## Translating

Translation is managed through [Transifex](https://www.transifex.com/openstreetmap/umap/).

## Bug Triaging

You are very welcome to help us triaging [uMap issues](https://github.com/umap-project/umap/issues).

* Help other users by answering questions
* Give your point of view in discussions
* And so on...

## Development on Ubuntu

### Environment setup

Choose one of the following two config:

#### Config global to your desktop

Follow the procedure [Ubuntu from scratch](ubuntu.md)

But instead using folders /etc/umap, you can create a ~/.umap folder.
This folder will contain the umap.conf file.

And for folder /srv/umap, you can create a ~/umap folder (We will remove this folder later)

You will have to set an env var, we will set it in your .bashrc:

    nano ~/.bashrc

Add the following at the end of file:

```
# uMap
export UMAP_SETTINGS=~/.umap/umap.conf
```

Then refresh your terminal

    source ~/.bashrc

Run your local uMap and check that it is working properly.

#### Config inside your local git repo

Follow the procedure [Ubuntu from scratch](ubuntu.md)

You can use the local.py.sample in the git repo and copy it to your local git repo to umap/settings/local.py

See [Installation](install.md)

### Hacking on the code

Create a workspace folder `~/wk` and go into it.

"git clone" the main repository and go in the `umap/` folder.

Once you are in the `umap/` folder, create a Python virtual environment:

    python3 -m venv venv
    source venv/bin/activate

Now, the `umap` command will be available.

*Note: if you close your terminal, you will need to re-run that command from `~/wk/umap`:*

    source venv/bin/activate

To test your code, you will add to install umap from your git folder. Go to `~/wk/umap` and run:

    make install

This command will check dependencies and install uMap from sources inside folder.

When installing from the git repository, do not forget to run `make installjs` and `make vendors`, before running `umap collectstatic` (as mentioned in [Ubuntu from scratch](ubuntu.md)).

Create a PostgreSQL database and apply migrations to setup your database:

    createdb umap
    umap migrate

You should now be able to start your local uMap instance:

    umap runserver 0.0.0.0:8000

### Update translations

Install needed tools:

    apt install gettext transifex-client

Pull the translations from transifex website:

    tx pull -f

Then you will need to update binary files with command:

    make compilemessages

Done. You can now review and commit modified/added files.

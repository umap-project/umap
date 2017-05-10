from hashlib import md5
from io import StringIO
from pathlib import Path
from string import Template as BaseTemplate

from invoke import task


class Template(BaseTemplate):
    # Default delimiter ($) clashes at least with Nginx DSL.
    delimiter = '$$'


def render_template(path, **context):
    with Path(path).open() as f:
        template = Template(f.read())
        return StringIO(template.substitute(**context))


def as_user(ctx, user, cmd, *args, **kwargs):
    ctx.run('sudo --set-home --preserve-env --user {} '
            '{}'.format(user, cmd), *args, **kwargs)


def as_umap(ctx, cmd, *args, **kwargs):
    as_user(ctx, 'umap', cmd)


def as_postgres(ctx, cmd, *args, **kwargs):
    # We need to login as postgres to avoid a warning when not running the
    # command from a directory where postgres cannot cd (eg. /root).
    as_user(ctx, 'postgres --login', cmd)


def sudo_put(ctx, local, remote, chown=None):
    tmp = str(Path('/tmp') / md5(remote.encode()).hexdigest())
    ctx.put(local, tmp)
    ctx.run('sudo mv {} {}'.format(tmp, remote))
    if chown:
        ctx.run('sudo chown {} {}'.format(chown, remote))


@task
def umap_cmd(ctx, cmd):
    as_umap(ctx, '/srv/umap/venv/bin/umap {}'.format(cmd))


def put_dir(ctx, local, remote):
    local = Path(local)
    remote = Path(remote)
    for path in local.rglob('*'):
        relative_path = path.relative_to(local)
        if path.is_dir():
            as_umap(ctx, 'mkdir -p {}'.format(remote / relative_path))
        else:
            sudo_put(ctx, path, str(remote / relative_path))


@task
def system(ctx):
    ctx.run('sudo apt update')
    ctx.run('sudo apt install -y python3.5 python3.5-dev python-virtualenv '
            'wget nginx uwsgi uwsgi-plugin-python3 postgresql-9.5 gcc '
            'postgresql-9.5-postgis-2.2 postgresql-server-dev-9.5')
    ctx.run('sudo mkdir -p /srv/umap')
    ctx.run('sudo mkdir -p /etc/umap')
    ctx.run('sudo useradd -N umap -d /srv/umap/ || exit 0')
    ctx.run('sudo chown umap:users /srv/umap/')
    ctx.run('sudo chown umap:users /etc/umap/')
    ctx.run('sudo chsh -s /bin/bash umap')


@task
def db(ctx):
    as_postgres(ctx, 'createuser umap || exit 0')
    as_postgres(ctx, 'createdb umap -O umap || exit 0')
    as_postgres(ctx, 'psql umap -c "CREATE EXTENSION IF NOT EXISTS postgis"')
    as_postgres(ctx, 'psql umap -c "CREATE EXTENSION IF NOT EXISTS unaccent"')


@task
def venv(ctx):
    as_umap(ctx, 'virtualenv /srv/umap/venv --python=python3')
    as_umap(ctx, '/srv/umap/venv/bin/pip install pip -U')


@task
def customize(ctx):
    if ctx.custom.settings:
        sudo_put(ctx, ctx.custom.settings, '/etc/umap/umap.conf',
                 chown='umap:users')
    if ctx.custom.static:
        put_dir(ctx, ctx.custom.static, '/srv/umap/theme/static')
    if ctx.custom.templates:
        put_dir(ctx, ctx.custom.templates, '/srv/umap/theme/templates')
    ctx.run('sudo chown umap:users -R /srv/umap')


@task
def http(ctx):
    sudo_put(ctx, 'fabfile/uwsgi_params', '/srv/umap/uwsgi_params')
    uwsgi_conf = render_template('fabfile/uwsgi.ini',
                                 processes=ctx.config.get('processes', 4))
    sudo_put(ctx, uwsgi_conf, '/etc/uwsgi/apps-enabled/umap.ini')
    nginx_conf = render_template('fabfile/nginx.conf',
                                 domain=ctx.config.domain)
    sudo_put(ctx, nginx_conf, '/etc/nginx/sites-enabled/umap')


@task
def bootstrap(ctx):
    system(ctx)
    db(ctx)
    venv(ctx)
    customize(ctx)
    http(ctx)


def write_default(ctx):
    content = '\n'.join(['{}={}'.format(k, v)
                         for k, v in ctx.config.get('env', {}).items()])
    ctx.run('echo "{}" | sudo tee /etc/default/umap'.format(content))


@task
def deploy(ctx):
    as_umap(ctx, '/srv/umap/venv/bin/pip install umap-project --upgrade')
    umap_cmd(ctx, 'migrate')
    umap_cmd(ctx, 'collectstatic --noinput --verbosity 0')
    umap_cmd(ctx, 'storagei18n --verbosity 0')
    # Compress even if COMPRESS_ENABLED=False in local.py.
    umap_cmd(ctx, 'compress --force')
    write_default(ctx)
    restart(ctx)


@task
def restart(ctx):
    ctx.run('sudo systemctl restart uwsgi nginx')

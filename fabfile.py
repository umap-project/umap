from fabric.api import task, env, run, local, roles, cd, execute, hide, puts,\
    sudo
import posixpath


env.project_name = 'umap'
env.repository = 'https://yohanboniface@bitbucket.org/yohanboniface/umap.git'
env.local_branch = 'master'
env.remote_ref = 'origin/master'
env.requirements_file = 'requirements.txt'
env.restart_sudo = False


def run_as_umap(*args, **kwargs):
    if env.restart_sudo:
        kwargs['user'] = "umap"
        return sudo(*args, **kwargs)
    else:
        return run(*args, **kwargs)


#==============================================================================
# Tasks which set up deployment environments
#==============================================================================

@task
def osmfr():
    """
    OSM-fr servers.
    """
    server = 'osm102.openstreetmap.fr'
    env.roledefs = {
        'web': [server],
        'db': [server],
    }
    env.system_users = {server: 'www-data'}
    env.virtualenv_dir = '/data/project/umap/.virtualenvs/{project_name}'.format(**env)
    env.project_dir = '/data/project/umap/src/{project_name}'.format(**env)
    env.project_conf = '{project_name}.settings.local'.format(**env)
    env.restart_command = 'touch {project_dir}/umap/wsgi.py'.format(**env)
    env.restart_sudo = True


@task
def dev():
    """
    Kimsufi dev server.
    """
    server = 'ks3267459.kimsufi.com'
    env.roledefs = {
        'web': [server],
        'db': [server],
    }
    env.system_users = {server: 'www-data'}
    env.virtualenv_dir = '/home/ybon/.virtualenvs/{project_name}'.format(**env)
    env.project_dir = '/home/ybon/src/{project_name}'.format(**env)
    env.project_conf = '{project_name}.settings.local'.format(**env)
    env.restart_command = '/home/ybon/.virtualenvs/circus/bin/circusctl restart {project_name}'.format(**env)


# Set the default environment.
dev()


#==============================================================================
# Actual tasks
#==============================================================================

@task
@roles('web', 'db')
def bootstrap(action=''):
    """
    Bootstrap the environment.
    """
    with hide('running', 'stdout'):
        exists = run('if [ -d "{virtualenv_dir}" ]; then echo 1; fi'.format(**env))
    if exists and not action == 'force':
        puts('Assuming {host} has already been bootstrapped since '
             '{virtualenv_dir} exists.'.format(**env))
        return
    # run('mkvirtualenv {project_name}'.format(**env))
    with hide('running', 'stdout'):
        project_git_exists = run('if [ -d "{project_dir}" ]; then echo 1; fi'.format(**env))
    if not project_git_exists:
        run('mkdir -p {0}'.format(posixpath.dirname(env.virtualenv_dir)))
        run('git clone {repository} {project_dir}'.format(**env))
    # sudo('{virtualenv_dir}/bin/pip install -e {project_dir}'.format(**env))
    # with cd(env.virtualenv_dir):
    #     sudo('chown -R {user} .'.format(**env))
    #     fix_permissions()
    requirements()
    puts('Bootstrapped {host} - database creation needs to be done manually.'.format(**env))


@task
@roles('web', 'db')
def push():
    """
    Push branch to the repository.
    """
    remote, dest_branch = env.remote_ref.split('/', 1)
    local('git push {remote} {local_branch}:{dest_branch}'.format(
        remote=remote, dest_branch=dest_branch, **env))


@task
def deploy(verbosity='normal'):
    """
    Full server deploy.

    Updates the repository (server-side), synchronizes the database, collects
    static files and then restarts the web service.
    """
    if verbosity == 'noisy':
        hide_args = []
    else:
        hide_args = ['running', 'stdout']
    with hide(*hide_args):
        puts('Updating repository...')
        execute(update)
        puts('Collecting static files...')
        execute(collectstatic)
        puts('Synchronizing database...')
        execute(syncdb)
        puts('Restarting web server...')
        execute(restart)


@task
@roles('web', 'db')
def update(action='check'):
    """
    Update the repository (server-side).

    By default, if the requirements file changed in the repository then the
    requirements will be updated. Use ``action='force'`` to force
    updating requirements. Anything else other than ``'check'`` will avoid
    updating requirements at all.
    """
    with cd(env.project_dir):
        remote, dest_branch = env.remote_ref.split('/', 1)
        run_as_umap('git fetch {remote}'.format(remote=remote))
        with hide('running', 'stdout'):
            changed_files = run('git diff-index --cached --name-only '
                                '{remote_ref}'.format(**env)).splitlines()
        if not changed_files and action != 'force':
            # No changes, we can exit now.
            return
        if action == 'check':
            reqs_changed = env.requirements_file in changed_files
        else:
            reqs_changed = False
        run_as_umap('git merge {remote_ref}'.format(**env))
        run_as_umap('find -name "*.pyc" -delete')
        if action == "clean":
            run_as_umap('git clean -df')
    if action == 'force' or reqs_changed:
        # Not using execute() because we don't want to run multiple times for
        # each role (since this task gets run per role).
        requirements()


@task
@roles('web')
def collectstatic():
    """
    Collect static files from apps and other locations in a single location.
    """
    collect_remote_statics()
    dj('collectstatic --link --noinput')
    dj('storagei18n')
    dj('compress')


@task
@roles('db')
def syncdb(sync=True, migrate=True):
    """
    Synchronize the database.
    """
    dj('syncdb --migrate --noinput')


@task
@roles('web')
def restart():
    """
    Restart the web service.
    """
    run_as_umap(env.restart_command)


@task
@roles('web', 'db')
def requirements(name=None, upgrade=False):
    """
    Update the requirements.
    """
    base_command = '{virtualenv_dir}/bin/pip install'.format(virtualenv_dir=env.virtualenv_dir)
    if upgrade:
        base_command += ' --upgrade'
    if not name:
        kwargs = {
            "base_command": base_command,
            "project_dir": env.project_dir,
            "requirements_file": env.requirements_file,
        }
        run_as_umap('{base_command} -r {project_dir}/{requirements_file}'.format(**kwargs))
    else:
        run_as_umap('{base_command} {name}'.format(
            base_command=base_command,
            name=name
        ))


@task
@roles('web')
def collect_remote_statics(name=None):
    """
    Add leaflet and leaflet.draw in a repository watched by collectstatic.
    """
    remote_static_dir = '{project_dir}/{project_name}/remote_static'.format(**env)
    run_as_umap('mkdir -p {0}'.format(remote_static_dir))
    remote_repositories = {
        'storage': 'git://github.com/yohanboniface/Leaflet.Storage.git@master',
    }
    with cd(remote_static_dir):
        for subdir, path in remote_repositories.iteritems():
            if name and name != subdir:
                continue
            repository, branch = path.split('@')
            if "#" in branch:
                branch, ref = branch.split('#')
            else:
                ref = branch
            with hide("running", "stdout"):
                exists = run_as_umap('if [ -d "{0}" ]; then echo 1; fi'.format(subdir))
            if exists:
                with cd(subdir):
                    run_as_umap('git checkout {0}'.format(branch))
                    run_as_umap('git pull origin {0} --tags'.format(branch))
            else:
                run_as_umap('git clone {0} {1}'.format(repository, subdir))
            with cd(subdir):
                run_as_umap('git checkout {0}'.format(ref))
                if subdir == "leaflet":
                    run_as_umap('npm install')
                    run_as_umap('jake build')

#==============================================================================
# Helper functions
#==============================================================================

def dj(command):
    """
    Run a Django manage.py command on the server.
    """
    with cd(env.project_dir):
        run_as_umap('{virtualenv_dir}/bin/python {project_dir}/manage.py {dj_command} '
                    '--settings {project_conf}'.format(dj_command=command, **env))

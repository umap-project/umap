# Deploying uMap with Cloudron

[Cloudron](https://www.cloudron.io/) is a self-hosting platform that makes it easy to install and manage web applications.

You must have a running Cloudron instance. See the [Cloudron documentation](https://docs.cloudron.io/) to get started.

### Install from the App Store

1. Open your Cloudron dashboard
2. Go to the **App Store** and select **Community apps**
3. Paste the following URL:

```
https://git.wazo-lab.io/wazolab/cloudron-umap/raw/branch/develop/CloudronVersions.json
```

See the package on the [Cloudron App Store](https://ca.cloudron.io/app/org.umap-project.umap).

The source is available at: https://git.wazo-lab.io/wazolab/cloudron-umap

### What's included

The package sets up uMap with:

- PostgreSQL (with PostGIS) for the database
- Redis for real-time collaboration
- Nginx for static files
- Optional OIDC SSO via Cloudron

### Configuration

After installation, users can sign in with their Cloudron account via OIDC SSO. Anonymous users can also create and edit maps without an account.

Data is stored in PostgreSQL, and uploaded files are kept in `/app/data/uploads/`.

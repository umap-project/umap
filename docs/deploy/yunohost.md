# Deploying uMap with YunoHost

You must have a YunoHost host up and running. This can be either self hosted, or from a provider.

### Install from admin panel

Look for "uMap" in the official application catalog, and click on "install".

### Install from cli

When you are logged in as YunoHost admin:

    yunohost app install umap

See the official YunoHost package: https://github.com/YunoHost-Apps/umap_ynh

### Configuration

You'll be able to configure those settings from the config panel:

- default latitude, longitude and zoom
- OpenRouteService API key (to get routing)
- activate or not the realtime collaboration (activated by default)
- allow or not anonymous users to create and edit maps (deactivated by default)

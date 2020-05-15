# Customize your uMap installation


When running your own uMap, you may want to changed its appearance, for example
you want your own logo on the home page, or you want to apply some design, or
you want to add some tracking (but anonymous!) script…

This is done by overriding templates, CSS and images and telling uMap about
that.
So basically you'll have your own templates and/or statics directories where
you will put the templates or statics you want to control (and only those).

Inside thore directory, you need to respect the exact relative path of the
templates or statics you are adding, relatively to the
[templates](https://github.com/umap-project/umap/tree/master/umap/templates)
and
[static](https://github.com/umap-project/umap/tree/master/umap/static)
roots in the uMap structure.
For example, if you want to control the logo, you will add your own static with
the relative path `umap/img/logo.svg`.

The same apply to any file inside `umap/templates` and `umap/statics`.

## Settings

- `UMAP_CUSTOM_TEMPLATES` (`path`): points to the directory where the custom
 templates are stored
- `UMAP_CUSTOM_STATICS` (`path`): points to the directory where the custom
 templates are stored


## Example

Let's say we want to customize the home page, with a custom header, a custom
logo, and some CSS adjustments.

For this we need to control at least two files:

- `umap/navigation.html`
- `umap/theme.css`

Let's create one templates directory:

    mkdir -p /srv/umap/custom/templates/

And one static directory:

    mkdir -p /srv/umap/custom/static/

Now let's create our custom navigation file:

    vim /srv/umap/custom/templates/umap/navigation.html

We certainly want to copy-paste the
[original one](https://github.com/umap-project/umap/blob/master/umap/templates/umap/navigation.html)
to adapt it.

Now let's add our custom logo, with whatever path inside the static dir, given
we'll customize also the CSS:

    mv mylogo.png /srv/umap/custom/static/umap/mylogo.png

And then let's add some custom rules in `theme.css`. This file will be automatically loaded by uMap.

For example, this rule to load our logo:

```css
.umap-nav h1 a {
    background-image: url("./img/mylogo.png");
}
```

And we want the header to be red:

```css
.umap-nav {
    background-color: red;
}
```

And so on!

See also
[https://github.com/etalab/cartes.data.gouv.fr](https://github.com/etalab/cartes.data.gouv.fr)
for an example of customization.

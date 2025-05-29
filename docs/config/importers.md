# Importers

UMap comes with a list of import assistants (importers) that can be activated from server configuration.

See [UMAP_IMPORTERS](settings.md#umap_importers) for the setting option.

## Overpass

Basic importer to build simple Overpass queries.

### Configuration

- `url`: the URL of the Overpass server to be used (default: `https://overpass-api.de/api/interpreter`)
- `name`: the name of the importer in the list (default: `Overpass`)

Example:

```python
UMAP_IMPORTERS = {
    "overpass": {"url": "https://overpass-api.de/api/interpreter"},
}
```

## Datasets

List useful datasets to ease imports from users.

### Configuration

- `choices`: the datasets to include
- `name`: the name of the importer in the list (default: `Datasets`)

Example:

```python
UMAP_IMPORTERS = {
    "datasets": {
        "choices": [
            {
                "label": "Régions",
                "url": "https://france-geojson.gregoiredavid.fr/repo/regions.geojson",
                "format": "geojson",
            },
            {
                "label": "Départements",
                "url": "https://france-geojson.gregoiredavid.fr/repo/departements.geojson",
                "format": "geojson",
            },
            {
                "label": "Arrondissements de Paris",
                "url": "https://geo.api.gouv.fr/communes?codeParent=75056&type=arrondissement-municipal&format=geojson&geometry=contour",
                "format": "geojson",
            },
            {
                "label": "Arrondissements de Marseille",
                "url": "https://geo.api.gouv.fr/communes?codeParent=13055&type=arrondissement-municipal&format=geojson&geometry=contour",
                "format": "geojson",
            },
            {
                "label": "Arrondissements de Lyon",
                "url": "https://geo.api.gouv.fr/communes?codeParent=69123&type=arrondissement-municipal&format=geojson&geometry=contour",
                "format": "geojson",
            },
        ]
    },
}
```

## OpenDataSoft

Importer allowing to interact with an OpenDataSoft instance API.
By default, all instances are in France, but this can be overriden from settings.

### Configuration
- `name`: the name of the importer in the list (default: `OpenDataSoft`)
- `choices`: the available instances

Example:
```python
UMAP_IMPORTERS = {
    "opendatasoft": {
        "choices": [
            { name: 'Aix-Marseille Métropole', url: 'https://data.ampmetropole.fr' },
            { name: 'Région Centre-Val de Loire', url: 'https://data.centrevaldeloire.fr' },
            { name: 'Toulouse Métropole', url: 'https://data.toulouse-metropole.fr' },
            { name: 'Ville de Clermont-Ferrand', url: 'https://opendata.clermont-ferrand.fr' },
            { name: 'Métropole de Dijon', url: 'https://data.metropole-dijon.fr' },
            { name: 'Région Île-de-France', url: 'https://data.iledefrance.fr' },
            { name: 'Bordeaux Métropole', url: 'https://opendata.bordeaux-metropole.fr' },
        ]
    }
}
```

## GéoDatamine (fr)

Importer based on https://geodatamine.fr/.

*Only makes sense for France related uMap servers.*

### Configuration

- `url`: the URL of the GeoDatamine server to be used (default: `https://geodatamine.fr`)
- `name`: the name of the importer in the list (default: `GéoDatamine`)

Example:
```python
UMAP_IMPORTERS = {
    "geodatamine": {},
}
```

## Communes (fr)

Allow to import a French commune boundary.

*Only makes sense for France related uMap servers.*

### Configuration

- `name`: the name of the importer in the list (default: `Communes`)

Example:
```python
UMAP_IMPORTERS = {
    "communesfr": {"name": "Importer une commune"},
}
```

## Cadastre (fr)

Allow to import data from French cadastre.

*Only makes sense for France related uMap servers.*

### Configuration

- `name`: the name of the importer in the list (default: `Cadastre`)

Example:
```python
UMAP_IMPORTERS = {
    "cadastrefr": {"name": "Cadastre France"},
}
```

## Base Adresse Nationale (fr)

Allow to import addresses geocoded from the BAN API (in CSV format).

*Only makes sense for France related uMap servers.*

### Configuration

- `name`: the name of the importer in the list (default: `Géocodage FR`)

Example:
```python
UMAP_IMPORTERS = {
    "banfr": {"name": "BAN"},
}
```


# Questions Fréquemment Posées (FAQ)

## Quelle syntaxe est acceptée dans les champs de description ?  {: #text-formatting }

* `*simple astérisque pour italique*` → *simple astérisque pour italique*
* `**double astérisque pour gras**` → **double astérisque pour gras**
* `# un dièse pour titre 1` ⤵ <h1>un dièse pour titre 1</h1>
* `## deux dièses pour titre 2` ⤵ <h2>deux dièses pour titre 2</h2>
* `### trois dièses pour titre 3` ⤵ <h3>trois dièses pour titre 3</h3>
* `Lien simple : [[http://example.com]]` → Lien simple : [http://example.com](http://example.com)
* `Lien avec texte : [[http://exemple.fr|texte du lien]]` → Lien avec texte : [texte du lien](http://example.com)
* `--- pour un séparateur horizontal` ⤵ <hr>

## Quels sont les raccourcis clavier? {: #keyboard-shortcuts}

Sur macOS, utliser `Cmd` à la place de `Ctrl`.

### Génériques

* `Ctrl+F` → ouvre le panneau de recherche
* `Ctrl+E` → bascule en mode édition
* `Escape` → ferme le panneau ou la fenêtre dialogue ouverte
* `Shift+drag` sur la carte → zoom vers cette zone
* `Shift+click` sur les boutons de zoom → zoom ou dézoom de trois niveaux

### En mode édition

* `Ctrl+E` → retour à l’aperçu
* `Ctrl+S` → sauvegarde la carte
* `Ctrl+Z` → annule tous les changements depuis la dernière sauvegarde
* `Ctrl+M` → ajouter un nouveau marqueur
* `Ctrl+P` → commence un nouveau polygone
* `Ctrl+L` → commence une nouvelle ligne
* `Ctrl+I` → ouvre le panneau d’import de données
* `Ctrl+O` → ouvre le panneau d’import et le navigateur de fichiers
* `Ctrl++` → zoom
* `Ctrl+-` → dézoome
* `Shift+click` sur un élément → ouvre le panneau d’édition de cet élément
* `Ctrl+Shift+click` sur un élément → ouvre le panneau d’édition du calque de cet élément

## Quelle syntaxe est acceptée dans les règles de formattage conditionnel ? {: #conditional-rules }

* `macolonne=impair` → cible les éléments dont la colonne  `macolonne` vaut `impair`
* `macolonne!=impair` → cible les éléments dont la colonne `macolonne` est absente ou dont la valeur est différente de `impair`
* `macolonne>12` → cible les éléments dont la colonne `macolonne` est supérieur au nombre `12`
* `macolonne<12.34` → cible les éléments dont la colonne `macolonne` est inférieure au nombre `12.34`
* `macolonne=` → cible les éléments dont la colonne `macolonne` est vide
* `macolonne!=` → cible les éléments dont la colonne `macolonne` n'est pas vide
* `macolonne=true/false` → cible les éléments dont la colonne `macolonne` est explicitement `true` (ou `false`)
* `macolonne!=true/false` → cible les éléments dont la colonne `macolonne` est différente de `true` (ou `false`)

Quand la condition est vraie pour un élément donné, le style associé sera appliqué. Si plusieurs règles définissent
la même propriété, la première règle qui est vraie l'emporte.

Par exemple, imaginons des règles définies dans cet ordre:
- `population>10000` alors appliquer `couleur=rouge`
- `population>1000` alors appliquer `couleur=orange`
- `chomage<10` alors appliquer `image=par-défaut`
- `chomage>10` alors appliquer `image=attention`

Dans cet exemple:
- pour un élément ayant `population=1300` et `chomage=8`, la `couleur` sera `orange` et `image` sera `par-défaut`
- pour un élément ayant `population=1300` et `chomage=12`, la `couleur` sera `orange` et `image` sera `attention`
- pour un élément ayant `population=20000` et `chomage=15`, la `couleur` sera `rouge` et `image` sera `attention`


## Comment utiliser les variables ? {: #variables}

Utiliser une variable est aussi simple que `{variable}`.

Il est possible de définir une seconde variable de repli, dans le cas où la première ne serait pas définie: `{variable|repli}`

La valeur de repli peut être une chaîne, définie entre guillemets: `{variable|"repli"}`

Il est possible d'enchaîner plusieurs variables: `{variable|autrevariable|"une chaîne"}`

Il est possible d'utiliser une variable à l'intérieur d'une URL: `[[https://domain.org/?locale={locale}|Wikipedia]]`

Ou même comme chemin vers une image: `{{{variable}}}` (noter le triple `{}`).

### Variables disponibles pour les éléments de la carte:

Ces variables peuvent être utilisées dans le champ description d'un élément, ou comme gabarit manuel de popup.

Toute propriété de l'élément sera disponible, ainsi que:

- `{lat}/{lng}` → la position de l'élément (ou le centroïde dans le cas d'une ligne ou d'un polygone)
- `{alt}` → l'altitude (pour les points uniquement), si elle est définie dans les données
- `{locale}` → la langue sous la forme `fr` ou `fr_CA` quand une variante est utilisée
- `{lang}` → la langue sous la forme `fr` ou `fr-ca` quand une variante est utilisée
- `{measure}` → la longueur d'une ligne ou la surface d'un polygone
- `{gain}`/`{loss}` → la dénivelée positive/négative d'une ligne (seulement si elle contient les altitudes)
- `{rank}` → la rang d'un élément dans son calque
- `{layer}` → le nom du calque de l'élément
- `{zoom}` → le zoom actuel de la carte

### Variables disponibles dans les URL de données distantes:

- `{bbox}` → la bbox de la carte sous la forme `sud_ouest_lng,sud_ouest_lat,nord_est_lng,nord_est_lat`
- `{north}/{top}` → la latitude nord de la vue actuelle de la carte
- `{south}/{bottom}` → la latitude sud de la vue actuelle de la carte
- `{east}/{right}` → la longitude est de la vue actuelle de la carte
- `{west}/{left}` → la longitude ouest de la vue actuelle de la carte
- `{zoom}` → le zoom actuel de la carte
- `{lat}` → la latitude du centre actuel de la carte
- `{lng}` → la longitude du centre actuel de la carte


## Quels statuts peut avoir une carte ? {: #map-statuses}

### En accès

* **Brouillon (privé)**: Vous seul et votre équipe pouvez accéder à la carte.
* **Tout le monde (public)**: Tout le monde peut accéder à la carte, qui est visible dans la recherche et la page d’accueil. La carte est indexée dans les moteurs de recherche (Google, etc.).
* **Quiconque a le lien**: La carte est visible par toutes les personnes qui en ont le lien. Elle n’est pas indexée dans les moteurs de recherche.
* **Éditeurs et équipe seulement**: Vous seul et votre équipe pouvez accéder à la carte.

Les personnes affichant une carte à laquelle elles n’ont pas accès auront une page d’erreur 403.

### En édition

* **Propriétaire uniquement**: Vous seul pouvez modifier la carte.
* **Éditeurs et équipe seulement**: Vous seul et votre équipe pouvez modifier la carte.
* **Tout le monde**: Tout le monde peut modifier la carte, même les comptes anonymes.

Pour les cartes créées sans compte :

* **Modifiable seulement avec le lien d’édition secret**: Seules les personnes avec un lien d’édition pourront modifier la carte.

Ces réglages sont aussi disponibles pour chaque calque.

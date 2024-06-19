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

Quand la condition est vraie pour un élément donné, le style associé sera appliqué.


# Articles

## [Greeting uMap 3](https://www.openstreetmap.org/user/David%20Larlet/diary/406936) (2025-06-17)

> After one more year of French administration funding (thank you!), we are so proud to have released versions 3.X of uMap since last April. Since then, we made a couple of adjustments to ease the deployment of that new version.
>
> The main feature of that version is the long awaited real-time collaboration! Thanks to Alexis for the development and NLnet for the funding 👏

[Full article →](https://www.openstreetmap.org/user/David%20Larlet/diary/406936){ .md-button }


## [Towards uMap 3 😱](https://www.openstreetmap.org/user/David%20Larlet/diary/404654) (2024-07-16)

> The latest 2.4.X release sets the path for two major requested features: real-time collaboration and one-click remote data importers.
>
> Additionally, minor improvements and bugfixes have made the tool more stable and usable.

[Full article →](https://www.openstreetmap.org/user/David%20Larlet/diary/404654){ .md-button }


## [Adding collaboration on uMap, fourth update](https://blog.notmyidea.org/adding-collaboration-on-umap-fourth-update.html) (2024-06-20)

> The main branch of uMap now ships a web socket server, enabling local changes to be replicated to other peers.
>
> Here is short video capturing how the import of <mark>some data can be synced between two browsers</mark>.

[Full article →](https://blog.notmyidea.org/adding-collaboration-on-umap-fourth-update.html){ .md-button }


## [Mapping the CUNY Digital History Archive](https://cuny.manifoldapp.org/read/mapping-the-cuny-digital-history-archive) (2024-05)

> This article discusses the implementation of the Learning CUNY History project, designed as an open education praxis for teaching and learning. It’s an example of a project-based assignment for undergraduate students and has evolved to explore the impact of integrating digital archives and digital mapping as instructional-digital tools. The project activates the CUNY Digital History Archive as a method of developing students’ digital literacy skills and investigates the potential to facilitate students’ learning. The archive is activated through student investigations and writings related to archival materials. Students then map the items as an interactive semester assignment. The project is described as occurring over three phases, and compares different digital mapping platforms. <mark>Ultimately, after careful consideration since its pilot phase, the project utilizes Open Street Map and uMap.</mark>

[Full article →](https://cuny.manifoldapp.org/read/mapping-the-cuny-digital-history-archive){ .md-button }


## [uMap 2 and beyond 🚀](https://www.openstreetmap.org/user/David%20Larlet/diary/403560) (2024-02-23)

> A [major version](https://pypi.org/project/umap-project/2.0.0/) of uMap has been released last week.
>
> <mark>This release is inauguring a new era in versioning uMap</mark>: in the future, we’ll take care of better documenting breaking changes, so expect more major releases from now on. More details on [how we version](https://docs.umap-project.org/en/master/release/#when-to-make-a-release).
>
> A comprehensive changelog for that version is available in our technical documentation. Most of the changes for a major version are indeed technical, we are taking care of people deploying and maintaining instances with that approach. User-facing features are deployed continuously with our minor versions. We think that scheme is more valuable for the community.

[Full article →](https://www.openstreetmap.org/user/David%20Larlet/diary/403560){ .md-button }


## [Adding collaboration on uMap, third update](https://blog.notmyidea.org/adding-collaboration-on-umap-third-update.html) (2024-02-15)

> I’ve spent the last few weeks working on uMap, still with the goal of bringing real-time collaboration to the maps. I’m not there yet, but <mark>I’ve made some progress that I will relate here</mark>.

[Full article →](https://blog.notmyidea.org/adding-collaboration-on-umap-third-update.html){ .md-button }


## [Adding Real-Time Collaboration to uMap, second week](https://blog.notmyidea.org/adding-real-time-collaboration-to-umap-second-week.html) (2023-11-21)

> I continued working on uMap, an open-source map-making tool to create and share customizable maps, based on Open Street Map data.
>
> <mark>Here is a summary of what I did:</mark>
>
> * I reviewed, rebased and made some minor changes to [a pull request which makes it possible to merge geojson features together](https://github.com/umap-project/umap/pull/772) ;
> * I’ve explored around the idea of using SQLite inside the browser, for two reasons : it could make it possible to use the [Spatialite](https://www.gaia-gis.it/fossil/libspatialite/index) extension, and it might help us to implement a CRDT with [cr-sqlite](https://github.com/vlcn-io/cr-sqlite) ;
> * I learned a lot about the SIG field. This is a wide ecosystem with lots of moving parts, which I understand a bit better now.

[Full article →](https://blog.notmyidea.org/adding-real-time-collaboration-to-umap-second-week.html){ .md-button }


## [Adding Real-Time Collaboration to uMap, first week](https://blog.notmyidea.org/adding-real-time-collaboration-to-umap-first-week.html) (2023-11-11)

> Last week, I’ve been lucky to start working on uMap, an open-source map-making tool to create and share customizable maps, based on Open Street Map data.
>
> <mark>My goal is to add real-time collaboration to uMap</mark>, but we first want to be sure to understand the issue correctly. There are multiple ways to solve this, so one part of the journey is to understand the problem properly (then, we’ll be able to chose the right path forward).

[Full article →](https://blog.notmyidea.org/adding-real-time-collaboration-to-umap-first-week.html){ .md-button }


## [Experimental choropleth layer in uMap](https://www.openstreetmap.org/user/ybon/diary/402589) (2023-10-12)

> We’ve just released the version 1.9.2 of uMap, that includes a new experimental type of layer: <mark>choropleth!</mark>

[Full article →](https://www.openstreetmap.org/user/ybon/diary/402589){ .md-button }


## [uMap: fine-grained permissions and more](https://www.openstreetmap.org/user/David%20Larlet/diary/402475) (2023-09-27)

> We finally managed to tackle a very popular feature request: [datalayers’ fine-grained permissions](https://github.com/umap-project/umap/pull/1307) 🎉. This is a huge step forward, <mark>allowing for a given map owner to only open a particular datalayer to edition</mark>. It will help people with contributive maps who need to setup a stable/fixed base layer. It also paved the way for even more control over the objects that are allowed for addition and/or edition. Please share with us your desired workflows.

[Full article →](https://www.openstreetmap.org/user/David%20Larlet/diary/402475){ .md-button }


## [Some news about uMap!](https://www.openstreetmap.org/user/ybon/diary/402248) (2023-08-25)

> Since a few month, <mark>uMap has been integrated in a French state incubator</mark>, so things are moving quite a lot!
>
> uMap is now ten years old, and is deployed on many instances around the world. The one I know well is hosted by OSM France, and is close to reach one million maps created and 100.000 users.
>
> This incubation program is ported by the French [“Accélérateur d’initiatives citoyennes”](https://citoyens.transformation.gouv.fr/), it includes coaches and a small budget for non tech needs (UI/UX…). One goal of this program is to find financial support for uMap development and maintainance. A French administration, the [Agence pour la cohésion des territoires](https://agence-cohesion-territoires.gouv.fr/), is the first uMap financial backer since a few months. This allowed us to put up a small team to work, part time, in uMap […]

[Full article →](https://www.openstreetmap.org/user/ybon/diary/402248){ .md-button }


## [uMap: A Free, Open-Source Alternative to Google My Maps](https://cartographicperspectives.org/index.php/journal/article/view/1729) (2022-02-08)

> Since their release in 2005, Google Maps-based tools have become the de facto solutions for a variety of online cartographic projects. Their success has been accompanied by a range of critiques denouncing the individualistic market-based logic imposed by these mapping services. Alternative options to this dominant model have been released since then; uMap is one of them. <mark>uMap is a free, open-source online mapping platform that builds on OpenStreetMap to enable anyone to easily publish web maps individually or collaboratively.</mark> In this paper, we reflect on the potential and limits of uMap based on our own experiences of deploying it in six different mapping projects. Through these experiences, uMap appears particularly well-suited for collaborative mapping projects, due to its ease in connecting to remote data and its high level of interoperability with a range of other applications. On the other hand, uMap seems less relevant for crowdmapping projects, due to its lack of built-in options to manage and control public contributions. Finally, the open-source philosophy of uMap, combined with its simplicity of use and its strong collaborative capacity, make it a great option for activist mapping projects as well as for pedagogical purposes to teach a range of topics including online collaborative cartography.

[Full article →](https://cartographicperspectives.org/index.php/journal/article/view/1729){ .md-button }

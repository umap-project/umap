export default class URLs{
    constructor(serverUrls){
        this.urls = serverUrls;
        console.log(`got server urls = ${serverUrls}`);
    }

    get(urlName, params) {
        return L.Util.template(this.urls[urlName], ...params);
    }

    editMap(mapId) {
        return L.Util.template(this.urls.map_update, {
          map_id: mapId,
        })
    }
    
    createMap() {
        return L.Util.template(this.urls.map_create)
    }
    
    saveMap(mapId) {
        if (mapId)
            return this.getEditUrl(mapId);
        return this.getCreateUrl();
    }

    deleteMap(mapId) {
        return L.Util.template(this.options.urls.map_delete, {
            map_id: mapId,
        })
    }

    starMap(mapId) {
        return L.Util.template(this.urls.map_star, {
            map_id: mapId,
        });
    }

    cloneMap(mapId) {
        return L.Util.template(this.urls.map_clone, {
            map_id: mapId,
          });
    }

    downloadMap(mapId) {
        return L.Util.template(this.options.urls.map_download, {
            map_id: mapId,
          })
    }

    sendEditLink(mapId){
        return L.Util.template(this.urls.map_send_edit_link, {
            map_id: mapId,
        });
    }
}
class SyncStorage{
    constructor(urls){
        this.urls = urls;
    }

    async saveMap(map){
        const geojson = {
          type: 'Feature',
          geometry: map.geometry(),
          properties: map.exportOptions(),
        }

        const formData = new FormData()
        formData.append('name', this.options.name)
        formData.append('center', JSON.stringify(this.geometry()))
        formData.append('settings', JSON.stringify(geojson))
        data = await this.post(this.urls.saveMap(), {
          data: formData,
          context: this,
        });
        
        let duration = 3000;
        let alert = { content: L._('Map has been saved!'), level: 'info' }

        if (!map.options.umap_id) {
          alert.content = L._('Congratulations, your map has been created!');
          map.options.umap_id = data.id
          map.permissions.setOptions(data.permissions)
          map.permissions.commit()
          if (
            data.permissions &&
            data.permissions.anonymous_edit_url &&
            map.options.urls.map_send_edit_link
          ) {
            alert.duration = Infinity
            alert.content =
              L._(
                'Your map has been created! As you are not logged in, here is your secret link to edit the map, please keep it safe:'
              ) + `<br>${data.permissions.anonymous_edit_url}`

            alert.actions = [
              {
                label: L._('Send me the link'),
                input: L._('Email'),
                callback: map.sendEditLink,
                callbackContext: map,
              },
              {
                label: L._('Copy link'),
                callback: () => {
                  L.Util.copyToClipboard(data.permissions.anonymous_edit_url)
                  map.ui.alert({
                    content: L._('Secret edit link copied to clipboard!'),
                    level: 'info',
                  })
                },
                callbackContext: map,
              },
            ]
          }
        } else if (!map.permissions.isDirty) {
          // Do not override local changes to permissions,
          // but update in case some other editors changed them in the meantime.
          map.permissions.setOptions(data.permissions)
          map.permissions.commit()
        }
        // Update URL in case the name has changed.
        if (history && history.pushState)
          history.pushState({}, map.options.name, data.url)
        else window.location = data.url
        alert.content = data.info || alert.content
        map.once('saved', () => map.ui.alert(alert))
        map.ui.closePanel()
        map.permissions.save()
      }
}

export default SyncStorage;
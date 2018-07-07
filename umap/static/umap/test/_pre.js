var qs = function (selector, element) {return (element || document).querySelector(selector);};
var qsa = function (selector) {return document.querySelectorAll(selector);};
var qst = function (text, parent) {
    // find element by its text content
    var r = document.evaluate("descendant::*[contains(text(),'" + text + "')]", parent || qs('#map'), null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null), count = 0;
    while(r.iterateNext()) console.log(++count);
    return count;
};
happen.at = function (what, x, y, props) {
    this.once(document.elementFromPoint(x, y), L.Util.extend({
        type: what,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        which: 1,
        button: 0
    }, props || {}));
};
var resetMap = function () {
    var mapElement = qs('#map');
    mapElement.innerHTML = 'Done';
    delete mapElement._leaflet_id;
    document.body.className = '';
};
var enableEdit = function () {
    happen.click(qs('div.leaflet-control-edit-enable a'));
};
var disableEdit = function () {
    happen.click(qs('a.leaflet-control-edit-disable'));
};
var clickSave = function () {
    happen.click(qs('a.leaflet-control-edit-save'));
};
var clickCancel = function () {
    var _confirm = window.confirm;
    window.confirm = function (text) {
        return true;
    };
    happen.click(qs('a.leaflet-control-edit-cancel'));
    happen.once(document.body, {type: 'keypress', keyCode: 13});
    window.confirm = _confirm;
};
var changeInputValue = function (input, value) {
    input.value = value;
    happen.once(input, {type: 'input'});
    happen.once(input, {type: 'blur'});
};
var changeSelectValue = function (path_or_select, value) {
    if (typeof path_or_select === 'string') path_or_select = qs(path_or_select);
    var found = false;
    for (var i = 0; i < path_or_select.length; i++) {
        if (path_or_select.options[i].value === value) {
            path_or_select.options[i].selected = true;
            found = true;
        }
    }
    happen.once(path_or_select, {type: 'change'});
    if (!found) throw new Error('Value ' + value + 'not found in select ' + path_or_select);
    return path_or_select;
}
var cleanAlert = function () {
    L.DomUtil.removeClass(qs('#map'), 'umap-alert');
    L.DomUtil.get('umap-alert-container').innerHTML = '';
    UI_ALERT_ID = null;  // Prevent setTimeout to be called
};
var defaultDatalayerData = function (custom) {
    var _default = {
        iconClass: 'Default',
        name: 'Elephants',
        displayOnLoad: true,
        id: 62,
        pictogram_url: null,
        opacity: null,
        weight: null,
        fillColor: '',
        color: '',
        stroke: true,
        smoothFactor: null,
        dashArray: '',
        fillOpacity: null,
        fill: true
    };
    return L.extend({}, _default, custom);
};

function initMap (options) {
    default_options = {
        "geometry": {
            "type": "Point",
            "coordinates": [5.0592041015625, 52.05924589011585]
        },
        "type": "Feature",
        "properties": {
            "umap_id": 42,
            "datalayers": [],
            "urls": {
                "map": "/map/{slug}_{pk}",
                "datalayer_view": "/datalayer/{pk}/",
                "map_update": "/map/{map_id}/update/settings/",
                "map_old_url": "/map/{username}/{slug}/",
                "map_clone": "/map/{map_id}/update/clone/",
                "map_short_url": "/m/{pk}/",
                "map_anonymous_edit_url": "/map/anonymous-edit/{signature}",
                "map_new": "/map/new/",
                "datalayer_update": "/map/{map_id}/datalayer/update/{pk}/",
                "map_delete": "/map/{map_id}/update/delete/",
                "map_create": "/map/create/",
                "logout": "/logout/",
                "datalayer_create": "/map/{map_id}/datalayer/create/",
                "login_popup_end": "/login/popupd/",
                "login": "/login/",
                "datalayer_delete": "/map/{map_id}/datalayer/delete/{pk}/",
                "datalayer_versions": "/map/{map_id}/datalayer/{pk}/versions/",
                "datalayer_version": "/datalayer/{pk}/{name}",
                "pictogram_list_json": "/pictogram/json/",
                "map_update_permissions": "/map/{map_id}/update/permissions/"
            },
            "default_iconUrl": "../src/img/marker.png",
            "zoom": 6,
            "tilelayers": [
            {
                "attribution": "\u00a9 OSM Contributors",
                "name": "OpenStreetMap",
                "url_template": "http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
                "minZoom": 0,
                "maxZoom": 18,
                "id": 1,
                "selected": true
            },
            {
                "attribution": "HOT and friends",
                "name": "HOT OSM-fr server",
                "url_template": "http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
                "rank": 99,
                "minZoom": 0,
                "maxZoom": 20,
                "id": 2
            }],
            "tilelayer": {
                "attribution": "HOT and friends",
                "name": "HOT OSM-fr server",
                "url_template": "http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
                "rank": 99,
                "minZoom": 0,
                "maxZoom": 20,
                "id": 2
            },
            "licences": {
              "No licence set": {
                "url": "",
                "name": "No licence set"
              },
              "Licence ouverte/Open Licence": {
                "url": "http://www.data.gouv.fr/Licence-Ouverte-Open-Licence",
                "name": "Licence ouverte/Open Licence"
              },
              "WTFPL": {
                "url": "http://www.wtfpl.net/",
                "name": "WTFPL"
              },
              "ODbl": {
                "url": "http://opendatacommons.org/licenses/odbl/",
                "name": "ODbl"
              }
            },
            "name": "name of the map",
            "description": "The description of the map",
            "allowEdit": true,
            "moreControl": true,
            "scaleControl": true,
            "miniMap": true,
            "datalayersControl": true,
            "displayCaptionOnLoad": false,
            "displayPopupFooter": false,
            "displayDataBrowserOnLoad": false
        }
    };
    default_options.properties.datalayers.push(defaultDatalayerData());
    options.properties = L.extend({}, default_options.properties, options);
    return new L.U.Map("map", options);
}

var RESPONSES = {
    'datalayer62_GET': {
        "crs": null,
        "type": "FeatureCollection",
        "_umap_options": defaultDatalayerData(),
        "features": [{
            "geometry": {
                "type": "Point",
                "coordinates": [-0.274658203125, 52.57634993749885]
            },
            "type": "Feature",
            "id": 1807,
            "properties": {_umap_options: {color: "OliveDrab"}, name: "test"}
        },
        {
            "geometry": {
                "type": "LineString",
                "coordinates": [[-0.5712890625, 54.47642158429295], [0.439453125, 54.610254981579146], [1.724853515625, 53.44880683542759], [4.163818359375, 53.98839506479995], [5.306396484375, 53.533778184257805], [6.591796875, 53.70971358510174], [7.042236328124999, 53.35055131839989]]
            },
            "type": "Feature",
            "id": 20, "properties": {"_umap_options": {"fill": false}, "name": "test"}
        },
        {
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[11.25, 53.585983654559804], [10.1513671875, 52.9751081817353], [12.689208984375, 52.16719363541221], [14.084472656249998, 53.199451902831555], [12.63427734375, 53.61857936489517], [11.25, 53.585983654559804], [11.25, 53.585983654559804]]]
            },
            "type": "Feature",
            "id": 76,
            "properties": {name: "name poly"}
        }]
    }
};


sinon.fakeServer.getRequest = function (path, method) {
    var request;
    for (var i=0, l=this.requests.length; i<l; i++) {
        request = this.requests[i];
        // In case of a form submit, the request start with file://
        if (request.url.indexOf(path) !== -1) {
            if (!method || request.method === method) {
                return request;
            }
        }
    }
};

sinon.fakeServer.flush = function () {
    this.responses = [];
};


var kml_example = '<?xml version="1.0" encoding="UTF-8"?>' +
'<kml xmlns="http://www.opengis.net/kml/2.2">' +
'<Placemark>'+
'<name>Simple point</name>'+
'<description>Here is a simple description.</description>'+
'<Point>'+
'<coordinates>-122.0822035425683,37.42228990140251,0</coordinates>'+
'</Point>'+
'</Placemark>'+
'<Placemark>'+
'<name>Simple path</name>'+
'<description>Simple description</description>'+
'<LineString>'+
'<coordinates>-112.2550785337791,36.07954952145647,2357 -112.2549277039738,36.08117083492122,2357 -112.2552505069063,36.08260761307279,2357</coordinates>'+
'</LineString>'+
'</Placemark>'+
'<Placemark>'+
'<name>Simple polygon</name>'+
'<description>A description.</description>'+
'<Polygon>'+
'<outerBoundaryIs>'+
'<LinearRing>'+
'<coordinates>'+
'            -77.05788457660967,38.87253259892824,100 '+
'            -77.05465973756702,38.87291016281703,100 '+
'            -77.05315536854791,38.87053267794386,100 '+
'            -77.05788457660967,38.87253259892824,100 '+
'</coordinates>'+
'</LinearRing>'+
'</outerBoundaryIs>'+
'</Polygon>'+
'</Placemark>'+
'</kml>';

var gpx_example = '<gpx' +
'  version="1.1"' +
'  creator="GPSBabel - http://www.gpsbabel.org"' +
'  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' +
'  xmlns="http://www.topografix.com/GPX/1/1"' +
'  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">' +
'  <wpt lat="45.44283" lon="-121.72904"><ele>1374</ele><name>Simple Point</name><desc>Simple description</desc></wpt>' +
'  <trk>' +
'    <name>Simple path</name>' +
'    <desc>Simple description</desc>' +
'    <trkseg>' +
'      <trkpt lat="45.4431641" lon="-121.7295456"></trkpt>' +
'      <trkpt lat="45.4428615" lon="-121.7290800"></trkpt>' +
'      <trkpt lat="45.4425697" lon="-121.7279085"></trkpt>' +
'    </trkseg>' +
'  </trk>' +
'</gpx>';

var csv_example = 'Foo,Latitude,Longitude,title,description\n' +
'bar,41.34,122.86,a point somewhere,the description of this point';

// Make Sinon log readable
sinon.format = function (what) {
    if (typeof what === 'object') {
        return JSON.stringify(what, null, 4);
    } else if (typeof what === "undefined") {
        return '';
    } else {
        return what.toString();
    }
};

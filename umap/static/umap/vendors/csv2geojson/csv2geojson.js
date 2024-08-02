(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.csv2geojson = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

var dsv = require('d3-dsv'),
    sexagesimal = require('@mapbox/sexagesimal');

var latRegex = /(Lat)(itude)?/gi,
    lonRegex = /(L)(on|ng)(gitude)?/i;

function guessHeader(row, regexp) {
    var name, match, score;
    for (var f in row) {
        match = f.match(regexp);
        if (match && (!name || match[0].length / f.length > score)) {
            score = match[0].length / f.length;
            name = f;
        }
    }
    return name;
}

function guessLatHeader(row) { return guessHeader(row, latRegex); }
function guessLonHeader(row) { return guessHeader(row, lonRegex); }

function isLat(f) { return !!f.match(latRegex); }
function isLon(f) { return !!f.match(lonRegex); }

function keyCount(o) {
    return (typeof o == 'object') ? Object.keys(o).length : 0;
}

function autoDelimiter(x) {
    var delimiters = [',', ';', '\t', '|'];
    var results = [];

    delimiters.forEach(function (delimiter) {
        var res = dsv.dsvFormat(delimiter).parse(x);
        if (res.length >= 1) {
            var count = keyCount(res[0]);
            for (var i = 0; i < res.length; i++) {
                if (keyCount(res[i]) !== count) return;
            }
            results.push({
                delimiter: delimiter,
                arity: Object.keys(res[0]).length,
            });
        }
    });

    if (results.length) {
        return results.sort(function (a, b) {
            return b.arity - a.arity;
        })[0].delimiter;
    } else {
        return null;
    }
}

/**
 * Silly stopgap for dsv to d3-dsv upgrade
 *
 * @param {Array} x dsv output
 * @returns {Array} array without columns member
 */
function deleteColumns(x) {
    delete x.columns;
    return x;
}

function auto(x) {
    var delimiter = autoDelimiter(x);
    if (!delimiter) return null;
    return deleteColumns(dsv.dsvFormat(delimiter).parse(x));
}

function csv2geojson(x, options, callback) {

    if (!callback) {
        callback = options;
        options = {};
    }

    options.delimiter = options.delimiter || ',';

    var latfield = options.latfield || '',
        lonfield = options.lonfield || '',
        crs = options.crs || '';

    var features = [],
        featurecollection = {type: 'FeatureCollection', features: features};

    if (crs !== '') {
        featurecollection.crs = {type: 'name', properties: {name: crs}};
    }

    if (options.delimiter === 'auto' && typeof x == 'string') {
        options.delimiter = autoDelimiter(x);
        if (!options.delimiter) {
            callback({
                type: 'Error',
                message: 'Could not autodetect delimiter'
            });
            return;
        }
    }

    var numericFields = options.numericFields ? options.numericFields.split(',') : null;

    var parsed = (typeof x == 'string') ?
        dsv.dsvFormat(options.delimiter).parse(x, function (d) {
            if (numericFields) {
                for (var key in d) {
                    if (numericFields.includes(key)) {
                        d[key] = +d[key];
                    }
                }
            }
            return d;
        }) : x;

    if (!parsed.length) {
        callback(null, featurecollection);
        return;
    }

    var errors = [];
    var i;


    if (!latfield) latfield = guessLatHeader(parsed[0]);
    if (!lonfield) lonfield = guessLonHeader(parsed[0]);
    var noGeometry = (!latfield || !lonfield);

    if (noGeometry) {
        for (i = 0; i < parsed.length; i++) {
            features.push({
                type: 'Feature',
                properties: parsed[i],
                geometry: null
            });
        }
        callback(errors.length ? errors : null, featurecollection);
        return;
    }

    for (i = 0; i < parsed.length; i++) {
        if (parsed[i][lonfield] !== undefined &&
            parsed[i][latfield] !== undefined) {

            var lonk = parsed[i][lonfield],
                latk = parsed[i][latfield],
                lonf, latf,
                a;

            a = sexagesimal(lonk, 'EW');
            if (a) lonk = a;
            a = sexagesimal(latk, 'NS');
            if (a) latk = a;

            lonf = parseFloat(lonk);
            latf = parseFloat(latk);

            if (isNaN(lonf) ||
                isNaN(latf)) {
                errors.push({
                    message: 'A row contained an invalid value for latitude or longitude',
                    row: parsed[i],
                    index: i
                });
            } else {
                if (!options.includeLatLon) {
                    delete parsed[i][lonfield];
                    delete parsed[i][latfield];
                }

                features.push({
                    type: 'Feature',
                    properties: parsed[i],
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            parseFloat(lonf),
                            parseFloat(latf)
                        ]
                    }
                });
            }
        }
    }

    callback(errors.length ? errors : null, featurecollection);
}

function toLine(gj) {
    var features = gj.features;
    var line = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: []
        }
    };
    for (var i = 0; i < features.length; i++) {
        line.geometry.coordinates.push(features[i].geometry.coordinates);
    }
    line.properties = features.reduce(function (aggregatedProperties, newFeature) {
        for (var key in newFeature.properties) {
            if (!aggregatedProperties[key]) {
                aggregatedProperties[key] = [];
            }
            aggregatedProperties[key].push(newFeature.properties[key]);
        }
        return aggregatedProperties;
    }, {});
    return {
        type: 'FeatureCollection',
        features: [line]
    };
}

function toPolygon(gj) {
    var features = gj.features;
    var poly = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[]]
        }
    };
    for (var i = 0; i < features.length; i++) {
        poly.geometry.coordinates[0].push(features[i].geometry.coordinates);
    }
    poly.properties = features.reduce(function (aggregatedProperties, newFeature) {
        for (var key in newFeature.properties) {
            if (!aggregatedProperties[key]) {
                aggregatedProperties[key] = [];
            }
            aggregatedProperties[key].push(newFeature.properties[key]);
        }
        return aggregatedProperties;
    }, {});
    return {
        type: 'FeatureCollection',
        features: [poly]
    };
}

module.exports = {
    isLon: isLon,
    isLat: isLat,
    guessLatHeader: guessLatHeader,
    guessLonHeader: guessLonHeader,
    csv: dsv.csvParse,
    tsv: dsv.tsvParse,
    dsv: dsv,
    auto: auto,
    csv2geojson: csv2geojson,
    toLine: toLine,
    toPolygon: toPolygon
};

},{"@mapbox/sexagesimal":2,"d3-dsv":3}],2:[function(require,module,exports){
module.exports = element;
module.exports.pair = pair;
module.exports.format = format;
module.exports.formatPair = formatPair;
module.exports.coordToDMS = coordToDMS;


function element(input, dims) {
  var result = search(input, dims);
  return (result === null) ? null : result.val;
}


function formatPair(input) {
  return format(input.lat, 'lat') + ' ' + format(input.lon, 'lon');
}


// Is 0 North or South?
function format(input, dim) {
  var dms = coordToDMS(input, dim);
  return dms.whole + '° ' +
    (dms.minutes ? dms.minutes + '\' ' : '') +
    (dms.seconds ? dms.seconds + '" ' : '') + dms.dir;
}


function coordToDMS(input, dim) {
  var dirs = { lat: ['N', 'S'], lon: ['E', 'W'] }[dim] || '';
  var dir = dirs[input >= 0 ? 0 : 1];
  var abs = Math.abs(input);
  var whole = Math.floor(abs);
  var fraction = abs - whole;
  var fractionMinutes = fraction * 60;
  var minutes = Math.floor(fractionMinutes);
  var seconds = Math.floor((fractionMinutes - minutes) * 60);

  return {
    whole: whole,
    minutes: minutes,
    seconds: seconds,
    dir: dir
  };
}


function search(input, dims) {
  if (!dims) dims = 'NSEW';
  if (typeof input !== 'string') return null;

  input = input.toUpperCase();
  var regex = /^[\s\,]*([NSEW])?\s*([\-|\—|\―]?[0-9.]+)[°º˚]?\s*(?:([0-9.]+)['’′‘]\s*)?(?:([0-9.]+)(?:''|"|”|″)\s*)?([NSEW])?/;

  var m = input.match(regex);
  if (!m) return null;  // no match

  var matched = m[0];

  // extract dimension.. m[1] = leading, m[5] = trailing
  var dim;
  if (m[1] && m[5]) {                 // if matched both..
    dim = m[1];                       // keep leading
    matched = matched.slice(0, -1);   // remove trailing dimension from match
  } else {
    dim = m[1] || m[5];
  }

  // if unrecognized dimension
  if (dim && dims.indexOf(dim) === -1) return null;

  // extract DMS
  var deg = m[2] ? parseFloat(m[2]) : 0;
  var min = m[3] ? parseFloat(m[3]) / 60 : 0;
  var sec = m[4] ? parseFloat(m[4]) / 3600 : 0;
  var sign = (deg < 0) ? -1 : 1;
  if (dim === 'S' || dim === 'W') sign *= -1;

  return {
    val: (Math.abs(deg) + min + sec) * sign,
    dim: dim,
    matched: matched,
    remain: input.slice(matched.length)
  };
}


function pair(input, dims) {
  input = input.trim();
  var one = search(input, dims);
  if (!one) return null;

  input = one.remain.trim();
  var two = search(input, dims);
  if (!two || two.remain) return null;

  if (one.dim) {
    return swapdim(one.val, two.val, one.dim);
  } else {
    return [one.val, two.val];
  }
}


function swapdim(a, b, dim) {
  if (dim === 'N' || dim === 'S') return [a, b];
  if (dim === 'W' || dim === 'E') return [b, a];
}

},{}],3:[function(require,module,exports){
// https://d3js.org/d3-dsv/ Version 1.0.1. Copyright 2016 Mike Bostock.
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.d3 = global.d3 || {})));
}(this, function (exports) { 'use strict';

  function objectConverter(columns) {
    return new Function("d", "return {" + columns.map(function(name, i) {
      return JSON.stringify(name) + ": d[" + i + "]";
    }).join(",") + "}");
  }

  function customConverter(columns, f) {
    var object = objectConverter(columns);
    return function(row, i) {
      return f(object(row), i, columns);
    };
  }

  // Compute unique columns in order of discovery.
  function inferColumns(rows) {
    var columnSet = Object.create(null),
        columns = [];

    rows.forEach(function(row) {
      for (var column in row) {
        if (!(column in columnSet)) {
          columns.push(columnSet[column] = column);
        }
      }
    });

    return columns;
  }

  function dsv(delimiter) {
    var reFormat = new RegExp("[\"" + delimiter + "\n]"),
        delimiterCode = delimiter.charCodeAt(0);

    function parse(text, f) {
      var convert, columns, rows = parseRows(text, function(row, i) {
        if (convert) return convert(row, i - 1);
        columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
      });
      rows.columns = columns;
      return rows;
    }

    function parseRows(text, f) {
      var EOL = {}, // sentinel value for end-of-line
          EOF = {}, // sentinel value for end-of-file
          rows = [], // output rows
          N = text.length,
          I = 0, // current character index
          n = 0, // the current line number
          t, // the current token
          eol; // is the current token followed by EOL?

      function token() {
        if (I >= N) return EOF; // special case: end of file
        if (eol) return eol = false, EOL; // special case: end of line

        // special case: quotes
        var j = I, c;
        if (text.charCodeAt(j) === 34) {
          var i = j;
          while (i++ < N) {
            if (text.charCodeAt(i) === 34) {
              if (text.charCodeAt(i + 1) !== 34) break;
              ++i;
            }
          }
          I = i + 2;
          c = text.charCodeAt(i + 1);
          if (c === 13) {
            eol = true;
            if (text.charCodeAt(i + 2) === 10) ++I;
          } else if (c === 10) {
            eol = true;
          }
          return text.slice(j + 1, i).replace(/""/g, "\"");
        }

        // common case: find next delimiter or newline
        while (I < N) {
          var k = 1;
          c = text.charCodeAt(I++);
          if (c === 10) eol = true; // \n
          else if (c === 13) { eol = true; if (text.charCodeAt(I) === 10) ++I, ++k; } // \r|\r\n
          else if (c !== delimiterCode) continue;
          return text.slice(j, I - k);
        }

        // special case: last token before EOF
        return text.slice(j);
      }

      while ((t = token()) !== EOF) {
        var a = [];
        while (t !== EOL && t !== EOF) {
          a.push(t);
          t = token();
        }
        if (f && (a = f(a, n++)) == null) continue;
        rows.push(a);
      }

      return rows;
    }

    function format(rows, columns) {
      if (columns == null) columns = inferColumns(rows);
      return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
        return columns.map(function(column) {
          return formatValue(row[column]);
        }).join(delimiter);
      })).join("\n");
    }

    function formatRows(rows) {
      return rows.map(formatRow).join("\n");
    }

    function formatRow(row) {
      return row.map(formatValue).join(delimiter);
    }

    function formatValue(text) {
      return text == null ? ""
          : reFormat.test(text += "") ? "\"" + text.replace(/\"/g, "\"\"") + "\""
          : text;
    }

    return {
      parse: parse,
      parseRows: parseRows,
      format: format,
      formatRows: formatRows
    };
  }

  var csv = dsv(",");

  var csvParse = csv.parse;
  var csvParseRows = csv.parseRows;
  var csvFormat = csv.format;
  var csvFormatRows = csv.formatRows;

  var tsv = dsv("\t");

  var tsvParse = tsv.parse;
  var tsvParseRows = tsv.parseRows;
  var tsvFormat = tsv.format;
  var tsvFormatRows = tsv.formatRows;

  exports.dsvFormat = dsv;
  exports.csvParse = csvParse;
  exports.csvParseRows = csvParseRows;
  exports.csvFormat = csvFormat;
  exports.csvFormatRows = csvFormatRows;
  exports.tsvParse = tsvParse;
  exports.tsvParseRows = tsvParseRows;
  exports.tsvFormat = tsvFormat;
  exports.tsvFormatRows = tsvFormatRows;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
},{}]},{},[1])(1)
});

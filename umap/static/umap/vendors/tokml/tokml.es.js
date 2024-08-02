/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist').Parent} Parent
 * @typedef {import('unist').Literal} Literal
 * @typedef {Object.<string, unknown>} Props
 * @typedef {Array.<Node>|string} ChildrenOrValue
 *
 * @typedef {(<T extends string, P extends Record<string, unknown>, C extends Node[]>(type: T, props: P, children: C) => {type: T, children: C} & P)} BuildParentWithProps
 * @typedef {(<T extends string, P extends Record<string, unknown>>(type: T, props: P, value: string) => {type: T, value: string} & P)} BuildLiteralWithProps
 * @typedef {(<T extends string, P extends Record<string, unknown>>(type: T, props: P) => {type: T} & P)} BuildVoidWithProps
 * @typedef {(<T extends string, C extends Node[]>(type: T, children: C) => {type: T, children: C})} BuildParent
 * @typedef {(<T extends string>(type: T, value: string) => {type: T, value: string})} BuildLiteral
 * @typedef {(<T extends string>(type: T) => {type: T})} BuildVoid
 */

var u = /**
 * @type {BuildVoid & BuildVoidWithProps & BuildLiteral & BuildLiteralWithProps & BuildParent & BuildParentWithProps}
 */ (
  /**
   * @param {string} type Type of node
   * @param {Props|ChildrenOrValue} [props] Additional properties for node (or `children` or `value`)
   * @param {ChildrenOrValue} [value] `children` or `value` of node
   * @returns {Node}
   */
  function (type, props, value) {
    /** @type {Node} */
    var node = {type: String(type)};

    if (
      (value === undefined || value === null) &&
      (typeof props === 'string' || Array.isArray(props))
    ) {
      value = props;
    } else {
      Object.assign(node, props);
    }

    if (Array.isArray(value)) {
      node.children = value;
    } else if (value !== undefined && value !== null) {
      node.value = String(value);
    }

    return node
  }
);

/**
 * @typedef {import('xast').Root} Root
 * @typedef {import('xast').Element} Element
 * @typedef {Root['children'][number]} Child
 * @typedef {Child|Root} Node
 * @typedef {Root|Element} XResult
 * @typedef {string|number|boolean|null|undefined} XValue
 * @typedef {{[attribute: string]: XValue}} XAttributes Attributes to support JS primitive types
 *
 * @typedef {string|number|null|undefined} XPrimitiveChild
 * @typedef {Array.<Node|XPrimitiveChild>} XArrayChild
 * @typedef {Node|XPrimitiveChild|XArrayChild} XChild
 * @typedef {import('./jsx-classic').Element} x.JSX.Element
 * @typedef {import('./jsx-classic').IntrinsicAttributes} x.JSX.IntrinsicAttributes
 * @typedef {import('./jsx-classic').IntrinsicElements} x.JSX.IntrinsicElements
 * @typedef {import('./jsx-classic').ElementChildrenAttribute} x.JSX.ElementChildrenAttribute
 */

/**
 * Create XML trees in xast.
 *
 * @param name Qualified name. Case sensitive and can contain a namespace prefix (such as `rdf:RDF`). Pass `null|undefined` to build a root.
 * @param attributes Map of attributes. Nullish (null or undefined) or NaN values are ignored, other values (strings, booleans) are cast to strings.
 * @param children (Lists of) child nodes. When strings are encountered, they are mapped to Text nodes.
 */
const x =
  /**
   * @type {{
   *   (): Root
   *   (name: null|undefined, ...children: XChild[]): Root
   *   (name: string, attributes: XAttributes, ...children: XChild[]): Element
   *   (name: string, ...children: XChild[]): Element
   * }}
   */
  (
    /**
     * Hyperscript compatible DSL for creating virtual xast trees.
     *
     * @param {string|null} [name]
     * @param {XAttributes|XChild} [attributes]
     * @param {XChild[]} children
     * @returns {XResult}
     */
    function (name, attributes, ...children) {
      var index = -1;
      /** @type {XResult} */
      var node;
      /** @type {string} */
      var key;

      if (name === undefined || name === null) {
        node = {type: 'root', children: []};
        // @ts-ignore Root builder doesn’t accept attributes.
        children.unshift(attributes);
      } else if (typeof name === 'string') {
        node = {type: 'element', name, attributes: {}, children: []};

        if (isAttributes(attributes)) {
          for (key in attributes) {
            // Ignore nullish and NaN values.
            if (
              attributes[key] !== undefined &&
              attributes[key] !== null &&
              (typeof attributes[key] !== 'number' ||
                !Number.isNaN(attributes[key]))
            ) {
              // @ts-ignore Pretty sure we just set it.
              node.attributes[key] = String(attributes[key]);
            }
          }
        } else {
          children.unshift(attributes);
        }
      } else {
        throw new TypeError('Expected element name, got `' + name + '`')
      }

      // Handle children.
      while (++index < children.length) {
        addChild(node.children, children[index]);
      }

      return node
    }
  );

/**
 * @param {Array.<Child>} nodes
 * @param {XChild} value
 */
function addChild(nodes, value) {
  var index = -1;

  if (value === undefined || value === null) ; else if (typeof value === 'string' || typeof value === 'number') {
    nodes.push({type: 'text', value: String(value)});
  } else if (Array.isArray(value)) {
    while (++index < value.length) {
      addChild(nodes, value[index]);
    }
  } else if (typeof value === 'object' && 'type' in value) {
    if (value.type === 'root') {
      addChild(nodes, value.children);
    } else {
      nodes.push(value);
    }
  } else {
    throw new TypeError('Expected node, nodes, string, got `' + value + '`')
  }
}

/**
 * @param {XAttributes|XChild} value
 * @returns {value is XAttributes}
 */
function isAttributes(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  return true
}

/**
 * @typedef {import('./index.js').Parent} Parent
 * @typedef {import('./index.js').Context} Context
 * @typedef {import('./index.js').Child} Child
 */

/**
 * Serialize all children of `parent`.
 *
 * @param {Parent} parent
 * @param {Context} ctx
 * @returns {string}
 *
 */
function all(parent, ctx) {
  /** @type {Array.<Child>} */
  var children = (parent && parent.children) || [];
  var index = -1;
  /** @type {Array.<string>} */
  var results = [];

  while (++index < children.length) {
    results[index] = one(children[index], ctx);
  }

  return results.join('')
}

/**
 * @typedef {Object} CoreOptions
 * @property {string[]} [subset=[]]
 *   Whether to only escape the given subset of characters.
 * @property {boolean} [escapeOnly=false]
 *   Whether to only escape possibly dangerous characters.
 *   Those characters are `"`, `&`, `'`, `<`, `>`, and `` ` ``.
 *
 * @typedef {Object} FormatOptions
 * @property {(code: number, next: number, options: CoreWithFormatOptions) => string} format
 *   Format strategy.
 *
 * @typedef {CoreOptions & FormatOptions & import('./util/format-smart.js').FormatSmartOptions} CoreWithFormatOptions
 */

/**
 * Encode certain characters in `value`.
 *
 * @param {string} value
 * @param {CoreWithFormatOptions} options
 * @returns {string}
 */
function core(value, options) {
  value = value.replace(
    options.subset ? charactersToExpression(options.subset) : /["&'<>`]/g,
    basic
  );

  if (options.subset || options.escapeOnly) {
    return value
  }

  return (
    value
      // Surrogate pairs.
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, surrogate)
      // BMP control characters (C0 except for LF, CR, SP; DEL; and some more
      // non-ASCII ones).
      .replace(
        // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
        /[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g,
        basic
      )
  )

  /**
   * @param {string} pair
   * @param {number} index
   * @param {string} all
   */
  function surrogate(pair, index, all) {
    return options.format(
      (pair.charCodeAt(0) - 0xd800) * 0x400 +
        pair.charCodeAt(1) -
        0xdc00 +
        0x10000,
      all.charCodeAt(index + 2),
      options
    )
  }

  /**
   * @param {string} character
   * @param {number} index
   * @param {string} all
   */
  function basic(character, index, all) {
    return options.format(
      character.charCodeAt(0),
      all.charCodeAt(index + 1),
      options
    )
  }
}

/**
 * @param {string[]} subset
 * @returns {RegExp}
 */
function charactersToExpression(subset) {
  /** @type {string[]} */
  const groups = [];
  let index = -1;

  while (++index < subset.length) {
    groups.push(subset[index].replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'));
  }

  return new RegExp('(?:' + groups.join('|') + ')', 'g')
}

/**
 * The smallest way to encode a character.
 *
 * @param {number} code
 * @returns {string}
 */
function formatBasic(code) {
  return '&#x' + code.toString(16).toUpperCase() + ';'
}

/**
 * @typedef {import('./core.js').CoreOptions & import('./util/format-smart.js').FormatSmartOptions} Options
 * @typedef {import('./core.js').CoreOptions} LightOptions
 */

/**
 * Encode special characters in `value` as hexadecimals.
 *
 * @param {string} value
 *   Value to encode.
 * @param {LightOptions} [options]
 *   Configuration.
 * @returns {string}
 *   Encoded value.
 */
function stringifyEntitiesLight(value, options) {
  return core(value, Object.assign({format: formatBasic}, options))
}

var noncharacter = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Escape a string.
 *
 * @param {string} value
 * @param {Array.<string>} subset
 * @param {RegExp} [unsafe]
 * @returns {string}
 */
function escape(value, subset, unsafe) {
  var result = clean(value);

  return unsafe ? result.replace(unsafe, encode) : encode(result)

  /**
   * @param {string} $0
   * @returns {string}
   */
  function encode($0) {
    return stringifyEntitiesLight($0, {subset})
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function clean(value) {
  return String(value || '').replace(noncharacter, '')
}

var subset$3 = ['\t', '\n', ' ', '"', '&', "'", '/', '<', '=', '>'];

/**
 * Serialize a node name.
 *
 * @param {string} value
 * @returns {string}
 */
function name(value) {
  return escape(value, subset$3)
}

/**
 * Count how often a character (or substring) is used in a string.
 *
 * @param {string} value
 *   Value to search in.
 * @param {string} character
 *   Character (or substring) to look for.
 * @return {number}
 *   Number of times `character` occurred in `value`.
 */
function ccount(value, character) {
  const source = String(value);

  if (typeof character !== 'string') {
    throw new TypeError('Expected character')
  }

  let count = 0;
  let index = source.indexOf(character);

  while (index !== -1) {
    count++;
    index = source.indexOf(character, index + character.length);
  }

  return count
}

/**
 * @typedef {import('./index.js').Context} Context
 */

/**
 * Serialize an attribute value.
 *
 * @param {string} value
 * @param {Context} ctx
 * @returns {string}
 */
function value(value, ctx) {
  var primary = ctx.quote;
  var secondary = ctx.alternative;
  var result = String(value);
  var quote =
    secondary && ccount(result, primary) > ccount(result, secondary)
      ? secondary
      : primary;

  return quote + escape(result, ['<', '&', quote]) + quote
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Element} Element
 * @typedef {import('./index.js').Attributes} Attributes
 */

var own$1 = {}.hasOwnProperty;

/**
 * Serialize an element.
 *
 * @type {Handle}
 * @param {Element} node
 */
function element(node, ctx) {
  var nodeName = name(node.name);
  var content = all(node, ctx);
  /** @type {Attributes} */
  var attributes = node.attributes || {};
  var close = content ? false : ctx.close;
  /** @type {Array.<string>} */
  var attrs = [];
  /** @type {string} */
  var key;
  /** @type {Attributes[keyof Attributes]} */
  var result;

  for (key in attributes) {
    if (own$1.call(attributes, key)) {
      result = attributes[key];

      if (result !== null && result !== undefined) {
        attrs.push(name(key) + '=' + value(result, ctx));
      }
    }
  }

  return (
    '<' +
    nodeName +
    (attrs.length === 0 ? '' : ' ' + attrs.join(' ')) +
    (close ? (ctx.tight ? '' : ' ') + '/' : '') +
    '>' +
    content +
    (close ? '' : '</' + nodeName + '>')
  )
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Text} Text
 */

var subset$2 = ['&', '<'];

/**
 * Serialize a text.
 *
 * @type {Handle}
 * @param {Text} node
 */
function text(node) {
  return escape(node.value, subset$2)
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Comment} Comment
 */

/**
 * Serialize a comment.
 *
 * @type {Handle}
 * @param {Comment} node
 */
function comment(node) {
  return '<!--' + escape(node.value, ['-']) + '-->'
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Doctype} Doctype
 */

/**
 * Serialize a doctype.
 *
 * @type {Handle}
 * @param {Doctype} node
 */
function doctype(node, ctx) {
  var nodeName = name(node.name);
  var pub = node.public;
  var sys = node.system;
  var result = '<!DOCTYPE';

  if (nodeName !== '') {
    result += ' ' + nodeName;
  }

  if (pub !== null && pub !== undefined && pub !== '') {
    result += ' PUBLIC ' + value(pub, ctx);
  } else if (sys !== null && sys !== undefined && sys !== '') {
    result += ' SYSTEM';
  }

  if (sys !== null && sys !== undefined && sys !== '') {
    result += ' ' + value(sys, ctx);
  }

  return result + '>'
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Instruction} Instruction
 */

var unsafe$1 = /\?>/g;
var subset$1 = ['>'];

/**
 * Serialize an instruction.
 *
 * @type {Handle}
 * @param {Instruction} node
 */
function instruction(node) {
  var nodeName = name(node.name) || 'x';
  var result = escape(node.value, subset$1, unsafe$1);
  return '<?' + nodeName + (result ? ' ' + result : '') + '?>'
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Cdata} Cdata
 */

var unsafe = /]]>/g;
var subset = ['>'];

/**
 * Serialize a CDATA section.
 *
 * @type {Handle}
 * @param {Cdata} node
 */
function cdata(node) {
  return '<![CDATA[' + escape(node.value, subset, unsafe) + ']]>'
}

/**
 * @typedef {import('./index.js').Handle} Handle
 * @typedef {import('./index.js').Raw} Raw
 */

/**
 * Serialize a (non-standard) raw.
 *
 * @type {Handle}
 * @param {Raw} node
 */
function raw(node, ctx) {
  // @ts-ignore Looks like a text.
  return ctx.dangerous ? node.value : text(node)
}

/**
 * @typedef {import('./index.js').Handle} Handle
 */

var own = {}.hasOwnProperty;

var handlers = {
  root: all,
  element,
  text,
  comment,
  doctype,
  instruction,
  cdata,
  raw
};

/**
 * Serialize a node.
 *
 * @type {Handle}
 */
function one(node, ctx) {
  var type = node && node.type;

  if (!type) {
    throw new Error('Expected node, not `' + node + '`')
  }

  if (!own.call(handlers, type)) {
    throw new Error('Cannot compile unknown node `' + type + '`')
  }

  // @ts-ignore Hush, it works.
  return handlers[type](node, ctx)
}

/**
 * @typedef {import('xast').Root} Root
 * @typedef {import('xast').Element} Element
 * @typedef {import('xast').Cdata} Cdata
 * @typedef {import('xast').Comment} Comment
 * @typedef {import('xast').Doctype} Doctype
 * @typedef {import('xast').Instruction} Instruction
 * @typedef {import('xast').Text} Text
 * @typedef {import('xast').Literal & {type: 'raw'}} Raw
 * @typedef {Root|Element} Parent
 * @typedef {import('xast').Attributes} Attributes
 * @typedef {Root['children'][number]} Child
 * @typedef {Child|Root} Node
 *
 * @typedef {'"'|"'"} Quote
 *
 * @typedef Options
 * @property {Quote} [quote='"'] Preferred quote to use
 * @property {boolean} [quoteSmart=false] Use the other quote if that results in
 *   less bytes
 * @property {boolean} [closeEmptyElements=false] Close elements without any
 *   content with slash (/) on the opening tag instead of an end tag:
 *   `<circle />` instead of `<circle></circle>`.
 *   See `tightClose` to control whether a space is used before the slash.
 * @property {boolean} [tightClose=false] Do not use an extra space when closing
 *    self-closing elements: `<circle/>` instead of `<circle />`.
 * @property {boolean} [allowDangerousXml=false] Allow `raw` nodes and insert
 *   them as raw XML. When falsey, encodes `raw` nodes.
 *   Only set this if you completely trust the content!
 *
 * @typedef Context
 * @property {Quote} quote
 * @property {Quote} alternative
 * @property {boolean} close
 * @property {boolean} tight
 * @property {boolean} dangerous
 *
 * @callback Handle
 * @param {Node} node
 * @param {Context} context
 * @returns {string}
 */

/**
 * Serialize the given xast tree (or list of nodes).
 *
 * @param {Node|Array.<Node>} node
 * @param {Options} [options]
 * @returns {string}
 */
function toXml(node, options = {}) {
  var quote = options.quote || '"';
  /** @type {Quote} */
  var alternative = quote === '"' ? "'" : '"';
  var smart = options.quoteSmart;
  /** @type {Node} */
  // @ts-ignore Assume no `root` in `node`.
  var value = Array.isArray(node) ? {type: 'root', children: node} : node;

  if (quote !== '"' && quote !== "'") {
    throw new Error('Invalid quote `' + quote + '`, expected `\'` or `"`')
  }

  return one(value, {
    dangerous: options.allowDangerousXml,
    close: options.closeEmptyElements,
    tight: options.tightClose,
    quote,
    alternative: smart ? alternative : null
  })
}

const BR = u('text', '\n');
const TAB = u('text', '  ');
/**
 * Convert nested folder structure to KML. This expects
 * input that follows the same patterns as [toGeoJSON](https://github.com/placemark/togeojson)'s
 * kmlWithFolders method: a tree of folders and features,
 * starting with a root element.
 */
function foldersToKML(root) {
    return toXml(u('root', [
        x('kml', { xmlns: 'http://www.opengis.net/kml/2.2' }, x('Document', root.children.flatMap((child) => convertChild(child)))),
    ]));
}
/**
 * Convert a GeoJSON FeatureCollection to a string of
 * KML data.
 */
function toKML(featureCollection) {
    return toXml(u('root', [
        x('kml', { xmlns: 'http://www.opengis.net/kml/2.2' }, x('Document', featureCollection.features.flatMap((feature) => convertFeature(feature)))),
    ]));
}
function convertChild(child) {
    switch (child.type) {
        case 'Feature':
            return convertFeature(child);
        case 'folder':
            return convertFolder(child);
    }
}
function convertFolder(folder) {
    const id = ['string', 'number'].includes(typeof folder.meta.id)
        ? {
            id: String(folder.meta.id),
        }
        : {};
    return [
        BR,
        x('Folder', id, [
            BR,
            ...folderMeta(folder.meta),
            BR,
            TAB,
            ...folder.children.flatMap((child) => convertChild(child)),
        ]),
    ];
}
const META_PROPERTIES = [
    'address',
    'description',
    'name',
    'open',
    'visibility',
    'phoneNumber',
];
function folderMeta(meta) {
    return META_PROPERTIES.filter((p) => meta[p] !== undefined).map((p) => {
        return x(p, [u('text', String(meta[p]))]);
    });
}
function convertFeature(feature) {
    const { id } = feature;
    const idMember = ['string', 'number'].includes(typeof id)
        ? {
            id: id,
        }
        : {};
    return [
        BR,
        x('Placemark', idMember, [
            BR,
            ...propertiesToTags(feature.properties),
            BR,
            TAB,
            ...(feature.geometry ? [convertGeometry(feature.geometry)] : []),
        ]),
    ];
}
function join(position) {
    return `${position[0]},${position[1]}`;
}
function coord1(coordinates) {
    return x('coordinates', [u('text', join(coordinates))]);
}
function coord2(coordinates) {
    return x('coordinates', [u('text', coordinates.map(join).join('\n'))]);
}
function toString(value) {
    switch (typeof value) {
        case 'string': {
            return value;
        }
        case 'boolean':
        case 'number': {
            return String(value);
        }
        case 'object': {
            try {
                return JSON.stringify(value);
            }
            catch (e) {
                return '';
            }
        }
    }
    return '';
}
function maybeCData(value) {
    if (value &&
        typeof value === 'object' &&
        '@type' in value &&
        value['@type'] === 'html' &&
        'value' in value &&
        typeof value.value === 'string') {
        return u('cdata', value.value);
    }
    return toString(value);
}
function propertiesToTags(properties) {
    if (!properties)
        return [];
    const { name, description, visibility, ...otherProperties } = properties;
    return [
        name && x('name', [u('text', toString(name))]),
        description && x('description', [u('text', maybeCData(description))]),
        visibility !== undefined &&
            x('visibility', [u('text', visibility ? '1' : '0')]),
        x('ExtendedData', Object.entries(otherProperties).flatMap(([name, value]) => [
            BR,
            TAB,
            x('Data', { name: name }, [
                x('value', [
                    u('text', typeof value === 'string' ? value : JSON.stringify(value)),
                ]),
            ]),
        ])),
    ].filter(Boolean);
}
const linearRing = (ring) => x('LinearRing', [coord2(ring)]);
function convertMultiPoint(geometry) {
    return x('MultiGeometry', geometry.coordinates.flatMap((coordinates) => [
        BR,
        convertGeometry({
            type: 'Point',
            coordinates,
        }),
    ]));
}
function convertMultiLineString(geometry) {
    return x('MultiGeometry', geometry.coordinates.flatMap((coordinates) => [
        BR,
        convertGeometry({
            type: 'LineString',
            coordinates,
        }),
    ]));
}
function convertMultiPolygon(geometry) {
    return x('MultiGeometry', geometry.coordinates.flatMap((coordinates) => [
        BR,
        convertGeometry({
            type: 'Polygon',
            coordinates,
        }),
    ]));
}
function convertPolygon(geometry) {
    const [outerBoundary, ...innerRings] = geometry.coordinates;
    return x('Polygon', [
        BR,
        x('outerBoundaryIs', [BR, TAB, linearRing(outerBoundary)]),
        ...innerRings.flatMap((innerRing) => [
            BR,
            x('innerBoundaryIs', [BR, TAB, linearRing(innerRing)]),
        ]),
    ]);
}
function convertGeometry(geometry) {
    switch (geometry.type) {
        case 'Point':
            return x('Point', [coord1(geometry.coordinates)]);
        case 'MultiPoint':
            return convertMultiPoint(geometry);
        case 'LineString':
            return x('LineString', [coord2(geometry.coordinates)]);
        case 'MultiLineString':
            return convertMultiLineString(geometry);
        case 'Polygon':
            return convertPolygon(geometry);
        case 'MultiPolygon':
            return convertMultiPolygon(geometry);
        case 'GeometryCollection':
            return x('MultiGeometry', geometry.geometries.flatMap((geometry) => [
                BR,
                convertGeometry(geometry),
            ]));
    }
}

export { foldersToKML, toKML };
//# sourceMappingURL=tokml.es.mjs.map

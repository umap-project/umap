describe('L.Util', function () {

    describe('#toHTML()', function () {

        it('should handle title', function () {
            assert.equal(L.Util.toHTML('# A title'), '<h3>A title</h3>');
        });

        it('should handle title in the middle of the content', function () {
            assert.equal(L.Util.toHTML('A phrase\n## A title'), 'A phrase<br>\n<h4>A title</h4>');
        });

        it('should handle hr', function () {
            assert.equal(L.Util.toHTML('---'), '<hr>');
        });

        it('should handle bold', function () {
            assert.equal(L.Util.toHTML('Some **bold**'), 'Some <strong>bold</strong>');
        });

        it('should handle italic', function () {
            assert.equal(L.Util.toHTML('Some *italic*'), 'Some <em>italic</em>');
        });

        it('should handle newlines', function () {
            assert.equal(L.Util.toHTML('two\nlines'), 'two<br>\nlines');
        });

        it('should not change last newline', function () {
            assert.equal(L.Util.toHTML('two\nlines\n'), 'two<br>\nlines\n');
        });

        it('should handle two successive newlines', function () {
            assert.equal(L.Util.toHTML('two\n\nlines\n'), 'two<br>\n<br>\nlines\n');
        });

        it('should handle links without formatting', function () {
            assert.equal(L.Util.toHTML('A simple http://osm.org link'), 'A simple <a target="_blank" href="http://osm.org">http://osm.org</a> link');
        });

        it('should handle simple link in title', function () {
            assert.equal(L.Util.toHTML('# http://osm.org'), '<h3><a target="_blank" href="http://osm.org">http://osm.org</a></h3>');
        });

        it('should handle links with url parameter', function () {
            assert.equal(L.Util.toHTML('A simple https://osm.org/?url=https%3A//anotherurl.com link'), 'A simple <a target="_blank" href="https://osm.org/?url=https%3A//anotherurl.com">https://osm.org/?url=https%3A//anotherurl.com</a> link');
        });

        it('should handle simple link inside parenthesis', function () {
            assert.equal(L.Util.toHTML('A simple link (http://osm.org)'), 'A simple link (<a target="_blank" href="http://osm.org">http://osm.org</a>)');
        });

        it('should handle simple link with formatting', function () {
            assert.equal(L.Util.toHTML('A simple [[http://osm.org]] link'), 'A simple <a target="_blank" href="http://osm.org">http://osm.org</a> link');
        });

        it('should handle simple link with formatting and content', function () {
            assert.equal(L.Util.toHTML('A simple [[http://osm.org|link]]'), 'A simple <a target="_blank" href="http://osm.org">link</a>');
        });

        it('should handle simple link followed by a carriage return', function () {
            assert.equal(L.Util.toHTML('A simple link http://osm.org\nAnother line'), 'A simple link <a target="_blank" href="http://osm.org">http://osm.org</a><br>\nAnother line');
        });

        it('should handle image', function () {
            assert.equal(L.Util.toHTML('A simple image: {{http://osm.org/pouet.png}}'), 'A simple image: <img src="http://osm.org/pouet.png">');
        });

        it('should handle image without text', function () {
            assert.equal(L.Util.toHTML('{{http://osm.org/pouet.png}}'), '<img src="http://osm.org/pouet.png">');
        });

        it('should handle image with width', function () {
            assert.equal(L.Util.toHTML('A simple image: {{http://osm.org/pouet.png|100}}'), 'A simple image: <img src="http://osm.org/pouet.png" width="100">');
        });

        it('should handle iframe', function () {
            assert.equal(L.Util.toHTML('A simple iframe: {{{http://osm.org/pouet.html}}}'), 'A simple iframe: <div><iframe frameborder="0" src="http://osm.org/pouet.html" width="100%" height="300px"></iframe></div>');
        });

        it('should handle iframe with height', function () {
            assert.equal(L.Util.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200}}}'), 'A simple iframe: <div><iframe frameborder="0" src="http://osm.org/pouet.html" width="100%" height="200px"></iframe></div>');
        });

        it('should handle iframe with height and width', function () {
            assert.equal(L.Util.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200*400}}}'), 'A simple iframe: <div><iframe frameborder="0" src="http://osm.org/pouet.html" width="400px" height="200px"></iframe></div>');
        });

        it('should handle iframe with height with px', function () {
            assert.equal(L.Util.toHTML('A simple iframe: {{{http://osm.org/pouet.html|200px}}}'), 'A simple iframe: <div><iframe frameborder="0" src="http://osm.org/pouet.html" width="100%" height="200px"></iframe></div>');
        });

        it('should handle iframe with url parameter', function () {
            assert.equal(L.Util.toHTML('A simple iframe: {{{https://osm.org/?url=https%3A//anotherurl.com}}}'), 'A simple iframe: <div><iframe frameborder="0" src="https://osm.org/?url=https%3A//anotherurl.com" width="100%" height="300px"></iframe></div>');
        });

        it('should handle iframe with height with px', function () {
            assert.equal(L.Util.toHTML('A double iframe: {{{https://osm.org/pouet}}}{{{https://osm.org/boudin}}}'), 'A double iframe: <div><iframe frameborder="0" src="https://osm.org/pouet" width="100%" height="300px"></iframe></div><div><iframe frameborder="0" src="https://osm.org/boudin" width="100%" height="300px"></iframe></div>');
        });

        it('http link with http link as parameter as variable', function () {
            assert.equal(L.Util.toHTML('A phrase with a [[http://iframeurl.com?to=http://another.com]].'), 'A phrase with a <a target="_blank" href="http://iframeurl.com?to=http://another.com">http://iframeurl.com?to=http://another.com</a>.');
        });

    });

    describe('#escapeHTML', function () {

        it('should escape HTML tags', function () {
            assert.equal(L.Util.escapeHTML('<a href="pouet">'), '&lt;a href="pouet">');
        });

        it('should not fail with int value', function () {
            assert.equal(L.Util.escapeHTML(25), '25');
        });

        it('should not fail with null value', function () {
            assert.equal(L.Util.escapeHTML(null), '');
        });

    });

    describe('#greedyTemplate', function () {

        it('should replace simple props', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {variable}.', {variable: 'thing'}), 'A phrase with a thing.');
        });

        it('should not fail when missing key', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {missing}', {}), 'A phrase with a ');
        });

        it('should process brakets in brakets', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {{{variable}}}.', {variable: 'value'}), 'A phrase with a {{value}}.');
        });

        it('should not process http links', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {{{http://iframeurl.com}}}.', {'http://iframeurl.com': 'value'}), 'A phrase with a {{{http://iframeurl.com}}}.');
        });

        it('should not accept dash', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {var-iable}.', {'var-iable': 'value'}), 'A phrase with a {var-iable}.');
        });

        it('should accept colon', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {variable:fr}.', {'variable:fr': 'value'}), 'A phrase with a value.');
        });

        it('should replace even with ignore if key is found', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {variable:fr}.', {'variable:fr': 'value'}, true), 'A phrase with a value.');
        });

        it('should keep string when using ignore if key is not found', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {variable:fr}.', {}, true), 'A phrase with a {variable:fr}.');
        });

        it('should replace nested variables', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var}.', {fr: {var: 'value'}}), 'A phrase with a value.');
        });

        it('should not fail if nested variable is missing', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var.foo}.', {fr: {var: 'value'}}), 'A phrase with a .');
        });

        it('should not fail with nested variables and no data', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var.foo}.', {}), 'A phrase with a .');
        });

        it('should handle fallback value if any', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var.bar|"default"}.', {}), 'A phrase with a default.');
        });

        it('should handle fallback var if any', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var.bar|fallback}.', {fallback: "default"}), 'A phrase with a default.');
        });

        it('should handle multiple fallbacks', function () {
            assert.equal(L.Util.greedyTemplate('A phrase with a {fr.var.bar|try.again|"default"}.', {}), 'A phrase with a default.');
        });

    });

    describe('#TextColorFromBackgroundColor', function () {

        it('should output white for black', function () {
            document.body.style.backgroundColor = 'black';
            assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#ffffff');
        });

        it('should output white for brown', function () {
            document.body.style.backgroundColor = 'brown';
            assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#ffffff');
        });

        it('should output black for white', function () {
            document.body.style.backgroundColor = 'white';
            assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000');
        });

        it('should output black for tan', function () {
            document.body.style.backgroundColor = 'tan';
            assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000');
        });

        it('should output black by default', function () {
            document.body.style.backgroundColor = 'transparent';
            assert.equal(L.DomUtil.TextColorFromBackgroundColor(document.body), '#000000');
        });

    });


    describe('#flattenCoordinates()', function () {

        it('should not alter already flat coords', function () {
            var coords = [[1, 2], [3, 4]];
            assert.deepEqual(L.Util.flattenCoordinates(coords), coords);
        })

        it('should flatten nested coords', function () {
            var coords = [[[1, 2], [3, 4]]];
            assert.deepEqual(L.Util.flattenCoordinates(coords), coords[0]);
            coords = [[[[1, 2], [3, 4]]]];
            assert.deepEqual(L.Util.flattenCoordinates(coords), coords[0][0]);
        })

        it('should not fail on empty coords', function () {
            var coords = [];
            assert.deepEqual(L.Util.flattenCoordinates(coords), coords);
        })

    });

    describe('#usableOption()', function () {

        it('should consider false', function () {
            assert.ok(L.Util.usableOption({key: false}, 'key'));
        })

        it('should consider 0', function () {
            assert.ok(L.Util.usableOption({key: 0}, 'key'));
        })

        it('should not consider undefined', function () {
            assert.notOk(L.Util.usableOption({}, 'key'));
        })

        it('should not consider empty string', function () {
            assert.notOk(L.Util.usableOption({key: ''}, 'key'));
        })

        it('should consider null', function () {
            assert.ok(L.Util.usableOption({key: null}, 'key'));
        })

    });

});

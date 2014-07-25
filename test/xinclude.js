var fs = require('fs');
var path = require('path');
var assert = require('assert');
var transformer = require('../');
var utils = require('importer-utils');

function read(file) {
	return fs.readFileSync(p(file), 'utf8');
}

function p(file) {
	return path.join(__dirname, file);
}

function constructDocument(doc, transformer) {
	var out = '<?xml version="1.0" encoding="UTF-8"?>\n';
	out += '<document xmlns:xi="http://www.w3.org/2001/XInclude">\n';
	out += '<xi:include href="' + path.join(__dirname, 'xinclude/files.xml') + '"/>\n';
	out += '<xi:include href="' + path.join(__dirname, 'xinclude/items.xml') + '"/>\n';
	out += '<content></content>\n';
	out += '</document>';

	return out;
}

describe('Custom processor with XInclude', function() {
	it('transform', function(done) {
		transformer({
				htmlParser: false,
				transform: function(templates, docs, transformer) {
					templates = templates || [];
					return docs.map(function(doc) {
						var out = constructDocument(doc.content, transformer);
						templates.forEach(function(template) {
							out = transformer.transform(template, out, transformer._stylesheetParams);
						});

						return utils.extend({}, doc, {
							content: out
						});
					});
				}
			})
			.stylesheet(p('xsl/xinclude.xsl'))
			.run(p('html/test1.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, read('fixtures/xinclude.xml'));
				done();
			});
	});
});
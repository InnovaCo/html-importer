var fs = require('fs');
var path = require('path');
var assert = require('assert');
var utils = require('importer-utils');
var cleanup = require('../lib/cleanup');

var transformer = require('../');

function read(p, isFile) {
	return fs.readFileSync(path.join(__dirname, p), isFile ? {encoding: 'utf8'} : null);
}

function htmlProcessor(nodes) {
	nodes.forEach(function(node) {
		if (node.type === 'tag' && node.name === 'a' && ('href' in node.attribs)) {
			node.attribs.href = '/a' + node.attribs.href;
		}

		if (node.children) {
			htmlProcessor(node.children);
		}
	});
}

function asyncHtmlProcessor(nodes, res, cb) {
	setTimeout(function() {
		htmlProcessor(nodes);
		cb();
	}, 10);
}

describe('HTML transformer', function() {
	function fileObj(src) {
		return {
			src: src,
			cwd: __dirname
		};
	}

	var fixtures = {
		test1:   read('fixtures/test1.xml', true),
		test2:   read('fixtures/test2.xml', true),
		test3:   read('fixtures/test3.xml', true),
		test4:   read('fixtures/test4.xml', true),
		test5ru: read('fixtures/test5-ru.xml', true),
		test5en: read('fixtures/test5-en.xml', true),
		multi:   read('fixtures/multitransform.html', true)
	};

	it('apply transforms from buffers', function(done) {
		var html = read('html/test1.html');
		var xsl = read('xsl/stylesheet1.xsl');

		transformer()
			.stylesheet(xsl)
			.run(html, function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test1);
				done();
			});
	});

	it('apply transforms from files', function(done) {
		transformer()
			.stylesheet(fileObj('xsl/stylesheet1.xsl'))
			.run(fileObj('html/test1.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test1);
				done();
			});
	});

	it('resolve glob patterns when applying transforms from files', function(done) {
		transformer()
			.stylesheet(fileObj('xsl/stylesheet1.xsl'))
			.run(fileObj('html/*.html'), function(err, out) {
				assert.equal(out.length, 4);
				assert.equal(out[1].content, fixtures.test1);
				assert.equal(out[2].content, fixtures.test2);
				done();
			});
	});

	it('apply multiple XSL stylesheets', function(done) {
		transformer()
			.stylesheet(fileObj('xsl/{stylesheet1,stylesheet2}.xsl'))
			.run(fileObj('html/test1.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test3);
				done();
			});
	});

	it('apply preprocessor to HTML before transform', function(done) {
		transformer()
			.stylesheet(fileObj('xsl/stylesheet3.xsl'))
			.use(htmlProcessor)
			.run(fileObj('html/test2.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test4);
				done();
			});
	});

	it('apply async preprocessor to HTML before transform', function(done) {
		transformer()
			.stylesheet(fileObj('xsl/stylesheet3.xsl'))
			.use(asyncHtmlProcessor)
			.run(fileObj('html/test2.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test4);
				done();
			});
	});

	it('use custom transformer', function(done) {
		transformer({
				transform: function(templates, docs, t) {
					var result = [];
					templates = templates || [];
					['ru', 'en'].forEach(function(lang) {
						docs.forEach(function(doc) {
							var out = doc.content;
							templates.forEach(function(template) {
								out = t.transform(template, out, {lang: "'" + lang + "'"});
							});

							result.push(utils.extend({}, doc, {
								content: out,
								file: path.join(lang, doc.file),
								absPath: path.join(doc.cwd, lang, doc.file),
							}));
						});
					});
					return result;
				}
			})
			.stylesheet(fileObj('xsl/stylesheet4.xsl'))
			.run(fileObj('html/test2.html'), function(err, out) {
				assert.equal(out.length, 2);
				assert.equal(out[0].content, fixtures.test5ru);
				assert.equal(out[1].content, fixtures.test5en);
				done();
			});
	});

	it('clean-up attributes', function(done) {
		var content = new Buffer('<html xmlns="http://www.w3.org/1999/html"><body><svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>');
		transformer()
			.use(cleanup())
			.run(content, function(err, out) {
				assert.equal(out[0].content, '<html><body><svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>');
				done();
			});
	});

	it('missing entities', function(done) {
		var content = new Buffer('<?xml version="1.0"?><!DOCTYPE html SYSTEM "test/xinclude/entities.dtd"><html><body><a href="/?a=3&b=4">Hello&nbsp;world &#160;</a></body></html>');
		transformer({htmlParser: false})
			.stylesheet(fileObj('xsl/copy.xsl'))
			.run(content, function(err, out) {
				assert.equal(out[0].content, '<html><body><a href="/?a=3&amp;b=4">Hello' + String.fromCharCode(160) + 'world ' + String.fromCharCode(160) + '</a></body></html>\n');
				done();
			});
	});

	it('parse HTML', function(done) {
		// должен сохранить незакрытый <link>
		var content = new Buffer('<html><body><link><p>test</p></body></html>');
		transformer()
			.stylesheet(fileObj('xsl/copy.xsl'))
			.run(content, function(err, out) {
				assert.equal(out[0].content, '<html><body>\n<link>\n<p>test</p>\n</body></html>\n');
				done();
			});
	})

	it('parse XML', function(done) {
		// не должен заворачивать <p>test</p> в тэг <script>
		var content = new Buffer('<html><body><script/><p>test</p></body></html>');
		transformer({htmlParser: false})
			.stylesheet(fileObj('xsl/copy.xsl'))
			.run(content, function(err, out) {
				assert.equal(out[0].content, '<html><body>\n<script></script><p>test</p>\n</body></html>\n');
				done();
			});
	});

	it('multiple transforms', function(done) {
		transformer({htmlParser: false})
			.use(htmlProcessor)
			.stylesheet(fileObj('xsl/html.xsl'))
			.run(fileObj('multitransform/file.html'), function(err, out) {
				assert.equal(out[0].content, fixtures.multi);

				transformer()
					.stylesheet(fileObj('xsl/html.xsl'))
					.run(new Buffer(out[0].content), function(err, out) {
						assert.equal(out[0].content, fixtures.multi);
						done();
					});
			});
	});
});
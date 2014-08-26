var fs = require('fs');
var path = require('path');
var assert = require('assert');
var Resource = require('importer-utils').Resource;
var dom = require('../lib/dom');
var rewrite = require('../lib/rewrite-url');

function read(p) {
	return fs.readFileSync(path.join(__dirname, p), {encoding: 'utf8'});
}

describe('URL rewriter', function() {
	// var filePath = path.join(__dirname, 'html/urls.html');
	var res =  new Resource({
		cwd: __dirname,
		file: 'html/urls.html',
		prefix: '/a/b/c'
	});
	// var html = fs.readFileSync(filePath, {encoding: 'utf8'});

	var fixtures = {
		urls1: read('fixtures/urls1.html'),
		urls2: read('fixtures/urls2.html'),
		urls3: read('fixtures/urls3.html')
	};

	it('should properly rewrite URLs', function() {
		var doc = dom.parse(res.content);
		var proc = rewrite({
			cwd: __dirname,
			prefix: '/a/b/c'
		});

		proc(doc, res);
		assert.equal(dom.stringify(doc), fixtures.urls1);
	});

	it('should add custom tag to rewrite map', function() {
		var doc = dom.parse(res.content);
		var proc = rewrite({
			cwd: __dirname,
			prefix: '/a/b/c',
			rewriteMap: {
				foo: ['href']
			}
		});

		proc(doc, res);
		assert.equal(dom.stringify(doc), fixtures.urls2);
	});

	it('should use custom URL transformer', function() {
		var doc = dom.parse(res.content);
		var proc = rewrite({
			cwd: __dirname,
			prefix: '/a/b/c',
			transform: function(url, info) {
				return '/-' + url;
			}
		});

		proc(doc, res);
		assert.equal(dom.stringify(doc), fixtures.urls3);
	});
});
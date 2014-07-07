var fs = require('fs');
var path = require('path');
var assert = require('assert');

var transformer = require('../');

function read(p, options) {
	return fs.readFileSync(path.join(__dirname, p), options);
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
};

describe('HTML transformer', function() {
	var options = {
		cwd: __dirname
	};

	var fixtures = {
		test1: read('fixtures/test1.xml', {encoding: 'utf8'}),
		test2: read('fixtures/test2.xml', {encoding: 'utf8'}),
		test3: read('fixtures/test3.xml', {encoding: 'utf8'}),
		test4: read('fixtures/test4.xml', {encoding: 'utf8'})
	};

	it('should apply transforms from buffers', function(done) {
		var html = read('html/test1.html');
		var xsl = read('xsl/stylesheet1.xsl');

		transformer.transform(html, xsl, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test1);
			done();
		});
	});

	it('should apply transforms from files', function(done) {
		transformer.transform('html/test1.html', 'xsl/stylesheet1.xsl', options, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test1);
			done();
		});
	});

	it('should resolve glob patterns when applying transforms from files', function(done) {
		transformer.transform('html/*.html', 'xsl/stylesheet1.xsl', options, function(err, out) {
			assert.equal(out.length, 2);
			assert.equal(out[0].content, fixtures.test1);
			assert.equal(out[1].content, fixtures.test2);
			done();
		});
	});

	it('should apply multiple XSL stylesheets', function(done) {
		transformer.transform('html/test1.html', 'xsl/{stylesheet1,stylesheet2}.xsl', options, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test3);
			done();
		});
	});

	it('should apply preprocessor to HTML before transform', function(done) {
		var opt = {
			cwd: options.cwd,
			process: htmlProcessor
		};

		transformer.transform('html/test2.html', 'xsl/stylesheet3.xsl', opt, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test4);
			done();
		});
	});

	it('should apply async preprocessor to HTML before transform', function(done) {
		var opt = {
			cwd: options.cwd,
			process: function(dom, cb) {
				setTimeout(function() {
					htmlProcessor(dom);
					cb();
				}, 10);
			}
		};

		transformer.transform('html/test2.html', 'xsl/stylesheet3.xsl', opt, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test4);
			done();
		});
	});
});
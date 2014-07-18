var fs = require('fs');
var path = require('path');
var assert = require('assert');

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
		test1: read('fixtures/test1.xml', true),
		test2: read('fixtures/test2.xml', true),
		test3: read('fixtures/test3.xml', true),
		test4: read('fixtures/test4.xml', true)
	};

	it('should apply transforms from buffers', function(done) {
		var html = read('html/test1.html');
		var xsl = read('xsl/stylesheet1.xsl');

		transformer(xsl).run(html, function(err, out) {
			assert.equal(out.length, 1);
			assert.equal(out[0].content, fixtures.test1);
			done();
		});
	});

	it('should apply transforms from files', function(done) {
		transformer(fileObj('xsl/stylesheet1.xsl'))
			.run(fileObj('html/test1.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test1);
				done();
			});
	});

	it('should resolve glob patterns when applying transforms from files', function(done) {
		transformer(fileObj('xsl/stylesheet1.xsl'))
			.run(fileObj('html/*.html'), function(err, out) {
				assert.equal(out.length, 3);
				assert.equal(out[0].content, fixtures.test1);
				assert.equal(out[1].content, fixtures.test2);
				done();
			});
	});

	it('should apply multiple XSL stylesheets', function(done) {
		transformer(fileObj('xsl/{stylesheet1,stylesheet2}.xsl'))
			.run(fileObj('html/test1.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test3);
				done();
			});
	});

	it('should apply preprocessor to HTML before transform', function(done) {
		transformer(fileObj('xsl/stylesheet3.xsl'))
			.use(htmlProcessor)
			.run(fileObj('html/test2.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test4);
				done();
			});
	});

	it('should apply async preprocessor to HTML before transform', function(done) {
		transformer(fileObj('xsl/stylesheet3.xsl'))
			.use(asyncHtmlProcessor)
			.run(fileObj('html/test2.html'), function(err, out) {
				assert.equal(out.length, 1);
				assert.equal(out[0].content, fixtures.test4);
				done();
			});
	});
});
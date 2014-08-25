var fs = require('fs');
var path = require('path');
var assert = require('assert');
var utils = require('importer-utils');
var transformer = require('../');
var escape = require('../lib/escape');

function read(file) {
	return fs.readFileSync(path.join(__dirname, file));
}

describe('Escape node content', function() {
	it('escape', function(done) {
		var html = read('html/escape.html');
		transformer()
			.use(escape())
			.run(html, function(err, out) {
				assert.equal(out[0].content, read('fixtures/escape.html').toString('utf8'));
				done();
			});
	});
});
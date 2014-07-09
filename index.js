var xslt = require('node_xslt');
var preprocessor = require('xslt-preprocessor');

var fileUtils = require('./lib/file-utils');
var dom = require('./lib/dom');

var stylesheetCache = {};

function Transformer(stylesheet, options) {
	if (!(this instanceof Transformer)) {
		return new Transformer(stylesheet, options);
	}

	this._stylesheet = null;
	this._stylesheetOpt = null;
	this._processors = [];

	if (stylesheet) {
		this.stylesheet(stylesheet, options);
	}
}

Transformer.prototype = {
	stylesheet: function(files, options) {
		this._stylesheet = Array.isArray(files) ? files : [files];
		this._stylesheetOpt = options || {};
		return this;
	},

	use: function(processor) {
		for (var i = 0, il = arguments.length, p; i < il; i++) {
			p = arguments[i];
			if (!~this._processors.indexOf(p)) {
				this._processors.push(p);
			}
		}

		return this;
	},

	/**
	 * Готовим набор XSL-файлов, через который будем проводить трансформации:
	 * резолвим пути, читаем файлы и преобразуем их в закэшированные
	 * объекты, которые можно многократно применять к файлам
	 * @param  {Function} callback 
	 */
	_prepareStylesheet: function(callback) {
		var self = this;
		fileUtils.read(this._stylesheet, this._stylesheetOpt, function(err, result) {
			if (err) {
				return callback(err);
			}

			var cache = stylesheetCache;
			callback(null, result.map(function(item) {
				if (!cache[item.file]) {
					var doc = preprocessor.transform(item.content);
					doc = xslt.readXsltString(doc);
					doc.filePath = item.file;
					cache[item.file] = doc;
				}

				return cache[item.file];
			}));
		});
	},

	/**
	 * Готовим набор HTML-файлов к преобразованию: резолвим пути,
	 * читаем файлы, применяем препроцессинг (если надо) и возвращаем
	 * содержимое файлов в виде валидного XML
	 * @param  {Function} callback
	 */
	_prepareInput: function(files, options, callback) {
		var self = this;
		fileUtils.read(files, options, function(err, input) {
			if (err) {
				return callback(err);
			}

			var output = [];
			var next = function() {
				if (!input.length) {
					return callback(null, output.map(function(item) {
						item.content = dom.stringify(item.content);
						return item;
					}));
				}

				var cur = input.shift();
				self._processDoc(cur, function(doc) {
					output.push({
						file: cur.file,
						content: doc
					});
					next();
				});
			};

			next();
		});
	},

	_processDoc: function(res, callback) {
		var doc = dom.parse(res.content);
		var queue = this._processors.slice(0);
		var next = function() {
			if (!queue.length) {
				return callback(doc);
			}

			var fn = queue.shift();
			fn.length > 2 ? fn(doc, res, next) : next(fn(doc, res));
		};
		next();
	},

	run: function(files, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = null;
		}

		var self = this;
		self._prepareStylesheet(function(err, stylesheetList) {
			if (err) {
				return callback(err);
			}

			self._prepareInput(files, options, function(err, docList) {
				if (err) {
					return callback(err);
				}

				callback(null, docList.map(function(item) {
					var out = item.content;
					stylesheetList.forEach(function(stylesheetItem) {
						out = xslt.transform(stylesheetItem, xslt.readXmlString(out), []);
					});

					return {
						file: item.file,
						content: out
					}
				}));
			});
		});
	}
};

module.exports = Transformer;
module.exports.resetCache = function() {
	stylesheetCache = {};
};
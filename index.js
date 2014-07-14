var fs = require('fs');
var path = require('path');
var async = require('async');
var glob = require('glob');
var temp = require('temp').track();
var mkdirp = require('mkdirp');
var xslt = require('node_xslt');
var preprocessor = require('xslt-preprocessor');

var fileUtils = require('./lib/file-utils');
var dom = require('./lib/dom');

var stylesheetCache = {};

xslt.useInternalErrors();

function Transformer(stylesheet, options) {
	if (!(this instanceof Transformer)) {
		return new Transformer(stylesheet, options);
	}

	this._stylesheet = null;
	this._stylesheetOpt = null;
	this._processors = [];
	this.processXslt = true;

	if (stylesheet) {
		this.stylesheet(stylesheet, options);
	}
}

Transformer.prototype = {
	stylesheet: function(files, options) {
		this._stylesheet = files;
		this._stylesheetOpt = options;
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
	 * Предварительная обработка XSL-файлов через препроцессор.
	 * Файлы сохраняются в отдельную временную папку, при этом 
	 * меняется `cwd` у `_stylesheetOpt`
	 * @param  {Function} callback
	 */
	_preprocessStylesheet: function(callback) {
		var opt = this._stylesheetOpt;
		if (!this.processXslt || !opt) {
			// nothing to process
			return callback(null, null);
		}

		if (!opt.cwd) {
			return callback(new Error('Unable to preprocess XSL: you should pass stylessheet glob options with `cwd` parameter'), null);
		}

		async.waterfall([
			function(callback) {
				glob('**/*.*', opt, callback);
			},
			function(files, callback) {
				temp.mkdir('xsl', function(err, tmp) {
					callback(err, files, tmp);
				});
			},
			function(files, tmp, callback) {
				var reStylesheet = /\.xslt?$/;
				async.each(files, function(file, callback) {
					var srcPath = path.normalize(path.join(opt.cwd, file));
					var targetPath = path.join(tmp, file);

					if (reStylesheet.test(file)) {
						// preprocess XSLT files
						async.waterfall([
							function(callback) {
								mkdirp(path.dirname(targetPath), callback);
							},
							function(result, callback) {
								fs.readFile(srcPath, {encoding: 'utf8'}, callback);
							},
							function(content, callback) {
								fs.writeFile(targetPath, preprocessor.transform(content), callback);
							}
						], callback);
					} else {
						fileUtils.copy(srcPath, targetPath, callback);
					}
				}, function(err) { callback(err, tmp); });
			}
		], callback);
	},

	/**
	 * Готовим набор XSL-файлов, через который будем проводить трансформации:
	 * резолвим пути, читаем файлы и преобразуем их в закэшированные
	 * объекты, которые можно многократно применять к файлам
	 * @param  {Function} callback 
	 */
	_prepareStylesheet: function(callback) {
		var self = this;
		if (!this._stylesheet || !this._stylesheet.length) {
			return callback(null, []);
		}

		var opt = null;
		if (this._stylesheetOpt) {
			opt = {};
			for (var p in this._stylesheetOpt) {
				opt[p] = this._stylesheetOpt[p];
			}
		}

		async.waterfall([
			function(callback) {
				// preprocess stylesheet and switch `cwd` so 
				// next step will grab processed files from folder
				// with preprocessed stylesheets
				self._preprocessStylesheet(callback);
			}, function(tmpPath, callback) {
				if (tmpPath) {
					opt.cwd = tmpPath;
				}

				fileUtils.read(self._stylesheet, opt, function(err, result) {
					var cache = stylesheetCache;

					callback(err, result && result.map(function(item) {
						if (!item.file) {
							var doc = item.content;
							if (self.processXslt) {
								doc = preprocessor.transform(item.content);
							}
							return xslt.readXsltString(doc);
						} else if (!cache[item.file]) {
							cache[item.file] = xslt.readXsltFile(item.file);
						}

						return cache[item.file];
					}));
				});
			}
		], callback);
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
				console.log('err', err);
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
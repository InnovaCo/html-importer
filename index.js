var fs = require('fs');
var path = require('path');
var async = require('async');
var glob = require('glob');
var temp = require('temp').track();
var mkdirp = require('mkdirp');
var xslt = require('node_xslt');
var preprocessor = require('xslt-preprocessor');
var utils = require('importer-utils');
var dom = require('./lib/dom');

var stylesheetCache = {};

function Transformer(options) {
	if (!(this instanceof Transformer)) {
		return new Transformer(options);
	}

	this._stylesheet = null;
	this._stylesheetParams = [];
	this._processors = [];
	this.options = utils.extend({
		processXslt: true,
		htmlParser: true,
		suppressWarnings: true
	}, options);
}

Transformer.prototype = {
	stylesheet: function(files, params) {
		if (params && !Array.isArray(params)) {
			var p = [];
			Object.keys(params).forEach(function(key) {
				p.push(key, params[key]);
			});
			params = p;
		}

		this._stylesheet = utils.file.normalize(files);
		this._stylesheetParams = params || [];
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
		var opt = this._stylesheet.options;
		if (!this.options.processXslt || !opt.cwd) {
			// nothing to process
			return callback(null, null);
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
						utils.file.copy(srcPath, targetPath, callback);
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
		if (!this._stylesheet || !this._stylesheet.files.length) {
			return callback(null, []);
		}

		var opt = utils.extend(this._stylesheet.options);

		async.waterfall([
			function(callback) {
				// preprocess stylesheet and switch `cwd` so 
				// next step will grab processed files from folder
				// with preprocessed stylesheets
				self._preprocessStylesheet(callback);
			}, function(tmpPath, callback) {
				var oldCwd = opt.cwd
				if (tmpPath) {
					opt.cwd = tmpPath;
				}

				utils.file.read(self._stylesheet, function(err, result) {
					var cache = stylesheetCache;
					opt.cwd = oldCwd;

					callback(err, result && result.map(function(item) {
						if (!item.file) {
							var doc = item.content;
							if (self.options.processXslt) {
								doc = preprocessor.transform(item.content);
							}
							return xslt.readXsltString(doc);
						} else if (!cache[item.absPath]) {
							cache[item.absPath] = xslt.readXsltFile(item.absPath);
						}

						return cache[item.absPath];
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
	_prepareInput: function(files, callback) {
		var self = this;
		utils.file.read(files, function(err, input) {
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
					output.push(utils.extend({}, cur, {
						content: doc
					}));
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

	run: function(files, callback) {
		var self = this;
		if (self.options.suppressWarnings) {
			xslt.useInternalErrors();
		}

		self._prepareStylesheet(function(err, stylesheetList) {
			if (err) {
				return callback(err);
			}

			self._prepareInput(files, function(err, docList) {
				if (err) {
					return callback(err);
				}

				callback(null, docList.map(function(item) {
					var out = item.content;
					stylesheetList.forEach(function(stylesheetItem) {
						var doc = self.options.htmlParser ? xslt.readHtmlString(out) : xslt.readXmlString(out);
						out = xslt.transform(stylesheetItem, doc, self._stylesheetParams);
					});

					return utils.extend({}, item, {
						content: out
					});
				}));
			});
		});
	}
};

module.exports = Transformer;
module.exports.resetCache = function() {
	stylesheetCache = {};
};
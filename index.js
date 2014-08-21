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

/**
 * Стандартная функция для получения преобразованных файлов.
 * Функция принимает на вход набор XML и XSL документов и возвращает
 * массив преобразованных файлов.
 * Используется как опция объекта `Transformer` и подразумевается,
 * что он может быть перекрыт в конструкторе для получения нужного набора
 * файлов
 * @param  {Array} templates   Набор XSL-шаблонов
 * @param  {Array} docs        Набор документов для преобразования
 * @param  {Transformer} transformer Контекст, в котором делается преобразование
 * @return {Array}             Набор преобразованных документов
 */
function transform(templates, docs, transformer) {
	templates = templates || [];
	return docs.map(function(item) {
		var out = item.content;
		templates.forEach(function(template) {
			out = transformer.transform(template, out, transformer._stylesheetParams);
		});

		return utils.extend({}, item, {
			content: out
		});
	});
}

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
		suppressWarnings: true,
		transform: transform
	}, options);
}

Transformer.prototype = {
	stylesheet: function(files, params) {
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

	parseXml: function(doc, options) {
		if (typeof doc === 'string') {
			options = utils.extend(this.options, options);
			doc = options.htmlParser ? xslt.readHtmlString(doc) : xslt.readXmlString(doc);
		}
		return doc;
	},

	transform: function(template, doc, params) {
		doc = this.parseXml(doc);

		if (typeof params === 'object' && !Array.isArray(params)) {
			// normalize XSL params
			var normParams = [];
			params = Object.keys(params).forEach(function(key) {
				normParams.push(key, params[key]);
			});
			params = normParams;
		} else {
			params = params || [];
		}

		return xslt.transform(template, doc, params);
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
		var process = this._processResource.bind(this);

		async.waterfall([
			function(callback) {
				utils.file.read(files, callback);
			},
			function(files, callback) {
				async.map(files, process, callback);
			}
		], callback);
	},

	_processResource: function(res, callback) {
		var doc = dom.parse(res.content, !this.options.htmlParser ? {xmlMode: true} : null);
		var queue = this._processors.slice(0);
		if (this.options.use) {
			queue = queue.concat(this.options.use);
		}

		var next = function() {
			if (!queue.length) {
				res.content = dom.stringify(doc);
				return callback(null, res);
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
				return callback(err, !err && self.options.transform(stylesheetList, docList, self));
			});
		});
	}
};

module.exports = Transformer;
module.exports.resetCache = function() {
	stylesheetCache = {};
};
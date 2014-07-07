var fs = require('fs');
var path = require('path');

var xslt = require('node_xslt');
var preprocessor = require('inn-template');
var glob = require('glob');
var htmlparser = require('htmlparser2');
var DomHandler = require('domhandler');
var DomUtils = require('domutils');

/**
 * Парсит указанный XML/HTML документ в DOM
 * @param  {String} code Содержимое документа, которое нужно распарсить
 * @return {Object}      DOM-дерево документа
 */
function parseDoc(code) {
	var handler = new DomHandler();
	var parser = new htmlparser.Parser(handler);
	parser.write(code);
	parser.done();
	return handler.dom;
}

function strinfigyDom(dom) {
	var opt = {xmlMode: true};
	return dom.map(function(node) {
		return DomUtils.getOuterHTML(node, opt);
	}).join('');
}

function readFileList(list, callback) {
	var input = list.slice(0);
	var output = [];
	var next = function() {
		if (!input.length) {
			return callback(null, output);
		}

		var cur = input.shift();
		fs.readFile(cur, {encoding: 'utf8'}, function(err, content) {
			if (err) {
				return callback(err);
			}

			output.push({
				file: cur,
				content: content
			});
			next();
		});
	};
	next();
}

function absPath(p, options) {
	options = options || {};
	var cwd = options.cwd || process.cwd();
	return path.normalize(path.join(cwd, p));
}

function absPathList(list, options) {
	options = options || {cwd: process.cwd()};
	return list.map(function(p) {
		return absPath(p, options);
	});
}

/**
 * Резолвит ссылку на файл и возвращает его содержимое. Если передан
 * `Buffer`, то считаем, что передали само содержиоме файла и просто 
 * преобразуем его в строку.
 * Также можно указать массив — ссылок или содержимого файлов – который
 * также будет преобразован
 * @param {Object} f Путь к файлу либо содержимое файла (Buffer)
 * @param {Function} callback 
 */
function resolveFile(f, options, callback) {
	if (!Array.isArray(f)) {
		f = [f];
	}

	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	var input = f.slice(0);
	var output = [];
	var next = function() {
		if (!input.length) {
			return callback(null, output);
		}

		var cur = input.shift();
		if (cur instanceof Buffer) {
			output.push({
				file: null,
				content: cur.toString()
			});
			return next();
		}

		glob(cur, options, function(err, result) {
			if (err) {
				return callback(err);
			}

			readFileList(absPathList(result, options), function(err, content) {
				if (err) {
					return callback(err);
				}
				output = output.concat(content);
				next();
			});
		});
	};

	next();
}

/**
 * Готовим набор XSL-файлов, через который будем проводить трансформации:
 * резолвим пути, читаем файлы и преобразуем их в закэшированные
 * объекты, которые можно многократно применять к файлам
 * @param  {Object}   xsl      Набор путей к XSL-файлам или сами файлы
 * @param  {Object}   options  Дополнительные опции для резолвинга путей к XSL
 * @param  {Function} callback 
 */
function prepareXsl(xsl, options, callback) {
	resolveFile(xsl, options, function(err, result) {
		if (err) {
			return callback(err);
		}

		result = result.map(function(item) {
			item.doc = preprocessor.transform(item.content);
			item.doc = xslt.readXsltString(item.doc);
			return item;
		});

		callback(null, result);
	});
}

/**
 * Готовим набор HTML-файлов к преобразованию: резолвим пути,
 * читаем файлы, применяем препроцессинг (если надо) и возвращаем
 * содержимое файлов в виде валидного XML
 * @param  {Object}   html     Набор путей к HTML-файлам или сами файлы
 * @param  {Object}   options  Дополнительные опции для поиска и преобразования HTML-файлов
 * @param  {Function} callback
 */
function prepareHtml(html, options, callback) {
	resolveFile(html, options, function(err, input) {
		if (err) {
			return callback(err);
		}

		var output = [];
		var next = function() {
			if (!input.length) {
				return callback(null, output.map(function(item) {
					item.content = strinfigyDom(item.content);
					return item;
				}));
			}

			var cur = input.shift();
			var dom = parseDoc(cur.content);
			output.push({
				file: cur.file,
				content: dom
			});

			if (options.process) {
				if (options.process.length > 1) {
					return options.process(dom, next);
				}
				options.process(dom);
			}
			next();
		};

		next();
	});
}

module.exports = {
	transform: function(html, xsl, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		prepareXsl(xsl, options, function(err, xslList) {
			if (err) {
				return callback(err);
			}

			prepareHtml(html, options, function(err, docList) {
				if (err) {
					return callback(err);
				}

				callback(null, docList.map(function(item) {
					var out = item.content;
					xslList.forEach(function(xslItem) {
						out = xslt.transform(xslItem.doc, xslt.readXmlString(out), []);
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
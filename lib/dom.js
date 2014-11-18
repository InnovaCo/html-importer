/**
 * Вспомогательные методы для работы с DOM
 */
var htmlparser = require('htmlparser2');
var DomHandler = require('domhandler');
var serializer = require('./serializer');

var defaultOptions = {
	xhtmlMode: true,
	parseCustomScript: true
	// decodeEntities: true
};

function makeOptions(options) {
	return extend({}, defaultOptions, options);
}

function extend(obj) {
	for (var i = 1, il = arguments.length, a; i < il; i++) {
		a = arguments[i];
		if (!a) {
			continue;
		}

		Object.keys(a).forEach(function(key) {
			obj[key] = a[key];
		});
	}
	return obj;
}

function walk(nodes, fn) {
	if (!nodes) return;
	nodes.forEach(function(node, i) {
		fn(node, i);
		walk(node.children, fn);
	});
}

function parseScriptContent(node, parser, handler) {
	for (var i = node.children.length - 1, c; i >= 0; i--) {
		c = node.children[i];
		if (c.type === 'text') {
			parser.reset();
			parser.write(c.data);
			parser.done();
			Array.prototype.splice.apply(node.children, [i, 1].concat(handler.dom));
		}
	}
}

module.exports = {
	/**
	 * Парсит указанный XML/HTML документ в DOM
	 * @param  {String} code Содержимое документа, которое нужно распарсить
	 * @return {Object}      DOM-дерево документа
	 */
	parse: function(code, options) {
		options = makeOptions(options);
		var handler = new DomHandler();
		var parser = new htmlparser.Parser(handler, options);
		parser.write(this.sanitize(code));
		parser.done();
		var result = handler.dom;
		parser.reset();

		if (options.parseCustomScript) {
			walk(result, function(node) {
				if (node.name === 'script' || node.name === 'SCRIPT') {
					if (node.attribs.type && node.attribs.type.toLowerCase() !== 'text/javascript') {
						parseScriptContent(node, parser, handler);
					}
				}
			});
		}
		return result;
	},

	/**
	 * Делает строковое представление указанного DOM-дерева
	 * @param  {Object} dom
	 * @return {String}
	 */
	stringify: function(dom, options) {
		return serializer(dom, makeOptions(options));
	},

	/**
	 * Очищаем код от символов, которые могут навредить парсингу
	 * @param  {String} str
	 * @return {String}
	 */
	sanitize: function(str) {
		return str
			.replace(/[\x00-\x08]/g, '')
			.replace(/&(?!([a-z0-9]+|#x?\d+);)/g, '&amp;');
	}
};
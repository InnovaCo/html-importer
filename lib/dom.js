/**
 * Вспомогательные методы для работы с DOM
 */
var htmlparser = require('htmlparser2');
var DomHandler = require('domhandler');
var serializer = require('./serializer');

var defaultOptions = {
	xhtmlMode: true
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

module.exports = {
	/**
	 * Парсит указанный XML/HTML документ в DOM
	 * @param  {String} code Содержимое документа, которое нужно распарсить
	 * @return {Object}      DOM-дерево документа
	 */
	parse: function(code, options) {
		var handler = new DomHandler();
		var parser = new htmlparser.Parser(handler, makeOptions(options));
		parser.write(this.sanitize(code));
		parser.done();
		return handler.dom;
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
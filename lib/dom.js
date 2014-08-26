/**
 * Вспомогательные методы для работы с DOM
 */
var htmlparser = require('htmlparser2');
var DomHandler = require('domhandler');
var DomUtils = require('domutils');

module.exports = {
	/**
	 * Парсит указанный XML/HTML документ в DOM
	 * @param  {String} code Содержимое документа, которое нужно распарсить
	 * @return {Object}      DOM-дерево документа
	 */
	parse: function(code, options) {
		var handler = new DomHandler();
		var parser = new htmlparser.Parser(handler, options);
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
		options = options || {xmlMode: true};
		return dom.map(function(node) {
			return DomUtils.getOuterHTML(node, options);
		}).join('');
	},

	/**
	 * Очищаем код от символов, которые могут навредить парсингу
	 * @param  {String} str
	 * @return {String}
	 */
	sanitize: function(str) {
		return str.replace(/&(?![a-z0-9]+;)/g, '&amp;');
	}
};
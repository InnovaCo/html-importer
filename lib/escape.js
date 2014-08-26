/**
 * Препроцессор, который эскейпит содеримое некоторых тэгов, чтобы 
 * оно не испортилось во время XSL-трансформации
 */

var escapeTags = ['script', 'style'];

function findNodes(dom, tags, out) {
	out = out || [];
	dom.forEach(function(node) {
		if (~tags.indexOf(node.name)) {
			out.push(node);
		}
		if (node.children) {
			findNodes(node.children, tags, out);
		}
	});

	return out;
}

module.exports = function(tags) {
	return function(dom) {
		findNodes(dom, tags || escapeTags).forEach(function(node) {
			node.children.forEach(function(child) {
				if (child.type === 'text') {
					// XXX замена &amp; на & — опасное преобразование, так как 
					// может затронуть энтити, которые должны остаться как &amp;.
					// Но проблема в том, что если не экранировать все «неправильные» 
					// символы & (см. модуль ./dom), во время парсинга потеряются энтити,
					// что гораздо опаснее, чем замена всех &amp;. 
					// Так что оставляем эту замену пока не придумем более элегантное решение
					child.data = '<![CDATA[' + child.data.replace(/&amp;/g, '&') + ']]>';
				}
			});
		});
	};
}
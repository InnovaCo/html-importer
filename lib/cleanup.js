/**
 * Удаляет некоторые атрибуты из DOM-дерева.
 * Атрибуты, которые потенциально могут помешать XSL-трансформации
 */
function walk(nodes, fn) {
	nodes.forEach(function(node) {
		fn(node);
		if (node.children) {
			walk(node.children, fn);
		}
	});
}

function removeAttrs(node) {
	if (node && node.attribs) {
		var attrs = node.attribs;
		if (attrs.xmlns == 'http://www.w3.org/1999/html') {
			delete attrs.xmlns;
		}
	}
}

module.exports = function() {
	return function(dom) {
		walk(dom, removeAttrs);
	};
};
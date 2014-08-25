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
					child.data = '<![CDATA[' + child.data + ']]>';
				}
			});
		});
	};
}